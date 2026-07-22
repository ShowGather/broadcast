import type { FastifyInstance } from "fastify";
import {
  generateEventId,
  encodeEvent,
  isPresentationCueKey,
  validatePresentationCommandPayload,
  type PresentationCueKey,
  type PresentationCommandPayload,
  type ShowGatherEvent,
} from "@showgather/event-schema";
import { encodeTpe1Frame } from "@showgather/id3";
import { ChannelPresentationState } from "../presentation/channelState.js";
import { prisma } from "../database/client.js";
import { PersistentPresentationStore } from "../presentation/persistentStore.js";

const INJECTOR_HOST = process.env.ID3_INJECTOR_HOST ?? "localhost";
const INJECTOR_PORT = process.env.ID3_INJECTOR_PORT ?? "8080";
const INJECTOR_URL = `http://${INJECTOR_HOST}:${INJECTOR_PORT}/inject`;

export interface EventRequest {
  title?: string;
  message?: string;
  durationMs?: number;
  cue?: PresentationCueKey;
  action?: "safe-clear";
  command?: PresentationCommandPayload;
}

export interface StoredEvent {
  event: ShowGatherEvent;
  injectedAt: string;
  injectionResponse: unknown;
  status?: "pending" | "dispatched" | "failed" | "cancelled";
  revision?: number;
}

const events: StoredEvent[] = [];
const channelPresentation = new ChannelPresentationState();
// Preserve total order between revision assignment and the asynchronous injector.
let dispatchTail: Promise<void> = Promise.resolve();
const persistentStore = process.env.DATABASE_URL ? new PersistentPresentationStore(prisma, injectLiveEvent) : null;

export async function injectLiveEvent(event: ShowGatherEvent): Promise<unknown> {
  const id3Base64 = Buffer.from(encodeTpe1Frame(encodeEvent(event))).toString("base64");
  const response = await fetch(INJECTOR_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id3_base64: id3Base64 }) });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`injector rejected event (${response.status})${body ? `: ${JSON.stringify(body)}` : ""}`);
  return body;
}

export async function dispatchLiveEvent(event: ShowGatherEvent, source = "direct-control", executionId?: string): Promise<StoredEvent> {
  if (persistentStore) {
    const result = await persistentStore.accept(event, source, executionId);
    const stored: StoredEvent = {
      event: result.event,
      injectedAt: new Date().toISOString(),
      injectionResponse: { status: result.status, ...(result.error ? { error: result.error } : {}) },
      status: result.status,
      ...(result.revision !== undefined ? { revision: result.revision } : {}),
    };
    events.push(stored);
    return stored;
  }
  const dispatch = dispatchTail.then(async () => {
    const revised = channelPresentation.withRevision(event);
    const injectorResponse = await injectLiveEvent(revised);
    const stored: StoredEvent = { event: revised, injectedAt: new Date().toISOString(), injectionResponse: injectorResponse, status: "dispatched", ...(revised.r !== undefined ? { revision: revised.r } : {}) };
    events.push(stored);
    channelPresentation.apply(revised);
    return stored;
  });
  dispatchTail = dispatch.then(() => undefined, () => undefined);
  return dispatch;
}

export function createEvent(body: EventRequest): { event: ShowGatherEvent } | { error: string } {
  const { title, message, durationMs, cue, action, command } = body;

  if (action === "safe-clear") {
    return { event: { v: 1, id: generateEventId(), t: "presentation.clear", p: {} } };
  }
  if (cue !== undefined) {
    if (!isPresentationCueKey(cue)) return { error: "cue must be a supported presentation cue" };
    if (durationMs !== undefined && (typeof durationMs !== "number" || durationMs <= 0)) {
      return { error: "durationMs must be a positive number when supplied" };
    }
    return { event: { v: 1, id: generateEventId(), t: "presentation.cue", p: { cue, ...(durationMs !== undefined ? { dur: durationMs } : {}) } } };
  }
  if (command !== undefined) {
    const payload = validatePresentationCommandPayload(command);
    if (payload === null) return { error: "command must be a supported compact presentation command" };
    return { event: { v: 1, id: generateEventId(), t: "pc", p: payload } };
  }
  if (typeof title !== "string" || title.trim().length === 0) return { error: "title must be a non-empty string" };
  if (typeof durationMs !== "number" || durationMs <= 0) return { error: "durationMs must be a positive number" };
  return {
    event: {
      v: 1, id: generateEventId(), t: "overlay.show",
      p: { title: title.trim(), ...(message != null && message.length > 0 ? { msg: message } : {}), dur: durationMs },
    },
  };
}

export async function eventRoutes(app: FastifyInstance) {
  app.post<{
    Body: EventRequest;
  }>("/events", async (request, reply) => {
    const created = createEvent(request.body ?? {});
    if ("error" in created) return reply.status(400).send({ error: created.error });
    const stored = await dispatchLiveEvent(created.event);

    return reply.status(201).send(stored);
  });

  app.get("/events", async () => events);
  app.get("/presentation/snapshot", async () => persistentStore ? persistentStore.snapshot() : channelPresentation.snapshot());
}
