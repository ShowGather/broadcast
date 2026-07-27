import { useEffect, useMemo, useState } from "react";
import type { useRundownEditor } from "../hooks/useRundownEditor.js";
import type { useCommandBuilder } from "../hooks/useCommandBuilder.js";
import type { Rundown, RundownCue, RundownDefinitionCue } from "../types.js";
import { CueList, CueListItem } from "./ui/CueList.js";
import { PrimaryAction, SecondaryAction } from "./ui/ActionButtons.js";
import { ProfileSelector } from "./ui/ProfileSelector.js";

type Profile = "desktop" | "mobile" | "tv";
type CommandKind = "score" | "lower" | "alert" | "sponsor" | "ticker" | "clock" | "clear";

export interface RundownShellProps {
  productionId: string;
  rundownId: string;
  rundowns: Rundown[];
  rundown: RundownCue[];
  rundownEditor: ReturnType<typeof useRundownEditor>;
  commandBuilder: ReturnType<typeof useCommandBuilder>;
  setRundownId: (id: string) => void;
  refreshRundowns: () => Promise<void>;
  mutate: (url: string, method: "POST" | "PUT", body: Record<string, unknown>, success: string, reload?: () => Promise<void>) => Promise<{ id?: string } | undefined>;
  previewProfile: Profile;
  setPreviewProfile: (profile: Profile) => void;
  realOutputUrl: string;
  previewCue: (cue: RundownCue) => Promise<void>;
}

const COMMAND_TYPES: { kind: CommandKind; label: string; description: string }[] = [
  { kind: "score", label: "Score update", description: "Scorebug" },
  { kind: "lower", label: "Lower third", description: "Name and role" },
  { kind: "alert", label: "Alert", description: "Timed notice" },
  { kind: "sponsor", label: "Sponsor", description: "Partner takeover" },
  { kind: "ticker", label: "Ticker", description: "Persistent update" },
  { kind: "clock", label: "Programme clock", description: "Time indicator" },
  { kind: "clear", label: "Clear region", description: "Presentation clear" },
];

function commandName(command: Record<string, unknown>) {
  return COMMAND_TYPES.find((item) => item.kind === command.k)?.label ?? "Presentation command";
}

function resetForKind(commandBuilder: RundownShellProps["commandBuilder"], kind: CommandKind) {
  commandBuilder.setCommandKind(kind);
  commandBuilder.setPrimary("");
  commandBuilder.setSecondary("");
  commandBuilder.setLabel("");
  commandBuilder.setCommandDuration(8000);
  commandBuilder.setCommandInstanceId("");
}

