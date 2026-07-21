import Fastify from "fastify";
import cors from "@fastify/cors";
import { eventRoutes } from "./routes/events.js";
import { measurementRoutes } from "./routes/measurements.js";
import { rehearsalRoutes } from "./routes/rehearsal.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors);
  await app.register(eventRoutes, { prefix: "/api" });
  await app.register(measurementRoutes, { prefix: "/api" });
  await app.register(rehearsalRoutes, { prefix: "/api" });

  app.get("/api/health", async () => ({
    status: "ok",
    uptime: process.uptime(),
  }));

  return app;
}
