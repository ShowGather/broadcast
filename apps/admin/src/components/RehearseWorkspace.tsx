import { useEffect, useMemo, useState } from "react";
import type { useRundownEditor } from "../hooks/useRundownEditor.js";
import type { useRunWorkspace } from "../hooks/useRunWorkspace.js";
import type { RundownCue, RundownDefinitionCue } from "../types.js";
import { CueList, CueListItem } from "./ui/CueList.js";
import { PrimaryAction, SecondaryAction } from "./ui/ActionButtons.js";
import { ProfileSelector } from "./ui/ProfileSelector.js";

type Profile = "desktop" | "mobile" | "tv";
type RehearsalResult = { tone: "success" | "error"; message: string; at: string } | null;

export interface RehearsalShellProps {
  rundownId: string;
  rundown: RundownCue[];
  sessionId: string;
  previewProfile: Profile;
  setPreviewProfile: (profile: Profile) => void;
  playerPreviewUrl: string;
  runWorkspace: ReturnType<typeof useRunWorkspace>;
  rundownEditor: ReturnType<typeof useRundownEditor>;
  mutate: (url: string, method: "POST" | "PUT", body: Record<string, unknown>, success: string, reload?: () => Promise<void>) => Promise<{ id?: string } | undefined>;
  fetchRundown: () => Promise<void>;
  returnToPrepare: () => void;
}

export function rehearsalGoDisabledReason(cue: RundownCue | null, executing: boolean, rundownId: string) {
  if (!rundownId) return "Choose a rundown before rehearsing.";
  if (!cue) return "Select a cue from the rehearsal stack.";
  if (!cue.enabled) return "This cue is disabled in the saved rundown.";
  if (cue.status === "active") return "This cue is already being rehearsed.";
  if (cue.status === "cancelled") return "This cue is cancelled.";
  if (executing) return "Rehearsal dispatch is in progress.";
  return "";
}

export async function executeRehearsalCue(cue: RundownCue, goCue: (cue: RundownCue, rerun?: boolean) => Promise<{ success?: string; error?: string }>, rerun = false) {
  return goCue(cue, rerun);
}

export function useRehearsalWorkspace(props: Pick<RehearsalShellProps, "rundownId" | "rundown" | "sessionId" | "runWorkspace" | "mutate" | "fetchRundown">) {
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const [result, setResult] = useState<RehearsalResult>(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    setSelectedCueId((current) => props.rundown.some((cue) => cue.id === current) ? current : null);
  }, [props.rundown]);
  useEffect(() => { setSelectedCueId(null); setResult(null); }, [props.rundownId]);

  const selectedCue = props.rundown.find((cue) => cue.id === selectedCueId) ?? null;
  const selectedIndex = selectedCue ? props.rundown.findIndex((cue) => cue.id === selectedCue.id) : -1;
  const currentCue = selectedCue ?? props.rundown.find((cue) => cue.status === "active") ?? null;
  const currentIndex = currentCue ? props.rundown.findIndex((cue) => cue.id === currentCue.id) : -1;
  const previousCue = currentIndex > 0 ? props.rundown[currentIndex - 1] ?? null : null;
  const nextCue = currentIndex >= 0 ? props.rundown.slice(currentIndex + 1).find((cue) => cue.enabled && cue.status !== "complete") ?? null : null;

  const go = async (rerun = false) => {
    const reason = rehearsalGoDisabledReason(selectedCue, executing, props.rundownId);
    if (reason || !selectedCue) return;
    setExecuting(true);
    try {
      const outcome = await executeRehearsalCue(selectedCue, props.runWorkspace.goCue, rerun);
      setResult({ tone: outcome.error ? "error" : "success", message: outcome.error ?? outcome.success ?? "Rehearsal cue completed.", at: new Date().toLocaleTimeString() });
    } finally { setExecuting(false); }
  };

  const reset = async () => {
    if (!props.rundownId || executing) return;
    setExecuting(true);
    try {
      const result = await props.mutate(`/api/rundown/rehearsal/sessions?rundownId=${encodeURIComponent(props.rundownId)}`, "POST", {}, "Rehearsal session reset", props.fetchRundown);
      setResult({ tone: result ? "success" : "error", message: result ? "A new rehearsal session is active. Live output was not changed." : "Unable to reset rehearsal session.", at: new Date().toLocaleTimeString() });
    } finally { setExecuting(false); }
  };

  return { selectedCueId, setSelectedCueId, selectedCue, selectedIndex, currentCue, previousCue, nextCue, result, executing, go, reset } as const;
}

type RehearsalUi = ReturnType<typeof useRehearsalWorkspace>;

function cueDefinition(rundownEditor: RehearsalShellProps["rundownEditor"], id: string | undefined) {
  return rundownEditor.rundownDefinition.find((cue) => cue.id === id) ?? null;
}
function commandSummary(cue: RundownDefinitionCue | null) {
  if (!cue) return "Command details are unavailable until the rundown definition loads.";
  const command = cue.commandPayload;
  const kind = typeof command.k === "string" ? command.k : "presentation";
  const title = typeof command.t === "string" ? command.t : typeof command.b === "string" ? command.b : typeof command.l === "string" ? command.l : "";
  return `${kind}${title ? ` · ${title}` : ""}`;
}

