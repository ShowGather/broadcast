import type { PresentationCommand } from "./index.js";

export type PresentationCueKey = "goal-home" | "speaker-intro" | "alert-test";

/** Structural input keeps cue resolution independent of a particular transport schema. */
export interface PresentationCueInput {
  id: string;
  p: { cue: PresentationCueKey; dur?: number };
}

export function resolvePresentationCue(event: PresentationCueInput, targetPts: number): PresentationCommand[] {
  const durationMs = event.p.dur ?? defaultDuration(event.p.cue);
  switch (event.p.cue) {
    case "goal-home":
      return [
        { action: "activate", eventId: `${event.id}:score`, targetPts, region: "video.overlay", layer: "scorebug", priority: 10, item: { kind: "scorebug", homeTeam: "HOME", homeScore: "1", awayTeam: "AWAY", awayScore: "0", clock: "GOAL" } },
        { action: "activate", eventId: `${event.id}:lower-third`, targetPts, region: "video.overlay", layer: "lower-third", priority: 20, durationMs, item: { kind: "lower-third", title: "GOAL!", subtitle: "Home team scores" } },
        { action: "activate", eventId: `${event.id}:takeover`, targetPts, region: "right.rail", layer: "primary", priority: 100, durationMs, item: { kind: "sponsor-panel", brand: "Goal Partner", tagline: "Celebrating the moment." } },
      ];
    case "speaker-intro":
      return [{ action: "activate", eventId: `${event.id}:lower-third`, targetPts, region: "video.overlay", layer: "lower-third", priority: 20, durationMs, item: { kind: "lower-third", title: "SARAH JENNINGS", subtitle: "Lead Broadcast Engineer • ShowGather" } }];
    case "alert-test":
      return [{ action: "activate", eventId: `${event.id}:alert`, targetPts, region: "header", layer: "alert", priority: 100, durationMs, item: { kind: "alert", title: "BROADCAST ALERT", message: "Timed presentation cue received.", severity: "warning" } }];
  }
}

function defaultDuration(cue: PresentationCueKey): number {
  return cue === "goal-home" ? 15_000 : 8_000;
}
