import type { FastifyInstance } from "fastify";
import type { PresentationCommandPayload, ShowGatherEvent } from "@showgather/event-schema";
import { createEvent, dispatchLiveEvent } from "./events.js";
import { dispatchRehearsalEvent } from "./rehearsal.js";
import { prisma } from "../database/client.js";
import { PersistentRundown } from "../rundown/persistentRundown.js";

type Target = "live" | "rehearsal";
type CueStatus = "pending" | "active" | "complete";
interface RundownCue { id: string; label: string; command: PresentationCommandPayload; }
interface CueState { status: CueStatus; executionId?: string; }

const cues: RundownCue[] = [
  { id: "score-opening", label: "Opening score", command: { k: "score", h: 0, a: 0, l: "KICK OFF" } },
  { id: "host-intro", label: "Host lower third", command: { k: "lower", t: "HOST NAME", s: "ShowGather Live", d: 8_000 } },
  { id: "goal-update", label: "Home goal", command: { k: "score", h: 1, a: 0, l: "GOAL" } },
  { id: "partner-takeover", label: "Partner takeover", command: { k: "sponsor", b: "Goal Partner", s: "Celebrating the moment", d: 8_000 } },
];
const states: Record<Target, Map<string, CueState>> = { live: new Map(), rehearsal: new Map() };
const persistentRundown = process.env.DATABASE_URL ? new PersistentRundown(prisma) : null;

function state(target: Target, cueId: string): CueState { return states[target].get(cueId) ?? { status: "pending" }; }
function snapshot(target: Target) { return { target, cues: cues.map((cue, index) => ({ ...cue, order: index + 1, ...state(target, cue.id) })) }; }

export async function rundownRoutes(app: FastifyInstance) {
  app.get<{ Params: { target: Target }; Querystring: { rundownId?: string } }>("/rundown/:target", async (request, reply) => {
    if (request.params.target !== "live" && request.params.target !== "rehearsal") return reply.status(400).send({ error: "target must be live or rehearsal" });
    if (persistentRundown) return persistentRundown.snapshot(request.params.target, request.query.rundownId);
    return snapshot(request.params.target);
  });
  app.post<{ Params: { target: Target }; Querystring: { rundownId?: string } }>("/rundown/:target/sessions", async (request, reply) => {
    const target = request.params.target;
    if (target !== "live" && target !== "rehearsal") return reply.status(400).send({ error: "target must be live or rehearsal" });
    if (!persistentRundown) return reply.status(503).send({ error: "database persistence is not configured" });
    try { return reply.status(201).send(await persistentRundown.startSession(target, request.query.rundownId)); }
    catch (error) { return reply.status(404).send({ error: error instanceof Error ? error.message : "unable to start execution session" }); }
  });
  app.post<{ Params: { target: Target }; Querystring: { rundownId?: string }; Body: { cueId?: string; rerun?: boolean } }>("/rundown/:target/go", async (request, reply) => {
    const target = request.params.target;
    if (target !== "live" && target !== "rehearsal") return reply.status(400).send({ error: "target must be live or rehearsal" });
    if (persistentRundown) {
      try {
        const result = await persistentRundown.go(target, request.body?.cueId ?? "", request.body?.rerun, request.query.rundownId);
        const dispatchStatus = "dispatchStatus" in result ? result.dispatchStatus : undefined;
        if (target === "live" && dispatchStatus === "failed") return reply.status(503).send(result);
        return reply.status(target === "live" && dispatchStatus === "pending" ? 202 : 201).send(result);
      } catch (error) {
        return reply.status(404).send({ error: error instanceof Error ? error.message : "unable to execute cue" });
      }
    }
    const cue = cues.find((candidate) => candidate.id === request.body?.cueId);
    if (!cue) return reply.status(404).send({ error: "cue not found" });
    const prior = state(target, cue.id);
    if (prior.status === "complete" && !request.body?.rerun) return reply.status(409).send({ error: "cue is complete; set rerun to true" });
    const executionId = prior.executionId ?? `run-${target}-${cue.id}`;
    if (prior.status === "active") return { ...snapshot(target), eventId: executionId, duplicate: true };
    const created = createEvent({ command: cue.command });
    if ("error" in created) return reply.status(400).send({ error: created.error });
    const event = { ...created.event, id: request.body?.rerun ? `${executionId}-rerun-${Date.now()}` : executionId } as ShowGatherEvent;
    states[target].set(cue.id, { status: "active", executionId: event.id });
    try {
      const result = target === "live" ? await dispatchLiveEvent(event) : dispatchRehearsalEvent(event);
      states[target].set(cue.id, { status: "complete", executionId: event.id });
      return reply.status(201).send({ ...snapshot(target), event: result.event });
    } catch (error) {
      states[target].set(cue.id, { status: prior.status, ...(prior.executionId ? { executionId: prior.executionId } : {}) });
      throw error;
    }
  });
}
