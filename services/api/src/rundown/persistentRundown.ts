import { type Prisma, type PrismaClient } from "@prisma/client";
import type { PresentationCommandPayload, ShowGatherEvent } from "@showgather/event-schema";
import { createEvent, dispatchLiveEvent, retryLiveEvent } from "../routes/events.js";
import { dispatchRehearsalEvent } from "../routes/rehearsal.js";

export type RundownTarget = "live" | "rehearsal";
type CueStatus = "pending" | "active" | "complete" | "failed" | "cancelled";
const DEFAULT_RUNDOWN_ID = process.env.SHOWGATHER_RUNDOWN_ID ?? "showgather-v1-demonstration";

interface PersistedCue { id: string; label: string; position: number; commandPayload: unknown; enabled: boolean; }
interface RundownSnapshot { cues: PersistedCue[]; }
interface CueView { id: string; label: string; order: number; command: PresentationCommandPayload; enabled: boolean; status: CueStatus; executionId?: string; error?: string; }

export class PersistentRundown {
  constructor(private readonly db: PrismaClient) {}

  async snapshot(target: RundownTarget, rundownId = DEFAULT_RUNDOWN_ID) {
    const rundown = await this.db.rundown.findUniqueOrThrow({ where: { id: rundownId }, include: { cues: { orderBy: { position: "asc" } }, production: true } });
    const session = await this.db.rundownExecutionSession.findFirst({ where: { rundownId: rundown.id, mode: target, status: "active" }, orderBy: { startedAt: "desc" }, include: { cues: true } });
    const executions = new Map(session?.cues.map((execution) => [execution.rundownCueId, execution]) ?? []);
    const cues = this.sessionSnapshot(session?.rundownSnapshot)?.cues ?? rundown.cues;
    return {
      target,
      rundownId: rundown.id,
      productionId: rundown.productionId,
      sessionId: session?.id,
      cues: cues.map((cue) => this.view(cue, executions.get(cue.id))),
    };
  }

  async go(target: RundownTarget, cueId: string, rerun = false, rundownId = DEFAULT_RUNDOWN_ID) {
    const rundown = await this.db.rundown.findUniqueOrThrow({ where: { id: rundownId }, include: { cues: true } });
    const session = await this.session(rundown.id, rundown.productionId, target, rundown.cues);
    const cue = this.sessionSnapshot(session.rundownSnapshot)?.cues.find((candidate) => candidate.id === cueId) ?? rundown.cues.find((candidate) => candidate.id === cueId);
    if (!cue || !cue.enabled) throw new Error("cue not found or disabled");
    const previous = await this.db.rundownCueExecution.findFirst({ where: { sessionId: session.id, rundownCueId: cue.id }, orderBy: { createdAt: "desc" } });
    if (previous?.status === "dispatched" && !rerun) return { ...(await this.snapshot(target, rundownId)), eventId: previous.executionId, duplicate: true };
    if (previous?.status === "accepted" && !rerun) return { ...(await this.snapshot(target, rundownId)), eventId: previous.executionId, duplicate: true };
    if (previous?.status === "failed" && !rerun && target === "live") {
      const result = await retryLiveEvent(previous.executionId);
      const retryError = (result.injectionResponse as { error?: string }).error ?? "dispatch failed";
      await this.db.rundownCueExecution.update({ where: { id: previous.id }, data: result.status === "dispatched" ? { status: "dispatched", revision: result.revision, executedAt: new Date(), error: null } : { status: result.status === "cancelled" ? "cancelled" : "failed", error: retryError } });
      return { ...(await this.snapshot(target, rundownId)), event: result.event, dispatchStatus: result.status };
    }

    const executionId = rerun || !previous ? `run-${target}-${cue.id}-${rerun ? Date.now() : "initial"}` : previous.executionId;
    const created = createEvent({ command: cue.commandPayload as PresentationCommandPayload });
    if ("error" in created) throw new Error(created.error);
    const event = { ...created.event, id: executionId } as ShowGatherEvent;
    const execution = await this.db.rundownCueExecution.upsert({
      where: { executionId },
      update: { status: "accepted", error: null },
      create: { sessionId: session.id, rundownCueId: cue.id, executionId, status: "accepted" },
    });

    if (target === "rehearsal") {
      const result = dispatchRehearsalEvent(event);
      await this.db.rundownCueExecution.update({ where: { id: execution.id }, data: { status: "dispatched", executedAt: new Date() } });
      return { ...(await this.snapshot(target, rundownId)), event: result.event };
    }

    const result = await dispatchLiveEvent(event, "rundown", executionId);
    if (result.status === "dispatched") {
      await this.db.rundownCueExecution.update({ where: { id: execution.id }, data: { status: "dispatched", revision: result.revision, executedAt: new Date(), error: null } });
    } else if (result.status === "failed") {
      await this.db.rundownCueExecution.update({ where: { id: execution.id }, data: { status: "failed", error: String((result.injectionResponse as { error?: string }).error ?? "dispatch failed") } });
    }
    return { ...(await this.snapshot(target, rundownId)), event: result.event, dispatchStatus: result.status };
  }