function CommandFields({ commandBuilder }: Pick<RundownShellProps, "commandBuilder">) {
  const { commandKind } = commandBuilder;
  return <div className="rundown-cue-editor__fields form">
    <label>
      <span>Command type</span>
      <select value={commandKind} onChange={(event) => resetForKind(commandBuilder, event.target.value as CommandKind)}>
        {COMMAND_TYPES.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
      </select>
    </label>
    {commandKind !== "clear" && <label><span>Presentation instance (optional)</span><input value={commandBuilder.commandInstanceId} maxLength={24} pattern="[A-Za-z0-9][A-Za-z0-9-]*" onChange={(event) => commandBuilder.setCommandInstanceId(event.target.value)} placeholder="scorebug-main" /></label>}
    {commandKind === "score" ? <>
      <label><span>Home score</span><input type="number" min={0} max={999} value={commandBuilder.primary} onChange={(event) => commandBuilder.setPrimary(event.target.value)} /></label>
      <label><span>Away score</span><input type="number" min={0} max={999} value={commandBuilder.secondary} onChange={(event) => commandBuilder.setSecondary(event.target.value)} /></label>
      <label><span>Status label</span><input value={commandBuilder.label} maxLength={12} onChange={(event) => commandBuilder.setLabel(event.target.value)} placeholder="GOAL" /></label>
    </> : commandKind === "clear" ? <>
      <label><span>Region</span><select value={commandBuilder.primary} onChange={(event) => commandBuilder.setPrimary(event.target.value)}><option value="">All regions</option><option value="v">Video overlay</option><option value="h">Header</option><option value="l">Left rail</option><option value="r">Right rail</option><option value="f">Footer</option></select></label>
      <label><span>Layer (optional)</span><input value={commandBuilder.secondary} maxLength={16} onChange={(event) => commandBuilder.setSecondary(event.target.value)} placeholder="primary" /></label>
    </> : commandKind === "clock" ? <>
      <label><span>Clock time</span><input value={commandBuilder.primary} maxLength={12} onChange={(event) => commandBuilder.setPrimary(event.target.value)} placeholder="78:42" /></label>
      <label><span>Clock label</span><input value={commandBuilder.label} maxLength={12} onChange={(event) => commandBuilder.setLabel(event.target.value)} placeholder="LIVE" /></label>
    </> : <>
      <label><span>{commandKind === "sponsor" ? "Brand" : commandKind === "ticker" ? "Ticker text" : "Primary text"}</span><input value={commandBuilder.primary} maxLength={80} onChange={(event) => commandBuilder.setPrimary(event.target.value)} /></label>
      {commandKind !== "ticker" && <label><span>{commandKind === "alert" ? "Message" : "Secondary text"}</span><input value={commandBuilder.secondary} maxLength={80} onChange={(event) => commandBuilder.setSecondary(event.target.value)} /></label>}
      {commandKind === "ticker" && <label><span>Label</span><input value={commandBuilder.label} maxLength={12} onChange={(event) => commandBuilder.setLabel(event.target.value)} /></label>}
      {commandKind !== "ticker" && <label><span>Duration (ms)</span><input type="number" min={1000} step={1000} value={commandBuilder.commandDuration} onChange={(event) => commandBuilder.setCommandDuration(Number(event.target.value))} /></label>}
    </>}
  </div>;
}

export function RundownElementsPanel(props: RundownShellProps) {
  const { productionId, rundownId, rundowns, rundownEditor, commandBuilder, setRundownId, refreshRundowns, mutate } = props;
  const [newRundownName, setNewRundownName] = useState("");
  return <section className="rundown-elements-panel" aria-label="Rundown selection and cue creation">
    <div className="rundown-panel-heading"><span>Prepare</span><h2>Rundown</h2></div>
    <label className="rundown-compact-field"><span>Active rundown</span><select value={rundownId} onChange={(event) => setRundownId(event.target.value)}>{rundowns.length ? rundowns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">No rundowns</option>}</select></label>
    <label className="rundown-compact-field"><span>Rundown name</span><input value={rundownEditor.rundownName} onChange={(event) => rundownEditor.setRundownName(event.target.value)} /></label>
    <div className="rundown-compact-actions">
      <input aria-label="New rundown name" value={newRundownName} onChange={(event) => setNewRundownName(event.target.value)} placeholder="New rundown name" />
      <PrimaryAction disabled={!productionId || !newRundownName.trim()} onClick={async () => {
        const result = await mutate(`/api/productions/${productionId}/rundowns`, "POST", { name: newRundownName.trim() }, "Rundown created");
        if (result?.id) { await refreshRundowns(); setRundownId(result.id); setNewRundownName(""); }
      }}>Create rundown</PrimaryAction>
      <SecondaryAction disabled={!rundownId} onClick={async () => {
        const result = await mutate(`/api/rundowns/${rundownId}/duplicate`, "POST", {}, "Rundown duplicated");
        if (result?.id) { await refreshRundowns(); setRundownId(result.id); }
      }}>Duplicate rundown</SecondaryAction>
      <SecondaryAction disabled={!rundownId || !rundownEditor.rundownName.trim()} onClick={() => mutate(`/api/rundowns/${rundownId}`, "PUT", { name: rundownEditor.rundownName.trim() }, "Rundown saved", rundownEditor.reloadRundownDefinition)}>Save rundown</SecondaryAction>
    </div>
    <div className="rundown-element-library"><h3>Presentation elements</h3>{COMMAND_TYPES.map((item) => <button key={item.kind} type="button" className={commandBuilder.commandKind === item.kind ? "active" : ""} onClick={() => resetForKind(commandBuilder, item.kind)}><strong>{item.label}</strong><span>{item.description}</span></button>)}</div>
    <div className="rundown-add-cue"><p>Creates a saved cue from the selected typed command.</p><PrimaryAction disabled={!rundownId} onClick={() => rundownEditor.addCue()}>Add cue</PrimaryAction></div>
  </section>;
}

export function RundownProgrammeStage({ rundownEditor, previewProfile, setPreviewProfile, realOutputUrl }: Pick<RundownShellProps, "rundownEditor" | "previewProfile" | "setPreviewProfile" | "realOutputUrl">) {
  const selectedCue = rundownEditor.rundownDefinition.find((cue) => cue.id === rundownEditor.selectedCueId);
  return <section className="rundown-programme-stage" aria-label="Programme preview">
    <div className="rundown-stage__heading"><div><span>Programme preview</span><h1>{selectedCue ? `${selectedCue.position}. ${selectedCue.label}` : "Choose a cue to inspect"}</h1></div><ProfileSelector profiles={["desktop", "mobile", "tv"]} selected={previewProfile} onSelect={(profile) => setPreviewProfile(profile as Profile)} label="Programme preview profile" /></div>
    <div className={`rundown-stage__canvas rundown-stage__canvas--${previewProfile}`}>
      <div className="rundown-stage__header">Header</div><div className="rundown-stage__rail rundown-stage__rail--left">Left rail</div><div className="rundown-stage__video"><span>16:9 programme monitor</span><strong>{selectedCue ? commandName(selectedCue.commandPayload) : "No cue selected"}</strong></div><div className="rundown-stage__rail rundown-stage__rail--right">Right rail</div><div className="rundown-stage__footer">Footer</div>
    </div>
    <div className="rundown-stage__footerbar"><span>Fitted composition preview — it does not execute a cue.</span>{realOutputUrl ? <a href={realOutputUrl} target="_blank" rel="noreferrer">Open real output</a> : <span>Choose a channel to open real output.</span>}</div>
  </section>;
}

export function RundownCueEditor({ rundownEditor, commandBuilder }: Pick<RundownShellProps, "rundownEditor" | "commandBuilder">) {
  const selectedCue = rundownEditor.rundownDefinition.find((cue) => cue.id === rundownEditor.selectedCueId) ?? null;
  const [draftLabel, setDraftLabel] = useState("");
  useEffect(() => { setDraftLabel(selectedCue?.label ?? ""); }, [selectedCue?.id, selectedCue?.label]);
  if (!selectedCue) return <section className="rundown-cue-editor rundown-cue-editor--empty" aria-label="Selected cue editor"><strong>No cue selected</strong><span>Select a persisted cue from the cue stack to edit its label, command and timing.</span></section>;
  return <section className="rundown-cue-editor" aria-label="Selected cue editor"><div className="rundown-editor__heading"><div><span>Selected cue</span><h2>{selectedCue.position}. {selectedCue.label}</h2></div><span className={`cue-state cue-state--${selectedCue.enabled ? "enabled" : "disabled"}`}>{selectedCue.enabled ? "Enabled" : "Disabled"}</span></div><div className="rundown-cue-editor__layout"><div className="form"><label><span>Cue label</span><input value={draftLabel} maxLength={80} onChange={(event) => setDraftLabel(event.target.value)} /></label><label><span>Timing</span><input value={`Rundown position ${selectedCue.position}`} disabled /></label><label className="rundown-enabled-toggle"><input type="checkbox" checked={selectedCue.enabled} onChange={(event) => rundownEditor.editCue(selectedCue, { enabled: event.target.checked })} /><span>Enabled</span></label></div><CommandFields commandBuilder={commandBuilder} /></div><div className="rundown-editor__actions"><PrimaryAction disabled={!draftLabel.trim()} onClick={() => rundownEditor.editCue(selectedCue, { label: draftLabel.trim(), command: commandBuilder.currentCommand(), enabled: selectedCue.enabled })}>Save cue</PrimaryAction><SecondaryAction onClick={() => rundownEditor.duplicateCue(selectedCue)}>Duplicate cue</SecondaryAction><SecondaryAction onClick={() => rundownEditor.moveCue(selectedCue.position - 1, -1)} disabled={selectedCue.position === 1}>Move up</SecondaryAction><SecondaryAction onClick={() => rundownEditor.moveCue(selectedCue.position - 1, 1)} disabled={selectedCue.position === rundownEditor.rundownDefinition.length}>Move down</SecondaryAction><span className="rundown-editor__validation">Changes are validated by the saved command model.</span></div></section>;
}

export function RundownCueStackPanel({ rundownEditor, commandBuilder, rundown, previewCue }: Pick<RundownShellProps, "rundownEditor" | "commandBuilder" | "rundown" | "previewCue">) {
  const runtimeById = useMemo(() => new Map(rundown.map((cue) => [cue.id, cue])), [rundown]);
  const selectedIndex = rundownEditor.rundownDefinition.findIndex((cue) => cue.id === rundownEditor.selectedCueId);
  const selectedCue = selectedIndex >= 0 ? rundownEditor.rundownDefinition[selectedIndex] : null;
  const runtimeCue = selectedCue ? runtimeById.get(selectedCue.id) : undefined;
  const selectCue = (cue: RundownDefinitionCue) => { rundownEditor.setSelectedCueId(cue.id); commandBuilder.loadCommand(cue.commandPayload); };
  const previous = selectedIndex > 0 ? rundownEditor.rundownDefinition[selectedIndex - 1] : null;
  const next = selectedIndex >= 0 ? rundownEditor.rundownDefinition[selectedIndex + 1] ?? null : null;
  return <section className="rundown-cue-stack" aria-label="Persisted cue stack"><div className="rundown-panel-heading"><span>Persisted cues</span><h2>Cue stack</h2></div>{selectedCue && <div className="rundown-cue-stack__context"><span>Previous: {previous ? `${previous.position}. ${previous.label}` : "—"}</span><strong>Current: {selectedCue.position}. {selectedCue.label}</strong><span>Next: {next ? `${next.position}. ${next.label}` : "—"}</span></div>}<CueList ariaLabel="Persisted rundown cues">{rundownEditor.rundownDefinition.map((cue) => { const runtime = runtimeById.get(cue.id); return <CueListItem key={cue.id} order={cue.position} label={cue.label} status={runtime?.status ?? (cue.enabled ? "pending" : "disabled")} enabled={cue.enabled} active={cue.id === rundownEditor.selectedCueId} onSelect={() => selectCue(cue)} />; })}</CueList>{selectedCue ? <PrimaryAction disabled={!runtimeCue || !selectedCue.enabled || runtimeCue.status === "active" || runtimeCue.status === "cancelled"} onClick={() => runtimeCue && previewCue(runtimeCue)}>Preview selected cue</PrimaryAction> : <p className="hint">Select a cue to preview it in rehearsal only.</p>}<p className="rundown-cue-stack__note">Preview uses the isolated rehearsal pathway. It never sends a live GO command.</p></section>;
}
