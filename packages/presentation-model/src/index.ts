/**
 * Transport-independent presentation state for ShowGather V1.
 *
 * This package contains no React, HLS, ID3, or HTTP code. A caller translates
 * scheduled sync events into commands, while layout and graphics components
 * render the resolved state for their chosen viewport profile.
 */

export const PRESENTATION_REGIONS = [
  "video.overlay",
  "header",
  "left.rail",
  "right.rail",
  "footer",
] as const;

export type PresentationRegionName = (typeof PRESENTATION_REGIONS)[number];

export type PresentationItem =
  | {
      kind: "lower-third";
      title: string;
      subtitle?: string;
      accent?: string;
    }
  | {
      kind: "scorebug";
      homeTeam: string;
      homeScore: string;
      awayTeam: string;
      awayScore: string;
      clock?: string;
    }
  | {
      kind: "ticker";
      text: string;
      label?: string;
    }
  | {
      kind: "alert";
      title: string;
      message: string;
      severity: "info" | "warning" | "critical";
    }
  | {
      kind: "sponsor-panel";
      brand: string;
      tagline?: string;
      accent?: string;
    };

export interface PresentationActivation {
  action: "activate";
  eventId: string;
  targetPts: number;
  region: PresentationRegionName;
  /**
   * Items in the same region and layer compete by priority. This allows a
   * temporary sponsor takeover to replace a persistent sponsor panel while a
   * scorebug and lower third coexist in separate video-overlay layers.
   */
  layer: string;
  item: PresentationItem;
  priority?: number;
  durationMs?: number;
}

export interface PresentationClear {
  action: "clear";
  eventId: string;
  targetPts: number;
  region?: PresentationRegionName;
  layer?: string;
}

export type PresentationCommand = PresentationActivation | PresentationClear;

export interface PresentationEntry {
  eventId: string;
  region: PresentationRegionName;
  layer: string;
  item: PresentationItem;
  priority: number;
  activatedAtPts: number;
  expiresAtPts?: number;
}

export type PresentationState = Record<PresentationRegionName, PresentationEntry[]>;

/** A serialisable, durable view of one channel's presentation state. */
export interface PresentationSnapshot {
  revision: number;
  state: PresentationState;
}

export function createPresentationState(): PresentationState {
  return {
    "video.overlay": [],
    header: [],
    "left.rail": [],
    "right.rail": [],
    footer: [],
  };
}

/**
 * Baseline content for the V1 validation channel. Keeping it in the shared
 * model means an API snapshot and a first-load viewer begin from the same
 * presentation, rather than maintaining separate server and React defaults.
 */
export function createV1PresentationBaseline(): PresentationState {
  let state = createPresentationState();
  const commands: PresentationActivation[] = [
    { action: "activate", eventId: "baseline-scorebug", targetPts: 0, region: "video.overlay", layer: "scorebug", item: { kind: "scorebug", homeTeam: "HOME", homeScore: "0", awayTeam: "AWAY", awayScore: "0", clock: "00:00" } },
    { action: "activate", eventId: "baseline-header", targetPts: 0, region: "header", layer: "programme", item: { kind: "ticker", label: "SHOWGATHER LIVE", text: "Interactive broadcast test environment" } },
    { action: "activate", eventId: "baseline-left-rail", targetPts: 0, region: "left.rail", layer: "primary", item: { kind: "sponsor-panel", brand: "ShowGather", tagline: "Bring every part of the show together." } },
    { action: "activate", eventId: "baseline-right-rail", targetPts: 0, region: "right.rail", layer: "primary", item: { kind: "sponsor-panel", brand: "Partner Space", tagline: "Timed sponsor takeover ready." } },
    { action: "activate", eventId: "baseline-footer", targetPts: 0, region: "footer", layer: "ticker", item: { kind: "ticker", label: "LIVE", text: "HLS media time is the presentation authority • timed metadata pipeline connected • V1 surround-player preview" } },
  ];
  for (const command of commands) state = applyPresentationCommand(state, command);
  return state;
}

/** Temporary entries are deliberately excluded from a join/recovery snapshot. */
export function createPersistentPresentationSnapshot(
  state: PresentationState,
  revision: number
): PresentationSnapshot {
  return {
    revision,
    state: mapRegions(state, (entries) => entries.filter((entry) => entry.expiresAtPts === undefined)),
  };
}

/** Apply a scheduled presentation command without evaluating time. */
export function applyPresentationCommand(
  state: PresentationState,
  command: PresentationCommand
): PresentationState {
  if (command.action === "clear") {
    return clearPresentation(state, command);
  }

  const entry: PresentationEntry = {
    eventId: command.eventId,
    region: command.region,
    layer: command.layer,
    item: command.item,
    priority: command.priority ?? 0,
    activatedAtPts: command.targetPts,
    ...(command.durationMs === undefined
      ? {}
      : { expiresAtPts: command.targetPts + command.durationMs / 1000 }),
  };

  return {
    ...state,
    [command.region]: [
      ...state[command.region].filter((existing) => existing.eventId !== command.eventId),
      entry,
    ],
  };
}

/** Remove media-time-expired entries. Underlying entries remain for restoration. */
export function expirePresentationItems(
  state: PresentationState,
  currentPts: number
): PresentationState {
  const hasExpiredItem = PRESENTATION_REGIONS.some((region) =>
    state[region].some((entry) => entry.expiresAtPts !== undefined && currentPts >= entry.expiresAtPts)
  );
  if (!hasExpiredItem) return state;

  return mapRegions(state, (entries) =>
    entries.filter((entry) => entry.expiresAtPts === undefined || currentPts < entry.expiresAtPts)
  );
}

/**
 * Resolve the visible entry for each layer in a region. A higher-priority item
 * replaces lower-priority content in its own layer; separate layers coexist.
 */
export function resolvePresentationRegion(
  state: PresentationState,
  region: PresentationRegionName
): PresentationEntry[] {
  const topByLayer = new Map<string, PresentationEntry>();

  for (const entry of state[region]) {
    const current = topByLayer.get(entry.layer);
    if (
      current === undefined ||
      entry.priority > current.priority ||
      (entry.priority === current.priority && entry.activatedAtPts >= current.activatedAtPts)
    ) {
      topByLayer.set(entry.layer, entry);
    }
  }

  return [...topByLayer.values()].sort(
    (a, b) => a.layer.localeCompare(b.layer) || a.eventId.localeCompare(b.eventId)
  );
}

export function isPresentationRegionName(value: string): value is PresentationRegionName {
  return (PRESENTATION_REGIONS as readonly string[]).includes(value);
}

function clearPresentation(state: PresentationState, command: PresentationClear): PresentationState {
  if (command.region === undefined) {
    return createPresentationState();
  }

  return {
    ...state,
    [command.region]: state[command.region].filter(
      (entry) => command.layer !== undefined && entry.layer !== command.layer
    ),
  };
}

function mapRegions(
  state: PresentationState,
  transform: (entries: PresentationEntry[]) => PresentationEntry[]
): PresentationState {
  return {
    "video.overlay": transform(state["video.overlay"]),
    header: transform(state.header),
    "left.rail": transform(state["left.rail"]),
    "right.rail": transform(state["right.rail"]),
    footer: transform(state.footer),
  };
}

export { resolvePresentationCue, type PresentationCueInput, type PresentationCueKey } from "./cues.js";
export { resolvePresentationCommand, type PresentationCommandInput, type PresentationCommandPayload } from "./commands.js";
