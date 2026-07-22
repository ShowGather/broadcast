import { PRESENTATION_REGIONS, resolvePresentationRegion, type PresentationEntry, type PresentationItem, type PresentationRegionName, type PresentationState } from "./index.js";

/** A viewer's output profile, independent of the browser or transport. */
export type ViewerProfile = "desktop" | "tv" | "mobile";
export type PresentationSurface = "video" | "surround" | "companion";
export type PresentationAnchor =
  | "top-left" | "top-centre" | "top-right"
  | "centre-left" | "centre" | "centre-right"
  | "bottom-left" | "bottom-centre" | "bottom-right";
export type PresentationLayoutPolicy = "single" | "row" | "column" | "overlay";
export type PresentationTransitionKind = "cut" | "fade" | "slide" | "scale";

export interface ProfilePlacement {
  surface: PresentationSurface;
  anchor: PresentationAnchor;
  /** Normalised offsets from the named anchor. */
  x: number;
  y: number;
  /** Normalised width of the target surface. */
  width: number;
  height?: number;
  crop?: { top: number; right: number; bottom: number; left: number };
  opacity?: number;
  rotation?: number;
  safeArea?: boolean;
  layout?: PresentationLayoutPolicy;
}

export type PlacementByProfile = Partial<Record<ViewerProfile, ProfilePlacement>>;
export type VariantByProfile = Partial<Record<ViewerProfile, string>>;
/** Persisted configuration that decorates a stable active instance ID. */
export interface PresentationLayoutDefinition {
  instanceId: string;
  placementByProfile?: PlacementByProfile;
  variantByProfile?: VariantByProfile;
}
export interface PresentationTransition {
  enter: PresentationTransitionKind;
  exit: PresentationTransitionKind;
  durationMs: number;
}

export interface ResolvedPresentationInstance {
  entry: PresentationEntry;
  placement: ProfilePlacement;
  variant: string;
  transition: PresentationTransition;
  stackIndex: number;
}

export const PRESENTATION_PRESETS: Record<PresentationAnchor, Omit<ProfilePlacement, "surface">> = {
  "top-left": { anchor: "top-left", x: 0.04, y: 0.04, width: 0.3, safeArea: true, layout: "overlay" },
  "top-centre": { anchor: "top-centre", x: 0, y: 0.04, width: 0.3, safeArea: true, layout: "overlay" },
  "top-right": { anchor: "top-right", x: 0.04, y: 0.04, width: 0.3, safeArea: true, layout: "overlay" },
  "centre-left": { anchor: "centre-left", x: 0.04, y: 0, width: 0.34, safeArea: true, layout: "overlay" },
  "centre": { anchor: "centre", x: 0, y: 0, width: 0.42, safeArea: true, layout: "overlay" },
  "centre-right": { anchor: "centre-right", x: 0.04, y: 0, width: 0.34, safeArea: true, layout: "overlay" },
  "bottom-left": { anchor: "bottom-left", x: 0.04, y: 0.06, width: 0.4, safeArea: true, layout: "column" },
  "bottom-centre": { anchor: "bottom-centre", x: 0, y: 0.06, width: 0.7, safeArea: true, layout: "column" },
  "bottom-right": { anchor: "bottom-right", x: 0.04, y: 0.06, width: 0.4, safeArea: true, layout: "column" },
};

const defaultTransition: PresentationTransition = { enter: "fade", exit: "fade", durationMs: 180 };

/** Validate and clamp normalised geometry before it reaches a renderer. */
export function normalisePlacement(placement: ProfilePlacement): ProfilePlacement {
  const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
  const unit = (value: number, fallback: number) => Math.min(1, Math.max(0, finite(value, fallback)));
  const safeInset = placement.safeArea ? 0.04 : 0;
  const width = Math.min(1 - safeInset * 2, Math.max(0.08, unit(placement.width, 0.3)));
  return {
    ...placement,
    x: Math.min(1 - safeInset, Math.max(safeInset, unit(placement.x, safeInset))),
    y: Math.min(1 - safeInset, Math.max(safeInset, unit(placement.y, safeInset))),
    width,
    ...(placement.height === undefined ? {} : { height: unit(placement.height, 0.2) }),
    ...(placement.opacity === undefined ? {} : { opacity: unit(placement.opacity, 1) }),
    ...(placement.rotation === undefined ? {} : { rotation: finite(placement.rotation, 0) }),
  };
}

export function placementFromPreset(surface: PresentationSurface, anchor: PresentationAnchor, overrides: Partial<ProfilePlacement> = {}): ProfilePlacement {
  return normalisePlacement({ ...PRESENTATION_PRESETS[anchor], surface, ...overrides, anchor });
}

