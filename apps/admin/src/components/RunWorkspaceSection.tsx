import type { OutboxItem, RundownCue, StoredEvent } from "../types.js";
import type { useRunWorkspace } from "../hooks/useRunWorkspace.js";
import { CueList, CueListItem } from "./ui/CueList.js";
import { DangerAction, PrimaryAction, SafetyAction, SecondaryAction } from "./ui/ActionButtons.js";
import { StatusBadge } from "./ui/StatusBadge.js";
import { ValidationMessage } from "./ui/ValidationMessage.js";

export interface RunShellProps {
  rundowns: { id: string; name: string }[];
  rundownId: string;
  rundown: RundownCue[];
  selectedProduction: { title?: string } | undefined;
  disabledCueCount: number;
  apiConnection: string;
  streamConnection: string;
  sessionId: string;
  unresolvedOutbox: OutboxItem[];
  outbox: OutboxItem[];
  events: StoredEvent[];
  programmePreviewUrl: string;
  status: string;
  error: string;
  runWorkspace: ReturnType<typeof useRunWorkspace>;
  resolveOutbox: (item: OutboxItem, action: "retry" | "cancel") => Promise<void>;
}

export function liveGoDisabledReason({ runReady, unresolvedOutbox, cue, going }: { runReady: boolean; unresolvedOutbox: OutboxItem[]; cue: RundownCue | undefined; going: boolean }) {
  if (!runReady) return "Start or resume the live session before taking a cue.";
  if (unresolvedOutbox.length) return `${unresolvedOutbox.length} durable delivery issue${unresolvedOutbox.length === 1 ? " is" : "s are"} unresolved. Resolve it before taking another live cue.`;
  if (!cue) return "No enabled cue remains in this rundown.";
  if (!cue.enabled) return "This cue is disabled in the saved rundown.";
  if (cue.status === "active") return "This cue is already being delivered.";
  if (cue.status === "cancelled") return "This cue is cancelled.";
  if (going) return "Live cue dispatch is in progress.";
  return "";
}

export async function executeLiveCue(cue: RundownCue, goCue: (cue: RundownCue) => Promise<unknown>) {
  return goCue(cue);
}

function cueContext(rundown: RundownCue[], index: number) {
  return {
    previous: index > 0 ? rundown[index - 1] : undefined,
    current: rundown[index],
    next: rundown.slice(index + 1).find((cue) => cue.enabled && cue.status !== "complete"),
  };
}

function commandSummary(cue: RundownCue | undefined, events: StoredEvent[]) {
  if (!cue) return "No live cue is selected.";
  const event = events.find((item) => item.event.id === cue.executionId);
  return event ? `${event.event.t} · ${cue.label}` : `Saved rundown cue · ${cue.label}`;
}

export function RunContextPanel({ rundowns, rundownId, rundown, selectedProduction, disabledCueCount, apiConnection, streamConnection, sessionId, unresolvedOutbox, runWorkspace }: Pick<RunShellProps, "rundowns" | "rundownId" | "rundown" | "selectedProduction" | "disabledCueCount" | "apiConnection" | "streamConnection" | "sessionId" | "unresolvedOutbox" | "runWorkspace">) {
  const rundownName = rundowns.find((item) => item.id === rundownId)?.name ?? "Not selected";
  return <section className="run-context-panel" aria-label="Live operation context">
    <div className="run-panel-heading"><span>Live operation</span><h2>{runWorkspace.runReady ? "Session active" : "Entry readiness"}</h2></div>
    <dl>
      <div><dt>Production</dt><dd>{selectedProduction?.title ?? "Not selected"}</dd></div>
      <div><dt>Rundown</dt><dd>{rundownName}</dd></div>
      <div><dt>Session</dt><dd>{sessionId || "No active session"}</dd></div>
      <div><dt>Cues</dt><dd>{rundown.length} total · {disabledCueCount} disabled</dd></div>
      <div><dt>API</dt><dd>{apiConnection}</dd></div>
      <div><dt>Stream</dt><dd>{streamConnection}</dd></div>
    </dl>
    {unresolvedOutbox.length > 0 && <p className="run-context-panel__warning">{unresolvedOutbox.length} durable delivery issue{unresolvedOutbox.length === 1 ? "" : "s"} need resolution.</p>}
    {!runWorkspace.runReady && <p className="hint">Review the live state, then start or resume the session from the operational panel. This does not take a cue.</p>}
  </section>;
}

