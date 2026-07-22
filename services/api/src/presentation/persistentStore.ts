import type { PrismaClient, Prisma } from "@prisma/client";
import type { ShowGatherEvent } from "@showgather/event-schema";
import type { PresentationSnapshot } from "@showgather/presentation-model";
import { applyPersistentEvent, eventChangesPersistentState } from "./channelState.js";

export type DispatchStatus = "pending" | "dispatched" | "failed" | "cancelled";
export interface AcceptedPresentationCommand {
  event: ShowGatherEvent;
  channelId: string;
  revision?: number;
  status: DispatchStatus;
  error?: string;
}

type Injector = (event: ShowGatherEvent) => Promise<unknown>;
const DEFAULT_CHANNEL_SLUG = process.env.SHOWGATHER_CHANNEL_SLUG ?? "demo-channel";

/** PostgreSQL-backed durable command/outbox path. Rehearsal deliberately does not use it. */
export class PersistentPresentationStore {
  private dispatchTail: Promise<void> = Promise.resolve();

  constructor(private readonly db: PrismaClient, private readonly inject: Injector) {}

  async snapshot(channelSlug = DEFAULT_CHANNEL_SLUG): Promise<PresentationSnapshot> {
    const channel = await this.channel(channelSlug);
    const snapshot = await this.db.presentationSnapshot.findUniqueOrThrow({ where: { channelId: channel.id } });
    return { revision: snapshot.revision, state: snapshot.state as unknown as PresentationSnapshot["state"] };
  }

  async accept(event: ShowGatherEvent, source = "direct-control", executionId?: string, channelSlug = DEFAULT_CHANNEL_SLUG): Promise<AcceptedPresentationCommand> {
    const channel = await this.channel(channelSlug);
    const existing = await this.db.presentationCommand.findUnique({ where: { eventId: event.id } });
    if (existing) return this.commandResult(existing, channel.id);

    if (!eventChangesPersistentState(event, 1)) {
      await this.inject(event);
      await this.db.presentationCommand.create({ data: {
        eventId: event.id, executionId, channelId: channel.id, commandType: event.t,
        commandPayload: event.p as Prisma.InputJsonValue, event: event as unknown as Prisma.InputJsonValue,
        transport: "id3", source, status: "dispatched", dispatchedAt: new Date(),
      } });
      return { event, channelId: channel.id, status: "dispatched" };
    }

    const accepted = await this.db.$transaction(async (tx) => {
      const duplicate = await tx.presentationCommand.findUnique({ where: { eventId: event.id } });
      if (duplicate) return duplicate;
      const updated = await tx.channel.update({ where: { id: channel.id }, data: { nextRevision: { increment: 1 } }, select: { nextRevision: true } });
      const revised = { ...event, r: updated.nextRevision } as ShowGatherEvent;
      const command = await tx.presentationCommand.create({ data: {
        eventId: revised.id, executionId, channelId: channel.id, revision: revised.r, commandType: revised.t,
        commandPayload: revised.p as Prisma.InputJsonValue, event: revised as unknown as Prisma.InputJsonValue,
        transport: "id3", source, status: "accepted",
      } });
      await tx.presentationOutbox.create({ data: { commandId: command.id, channelId: channel.id, revision: revised.r!, event: revised as unknown as Prisma.InputJsonValue } });
      return command;
    });

    await this.dispatch(channel.id);
    const command = await this.db.presentationCommand.findUniqueOrThrow({ where: { id: accepted.id } });
    return this.commandResult(command, channel.id);
  }

  async outbox(channelId: string, status?: string) {
    const rows = await this.db.presentationOutbox.findMany({
      where: { channelId, ...(status ? { status: status === "pending" ? "pending" : status } : {}) },
      include: { command: true }, orderBy: { revision: "asc" },
    });
    return rows.map((row) => ({
      id: row.id, eventId: row.command.eventId, revision: row.revision,
      label: labelForEvent(row.command.event as unknown as ShowGatherEvent),
      status: externalStatus(row.status), attempts: row.attempts,
      ...(row.lastError ? { error: row.lastError } : {}),
      retryable: row.status === "failed", cancellable: row.status === "failed",
      createdAt: row.createdAt, dispatchedAt: row.dispatchedAt,
    }));
  }

  async retry(channelId: string, outboxId: string): Promise<AcceptedPresentationCommand> {
    const outbox = await this.db.presentationOutbox.findFirstOrThrow({ where: { id: outboxId, channelId }, include: { command: true } });
    if (outbox.status !== "failed") throw new Error("only failed commands can be retried");
    await this.db.$transaction([
      this.db.presentationOutbox.update({ where: { id: outbox.id }, data: { status: "pending", lastError: null } }),
      this.db.presentationCommand.update({ where: { id: outbox.commandId }, data: { status: "accepted", dispatchError: null } }),
    ]);
    await this.dispatch(channelId);
    return this.commandResult(await this.db.presentationCommand.findUniqueOrThrow({ where: { id: outbox.commandId } }), channelId);
  }

