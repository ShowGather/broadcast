import type { RundownCue, OutboxItem } from "../types.js";
import type { useRunWorkspace } from "../hooks/useRunWorkspace.js";
import { useAdminState } from "./AdminStateContext.js";

interface Props {
  rundowns: { id: string; name: string }[];
  rundown: RundownCue[];
  selectedProduction: { title?: string } | undefined;
  disabledCueCount: number;
  apiConnection: string;
  streamConnection: string;
  sessionId: string;
  unresolvedOutbox: OutboxItem[];
  programmePreviewUrl: string;
  runWorkspace: ReturnType<typeof useRunWorkspace>;
  setDiagnosticsOpen: (open: boolean) => void;
}

export function RunWorkspaceSection({ rundowns, rundown, selectedProduction, disabledCueCount, apiConnection, streamConnection, sessionId, unresolvedOutbox, programmePreviewUrl, runWorkspace, setDiagnosticsOpen }: Props) {
  const { rundownId } = useAdminState();
  return <>
    {!runWorkspace.runReady && <section className="section run-entry" aria-labelledby="run-entry-title">
      <h2 id="run-entry-title">Confirm live operation</h2>
      <p className="hint">Entering this workspace does not put the programme live. Review the current operational state, then explicitly start or resume the live session.</p>
      <dl className="run-entry__summary">
        <div><dt>Production</dt><dd>{selectedProduction?.title ?? "Not selected"}</dd></div>
        <div><dt>Rundown</dt><dd>{rundowns.find((item) => item.id === rundownId)?.name ?? "Not selected"}</dd></div>
        <div><dt>Cues</dt><dd>{rundown.length} total · {disabledCueCount} disabled</dd></div>
        <div><dt>Connection</dt><dd>API {apiConnection} · Stream {streamConnection}</dd></div>
        <div><dt>Live session</dt><dd>{sessionId ? "Existing session can be resumed" : "No active session"}</dd></div>
        <div><dt>Dispatch issues</dt><dd>{unresolvedOutbox.length ? `${unresolvedOutbox.length} pending or failed` : "None"}</dd></div>
      </dl>
      {unresolvedOutbox.length > 0 && <p className="error-msg" role="alert">Resolve or acknowledge the listed dispatch issues before operating live. Retry and Cancel remain available below.</p>}
      <button className="run-entry__go" disabled={!rundownId || apiConnection !== "connected" || streamConnection !== "connected"} onClick={runWorkspace.enterRun}>{sessionId ? "Resume live session" : "Start live session"}</button>
    </section>}

    {runWorkspace.runReady && <section className="section run-preview"><h2>Programme preview</h2>{programmePreviewUrl && <iframe title="Programme Player preview" src={programmePreviewUrl} className="player-preview" />}</section>}

    {runWorkspace.runReady && <section className="section run-console" aria-label="Live cue control">
      {unresolvedOutbox.length > 0 && <section className="run-console__failure" role="alert"><strong>COMMAND DELIVERY BLOCKED</strong><span>{unresolvedOutbox.length} pending or failed durable command{unresolvedOutbox.length === 1 ? "" : "s"} must be resolved before later live cues can be sent.</span><button onClick={() => setDiagnosticsOpen(true)}>Open diagnostics and recovery</button></section>}
      <div className="run-console__cue"><span className="run-console__eyebrow">Current cue</span><h2>{runWorkspace.runCue?.label ?? "No enabled cue remaining"}</h2><p>{runWorkspace.runCue ? `${runWorkspace.runCue.order}. ${runWorkspace.runCue.status}` : "The rundown is complete or has no enabled cues."}</p></div>
      <div className="run-console__next"><span>Next</span><strong>{runWorkspace.nextRunCue?.label ?? "\u2014"}</strong></div>
      <div className="run-console__actions"><button disabled={runWorkspace.runCueIndex === 0} onClick={() => runWorkspace.setRunCueIndex((index) => Math.max(0, index - 1))}>Previous</button><button className="run-console__go" disabled={unresolvedOutbox.length > 0 || !runWorkspace.runCue || !runWorkspace.runCue.enabled || runWorkspace.runCue.status === "active" || runWorkspace.runCue.status === "cancelled"} onClick={() => { if (runWorkspace.runCue) runWorkspace.goCue(runWorkspace.runCue); }}>{unresolvedOutbox.length > 0 ? "Resolve delivery issue" : runWorkspace.runCue?.status === "failed" ? "Retry cue" : "GO"}</button><button className="safe-clear" onClick={() => runWorkspace.setConfirmation("safe-clear")}>Safe Clear</button></div>
      <div className="run-console__list" aria-label="Rundown cue navigation">{rundown.map((cue, index) => <button key={cue.id} className={index === runWorkspace.runCueIndex ? "active" : ""} disabled={!cue.enabled} onClick={() => runWorkspace.setRunCueIndex(index)}>{cue.order}. {cue.label}<span>{cue.status}</span></button>)}</div>
      <div className="run-console__session-actions"><button onClick={() => runWorkspace.setConfirmation("complete")}>Complete show</button><button onClick={() => runWorkspace.setConfirmation("abandon")}>Abandon session</button><button onClick={() => runWorkspace.setConfirmation("reset")}>Reset live session</button></div>
    </section>}
  </>;
}

export function ConfirmationDialog({ runWorkspace }: { runWorkspace: ReturnType<typeof useRunWorkspace> }) {
  if (!runWorkspace.confirmation) return null;
  return <div className="confirmation-backdrop" role="presentation"><section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-description"><h2 id="confirmation-title">{runWorkspace.confirmation === "complete" ? "Complete this live show?" : runWorkspace.confirmation === "abandon" ? "Abandon this live session?" : runWorkspace.confirmation === "safe-clear" ? "Confirm Safe Clear?" : "Start a new live session?"}</h2><p id="confirmation-description">{runWorkspace.confirmation === "complete" ? "The current session will be marked complete. Programme presentation is not cleared automatically." : runWorkspace.confirmation === "abandon" ? "The current session will be recorded as abandoned. Programme presentation is not cleared automatically." : runWorkspace.confirmation === "safe-clear" ? "Safe Clear removes active presentation graphics. Programme video will continue uninterrupted." : "The current live session will be completed and a fresh immutable rundown session will begin."}</p><div><button onClick={() => runWorkspace.setConfirmation(null)}>Cancel</button><button ref={runWorkspace.confirmationButton} className="danger" onClick={runWorkspace.confirmSessionAction}>{runWorkspace.confirmation === "safe-clear" ? "Confirm Safe Clear" : "Confirm"}</button></div></section></div>;
}
