import type { FastifyInstance } from "fastify";
import { prisma } from "../database/client.js";
import { PersistentPresentationStore } from "../presentation/persistentStore.js";
import { injectLiveEvent } from "./events.js";

const store = process.env.DATABASE_URL ? new PersistentPresentationStore(prisma, injectLiveEvent) : null;

function requireStore() {
  if (!store) throw new Error("database persistence is not configured");
  return store;
}

export async function catalogRoutes(app: FastifyInstance) {
  app.get("/channels", async (_request, reply) => {
    if (!store) return reply.status(503).send({ error: "database persistence is not configured" });
    return prisma.channel.findMany({ select: { id: true, name: true, slug: true, status: true }, orderBy: { name: "asc" } });
  });
  app.get<{ Params: { channelId: string } }>("/channels/:channelId", async (request, reply) => {
    if (!store) return reply.status(503).send({ error: "database persistence is not configured" });
    const channel = await prisma.channel.findUnique({ where: { id: request.params.channelId }, select: { id: true, name: true, slug: true, status: true, publishedRevision: true } });
    return channel ?? reply.status(404).send({ error: "channel not found" });
  });
  app.get<{ Params: { channelId: string } }>("/channels/:channelId/productions", async (request, reply) => {
    if (!store) return reply.status(503).send({ error: "database persistence is not configured" });
    return prisma.production.findMany({ where: { channelId: request.params.channelId }, select: { id: true, title: true, status: true, scheduledStart: true, scheduledEnd: true }, orderBy: { createdAt: "asc" } });
  });
  app.get<{ Params: { productionId: string } }>("/productions/:productionId", async (request, reply) => {
    if (!store) return reply.status(503).send({ error: "database persistence is not configured" });
    const production = await prisma.production.findUnique({ where: { id: request.params.productionId }, select: { id: true, channelId: true, title: true, description: true, status: true, scheduledStart: true, scheduledEnd: true } });
    return production ?? reply.status(404).send({ error: "production not found" });
  });
  app.get<{ Params: { productionId: string } }>("/productions/:productionId/rundowns", async (request, reply) => {
    if (!store) return reply.status(503).send({ error: "database persistence is not configured" });
    return prisma.rundown.findMany({ where: { productionId: request.params.productionId }, select: { id: true, name: true, version: true, updatedAt: true }, orderBy: { createdAt: "asc" } });
  });
  app.get<{ Params: { rundownId: string } }>("/rundowns/:rundownId", async (request, reply) => {
    if (!store) return reply.status(503).send({ error: "database persistence is not configured" });
    const rundown = await prisma.rundown.findUnique({ where: { id: request.params.rundownId }, include: { cues: { orderBy: { position: "asc" } } } });
    return rundown ?? reply.status(404).send({ error: "rundown not found" });
  });
  app.get<{ Params: { channelId: string }; Querystring: { status?: string } }>("/channels/:channelId/presentation/outbox", async (request, reply) => {
    if (!store) return reply.status(503).send({ error: "database persistence is not configured" });
    return requireStore().outbox(request.params.channelId, request.query.status);
  });
  app.post<{ Params: { channelId: string; outboxId: string } }>("/channels/:channelId/presentation/outbox/:outboxId/retry", async (request, reply) => {
    try { return reply.status(200).send(await requireStore().retry(request.params.channelId, request.params.outboxId)); }
    catch (error) { return reply.status(409).send({ error: error instanceof Error ? error.message : "unable to retry command" }); }
  });
  app.post<{ Params: { channelId: string; outboxId: string } }>("/channels/:channelId/presentation/outbox/:outboxId/cancel", async (request, reply) => {
    try { return reply.status(200).send(await requireStore().cancel(request.params.channelId, request.params.outboxId)); }
    catch (error) { return reply.status(409).send({ error: error instanceof Error ? error.message : "unable to cancel command" }); }
  });
}
