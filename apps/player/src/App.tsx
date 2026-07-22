import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { ShowGatherEvent } from "@showgather/event-schema";
import type { PresentationSnapshot } from "@showgather/presentation-model";
import { useSyncClient } from "./useSyncClient";
import { PresentationProvider, usePresentation } from "./presentation/PresentationProvider";
import { PresentationRegion } from "./presentation/PresentationRegion";
import { createDemoPresentationState } from "./presentation/demoState";
import { resolveTimedPresentationEvent } from "./presentation/cues";
import { PersistentRevisionGate } from "./presentation/persistentRevision";
import { ViewerShell, type ViewerProfile } from "./viewer/ViewerShell";
import type { CompanionPanel, CompanionPanelLabels } from "./viewer/InteractivePanels";

function deltaClass(delta: number | null): string {
  if (delta === null) return "pending";
  const abs = Math.abs(delta);
  if (abs < 50) return "green";
  if (abs < 200) return "yellow";
  return "red";
}

interface ViewerContext { programmeTitle: string; programmeSubtitle?: string; liveLabel: string; accent: string; enabledPanels: CompanionPanel[]; panelLabels: CompanionPanelLabels; }
const defaultViewerContext: ViewerContext = { programmeTitle: "ShowGather Viewer", liveLabel: "LIVE", accent: "#73e3ff", enabledPanels: ["match", "info", "partners", "interact"], panelLabels: {} };
function viewerContextFromProduction(data: { title?: unknown; configuration?: unknown }): ViewerContext {
  const configuration = typeof data.configuration === "object" && data.configuration !== null ? data.configuration as Record<string, unknown> : {};
  const enabledPanels = Array.isArray(configuration.enabledCompanionPanels) ? configuration.enabledCompanionPanels.filter((panel): panel is CompanionPanel => panel === "match" || panel === "info" || panel === "partners" || panel === "interact") : defaultViewerContext.enabledPanels;
  const rawLabels = typeof configuration.companionPanelLabels === "object" && configuration.companionPanelLabels !== null ? configuration.companionPanelLabels as Record<string, unknown> : {};
  const panelLabels = Object.fromEntries(Object.entries(rawLabels).filter(([panel, label]) => (panel === "match" || panel === "info" || panel === "partners" || panel === "interact") && typeof label === "string")) as CompanionPanelLabels;
  return {
    programmeTitle: typeof configuration.programmeTitle === "string" ? configuration.programmeTitle : typeof data.title === "string" ? data.title : defaultViewerContext.programmeTitle,
    ...(typeof configuration.programmeSubtitle === "string" ? { programmeSubtitle: configuration.programmeSubtitle } : {}),
    liveLabel: typeof configuration.liveLabel === "string" ? configuration.liveLabel : defaultViewerContext.liveLabel,
    accent: typeof configuration.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(configuration.accent) ? configuration.accent : defaultViewerContext.accent,
    enabledPanels: enabledPanels.length ? enabledPanels : defaultViewerContext.enabledPanels,
    panelLabels,
  };
}

