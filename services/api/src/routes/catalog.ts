import type { FastifyInstance } from "fastify";
import { prisma } from "../database/client.js";
import { PersistentPresentationStore } from "../presentation/persistentStore.js";
import { injectLiveEvent } from "./events.js";
import { ShowService } from "../show/showService.js";

const store = process.env.DATABASE_URL ? new PersistentPresentationStore(prisma, injectLiveEvent) : null;
const show = new ShowService(prisma);

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
    return prisma.production.findMany({ where: { channelId: request.params.channelId }, select: { id: true, title: true, status: true, scheduledStart: true, scheduledEnd: true, configuration: true, showConfigurationId: true }, orderBy: { createdAt: "asc" } });
  });
  app.post<{ Params: { channelId: string }; Body: import("../show/showService.js").ProductionInput }>("/channels/:channelId/productions", async (request, reply) => {
    try { return reply.status(201).send(await show.createProduction(request.params.channelId, request.body ?? {})); }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : "unable to create production" }); }
  });
  app.get<{ Params: { productionId: string } }>("/productions/:productionId", async (request, reply) => {
    if (!store) return reply.status(503).send({ error: "database persistence is not configured" });
    const production = await prisma.production.findUnique({ where: { id: request.params.productionId }, select: { id: true, channelId: true, title: true, description: true, status: true, scheduledStart: true, scheduledEnd: true, configuration: true, showConfigurationId: true } });
    return production ?? reply.status(404).send({ error: "production not found" });
  });
  app.put<{ Params: { productionId: string }; Body: import("../show/showService.js").ProductionInput }>("/productions/:productionId", async (request, reply) => {
    try { return reply.send(await show.updateProduction(request.params.productionId, request.body ?? {})); }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : "unable to update production" }); }
  });
  app.post<{ Params: { productionId: string } }>("/productions/:productionId/duplicate", async (request, reply) => {
    try { return reply.status(201).send(await show.duplicateProduction(request.params.productionId)); }
    catch (error) { return reply.status(404).send({ error: error instanceof Error ? error.message : "production not found" }); }
  });
  app.post<{ Params: { productionId: string }; Body: { configurationId?: string } }>("/productions/:productionId/copy-configuration", async (request, reply) => {
    try { return reply.send(await show.copyConfigurationIntoProduction(request.params.productionId, request.body?.configurationId ?? "")); }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : "unable to copy configuration" }); }
  });
  app.get<{ Params: { productionId: string } }>("/productions/:productionId/rundowns", async (request, reply) => {
    if (!store) return reply.status(503).send({ error: "database persistence is not configured" });
    return prisma.rundown.findMany({ where: { productionId: request.params.productionId }, select: { id: true, name: true, version: true, updatedAt: true }, orderBy: { createdAt: "asc" } });
  });
  app.post<{ Params: { productionId: string }; Body: import("../show/showService.js").RundownInput }>("/productions/:productionId/rundowns", async (request, reply) => {
    try { return reply.status(201).send(await show.createRundown(request.params.productionId, request.body ?? {})); }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : "unable to create rundown" }); }
  });
  app.get<{ Params: { rundownId: string } }>("/rundowns/:rundownId", async (request, reply) => {
    if (!store) return reply.status(503).send({ error: "database persistence is not configured" });
    const rundown = await prisma.rundown.findUnique({ where: { id: request.params.rundownId }, include: { cues: { orderBy: { position: "asc" } } } });
    return rundown ?? reply.status(404).send({ error: "rundown not found" });
  });
  app.put<{ Params: { rundownId: string }; Body: import("../show/showService.js").RundownInput }>("/rundowns/:rundownId", async (request, reply) => {
    try { return reply.send(await show.updateRundown(request.params.rundownId, request.body ?? {})); }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : "unable to update rundown" }); }
  });
  app.post<{ Params: { rundownId: string } }>("/rundowns/:rundownId/duplicate", async (request, reply) => {
    try { return reply.status(201).send(await show.duplicateRundown(request.params.rundownId)); }
    catch (error) { return reply.status(404).send({ error: error instanceof Error ? error.message : "rundown not found" }); }
  });
  app.post<{ Params: { rundownId: string }; Body: import("../show/showService.js").CueInput }>("/rundowns/:rundownId/cues", async (request, reply) => {
    try { return reply.status(201).send(await show.createCue(request.params.rundownId, request.body ?? {})); }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : "unable to create cue" }); }
  });
  app.post<{ Params: { rundownId: string }; Body: { cueIds?: unknown } }>("/rundowns/:rundownId/cues/reorder", async (request, reply) => {
    try { return reply.send(await show.reorder(request.params.rundownId, request.body?.cueIds)); }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : "unable to reorder cues" }); }
  });
  app.put<{ Params: { cueId: string }; Body: import("../show/showService.js").CueInput }>("/rundown-cues/:cueId", async (request, reply) => {
    try { return reply.send(await show.updateCue(request.params.cueId, request.body ?? {})); }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : "unable to update cue" }); }
  });
  app.get<{ Params: { channelId: string } }>("/channels/:channelId/show-configurations", async (request, reply) => {
    if (!store) return reply.status(503).send({ error: "database persistence is not configured" });
    return show.configurations(request.params.channelId);
  });
  app.post<{ Params: { channelId: string }; Body: { name?: unknown; configuration?: unknown } }>("/channels/:channelId/show-configurations", async (request, reply) => {
    try { return reply.status(201).send(await show.createConfiguration(request.params.channelId, request.body ?? {})); }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : "unable to create configuration" }); }
  });
  app.put<{ Params: { configurationId: string }; Body: { name?: unknown; configuration?: unknown } }>("/show-configurations/:configurationId", async (request, reply) => {
    try { return reply.send(await show.updateConfiguration(request.params.configurationId, request.body ?? {})); }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : "unable to update configuration" }); }
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
    try {
      const result = await requireStore().cancel(request.params.channelId, request.params.outboxId);
      const outbox = await prisma.presentationOutbox.findUnique({ where: { id: request.params.outboxId }, include: { command: true } });
      if (result.status === "cancelled" && outbox?.command.executionId) {
        await prisma.rundownCueExecution.updateMany({ where: { executionId: outbox.command.executionId }, data: { status: "cancelled", executedAt: new Date(), error: null } });
      }
      return reply.status(200).send(result);
    }
    catch (error) { return reply.status(409).send({ error: error instanceof Error ? error.message : "unable to cancel command" }); }
  });
}