export function RunProgrammeStage({ sessionId, rundown, events, outbox, programmePreviewUrl, runWorkspace }: Pick<RunShellProps, "sessionId" | "rundown" | "events" | "outbox" | "programmePreviewUrl" | "runWorkspace">) {
  const { current } = cueContext(rundown, runWorkspace.runCueIndex);
  const latestDelivery = [...outbox].sort((a, b) => b.revision - a.revision)[0];
  const currentContext = current ? `${current.order}. ${current.label}` : "Waiting for a live cue";
  return <section className="run-programme-stage" aria-label="Fitted live programme preview">
    <div className="run-stage__live"><StatusBadge status="live" label="LIVE" /><span>{sessionId ? "Live execution session active" : "Live session not started"}</span></div>
    <div className="run-stage__heading"><div><span>Programme preview</span><h1>{currentContext}</h1></div><span>{latestDelivery ? `Revision ${latestDelivery.revision} · ${latestDelivery.status}` : "No delivered revision"}</span></div>
    <div className="run-stage__canvas">
      <div className="run-stage__header">Header</div><div className="run-stage__rail">Left rail</div>
      <div className="run-stage__video"><span>16:9 live programme monitor</span><strong>{commandSummary(current, events)}</strong><small>{sessionId ? "Presentation state follows the active live session." : "Start or resume a live session to operate this output."}</small></div>
      <div className="run-stage__rail">Right rail</div><div className="run-stage__footer">Footer</div>
    </div>
    <div className="run-stage__footerbar"><span>Fitted live-state preview — command dispatch is available only in the cue-control panel.</span>{programmePreviewUrl ? <a href={programmePreviewUrl} target="_blank" rel="noreferrer">Open real output</a> : <span>Choose a channel to open real output.</span>}</div>
  </section>;
}

export function RunDispatchPanel({ rundown, events, outbox, unresolvedOutbox, status, error, runWorkspace, resolveOutbox }: Pick<RunShellProps, "rundown" | "events" | "outbox" | "unresolvedOutbox" | "status" | "error" | "runWorkspace" | "resolveOutbox">) {
  const { current } = cueContext(rundown, runWorkspace.runCueIndex);
  const latestDelivery = [...outbox].sort((a, b) => b.revision - a.revision)[0];
  return <section className="run-dispatch-panel" aria-label="Live dispatch and delivery recovery">
    <div className="run-panel-heading"><span>Live delivery</span><h2>{unresolvedOutbox.length ? "Delivery needs resolution" : "Dispatch status"}</h2></div>
    <dl className="run-dispatch-panel__summary">
      <div><dt>Current cue</dt><dd>{current?.label ?? "No selected cue"}</dd></div>
      <div><dt>Command</dt><dd>{commandSummary(current, events)}</dd></div>
      <div><dt>Latest revision</dt><dd>{latestDelivery ? `${latestDelivery.revision} · ${latestDelivery.status}` : "Not dispatched"}</dd></div>
    </dl>
    {status && <p className="run-dispatch-panel__status" role="status">{status}</p>}
    {error && <p className="run-dispatch-panel__error" role="alert">{error}</p>}
    {unresolvedOutbox.length > 0 ? <div className="run-delivery-issues" role="alert"><ValidationMessage type="error" message="Later live cues are blocked until the durable delivery issue is resolved." />{unresolvedOutbox.map((item) => <article key={item.id}><div><strong>{item.label}</strong><span>Revision {item.revision} · {item.status}</span>{item.error && <small>{item.error}</small>}</div><div><SecondaryAction disabled={!item.retryable} onClick={() => resolveOutbox(item, "retry")}>Retry same command</SecondaryAction><DangerAction disabled={!item.cancellable} onClick={() => resolveOutbox(item, "cancel")}>Cancel and resolve revision</DangerAction></div></article>)}</div> : <p className="run-dispatch-panel__clear">No unresolved durable delivery. The next live cue can be taken when ready.</p>}
  </section>;
}

