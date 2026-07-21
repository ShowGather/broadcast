import type { FastifyInstance } from "fastify";
import type { ServerResponse } from "node:http";
import { createEvent, type EventRequest } from "./events.js";

const clients = new Set<ServerResponse>();

/**
 * Development-only rehearsal channel. It never touches the ID3 injector; a
 * preview player explicitly opts in and schedules received events against its
 * own media clock.
 */
export async function rehearsalRoutes(app: FastifyInstance) {
  app.get("/rehearsal/stream", (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    reply.raw.write(": showgather rehearsal connected\n\n");
    clients.add(reply.raw);
    request.raw.on("close", () => clients.delete(reply.raw));
  });

  app.post<{ Body: EventRequest }>("/rehearsal/events", async (request, reply) => {
    const created = createEvent(request.body ?? {});
    if ("error" in created) return reply.status(400).send({ error: created.error });

    const payload = `data: ${JSON.stringify(created.event)}\n\n`;
    for (const client of clients) client.write(payload);
    return reply.status(201).send({ event: created.event, receivers: clients.size });
  });
}
