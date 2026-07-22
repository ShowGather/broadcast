/**
 * ShowGather Event Schema — POC version
 *
 * Compact JSON format designed to fit within id3injector's TPE1 frame limit (127 bytes text content).
 * The entire JSON payload is encoded as the TPE1 text in an ID3v2.4 tag.
 */

/** Maximum bytes allowed for the TPE1 text payload (set by id3injector). */
export const MAX_PAYLOAD_BYTES = 127;

/**
 * A ShowGather sync event.
 * This is the wire format encoded into ID3 TPE1 frames.
 */
export type PresentationCueKey = "goal-home" | "speaker-intro" | "alert-test";

export interface OverlayShowEvent {
  /** Schema version. Always 1 for POC. */
  v: 1;
  /** Unique event ID for deduplication. */
  id: string;
  /** Persistent presentation revision when this event changes durable state. */
  r?: number;
  /** Event type. POC supports "overlay.show". */
  t: "overlay.show";
  /** Payload — the display data. */
  p: {
    /** Title text (required). */
    title: string;
    /** Optional message body. */
    msg?: string;
    /** Duration in milliseconds before auto-hide. */
    dur: number;
  };
}

/** Compact ID3 signal for a viewer-side, named presentation cue. */
export interface PresentationCueEvent {
  v: 1;
  id: string;
  r?: number;
  t: "presentation.cue";
  p: {
    cue: PresentationCueKey;
    /** Optional override for the cue's primary transient duration. */
    dur?: number;
  };
}

/** Compact signal that removes presentation while leaving video untouched. */
export interface PresentationClearEvent {
  v: 1;
  id: string;
  r?: number;
  t: "presentation.clear";
  p: Record<string, never>;
}

/** Compact, configurable command payload carried directly in timed metadata. */
export type PresentationCommandPayload =
  | { k: "score"; h: number; a: number; l?: string; i?: string }
  | { k: "lower"; t: string; s?: string; d?: number; i?: string }
  | { k: "alert"; t: string; m: string; x?: "i" | "w" | "c"; d?: number; i?: string }
  | { k: "sponsor"; b: string; s?: string; d?: number; i?: string }
  | { k: "ticker"; t: string; l?: string; i?: string }
  | { k: "clock"; t: string; l?: string; i?: string }
  | { k: "clear"; g?: "v" | "h" | "l" | "r" | "f"; y?: string }
  /** Ordered cancellation resolution: advances a durable revision without changing presentation. */
  | { k: "noop" };

export interface PresentationCommandEvent {
  v: 1;
  id: string;
  r?: number;
  /** Compact timed-transport type for a canonical presentation command. */
  t: "pc";
  p: PresentationCommandPayload;
}

export type ShowGatherEvent = OverlayShowEvent | PresentationCueEvent | PresentationClearEvent | PresentationCommandEvent;

export const PRESENTATION_CUE_KEYS: readonly PresentationCueKey[] = [
  "goal-home",
  "speaker-intro",
  "alert-test",
];

export function isPresentationCueKey(value: unknown): value is PresentationCueKey {
  return typeof value === "string" && PRESENTATION_CUE_KEYS.includes(value as PresentationCueKey);
}

/**
 * Validate that a parsed object is a valid ShowGatherEvent.
 * Returns the event if valid, null otherwise.
 */
export function validateEvent(data: unknown): ShowGatherEvent | null {
  if (typeof data !== "object" || data === null) return null;
  const obj = data as Record<string, unknown>;

  if (obj.v !== 1) return null;
  if (typeof obj.id !== "string" || obj.id.length === 0) return null;
  if (obj.r !== undefined && (!Number.isSafeInteger(obj.r) || (obj.r as number) <= 0)) return null;
  if (obj.t !== "overlay.show" && obj.t !== "presentation.cue" && obj.t !== "presentation.clear" && obj.t !== "pc") return null;

  const p = obj.p;
  if (typeof p !== "object" || p === null) return null;
  const payload = p as Record<string, unknown>;
  if (obj.t === "presentation.clear") {
    return { v: 1, id: obj.id as string, ...(obj.r !== undefined ? { r: obj.r as number } : {}), t: "presentation.clear", p: {} };
  }

  if (obj.t === "presentation.cue") {
    if (!isPresentationCueKey(payload.cue)) return null;
    if (payload.dur !== undefined && (typeof payload.dur !== "number" || payload.dur <= 0)) return null;
    return {
      v: 1,
      id: obj.id as string,
      ...(obj.r !== undefined ? { r: obj.r as number } : {}),
      t: "presentation.cue",
      p: {
        cue: payload.cue,
        ...(typeof payload.dur === "number" ? { dur: payload.dur } : {}),
      },
    };
  }

  if (obj.t === "pc") {
    const command = validatePresentationCommandPayload(payload);
    return command === null ? null : { v: 1, id: obj.id as string, ...(obj.r !== undefined ? { r: obj.r as number } : {}), t: "pc", p: command };
  }

  if (typeof payload.title !== "string" || payload.title.length === 0) return null;
  if (typeof payload.dur !== "number" || payload.dur <= 0) return null;

  return {
    v: 1,
    id: obj.id as string,
    ...(obj.r !== undefined ? { r: obj.r as number } : {}),
    t: "overlay.show",
    p: {
      title: payload.title as string,
      msg: typeof payload.msg === "string" ? payload.msg : undefined,
      dur: payload.dur as number,
    },
  };
}

