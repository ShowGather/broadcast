import { useCallback, useEffect, useRef, useState } from "react";
import type { ShowGatherEvent } from "@showgather/event-schema";
import type { PresentationSnapshot } from "@showgather/presentation-model";
import { useSyncClient } from "./useSyncClient";
import { PresentationProvider, usePresentation } from "./presentation/PresentationProvider";
import { PresentationRegion } from "./presentation/PresentationRegion";
import { createDemoPresentationState } from "./presentation/demoState";
import { resolveTimedPresentationEvent } from "./presentation/cues";
import { ViewerShell, type ViewerProfile } from "./viewer/ViewerShell";

function deltaClass(delta: number | null): string {
  if (delta === null) return "pending";
  const abs = Math.abs(delta);
  if (abs < 50) return "green";
  if (abs < 200) return "yellow";
  return "red";
}

function ViewerExperience() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [profile, setProfile] = useState<ViewerProfile>("desktop");
  const rehearsal = new URLSearchParams(window.location.search).get("rehearsal") === "1";
  const { applyCommand, expireAt, replaceState } = usePresentation();
  useEffect(() => {
    let active = true;
    fetch("/api/presentation/snapshot")
      .then((response) => response.ok ? response.json() as Promise<PresentationSnapshot> : Promise.reject(new Error("snapshot unavailable")))
      .then((snapshot) => { if (active) replaceState(snapshot.state); })
      .catch(() => { /* The baseline remains available if the API is temporarily unreachable. */ });
    return () => { active = false; };
  }, [replaceState]);
  const onTimedEvent = useCallback((event: ShowGatherEvent, targetPts: number) => {
    resolveTimedPresentationEvent(event, targetPts).forEach(applyCommand);
  }, [applyCommand]);
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

  return <div className="app">
    <header className="app-header">
      <div><h1>ShowGather Viewer</h1><span className="status">{status}{rehearsal ? " • rehearsal listener active" : ""}</span></div>
      <div className="profile-switcher" aria-label="Preview profile">
        {(["desktop", "mobile", "tv"] as ViewerProfile[]).map((candidate) => <button key={candidate} className={profile === candidate ? "active" : ""} onClick={() => setProfile(candidate)}>{candidate}</button>)}
      </div>
    </header>
    <ViewerShell profile={profile} video={video} diagnostics={diagnostics} />
  </div>;
}

export default function App() {
  return <PresentationProvider initialState={createDemoPresentationState()}><ViewerExperience /></PresentationProvider>;
}
