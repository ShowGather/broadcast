import type { PresentationCommand, PresentationRegionName } from "./index.js";

export type PresentationCommandPayload =
  | { k: "score"; h: number; a: number; l?: string; i?: string }
  | { k: "lower"; t: string; s?: string; d?: number; i?: string }
  | { k: "alert"; t: string; m: string; x?: "i" | "w" | "c"; d?: number; i?: string }
  | { k: "sponsor"; b: string; s?: string; d?: number; i?: string }
  | { k: "ticker"; t: string; l?: string; i?: string }
  | { k: "clock"; t: string; l?: string; i?: string }
  | { k: "clear"; g?: "v" | "h" | "l" | "r" | "f"; y?: string }
  | { k: "noop" };

export interface PresentationCommandInput { id: string; p: PresentationCommandPayload; }

export function resolvePresentationCommand(event: PresentationCommandInput, targetPts: number): PresentationCommand[] {
  const { p } = event;
  switch (p.k) {
    case "score": return [{ action: "activate", eventId: `${event.id}:score`, targetPts, region: "video.overlay", layer: "scorebug", instanceId: p.i, priority: 10, item: { kind: "scorebug", homeTeam: "HOME", homeScore: String(p.h), awayTeam: "AWAY", awayScore: String(p.a), clock: p.l } }];
    case "lower": return [{ action: "activate", eventId: `${event.id}:lower`, targetPts, region: "video.overlay", layer: "lower-third", instanceId: p.i, priority: 20, durationMs: p.d ?? 8_000, item: { kind: "lower-third", title: p.t, subtitle: p.s } }];
    case "alert": return [{ action: "activate", eventId: `${event.id}:alert`, targetPts, region: "header", layer: "alert", instanceId: p.i, priority: 100, durationMs: p.d ?? 8_000, item: { kind: "alert", title: p.t, message: p.m, severity: p.x === "c" ? "critical" : p.x === "i" ? "info" : "warning" } }];
    case "sponsor": return [{ action: "activate", eventId: `${event.id}:sponsor`, targetPts, region: "right.rail", layer: "primary", instanceId: p.i, priority: p.d === undefined ? 10 : 100, ...(p.d !== undefined ? { durationMs: p.d } : {}), item: { kind: "sponsor-panel", brand: p.b, tagline: p.s } }];
    case "ticker": return [{ action: "activate", eventId: `${event.id}:ticker`, targetPts, region: "footer", layer: "ticker", instanceId: p.i, priority: 10, item: { kind: "ticker", text: p.t, label: p.l } }];
    case "clock": return [{ action: "activate", eventId: `${event.id}:clock`, targetPts, region: "video.overlay", layer: "clock", instanceId: p.i, priority: 15, item: { kind: "clock", time: p.t, label: p.l } }];
    case "clear": return [{ action: "clear", eventId: event.id, targetPts, ...(p.g !== undefined ? { region: regionFromCode(p.g) } : {}), ...(p.y !== undefined ? { layer: p.y } : {}) }];
    case "noop": return [];
  }
}

function regionFromCode(code: "v" | "h" | "l" | "r" | "f"): PresentationRegionName {
  return ({ v: "video.overlay", h: "header", l: "left.rail", r: "right.rail", f: "footer" } as const)[code];
}
