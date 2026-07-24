"use client";

import { useAdminState } from "@/lib/admin-state";
import { ThreeColumnWorkspace } from "@/components/ui/three-column-workspace";
import { WorkspacePanel } from "@/components/ui/workspace-panel";
import { CueList, CueListItem } from "@/components/ui/cue-list";
import { PrimaryAction, SecondaryAction } from "@/components/ui/action-buttons";
import { ProfileSelector } from "@/components/ui/profile-selector";
import { AdminPreview } from "@/components/ui/admin-preview";

export function RundownWorkspace() {
  const { productionId, rundownId, setRundownId, mutate, rundowns, refreshRundowns, rundownEditor, commandBuilder, previewProfile, setPreviewProfile, layoutPreviewUrl } = useAdminState();

  const left = (
    <WorkspacePanel heading="Rundown editor">
      <div className="form" style={{ marginBottom: 14 }}>
        <label><span>Rundown name</span><input value={rundownEditor.rundownName} onChange={(e) => rundownEditor.setRundownName(e.target.value)} /></label>
        <div style={{ display: "flex", gap: 8 }}>
          <PrimaryAction disabled={!productionId} onClick={async () => {
            const result = await mutate(`/api/productions/${productionId}/rundowns`, "POST", { name: rundownEditor.rundownName || "New rundown" }, "Rundown created");
            if (result?.id) { await refreshRundowns(); setRundownId(result.id); }
          }}>Create rundown</PrimaryAction>
          <PrimaryAction disabled={!rundownId} onClick={() => mutate(`/api/rundowns/${rundownId}`, "PUT", { name: rundownEditor.rundownName }, "Rundown saved", rundownEditor.reloadRundownDefinition)}>Save rundown</PrimaryAction>
          <SecondaryAction disabled={!rundownId} onClick={async () => {
            const result = await mutate(`/api/rundowns/${rundownId}/duplicate`, "POST", {}, "Rundown duplicated");
            if (result?.id) { await refreshRundowns(); setRundownId(result.id); }
          }}>Duplicate</SecondaryAction>
        </div>
      </div>
      <ProfileSelector profiles={["desktop", "mobile", "tv"]} selected={previewProfile} onSelect={(p) => setPreviewProfile(p as "desktop" | "mobile" | "tv")} label="Preview profile" />
      <WorkspacePanel heading="Command builder" variant="control" style={{ marginTop: 14 }}>
        <p className="hint" style={{ marginBottom: 12 }}>The typed command form can send immediately or save a new cue into this rundown.</p>
        <div className="form">
          <label><span>Action</span>
            <select value={commandBuilder.commandKind} onChange={(e) => { commandBuilder.setCommandKind(e.target.value); commandBuilder.setPrimary(""); commandBuilder.setSecondary(""); commandBuilder.setLabel(""); }}>
              <option value="score">Score update</option><option value="lower">Lower third</option><option value="alert">Alert</option><option value="sponsor">Sponsor takeover</option><option value="ticker">Ticker update</option><option value="clock">Programme clock</option><option value="clear">Regional clear</option>
            </select>
          </label>
          {commandBuilder.commandKind !== "clear" && (
            <label><span>Presentation instance (optional)</span><input value={commandBuilder.commandInstanceId} maxLength={24} pattern="[A-Za-z0-9][A-Za-z0-9-]*" onChange={(e) => commandBuilder.setCommandInstanceId(e.target.value)} placeholder="scorebug-main" /></label>
          )}
          {commandBuilder.commandKind === "score" ? (<>
            <label><span>Home score</span><input type="number" min={0} max={999} value={commandBuilder.primary} onChange={(e) => commandBuilder.setPrimary(e.target.value)} /></label>
            <label><span>Away score</span><input type="number" min={0} max={999} value={commandBuilder.secondary} onChange={(e) => commandBuilder.setSecondary(e.target.value)} /></label>
            <label><span>Label</span><input value={commandBuilder.label} maxLength={12} onChange={(e) => commandBuilder.setLabel(e.target.value)} placeholder="GOAL" /></label>
          </>) : commandBuilder.commandKind === "clear" ? (<>
            <label><span>Region</span>
              <select value={commandBuilder.primary} onChange={(e) => commandBuilder.setPrimary(e.target.value)}>
                <option value="">All regions</option><option value="v">Video overlay</option><option value="h">Header</option><option value="l">Left rail</option><option value="r">Right rail</option><option value="f">Footer</option>
              </select>
            </label>
            <label><span>Layer (optional)</span><input value={commandBuilder.secondary} maxLength={16} onChange={(e) => commandBuilder.setSecondary(e.target.value)} placeholder="primary" /></label>
          </>) : commandBuilder.commandKind === "clock" ? (<>
            <label><span>Clock time</span><input value={commandBuilder.primary} maxLength={12} onChange={(e) => commandBuilder.setPrimary(e.target.value)} placeholder="78:42" /></label>
            <label><span>Clock label</span><input value={commandBuilder.label} maxLength={12} onChange={(e) => commandBuilder.setLabel(e.target.value)} placeholder="LIVE" /></label>
          </>) : (<>
            <label><span>{commandBuilder.commandKind === "sponsor" ? "Brand" : commandBuilder.commandKind === "ticker" ? "Ticker text" : "Title"}</span><input value={commandBuilder.primary} maxLength={20} onChange={(e) => commandBuilder.setPrimary(e.target.value)} /></label>
            {commandBuilder.commandKind !== "ticker" && <label><span>{commandBuilder.commandKind === "alert" ? "Message" : "Subtitle / tagline"}</span><input value={commandBuilder.secondary} maxLength={20} onChange={(e) => commandBuilder.setSecondary(e.target.value)} /></label>}
            {commandBuilder.commandKind === "ticker" && <label><span>Label</span><input value={commandBuilder.label} maxLength={12} onChange={(e) => commandBuilder.setLabel(e.target.value)} /></label>}
            {commandBuilder.commandKind !== "ticker" && <label><span>Duration (ms)</span><input type="number" min={1000} step={1000} value={commandBuilder.commandDuration} onChange={(e) => commandBuilder.setCommandDuration(Number(e.target.value))} /></label>}
          </>)}
        </div>
      </WorkspacePanel>
    </WorkspacePanel>
  );

  const centre = (
    <AdminPreview url={layoutPreviewUrl} title={`Rundown ${previewProfile} preview`} profile={previewProfile} showGuides />
  );

  const right = (
    <WorkspacePanel heading="Cue stack">
      <CueList heading="Persisted cues" ariaLabel="Rundown cues">
        {rundownEditor.rundownDefinition.map((cue, index) => (
          <CueListItem key={cue.id} order={cue.position} label={cue.label} status={cue.enabled ? "enabled" : "disabled"} enabled={cue.enabled}
            actions={<>
              <button onClick={() => rundownEditor.editCue(cue, { enabled: !cue.enabled })}>{cue.enabled ? "Disable" : "Enable"}</button>
              <button disabled={index === 0} onClick={() => rundownEditor.moveCue(index, -1)}>{'\u2191'}</button>
              <button disabled={index === rundownEditor.rundownDefinition.length - 1} onClick={() => rundownEditor.moveCue(index, 1)}>{'\u2193'}</button>
            </>} />
        ))}
      </CueList>
    </WorkspacePanel>
  );

  return <ThreeColumnWorkspace left={left} centre={centre} right={right} />;
}
