import type { FastifyInstance } from "fastify";
import {
  generateEventId,
  encodeEvent,
  isPresentationCueKey,
  type PresentationCueKey,
  type ShowGatherEvent,
} from "@showgather/event-schema";
import { encodeTpe1Frame } from "@showgather/id3";
import { ChannelPresentationState } from "../presentation/channelState.js";

const INJECTOR_HOST = process.env.ID3_INJECTOR_HOST ?? "localhost";
const INJECTOR_PORT = process.env.ID3_INJECTOR_PORT ?? "8080";
const INJECTOR_URL = `http://${INJECTOR_HOST}:${INJECTOR_PORT}/inject`;

export interface EventRequest {
  title?: string;
  message?: string;
  durationMs?: number;
  cue?: PresentationCueKey;
  action?: "safe-clear";
}

interface StoredEvent {
  event: ShowGatherEvent;
  injectedAt: string;
  injectionResponse: unknown;
}

const events: StoredEvent[] = [];
const channelPresentation = new ChannelPresentationState();
// Preserve total order between revision assignment and the asynchronous injector.
let dispatchTail: Promise<void> = Promise.resolve();

export function createEvent(body: EventRequest): { event: ShowGatherEvent } | { error: string } {
  const { title, message, durationMs, cue, action } = body;

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
    const dispatch = dispatchTail.then(async () => {
      const event = channelPresentation.withRevision(created.event);
      const json = encodeEvent(event);
      const id3Bytes = encodeTpe1Frame(json);
      const id3Base64 = Buffer.from(id3Bytes).toString("base64");
      const injectorResponse = await fetch(INJECTOR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id3_base64: id3Base64 }),
      });
      const injectionResult = await injectorResponse.json();
      const stored: StoredEvent = { event, injectedAt: new Date().toISOString(), injectionResponse: injectionResult };
      events.push(stored);
      channelPresentation.apply(event);
      return stored;
    });
    dispatchTail = dispatch.then(() => undefined, () => undefined);
    const stored = await dispatch;

    return reply.status(201).send(stored);
  });

  app.get("/events", async () => events);
  app.get("/presentation/snapshot", async () => channelPresentation.snapshot());
}
