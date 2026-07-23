import type { RundownCue } from "../types.js";
import type { useRunWorkspace } from "../hooks/useRunWorkspace.js";
import { useAdminState } from "./AdminStateContext.js";

interface Props {
  playerPreviewUrl: string;
  previewProfile: "desktop" | "mobile" | "tv";
  setPreviewProfile: (p: "desktop" | "mobile" | "tv") => void;
  rundowns: { id: string; name: string }[];
  rundown: RundownCue[];
  rehearsal: boolean;
  runWorkspace: ReturnType<typeof useRunWorkspace>;
  fetchRundown: () => Promise<void>;
}

export function RehearseWorkspace({ playerPreviewUrl, previewProfile, setPreviewProfile, rundowns, rundown, rehearsal, runWorkspace, fetchRundown }: Props) {
  const { rundownId, send, mutate } = useAdminState();
  return <>
    <section className="section rehearsal-preview">
      <div className="workspace-heading"><div><h2>Rehearsal preview</h2><p className="hint">This embeds the real Player in rehearsal mode. It never sends rehearsal cues to the live stream.</p></div><div className="profile-picker" role="group" aria-label="Preview profile">{(["desktop", "mobile", "tv"] as const).map((profile) => <button key={profile} className={previewProfile === profile ? "active" : ""} onClick={() => setPreviewProfile(profile)}>{profile}</button>)}</div></div>
      {playerPreviewUrl ? <iframe title={`Rehearsal Player ${previewProfile} preview`} src={playerPreviewUrl} className={`player-preview player-preview--${previewProfile}`} /> : <p className="empty">Choose a channel to load the preview.</p>}
    </section>

    <section className="section quick-cues">
      <h2>On-air cues</h2>
      <div className="cue-grid">
        <button onClick={() => send({ cue: "goal-home", durationMs: 15_000 }, "Home Goal sent")}>&#9917; Home Goal</button>
        <button onClick={() => send({ cue: "speaker-intro", durationMs: 8_000 }, "Speaker intro sent")}>&#127908; Speaker Intro</button>
        <button onClick={() => send({ cue: "alert-test", durationMs: 8_000 }, "Alert sent")}>&#9888; Alert</button>
        <button className="safe-clear" onClick={() => send({ action: "safe-clear" }, "Safe Clear sent")}>&#10005; Safe Clear</button>
      </div>
      <p className="hint">Safe Clear removes presentation only. The programme video continues uninterrupted.</p>
    </section>

    <section className="section rehearsal-console">
      <h2>Rehearsal rundown</h2>
      <p className="hint">GO uses an idempotent execution ID. Completed cues require explicit re-run; rehearsal state is separate from live.</p>
      <button disabled={!rundownId} onClick={() => mutate(`/api/rundown/${rehearsal ? "rehearsal" : "live"}/sessions?rundownId=${encodeURIComponent(rundownId)}`, "POST", {}, `${rehearsal ? "Rehearsal" : "Live"} session started`, fetchRundown)}>{rehearsal ? "Reset rehearsal session" : "Start new live session"}</button>
      <div className="cue-grid">
        {rundown.map((cue) => <div key={cue.id}><strong>{cue.order}. {cue.label}</strong><span className="hint"> {cue.status}</span><button disabled={cue.status === "active" || cue.status === "cancelled"} onClick={() => runWorkspace.goCue(cue)}>{cue.status === "failed" ? "Retry rehearsal cue" : "GO IN REHEARSAL"}</button>{cue.status === "complete" && <button onClick={() => runWorkspace.goCue(cue, true)}>Re-run in rehearsal</button>}</div>)}
      </div>
    </section>
  </>;
}
