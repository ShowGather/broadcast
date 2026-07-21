import type { FastifyInstance } from "fastify";
import {
  generateEventId,
  encodeEvent,
  type ShowGatherEvent,
} from "@showgather/event-schema";
import { encodeTpe1Frame } from "@showgather/id3";

const INJECTOR_HOST = process.env.ID3_INJECTOR_HOST ?? "localhost";
const INJECTOR_PORT = process.env.ID3_INJECTOR_PORT ?? "8080";
const INJECTOR_URL = `http://${INJECTOR_HOST}:${INJECTOR_PORT}/inject`;

interface StoredEvent {
  event: ShowGatherEvent;
  injectedAt: string;
  injectionResponse: unknown;
}

const events: StoredEvent[] = [];

export async function eventRoutes(app: FastifyInstance) {
  app.post<{
    Body: { title?: string; message?: string; durationMs?: number };
  }>("/events", async (request, reply) => {
    const { title, message, durationMs } = request.body ?? {};

    if (typeof title !== "string" || title.trim().length === 0) {
      return reply.status(400).send({ error: "title must be a non-empty string" });
    }
    if (typeof durationMs !== "number" || durationMs <= 0) {
      return reply.status(400).send({ error: "durationMs must be a positive number" });
    }

    const event: ShowGatherEvent = {
      v: 1,
      id: generateEventId(),
      t: "overlay.show",
      p: {
        title: title.trim(),
        ...(message != null && message.length > 0 ? { msg: message } : {}),
        dur: durationMs,
      },
    };

    const json = encodeEvent(event);
    const id3Bytes = encodeTpe1Frame(json);
    const id3Base64 = Buffer.from(id3Bytes).toString("base64");

    const injectorResponse = await fetch(INJECTOR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id3_base64: id3Base64 }),
    });

    const injectionResult = await injectorResponse.json();

    const stored: StoredEvent = {
      event,
      injectedAt: new Date().toISOString(),
      injectionResponse: injectionResult,
    };

    events.push(stored);

    return reply.status(201).send(stored);
  });

  app.get("/events", async () => events);
}
