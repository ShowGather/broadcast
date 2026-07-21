import type { FastifyInstance } from "fastify";

interface Measurement {
  eventId: string;
  metadataPts: number;
  parsedAtPlayerTime: number;
  renderedAtPlayerTime: number | null;
  performanceNowParsed: number;
  performanceNowRendered: number | null;
  deltaMs: number | null;
  receivedAt: string;
}

const measurements: Measurement[] = [];

function computeStats() {
  const deltas = measurements
    .filter((m) => m.deltaMs !== null)
    .map((m) => m.deltaMs as number)
    .sort((a, b) => a - b);

  const count = measurements.length;
  if (count === 0) {
    return { count: 0, rendered: 0, missed: 0, median: null, p95: null, min: null, max: null, mean: null };
  }

  const rendered = deltas.length;
  const missed = count - rendered;

  if (rendered === 0) {
    return { count, rendered, missed, median: null, p95: null, min: null, max: null, mean: null };
  }

  const median = deltas[Math.floor(deltas.length / 2)];
  const p95Index = Math.floor(deltas.length * 0.95);
  const p95 = deltas[Math.min(p95Index, deltas.length - 1)];
  const min = deltas[0];
  const max = deltas[deltas.length - 1];
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;

  return { count, rendered, missed, median, p95, min, max, mean };
}

export async function measurementRoutes(app: FastifyInstance) {
  app.post<{ Body: Measurement }>("/measurements", async (request, reply) => {
    const body = request.body;
    if (!body || typeof body.eventId !== "string" || typeof body.metadataPts !== "number") {
      return reply.status(400).send({ error: "Invalid measurement payload" });
    }

    const measurement: Measurement = {
      eventId: body.eventId,
      metadataPts: body.metadataPts,
      parsedAtPlayerTime: body.parsedAtPlayerTime ?? 0,
      renderedAtPlayerTime: body.renderedAtPlayerTime ?? null,
      performanceNowParsed: body.performanceNowParsed ?? 0,
      performanceNowRendered: body.performanceNowRendered ?? null,
      deltaMs: body.deltaMs ?? null,
      receivedAt: new Date().toISOString(),
    };

    measurements.push(measurement);

    return reply.status(201).send({ ok: true, total: measurements.length });
  });

  app.get("/measurements", async () => ({
    measurements,
    stats: computeStats(),
  }));

  app.get("/measurements/export", async () => ({
    exportedAt: new Date().toISOString(),
    stats: computeStats(),
    measurements,
  }));
}