export function RehearsalContextPanel({ previewProfile, setPreviewProfile, sessionId, returnToPrepare }: Pick<RehearsalShellProps, "previewProfile" | "setPreviewProfile" | "sessionId" | "returnToPrepare">) {
  return <section className="rehearsal-context-panel" aria-label="Rehearsal context"><div className="rehearsal-panel-heading"><span>Rehearsal</span><h2>Not live</h2></div><ProfileSelector profiles={["desktop", "mobile", "tv"]} selected={previewProfile} onSelect={(profile) => setPreviewProfile(profile as Profile)} label="Rehearsal output profile" /><p className="rehearsal-context-panel__session"><strong>Session</strong>{sessionId ? <span>{sessionId}</span> : <span>Created when the first rehearsal cue is taken.</span>}</p><p className="hint">Rehearsal cues use the isolated preview pathway only.</p><SecondaryAction onClick={returnToPrepare}>Return to Prepare</SecondaryAction></section>;
}

export function RehearsalProgrammeStage({ ui, previewProfile, playerPreviewUrl }: Pick<RehearsalShellProps, "previewProfile" | "playerPreviewUrl"> & { ui: RehearsalUi }) {
  const context = ui.currentCue ? `${ui.currentCue.order}. ${ui.currentCue.label}` : "Waiting for a rehearsal cue";
  return <section className="rehearsal-programme-stage" aria-label="Fitted rehearsal programme preview"><div className="rehearsal-stage__warning"><strong>REHEARSAL — NOT LIVE</strong><span>Only opted-in rehearsal Players receive this output.</span></div><div className="rehearsal-stage__heading"><div><span>Rehearsal programme</span><h1>{context}</h1></div><span>{previewProfile} profile</span></div><div className={`rehearsal-stage__canvas rehearsal-stage__canvas--${previewProfile}`}><div className="rehearsal-stage__header">Header</div><div className="rehearsal-stage__rail">Left rail</div><div className="rehearsal-stage__video"><span>16:9 rehearsal monitor</span><strong>{ui.result?.message ?? context}</strong></div><div className="rehearsal-stage__rail">Right rail</div><div className="rehearsal-stage__footer">Footer</div></div><div className="rehearsal-stage__footerbar"><span>Fitted rehearsal state preview — never a live programme output.</span>{playerPreviewUrl ? <a href={playerPreviewUrl} target="_blank" rel="noreferrer">Open real rehearsal output</a> : null}</div></section>;
}

export function RehearsalResultPanel({ ui, rundownEditor, sessionId }: Pick<RehearsalShellProps, "rundownEditor" | "sessionId"> & { ui: RehearsalUi }) {
  const definition = cueDefinition(rundownEditor, ui.selectedCue?.id);
  return <section className="rehearsal-result-panel" aria-label="Selected rehearsal cue and result">{ui.selectedCue ? <><div className="rehearsal-panel-heading"><span>Selected cue</span><h2>{ui.selectedCue.order}. {ui.selectedCue.label}</h2></div><dl><div><dt>Command</dt><dd>{commandSummary(definition)}</dd></div><div><dt>State</dt><dd>{ui.selectedCue.status}</dd></div><div><dt>Enabled</dt><dd>{ui.selectedCue.enabled ? "Yes" : "No"}</dd></div><div><dt>Execution</dt><dd>{ui.selectedCue.executionId ?? "Not yet executed"}</dd></div></dl></> : <div className="rehearsal-result-panel__empty"><strong>No cue selected</strong><span>Select a cue from the rehearsal stack to view its saved command and result.</span></div>}{ui.result && <div className={`rehearsal-result rehearsal-result--${ui.result.tone}`} role={ui.result.tone === "error" ? "alert" : "status"}><strong>{ui.result.tone === "error" ? "Rehearsal failed" : "Rehearsal result"}</strong><span>{ui.result.message}</span><small>{ui.result.at}</small></div>}<p className="rehearsal-result-panel__session">{sessionId ? `Active rehearsal session: ${sessionId}` : "No session yet. Taking a cue creates or resumes rehearsal only."}</p></section>;
}

export function RehearsalCueStackPanel({ ui, rundown, rundownId, returnToPrepare }: Pick<RehearsalShellProps, "rundown" | "rundownId" | "returnToPrepare"> & { ui: RehearsalUi }) {
  const reason = rehearsalGoDisabledReason(ui.selectedCue, ui.executing, rundownId);
  return <section className="rehearsal-cue-stack" aria-label="Rehearsal cue stack"><div className="rehearsal-panel-heading"><span>Rehearsal output</span><h2>Cue stack</h2></div><div className="rehearsal-cue-stack__context"><span>Previous: {ui.previousCue ? `${ui.previousCue.order}. ${ui.previousCue.label}` : "—"}</span><strong>Current: {ui.currentCue ? `${ui.currentCue.order}. ${ui.currentCue.label}` : "—"}</strong><span>Next: {ui.nextCue ? `${ui.nextCue.order}. ${ui.nextCue.label}` : "—"}</span></div><CueList ariaLabel="Rehearsal cues">{rundown.map((cue) => <CueListItem key={cue.id} order={cue.order} label={cue.label} status={cue.status} enabled={cue.enabled} active={cue.id === ui.selectedCueId} onSelect={() => ui.setSelectedCueId(cue.id)} />)}</CueList><PrimaryAction className="rehearsal-go" disabled={Boolean(reason)} onClick={() => ui.go()}>GO IN REHEARSAL</PrimaryAction>{reason && <p className="rehearsal-go__reason">{reason}</p>}{ui.selectedCue?.status === "complete" && <SecondaryAction onClick={() => ui.go(true)} disabled={ui.executing}>Re-run in rehearsal</SecondaryAction>}<SecondaryAction disabled={!rundownId || ui.executing} onClick={ui.reset}>Reset rehearsal</SecondaryAction><SecondaryAction onClick={returnToPrepare}>Return to Prepare</SecondaryAction></section>;
}