export function resolvePresentationInstance(entry: PresentationEntry, profile: ViewerProfile, definitions: readonly PresentationLayoutDefinition[] = []): ResolvedPresentationInstance {
  const definition = definitions.find((candidate) => candidate.instanceId === entry.instanceId);
  const placement = entry.placementByProfile?.[profile] ?? definition?.placementByProfile?.[profile] ?? defaultPlacement(entry.item, entry.region, profile);
  return {
    entry,
    placement: normalisePlacement(placement),
    variant: entry.variantByProfile?.[profile] ?? definition?.variantByProfile?.[profile] ?? defaultVariant(entry.item, profile),
    transition: entry.transition ?? defaultTransition,
    stackIndex: 0,
  };
}

/**
 * Resolve every visible entry intended for one renderer target. This lets a
 * TV move a legacy footer or rail graphic onto the video surface without
 * changing the command or stored content.
 */
export function resolvePresentationTarget(state: PresentationState, target: PresentationRegionName, profile: ViewerProfile, definitions: readonly PresentationLayoutDefinition[] = []): ResolvedPresentationInstance[] {
  const instances = PRESENTATION_REGIONS
    .flatMap((region) => resolvePresentationRegion(state, region))
    .map((entry) => resolvePresentationInstance(entry, profile, definitions))
    .filter((instance) => targetMatches(instance, target, profile))
    .sort((a, b) => (a.entry.zIndex ?? a.entry.priority) - (b.entry.zIndex ?? b.entry.priority) || a.entry.layer.localeCompare(b.entry.layer) || a.entry.instanceId.localeCompare(b.entry.instanceId));
  const stacks = new Map<string, number>();
  return instances.map((instance) => {
    const key = `${instance.placement.surface}:${instance.placement.anchor}:${instance.placement.layout}`;
    const stackIndex = instance.placement.layout === "column" ? (stacks.get(key) ?? 0) : 0;
    stacks.set(key, stackIndex + 1);
    return { ...instance, stackIndex };
  });
}

export function resolvePresentationSurface(state: PresentationState, surface: PresentationSurface, profile: ViewerProfile, definitions: readonly PresentationLayoutDefinition[] = []): ResolvedPresentationInstance[] {
  return PRESENTATION_REGIONS.flatMap((region) => resolvePresentationRegion(state, region)).map((entry) => resolvePresentationInstance(entry, profile, definitions)).filter((instance) => instance.placement.surface === surface).sort((a, b) => (a.entry.zIndex ?? a.entry.priority) - (b.entry.zIndex ?? b.entry.priority));
}

function targetMatches(instance: ResolvedPresentationInstance, target: PresentationRegionName, profile: ViewerProfile): boolean {
  if (instance.placement.surface === "video") return target === "video.overlay";
  if (instance.placement.surface === "companion") return false;
  return profile === "desktop" && instance.entry.region === target;
}

function defaultPlacement(item: PresentationItem, region: PresentationRegionName, profile: ViewerProfile): ProfilePlacement {
  switch (item.kind) {
    case "scorebug": return placementFromPreset("video", "top-left", { width: profile === "mobile" ? 0.34 : 0.28 });
    case "lower-third": return placementFromPreset("video", profile === "mobile" ? "bottom-centre" : "bottom-left", { width: profile === "mobile" ? 0.9 : profile === "tv" ? 0.44 : 0.4 });
    case "alert": return placementFromPreset("video", "centre", { width: profile === "mobile" ? 0.88 : 0.48 });
    case "clock": return placementFromPreset("video", "top-centre", { width: profile === "mobile" ? 0.24 : 0.18 });
    case "sponsor-panel": return profile === "tv"
      ? placementFromPreset("video", "top-right", { width: 0.22 })
      : profile === "mobile"
        ? placementFromPreset("companion", "centre", { width: 0.94, layout: "column" })
        : placementFromPreset("surround", "top-right", { width: 1, safeArea: false, layout: "single" });
    case "ticker": return profile === "tv"
      ? placementFromPreset("video", "bottom-centre", { width: 0.92 })
      : profile === "mobile"
        ? placementFromPreset("companion", "bottom-centre", { width: 0.94, layout: "column" })
        : placementFromPreset("surround", region === "header" ? "top-centre" : "bottom-centre", { width: 1, safeArea: false, layout: "single" });
  }
}

function defaultVariant(item: PresentationItem, profile: ViewerProfile): string {
  if (item.kind === "scorebug") return profile === "mobile" ? "compact" : profile === "tv" ? "broadcast" : "standard";
  if (item.kind === "lower-third") return profile === "mobile" ? "compact" : profile === "tv" ? "broadcast" : "wide";
  if (item.kind === "ticker") return profile === "mobile" ? "headline" : profile === "tv" ? "broadcast" : "crawl";
  if (item.kind === "clock") return profile === "mobile" ? "compact" : "standard";
  return "standard";
}