  async startSession(target: RundownTarget, rundownId = DEFAULT_RUNDOWN_ID) {
    const rundown = await this.db.rundown.findUniqueOrThrow({ where: { id: rundownId }, include: { cues: { orderBy: { position: "asc" } } } });
    await this.db.rundownExecutionSession.updateMany({ where: { rundownId, mode: target, status: "active" }, data: { status: "complete", completedAt: new Date() } });
    const session = await this.db.rundownExecutionSession.create({ data: { rundownId, productionId: rundown.productionId, mode: target, status: "active", rundownSnapshot: this.createSnapshot(rundown.cues) as unknown as Prisma.InputJsonValue } });
    return { ...(await this.snapshot(target, rundownId)), sessionId: session.id };
  }

  async endSession(target: RundownTarget, sessionId: string, outcome: "complete" | "abandoned", rundownId = DEFAULT_RUNDOWN_ID) {
    const session = await this.db.rundownExecutionSession.findFirst({ where: { id: sessionId, rundownId, mode: target, status: "active" } });
    if (!session) throw new Error("active execution session not found");
    await this.db.rundownExecutionSession.update({ where: { id: session.id }, data: { status: outcome, completedAt: new Date() } });
    return this.snapshot(target, rundownId);
  }

  private async session(rundownId: string, productionId: string, mode: RundownTarget, cues: PersistedCue[]) {
    const current = await this.db.rundownExecutionSession.findFirst({ where: { rundownId, mode, status: "active" }, orderBy: { startedAt: "desc" } });
    return current ?? this.db.rundownExecutionSession.create({ data: { rundownId, productionId, mode, status: "active", rundownSnapshot: this.createSnapshot(cues) as unknown as Prisma.InputJsonValue } });
  }

  private createSnapshot(cues: PersistedCue[]): RundownSnapshot { return { cues: cues.map((cue) => ({ id: cue.id, label: cue.label, position: cue.position, enabled: cue.enabled, commandPayload: cue.commandPayload })) }; }
  private sessionSnapshot(value: unknown): RundownSnapshot | null {
    if (!value || typeof value !== "object" || !Array.isArray((value as { cues?: unknown }).cues)) return null;
    const cues = (value as { cues: unknown[] }).cues;
    if (!cues.every((cue) => typeof cue === "object" && cue !== null && typeof (cue as PersistedCue).id === "string" && typeof (cue as PersistedCue).label === "string" && typeof (cue as PersistedCue).position === "number" && typeof (cue as PersistedCue).enabled === "boolean")) return null;
    return { cues: cues as PersistedCue[] };
  }

  private view(cue: PersistedCue, execution?: { status: string; executionId: string; error: string | null }): CueView {
    const status: CueStatus = execution?.status === "dispatched" ? "complete" : execution?.status === "accepted" ? "active" : execution?.status === "failed" ? "failed" : execution?.status === "cancelled" ? "cancelled" : "pending";
    return { id: cue.id, label: cue.label, order: cue.position, command: cue.commandPayload as PresentationCommandPayload, enabled: cue.enabled, status, ...(execution ? { executionId: execution.executionId } : {}), ...(execution?.error ? { error: execution.error } : {}) };
  }
}