export function RunOperationsPanel({ rundownId, rundown, unresolvedOutbox, runWorkspace }: Pick<RunShellProps, "rundownId" | "rundown" | "unresolvedOutbox" | "runWorkspace">) {
  const { previous, current, next } = cueContext(rundown, runWorkspace.runCueIndex);
  const reason = liveGoDisabledReason({ runReady: runWorkspace.runReady, unresolvedOutbox, cue: runWorkspace.runCue, going: runWorkspace.going });
  return <section className="run-operations-panel" aria-label="Live cue stack and controls">
    <div className="run-panel-heading"><span>Live output</span><h2>Cue stack</h2></div>
    <div className="run-operations-panel__context"><span>Previous: {previous ? `${previous.order}. ${previous.label}` : "—"}</span><strong>Current: {current ? `${current.order}. ${current.label}` : "—"}</strong><span>Next: {next ? `${next.order}. ${next.label}` : "—"}</span></div>
    <CueList ariaLabel="Live cue stack">{rundown.map((cue, index) => <CueListItem key={cue.id} order={cue.order} label={cue.label} status={cue.status} enabled={cue.enabled} active={index === runWorkspace.runCueIndex} onSelect={() => runWorkspace.setRunCueIndex(index)} />)}</CueList>
    {!runWorkspace.runReady ? <PrimaryAction className="run-entry__go" disabled={!rundownId} onClick={runWorkspace.enterRun}>{"Start live session"}</PrimaryAction> : <><PrimaryAction className="action-btn--go" disabled={Boolean(reason)} onClick={() => { if (runWorkspace.runCue) void executeLiveCue(runWorkspace.runCue, runWorkspace.goCue); }}>GO</PrimaryAction>{reason && <p className="run-operations-panel__reason">{reason}</p>}<SafetyAction onClick={() => runWorkspace.setConfirmation("safe-clear")}>Safe Clear</SafetyAction><div className="run-operations-panel__safety"><SecondaryAction onClick={() => runWorkspace.setConfirmation("complete")}>Complete show</SecondaryAction><DangerAction onClick={() => runWorkspace.setConfirmation("abandon")}>Abandon session</DangerAction><SecondaryAction onClick={() => runWorkspace.setConfirmation("reset")}>Reset live session</SecondaryAction></div></>}
  </section>;
}

export function ConfirmationDialog({ runWorkspace }: { runWorkspace: ReturnType<typeof useRunWorkspace> }) {
  if (!runWorkspace.confirmation) return null;
  return <div className="confirmation-backdrop" role="presentation"><section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-description"><h2 id="confirmation-title">{runWorkspace.confirmation === "complete" ? "Complete this live show?" : runWorkspace.confirmation === "abandon" ? "Abandon this live session?" : runWorkspace.confirmation === "safe-clear" ? "Confirm Safe Clear?" : "Start a new live session?"}</h2><p id="confirmation-description">{runWorkspace.confirmation === "complete" ? "The current session will be marked complete. Programme presentation is not cleared automatically." : runWorkspace.confirmation === "abandon" ? "The current session will be recorded as abandoned. Programme presentation is not cleared automatically." : runWorkspace.confirmation === "safe-clear" ? "Safe Clear removes active presentation graphics. Programme video will continue uninterrupted." : "The current live session will be completed and a fresh immutable rundown session will begin."}</p><div><button onClick={() => runWorkspace.setConfirmation(null)}>Cancel</button><button ref={runWorkspace.confirmationButton} className="danger" onClick={runWorkspace.confirmSessionAction}>{runWorkspace.confirmation === "safe-clear" ? "Confirm Safe Clear" : "Confirm"}</button></div></section></div>;
}
