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
    }
  | {
      kind: "clock";
      label?: string;
      time: string;
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
  /** Stable logical identity. Omitted legacy commands retain their layer ID. */
  instanceId?: string;
  item: PresentationItem;
  priority?: number;
  zIndex?: number;
  durationMs?: number;
  placementByProfile?: import("./layout.js").PlacementByProfile;
  variantByProfile?: import("./layout.js").VariantByProfile;
  transition?: import("./layout.js").PresentationTransition;
}

export interface PresentationClear {
  action: "clear";
  eventId: string;
  targetPts: number;
  region?: PresentationRegionName;
  layer?: string;
  instanceId?: string;
}

export type PresentationCommand = PresentationActivation | PresentationClear;

export interface PresentationEntry {
  eventId: string;
  region: PresentationRegionName;
  layer: string;
  instanceId: string;
  item: PresentationItem;
  priority: number;
  zIndex: number;
  activatedAtPts: number;
  expiresAtPts?: number;
  placementByProfile?: import("./layout.js").PlacementByProfile;
  variantByProfile?: import("./layout.js").VariantByProfile;
  transition?: import("./layout.js").PresentationTransition;
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

/**
 * A local, transport-free renderer acceptance scene. It deliberately models
 * the same instances across all output profiles rather than duplicating their
 * content for desktop, TV and mobile.
 */
export function createV13PresentationAcceptanceScene(): PresentationState {
  let state = createPresentationState();
  const commands: PresentationActivation[] = [
    { action: "activate", eventId: "scene-scorebug", targetPts: 0, region: "video.overlay", layer: "scorebug", instanceId: "scorebug-main", zIndex: 10, item: { kind: "scorebug", homeTeam: "ENG", homeScore: "2", awayTeam: "FRA", awayScore: "1", clock: "78:42" } },
    { action: "activate", eventId: "scene-clock", targetPts: 0, region: "video.overlay", layer: "clock", instanceId: "programme-clock", zIndex: 20, item: { kind: "clock", label: "LIVE", time: "78:42" } },
    { action: "activate", eventId: "scene-presenter-a", targetPts: 0, region: "video.overlay", layer: "lower-third", instanceId: "lower-third-presenter-a", zIndex: 30, item: { kind: "lower-third", title: "ALEX MORGAN", subtitle: "Presenter" }, placementByProfile: {
      desktop: { surface: "video", anchor: "bottom-left", x: .04, y: .06, width: .4, safeArea: true, layout: "column" },
      tv: { surface: "video", anchor: "bottom-left", x: .04, y: .06, width: .44, safeArea: true, layout: "column" },
      mobile: { surface: "video", anchor: "bottom-centre", x: 0, y: .18, width: .9, safeArea: true, layout: "column" },
    } },
    { action: "activate", eventId: "scene-presenter-b", targetPts: 0, region: "video.overlay", layer: "lower-third", instanceId: "lower-third-presenter-b", zIndex: 31, item: { kind: "lower-third", title: "JORDAN LEE", subtitle: "Co-commentator" }, placementByProfile: {
      desktop: { surface: "video", anchor: "bottom-right", x: .04, y: .06, width: .4, safeArea: true, layout: "column" },
      tv: { surface: "video", anchor: "bottom-right", x: .04, y: .06, width: .44, safeArea: true, layout: "column" },
      mobile: { surface: "video", anchor: "bottom-centre", x: 0, y: .05, width: .9, safeArea: true, layout: "column" },
    } },
    { action: "activate", eventId: "scene-sponsor", targetPts: 0, region: "right.rail", layer: "sponsor", instanceId: "sponsor-top-right", zIndex: 15, item: { kind: "sponsor-panel", brand: "NORTHSTAR", tagline: "Official broadcast partner" }, placementByProfile: {
      desktop: { surface: "surround", anchor: "top-right", x: 0, y: 0, width: 1, layout: "single" },
      tv: { surface: "video", anchor: "top-right", x: .04, y: .04, width: .22, safeArea: true, layout: "overlay" },
      mobile: { surface: "companion", anchor: "centre", x: 0, y: 0, width: .94, layout: "column" },
    } },
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
    instanceId: command.instanceId ?? command.layer,
    item: command.item,
    priority: command.priority ?? 0,
    zIndex: command.zIndex ?? command.priority ?? 0,
    activatedAtPts: command.targetPts,
    ...(command.placementByProfile === undefined ? {} : { placementByProfile: command.placementByProfile }),
    ...(command.variantByProfile === undefined ? {} : { variantByProfile: command.variantByProfile }),
    ...(command.transition === undefined ? {} : { transition: command.transition }),
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
    const resolutionKey = `${entry.layer}:${entry.instanceId}`;
    const current = topByLayer.get(resolutionKey);
    if (
      current === undefined ||
      entry.priority > current.priority ||
      (entry.priority === current.priority && entry.activatedAtPts >= current.activatedAtPts)
    ) {
      topByLayer.set(resolutionKey, entry);
    }
  }

  return [...topByLayer.values()].sort(
    (a, b) => a.zIndex - b.zIndex || a.layer.localeCompare(b.layer) || a.instanceId.localeCompare(b.instanceId)
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
      (entry) => (command.layer !== undefined && entry.layer !== command.layer) || (command.instanceId !== undefined && entry.instanceId !== command.instanceId)
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
export { placementFromPreset, normalisePlacement, resolvePresentationInstance, resolvePresentationSurface, resolvePresentationTarget, PRESENTATION_PRESETS, type PlacementByProfile, type PresentationAnchor, type PresentationLayoutDefinition, type PresentationSurface, type PresentationTransition, type PresentationTransitionKind, type ProfilePlacement, type ResolvedPresentationInstance, type ViewerProfile, type VariantByProfile } from "./layout.js";