  async cancel(channelId: string, outboxId: string): Promise<AcceptedPresentationCommand> {
    const outbox = await this.db.presentationOutbox.findFirstOrThrow({ where: { id: outboxId, channelId }, include: { command: true } });
    if (outbox.status !== "failed") throw new Error("only failed commands can be cancelled");
    const cancellation: ShowGatherEvent = { v: 1, id: `cancel-${outbox.id}`, r: outbox.revision, t: "pc", p: { k: "noop" } };
    await this.db.$transaction([
      this.db.presentationOutbox.update({ where: { id: outbox.id }, data: { status: "cancelling", event: cancellation as unknown as Prisma.InputJsonValue, lastError: null } }),
      this.db.presentationCommand.update({ where: { id: outbox.commandId }, data: { status: "cancelling", dispatchError: null } }),
    ]);
    await this.dispatch(channelId);
    return this.commandResult(await this.db.presentationCommand.findUniqueOrThrow({ where: { id: outbox.commandId } }), channelId);
  }

  /** Serialises one API process and refuses to skip an unresolved durable revision. */
  private async dispatch(channelId: string): Promise<void> {
    const operation = this.dispatchTail.then(async () => {
      for (;;) {
      const next = await this.db.presentationOutbox.findFirst({ where: { channelId, status: { in: ["pending", "cancelling", "dispatching", "failed"] } }, orderBy: { revision: "asc" }, include: { command: true } });
      if (!next || next.status === "failed" || next.status === "dispatching") return;
      const claimed = await this.db.presentationOutbox.updateMany({ where: { id: next.id, status: next.status }, data: { status: "dispatching", attempts: { increment: 1 }, lastError: null } });
      if (claimed.count === 0) return;
      try {
        await this.inject(next.event as unknown as ShowGatherEvent);
      } catch (error) {
        const message = error instanceof Error ? error.message : "injector dispatch failed";
        await this.db.$transaction([
          this.db.presentationOutbox.update({ where: { id: next.id }, data: { status: "failed", lastError: message } }),
          this.db.presentationCommand.update({ where: { id: next.commandId }, data: { status: "failed", dispatchError: message } }),
        ]);
        return;
      }

      await this.finalise(next.id);
      }
    });
    this.dispatchTail = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async finalise(outboxId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const outbox = await tx.presentationOutbox.findUniqueOrThrow({ where: { id: outboxId }, include: { command: true } });
      if (outbox.status === "dispatched") return;
      const snapshot = await tx.presentationSnapshot.findUniqueOrThrow({ where: { channelId: outbox.channelId } });
      if (snapshot.revision !== outbox.revision - 1) throw new Error(`cannot publish revision ${outbox.revision} after ${snapshot.revision}`);
      const event = outbox.event as unknown as ShowGatherEvent;
      const state = applyPersistentEvent(snapshot.state as unknown as PresentationSnapshot["state"], event, outbox.revision);
      const publishedAt = new Date();
      await tx.presentationSnapshot.update({ where: { id: snapshot.id }, data: { revision: outbox.revision, state: state as unknown as Prisma.InputJsonValue } });
      await tx.channel.update({ where: { id: outbox.channelId }, data: { publishedRevision: outbox.revision } });
      const cancelled = event.t === "pc" && event.p.k === "noop";
      await tx.presentationOutbox.update({ where: { id: outbox.id }, data: { status: cancelled ? "cancelled" : "dispatched", injectorAcceptedAt: publishedAt, dispatchedAt: publishedAt } });
      await tx.presentationCommand.update({ where: { id: outbox.commandId }, data: { status: cancelled ? "cancelled" : "dispatched", dispatchedAt: publishedAt, dispatchError: null } });
    });
  }

  private async channel(slug = DEFAULT_CHANNEL_SLUG) {
    return this.db.channel.findUniqueOrThrow({ where: { slug } });
  }

  private commandResult(command: { event: unknown; revision: number | null; status: string; dispatchError: string | null }, channelId: string): AcceptedPresentationCommand {
    return { event: command.event as ShowGatherEvent, channelId, revision: command.revision ?? undefined, status: externalStatus(command.status), ...(command.dispatchError ? { error: command.dispatchError } : {}) };
  }
}

function externalStatus(status: string): DispatchStatus {
  return status === "dispatched" || status === "failed" || status === "cancelled" ? status : "pending";
}

function labelForEvent(event: ShowGatherEvent): string {
  if (event.t === "pc") return event.p.k === "noop" ? "Cancellation resolution" : `${event.p.k} command`;
  return event.t;
}