function ViewerExperience() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const search = new URLSearchParams(window.location.search);
  const requestedProfile = search.get("profile");
  const [profile, setProfile] = useState<ViewerProfile>(requestedProfile === "mobile" || requestedProfile === "tv" ? requestedProfile : "desktop");
  const rehearsal = search.get("rehearsal") === "1";
  const embedded = search.get("embedded") === "1";
  const diagnosticsEnabled = search.get("diagnostics") === "1";
  const productionId = search.get("productionId");
  const channelId = window.location.pathname.match(/^\/player\/([^/]+)/)?.[1];
  const [viewerContext, setViewerContext] = useState<ViewerContext>(defaultViewerContext);
  const { applyCommand, expireAt, replaceState } = usePresentation();
  const revisionGate = useRef(new PersistentRevisionGate());
  const hydrateSnapshot = useCallback(() => {
    return fetch("/api/presentation/snapshot")
      .then((response) => response.ok ? response.json() as Promise<PresentationSnapshot> : Promise.reject(new Error("snapshot unavailable")))
      .then((snapshot) => {
        if (revisionGate.current.applySnapshot(snapshot)) replaceState(snapshot.state);
      });
  }, [replaceState]);
  useEffect(() => {
    let active = true;
    hydrateSnapshot()
      .then(() => { if (!active) return; })
      .catch(() => { /* The baseline remains available if the API is temporarily unreachable. */ });
    return () => { active = false; };
  }, [hydrateSnapshot]);
  useEffect(() => {
    if (!productionId) return;
    fetch(`/api/productions/${encodeURIComponent(productionId)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("production unavailable")))
      .then((production) => setViewerContext(viewerContextFromProduction(production)))
      .catch(() => { /* Audience viewing remains available with safe defaults. */ });
  }, [productionId]);
  const onTimedEvent = useCallback((event: ShowGatherEvent, targetPts: number) => {
    const decision = revisionGate.current.applyEvent(event.r);
    if (decision.needsRecovery) hydrateSnapshot().catch(() => {});
    resolveTimedPresentationEvent(event, targetPts)
      .filter((command) => decision.applyPersistent || (command.action === "activate" && command.durationMs !== undefined))
      .forEach(applyCommand);
  }, [applyCommand, hydrateSnapshot]);
  const { overlays, syncLog, status } = useSyncClient(videoRef, { onTimedEvent, onMediaTime: expireAt, rehearsal });

  const video = <div className="video-container">
    <video ref={videoRef} controls autoPlay muted className="video-player" />
    <PresentationRegion name="video.overlay">
      {overlays.map((overlay) => overlay.event.t === "overlay.show" && <div key={overlay.event.id} className="overlay">
        <div className="overlay-title">{overlay.event.p.title}</div>
        {overlay.event.p.msg && <div className="overlay-msg">{overlay.event.p.msg}</div>}
      </div>)}
    </PresentationRegion>
  </div>;

  const diagnostics = <aside className="sync-log">
    <h2>Timing diagnostics</h2>
    <table>
      <thead><tr><th>Event ID</th><th>PTS</th><th>Video @ render</th><th>Delta</th></tr></thead>
      <tbody>
        {syncLog.map((entry) => <tr key={entry.eventId} className={deltaClass(entry.deltaMs)}>
          <td className="mono">{entry.eventId}</td>
          <td className="mono">{entry.metadataPts.toFixed(3)}</td>
          <td className="mono">{entry.videoTimeAtRender !== null ? entry.videoTimeAtRender.toFixed(3) : "—"}</td>
          <td className="mono">{entry.deltaMs !== null ? entry.deltaMs.toFixed(1) : "—"}</td>
        </tr>)}
        {syncLog.length === 0 && <tr><td colSpan={4} className="empty">Waiting for timed events…</td></tr>}
      </tbody>
    </table>
  </aside>;
  const connectionNotice = status === "Initializing..." || /error|not supported|offline/i.test(status) ? status : null;

  return <div className={`app ${embedded ? "app--embedded" : ""}`} style={{ "--viewer-accent": viewerContext.accent } as CSSProperties}>
    {!embedded && <header className="app-header">
      <div><span className="viewer-context__live">{viewerContext.liveLabel}</span><h1>{viewerContext.programmeTitle}</h1><span className="status" role="status">{viewerContext.programmeSubtitle ?? status}{rehearsal ? " • rehearsal listener active" : ""}</span></div>
      <div className="profile-switcher" aria-label="Preview profile">
        {(["desktop", "mobile", "tv"] as ViewerProfile[]).map((candidate) => <button key={candidate} className={profile === candidate ? "active" : ""} onClick={() => setProfile(candidate)}>{candidate}</button>)}
      </div>
    </header>}
    {embedded && <p className="embedded-status" role="status">{viewerContext.liveLabel} · {viewerContext.programmeTitle}{channelId ? ` · channel ${channelId}` : ""}{rehearsal ? " · rehearsal" : ""}</p>}
    {connectionNotice && <p className="viewer-availability" role="status">{connectionNotice}</p>}
    <ViewerShell profile={profile} video={video} diagnostics={diagnosticsEnabled ? diagnostics : null} enabledPanels={viewerContext.enabledPanels} panelLabels={viewerContext.panelLabels} />
  </div>;
}

export default function App() {
  return <PresentationProvider initialState={createDemoPresentationState()}><ViewerExperience /></PresentationProvider>;
}