export function validatePresentationCommandPayload(data: unknown): PresentationCommandPayload | null {
  if (typeof data !== "object" || data === null) return null;
  const p = data as Record<string, unknown>;
  const duration = validDuration(p.d) ? p.d : undefined;
  if (p.d !== undefined && duration === undefined) return null;
  const instance = validInstanceId(p.i) ? p.i : undefined;
  if (p.i !== undefined && instance === undefined) return null;
  switch (p.k) {
    case "score":
      return validScore(p.h) && validScore(p.a) && optionalText(p.l, 12)
        ? { k: "score", h: p.h, a: p.a, ...(typeof p.l === "string" ? { l: p.l } : {}), ...(instance ? { i: instance } : {}) } : null;
    case "lower":
      return text(p.t, 20) && optionalText(p.s, 20)
        ? { k: "lower", t: p.t, ...(typeof p.s === "string" ? { s: p.s } : {}), ...(duration !== undefined ? { d: duration } : {}), ...(instance ? { i: instance } : {}) } : null;
    case "alert":
      return text(p.t, 20) && text(p.m, 20) && (p.x === undefined || p.x === "i" || p.x === "w" || p.x === "c")
        ? { k: "alert", t: p.t, m: p.m, ...(p.x !== undefined ? { x: p.x } : {}), ...(duration !== undefined ? { d: duration } : {}), ...(instance ? { i: instance } : {}) } : null;
    case "sponsor":
      return text(p.b, 20) && optionalText(p.s, 20)
        ? { k: "sponsor", b: p.b, ...(typeof p.s === "string" ? { s: p.s } : {}), ...(duration !== undefined ? { d: duration } : {}), ...(instance ? { i: instance } : {}) } : null;
    case "ticker":
      return text(p.t, 20) && optionalText(p.l, 12)
        ? { k: "ticker", t: p.t, ...(typeof p.l === "string" ? { l: p.l } : {}), ...(instance ? { i: instance } : {}) } : null;
    case "clock":
      return text(p.t, 12) && optionalText(p.l, 12)
        ? { k: "clock", t: p.t, ...(typeof p.l === "string" ? { l: p.l } : {}), ...(instance ? { i: instance } : {}) } : null;
    case "clear":
      return (p.g === undefined || p.g === "v" || p.g === "h" || p.g === "l" || p.g === "r" || p.g === "f") && optionalText(p.y, 16)
        ? { k: "clear", ...(p.g !== undefined ? { g: p.g } : {}), ...(typeof p.y === "string" ? { y: p.y } : {}) } : null;
    case "noop":
      return Object.keys(p).length === 1 ? { k: "noop" } : null;
    default:
      return null;
  }
}

function text(value: unknown, maxBytes: number): value is string {
  return typeof value === "string" && value.length > 0 && new TextEncoder().encode(value).byteLength <= maxBytes;
}
function validInstanceId(value: unknown): value is string { return typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,23}$/i.test(value); }
function optionalText(value: unknown, maxBytes: number): boolean {
  return value === undefined || text(value, maxBytes);
}
function validDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function validScore(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 999;
}

/**
 * Encode a ShowGatherEvent to a JSON string suitable for TPE1 injection.
 * Throws if the payload exceeds MAX_PAYLOAD_BYTES.
 */
export function encodeEvent(event: ShowGatherEvent): string {
  const json = JSON.stringify(event);
  if (new TextEncoder().encode(json).byteLength > MAX_PAYLOAD_BYTES) {
    throw new Error(
      `Event payload exceeds ${MAX_PAYLOAD_BYTES} bytes (${new TextEncoder().encode(json).byteLength} bytes)`
    );
  }
  return json;
}

/**
 * Generate a unique event ID.
 */
export function generateEventId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "evt-";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
