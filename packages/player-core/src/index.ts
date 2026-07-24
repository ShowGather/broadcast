// Media timeline scheduling (pure, no React)
export { advanceMediaTimeline, seekMediaTimeline } from "./media-timeline";
export type { ScheduledEvent, ActiveEvent, TimelineAdvance } from "./media-timeline";

// Persistent revision gate (pure, no React)
export { PersistentRevisionGate } from "./persistent-revision";
export type { EventRevisionDecision } from "./persistent-revision";

// Presentation cue resolution (pure, no React)
export { resolveTimedPresentationEvent, resolvePresentationCue } from "./cues";

// Demo state (pure, no React)
export { createDemoPresentationState } from "./demo-state";

// HLS sync client (framework-neutral)
export { createHlsClient } from "./sync-client";
export type { HlsClient, HlsClientOptions } from "./sync-client";
