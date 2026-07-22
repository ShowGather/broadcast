import Fastify from "fastify";
import cors from "@fastify/cors";
import { eventRoutes, injectorReachable } from "./routes/events.js";
import { measurementRoutes } from "./routes/measurements.js";
import { rehearsalRoutes } from "./routes/rehearsal.js";
import { rundownRoutes } from "./routes/rundown.js";
import { catalogRoutes } from "./routes/catalog.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors);
  await app.register(eventRoutes, { prefix: "/api" });
  await app.register(measurementRoutes, { prefix: "/api" });
  await app.register(rehearsalRoutes, { prefix: "/api" });
  await app.register(rundownRoutes, { prefix: "/api" });
  await app.register(catalogRoutes, { prefix: "/api" });

  app.get("/api/health", async () => ({
    status: "ok",
    uptime: process.uptime(),
  }));
  app.get("/api/status", async () => ({ api: "connected", stream: await injectorReachable() ? "connected" : "offline" }));

  return app;
}
