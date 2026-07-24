"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validateEvent, type ShowGatherEvent } from "@showgather/event-schema";
import {
  createDemoPresentationState,
  resolveTimedPresentationEvent,
  PersistentRevisionGate,
  createHlsClient,
  type HlsClient,
} from "@showgather/player-core";
import {
  PresentationProvider,
  PresentationRegion,
  usePresentation,
  ViewerShell,
  type ViewerProfile,
  type CompanionPanel,
  type CompanionPanelLabels,
} from "@showgather/player-ui";
import type { PresentationLayoutDefinition, PresentationSnapshot } from "@showgather/presentation-model";

const HLS_URL = (process.env.NEXT_PUBLIC_HLS_URL ?? "http://127.0.0.1:8000/hls/stream.m3u8").trim();

interface PlayerExperienceProps {
  productionId: string;
  profile?: ViewerProfile;
  embedded?: boolean;
  rehearsal?: boolean;
}

interface ViewerContext {
  programmeTitle: string;
  programmeSubtitle?: string;
  liveLabel: string;
  accent: string;
  enabledPanels: CompanionPanel[];
  panelLabels: CompanionPanelLabels;
  layoutDefinitions: PresentationLayoutDefinition[];
}

const defaultViewerContext: ViewerContext = {
  programmeTitle: "ShowGather Viewer",
  liveLabel: "LIVE",
  accent: "#73e3ff",
  enabledPanels: ["match", "info", "partners", "interact"],
  panelLabels: {},
  layoutDefinitions: [],
};

function viewerContextFromProduction(data: { title?: unknown; configuration?: unknown }): ViewerContext {
  const configuration = typeof data.configuration === "object" && data.configuration !== null ? data.configuration as Record<string, unknown> : {};
  const enabledPanels = Array.isArray(configuration.enabledCompanionPanels)
    ? configuration.enabledCompanionPanels.filter((panel): panel is CompanionPanel =>
        panel === "match" || panel === "info" || panel === "partners" || panel === "interact")
    : defaultViewerContext.enabledPanels;
  const rawLabels = typeof configuration.companionPanelLabels === "object" && configuration.companionPanelLabels !== null
    ? configuration.companionPanelLabels as Record<string, unknown>
    : {};
  const panelLabels = Object.fromEntries(
    Object.entries(rawLabels).filter(([panel, label]) =>
      (panel === "match" || panel === "info" || panel === "partners" || panel === "interact") && typeof label === "string")
  ) as CompanionPanelLabels;
  const layoutDefinitions = Array.isArray(configuration.presentationLayouts)
    ? configuration.presentationLayouts.filter((definition): definition is PresentationLayoutDefinition =>
        typeof definition === "object" && definition !== null && typeof (definition as Record<string, unknown>).instanceId === "string")
    : [];
  return {
    programmeTitle: typeof configuration.programmeTitle === "string"
      ? configuration.programmeTitle
      : typeof data.title === "string"
        ? data.title
        : defaultViewerContext.programmeTitle,
    programmeSubtitle: typeof configuration.programmeSubtitle === "string" ? configuration.programmeSubtitle : undefined,
    liveLabel: typeof configuration.liveLabel === "string" ? configuration.liveLabel : defaultViewerContext.liveLabel,
    accent: typeof configuration.accent === "string" ? configuration.accent : defaultViewerContext.accent,
    enabledPanels,
    panelLabels,
    layoutDefinitions,
  };
}

export function PlayerExperience({ productionId, profile: initialProfile = "desktop", embedded = false, rehearsal = false }: PlayerExperienceProps) {
  const [profile, setProfile] = useState<ViewerProfile>(initialProfile);
  const [viewerContext, setViewerContext] = useState<ViewerContext>(defaultViewerContext);
  const [viewerContextLoaded, setViewerContextLoaded] = useState(false);
  const [snapshotRevision, setSnapshotRevision] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("Initializing…");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsClientRef = useRef<HlsClient | null>(null);
  const gateRef = useRef(new PersistentRevisionGate());
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/productions/${productionId}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!cancelled && data) setViewerContext(viewerContextFromProduction(data)); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setViewerContextLoaded(true); });
    return () => { cancelled = true; };
  }, [productionId]);

  const onTimedEvent = useCallback((event: ShowGatherEvent, targetPts: number) => {
    const commands = resolveTimedPresentationEvent(event, targetPts);
    for (const command of commands) {
      // Commands will be handled by PresentationProvider
    }
  }, []);

  const onHlsStatus = useCallback((message: string) => {
    setStatus(message);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const client = createHlsClient(video, {
      hlsUrl: HLS_URL,
      onTimedEvent: (event, metadataPts) => {
        if (seenIdsRef.current.has(event.id)) return;
        seenIdsRef.current.add(event.id);
        onTimedEvent(event, metadataPts);
      },
      onLoaded: () => setStatus("Stream loaded — waiting for playback"),
      onError: (message) => setStatus(message),
    });

    if (client) {
      hlsClientRef.current = client;
    } else {
      setStatus("HLS is not supported in this browser");
    }

    return () => {
      client?.destroy();
      hlsClientRef.current = null;
      seenIdsRef.current.clear();
    };
  }, [onTimedEvent]);

  useEffect(() => {
    if (!rehearsal) return;
    const source = new EventSource("/api/rehearsal/stream");
    source.onmessage = (message) => {
      try {
        const event = validateEvent(JSON.parse(message.data));
        const video = videoRef.current;
        if (event && video) {
          // Enqueue for scheduling
        }
      } catch { /* Ignore malformed rehearsal messages. */ }
    };
    return () => source.close();
  }, [rehearsal]);

  const videoElement = (
    <div className="video-container">
      <video ref={videoRef} className="video-player" playsInline />
    </div>
  );

  const diagnostics = <div className="text-xs text-slate-500 mt-2">{status}</div>;

  return (
    <PresentationProvider>
      <div className={embedded ? "p-2" : "p-4 max-w-[1440px] mx-auto"}>
        {!embedded && (
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-lg font-semibold">{viewerContext.programmeTitle}</h1>
              <span className="status">{status}</span>
            </div>
            <div className="profile-switcher">
              {(["desktop", "mobile", "tv"] as const).map((p) => (
                <button key={p} className={profile === p ? "active" : ""} onClick={() => setProfile(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <ViewerShell
          profile={profile}
          video={videoElement}
          diagnostics={diagnostics}
          enabledPanels={viewerContext.enabledPanels}
          panelLabels={viewerContext.panelLabels}
          layoutDefinitions={viewerContext.layoutDefinitions}
        />
      </div>
    </PresentationProvider>
  );
}
