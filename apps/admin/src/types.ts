export interface StoredEvent {
  event: { id: string; t: string; p: Record<string, unknown> };
  injectedAt: string;
}

export interface RundownCue {
  id: string;
  label: string;
  order: number;
  enabled: boolean;
  status: "pending" | "active" | "complete" | "failed" | "cancelled";
  executionId?: string;
}

export interface Channel {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface Production {
  id: string;
  channelId: string;
  title: string;
  description?: string | null;
  status: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  configuration?: Record<string, unknown> | null;
  showConfigurationId?: string | null;
}

export interface Rundown {
  id: string;
  name: string;
  version: number;
}

export interface RundownDefinitionCue {
  id: string;
  label: string;
  position: number;
  enabled: boolean;
  commandPayload: Record<string, unknown>;
}

export interface ShowConfiguration {
  id: string;
  name: string;
  configuration: Record<string, unknown>;
}

export interface PresentationInstanceDefinition {
  id: string;
  kind:
    | "lower-third"
    | "scorebug"
    | "ticker"
    | "alert"
    | "sponsor"
    | "clock"
    | "live-badge"
    | "poll"
    | "custom";
  label: string;
  enabled: boolean;
}

export interface OutboxItem {
  id: string;
  eventId: string;
  revision: number;
  label: string;
  status: "pending" | "dispatched" | "failed" | "cancelled";
  error?: string;
  retryable: boolean;
  cancellable: boolean;
}

export type LayoutProfile = "desktop" | "tv" | "mobile";
export type LayoutSurface = "video" | "surround" | "companion";
export type LayoutAnchor =
  | "top-left"
  | "top-centre"
  | "top-right"
  | "centre-left"
  | "centre"
  | "centre-right"
  | "bottom-left"
  | "bottom-centre"
  | "bottom-right";

export interface LayoutDefinition {
  instanceId: string;
  placementByProfile: Partial<
    Record<
      LayoutProfile,
      {
        surface: LayoutSurface;
        anchor: LayoutAnchor;
        x: number;
        y: number;
        width: number;
        height?: number;
        crop?: { top: number; right: number; bottom: number; left: number };
        opacity?: number;
        rotation?: number;
        safeArea?: boolean;
        layout: "single" | "row" | "column" | "overlay";
      }
    >
  >;
  variantByProfile?: Partial<Record<LayoutProfile, string>>;
  zIndex?: number;
  transition?: {
    enter: "cut" | "fade" | "slide" | "scale";
    exit: "cut" | "fade" | "slide" | "scale";
    durationMs: number;
  };
}
