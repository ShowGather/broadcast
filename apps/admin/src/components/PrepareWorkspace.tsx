import type { useShowConfiguration } from "../hooks/useShowConfiguration.js";
import type { useRundownEditor } from "../hooks/useRundownEditor.js";
import type { useCommandBuilder } from "../hooks/useCommandBuilder.js";
import { useAdminState } from "./AdminStateContext.js";

interface Props {
  prepareTab: string;
  showConfig: ReturnType<typeof useShowConfiguration>;
  rundownEditor: ReturnType<typeof useRundownEditor>;
  commandBuilder: ReturnType<typeof useCommandBuilder>;
  setRundownId: (id: string) => void;
  selectedProduction: { configuration?: unknown } | undefined;
  disabledCueCount: number;
  createProduction: () => Promise<void>;
  duplicateProduction: () => Promise<void>;
  refreshRundowns: () => Promise<void>;
  previewProfile: "desktop" | "mobile" | "tv";
  setPreviewProfile: (p: "desktop" | "mobile" | "tv") => void;
  layoutPreviewUrl: string;
}

export function PrepareWorkspace({ prepareTab, showConfig, rundownEditor, commandBuilder, setRundownId, selectedProduction, disabledCueCount, createProduction, duplicateProduction, refreshRundowns, previewProfile, setPreviewProfile, layoutPreviewUrl }: Props) {
  const { productionId, rundownId, navigate, mutate, setStatus, setError } = useAdminState();
  return <>
    <section className={`section elements-panel${showConfig.elementsOpen ? "" : " elements-panel--collapsed"}`} hidden={prepareTab !== "configuration"}>
      <div className="workspace-heading"><div><h2>Elements</h2><p className="hint">Choose a presentation source to target its stable instance, suggested command, and placement preset.</p></div><button type="button" className="elements-panel__toggle" aria-expanded={showConfig.elementsOpen} onClick={() => showConfig.setElementsOpen((open) => !open)}>{showConfig.elementsOpen ? "Collapse" : "Open elements"}</button></div>
      {showConfig.elementsOpen && <div className="element-library" role="list" aria-label="Presentation elements">
        {(["scorebug", "lower-third", "ticker", "alert", "sponsor-panel", "clock"] as const).map((kind) => <button key={kind} type="button" role="listitem" draggable className={showConfig.selectedElement === kind ? "active" : ""} onDragStart={(event) => { event.dataTransfer.setData("application/x-showgather-element", kind); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => showConfig.chooseElement(kind)}>{kind === "sponsor-panel" ? "Sponsor bug" : kind.replace("-", " ")}</button>)}
      </div>}
      {showConfig.elementsOpen && <div className="placement-zones" aria-label="Video placement presets"><span>Drag an element onto a named placement preset</span><div>{(["top-left", "top-centre", "top-right", "centre-left", "centre", "centre-right", "bottom-left", "bottom-centre", "bottom-right"] as const).map((anchor) => <button key={anchor} type="button" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const kind = event.dataTransfer.getData("application/x-showgather-element"); if (["scorebug", "lower-third", "ticker", "alert", "sponsor-panel", "clock"].includes(kind)) showConfig.dropElementOnPreset(kind as "scorebug" | "lower-third" | "ticker" | "alert" | "sponsor-panel" | "clock", anchor); }} onClick={() => showConfig.dropElementOnPreset(showConfig.selectedElement as "scorebug" | "lower-third" | "ticker" | "alert" | "sponsor-panel" | "clock", anchor)}>{anchor.replace("-", " ")}</button>)}</div></div>}
    </section>

    <section className="section prepare-content" hidden={prepareTab === "rundown" || prepareTab === "viewer"}>
      <div hidden={prepareTab !== "overview"} className="prepare-overview">
        <div>
          <h2>Production editor</h2>
          <div className="form">
            <label><span>Title</span><input value={showConfig.productionTitle} onChange={(event) => showConfig.setProductionTitle(event.target.value)} /></label>
            <label><span>Description</span><input value={showConfig.productionDescription} onChange={(event) => showConfig.setProductionDescription(event.target.value)} /></label>
            <label><span>Status</span><select value={showConfig.productionStatus} onChange={(event) => showConfig.setProductionStatus(event.target.value)}><option value="draft">Draft</option><option value="rehearsal">Rehearsal</option><option value="live">Live</option><option value="complete">Complete</option><option value="archived">Archived</option></select></label>
            <button onClick={() => createProduction()}>Create production</button><button disabled={!productionId} onClick={() => mutate(`/api/productions/${productionId}`, "PUT", { title: showConfig.productionTitle, description: showConfig.productionDescription, status: showConfig.productionStatus }, "Production saved", showConfig.reloadProduction)}>Save production</button><button disabled={!productionId} onClick={duplicateProduction}>Duplicate production</button>
          </div>
        </div>
        <aside className="readiness-panel" aria-label="Show readiness">
          <h2>Show readiness</h2>
          <ul>
            <li className={showConfig.productionTitle.trim() ? "ready" : "attention"}>{showConfig.productionTitle.trim() ? "Production details ready" : "Add production details"}</li>
            <li className={selectedProduction?.configuration ? "ready" : "attention"}>{selectedProduction?.configuration ? "Show configuration selected" : "Select or create show configuration"}</li>
            <li className={rundownId ? "ready" : "attention"}>{rundownId ? `Rundown created${rundownEditor.rundownDefinition.length ? ` · ${rundownEditor.rundownDefinition.length} cues` : " · add cues"}` : "Create a rundown"}</li>
            <li className={disabledCueCount === 0 ? "ready" : "attention"}>{disabledCueCount === 0 ? "No disabled cues" : `${disabledCueCount} disabled cue${disabledCueCount === 1 ? "" : "s"}`}</li>
            <li className="attention">No rehearsal completed yet</li>
          </ul>
          <button type="button" disabled={!productionId || !rundownId} onClick={() => navigate({ workspace: "rehearse", productionId })}>Open rehearsal</button>
        </aside>
      </div>

      <div hidden={prepareTab !== "configuration"}>
        <h2>Show configuration</h2>
        <div className="form">
          <label><span>Package name</span><input value={showConfig.configurationName} onChange={(event) => showConfig.setConfigurationName(event.target.value)} /></label>
          <label><span>Home team</span><input maxLength={20} value={showConfig.homeTeam} onChange={(event) => showConfig.setHomeTeam(event.target.value)} /></label>
          <label><span>Away team</span><input maxLength={20} value={showConfig.awayTeam} onChange={(event) => showConfig.setAwayTeam(event.target.value)} /></label>
          <label><span>Ticker label</span><input maxLength={12} value={showConfig.tickerLabel} onChange={(event) => showConfig.setTickerLabel(event.target.value)} /></label>
          <label><span>Programme title</span><input maxLength={80} value={showConfig.programmeTitle} onChange={(event) => showConfig.setProgrammeTitle(event.target.value)} placeholder="Saturday Match" /></label>
          <label><span>Programme subtitle</span><input maxLength={80} value={showConfig.programmeSubtitle} onChange={(event) => showConfig.setProgrammeSubtitle(event.target.value)} placeholder="Live from the stadium" /></label>
          <label><span>Live label</span><input maxLength={80} value={showConfig.liveLabel} onChange={(event) => showConfig.setLiveLabel(event.target.value)} /></label>
          <label><span>Accent</span><input pattern="#[0-9a-fA-F]{6}" value={showConfig.accent} onChange={(event) => showConfig.setAccent(event.target.value)} /></label>
          <fieldset className="panel-options"><legend>Mobile companion panels</legend>{(["match", "info", "partners", "interact"] as const).map((panel) => <label key={panel}><input type="checkbox" checked={showConfig.enabledPanels.includes(panel)} onChange={() => showConfig.setEnabledPanels((current) => current.includes(panel) ? current.filter((item) => item !== panel) : [...current, panel])} /> {panel}</label>)}</fieldset>
          <fieldset className="panel-options"><legend>Companion tab labels</legend>
            <label><span>Match</span><input maxLength={30} value={showConfig.matchPanelLabel} onChange={(event) => showConfig.setMatchPanelLabel(event.target.value)} /></label>
            <label><span>Info</span><input maxLength={30} value={showConfig.infoPanelLabel} onChange={(event) => showConfig.setInfoPanelLabel(event.target.value)} /></label>
            <label><span>Partners</span><input maxLength={30} value={showConfig.partnersPanelLabel} onChange={(event) => showConfig.setPartnersPanelLabel(event.target.value)} /></label>
            <label><span>Interact</span><input maxLength={30} value={showConfig.interactPanelLabel} onChange={(event) => showConfig.setInteractPanelLabel(event.target.value)} /></label>
          </fieldset>
          <fieldset className="panel-options"><legend>Reusable presentation instances</legend>
            <p className="hint">Instances are named show building blocks. They can be placed differently per profile and targeted by typed cues without exposing transport data.</p>
            <label><span>Instance ID</span><input value={showConfig.newInstanceId} onChange={(event) => showConfig.setNewInstanceId(event.target.value)} placeholder="presenter-b" /></label>
            <label><span>Label</span><input value={showConfig.newInstanceLabel} onChange={(event) => showConfig.setNewInstanceLabel(event.target.value)} placeholder="Presenter B lower third" /></label>
            <label><span>Component</span><select value={showConfig.newInstanceKind} onChange={(event) => showConfig.setNewInstanceKind(event.target.value as "lower-third" | "scorebug" | "ticker" | "alert" | "sponsor" | "clock" | "live-badge" | "poll" | "custom")}>{(["lower-third", "scorebug", "ticker", "alert", "sponsor", "clock", "live-badge", "poll", "custom"] as const).map((kind) => <option key={kind}>{kind}</option>)}</select></label>
            <button type="button" onClick={() => { const result = showConfig.addPresentationInstance(); if ("error" in result) { setError(result.error!); } else { setStatus(result.success); commandBuilder.setCommandInstanceId(result.instanceId); } }}>Add instance</button>
            {showConfig.presentationInstances.length > 0 && <ul className="placement-summary">{showConfig.presentationInstances.map((instance) => <li key={instance.id}><span><b>{instance.label}</b> · {instance.kind} · {instance.enabled ? "Enabled" : "Disabled"}</span><button type="button" onClick={() => { showConfig.setLayoutInstanceId(instance.id); commandBuilder.setCommandInstanceId(instance.id); }}>Select</button><button type="button" onClick={() => showConfig.setPresentationInstances((current) => current.map((item) => item.id === instance.id ? { ...item, enabled: !item.enabled } : item))}>{instance.enabled ? "Disable" : "Enable"}</button><button type="button" onClick={() => showConfig.duplicatePresentationInstance(instance.id)}>Duplicate</button><button type="button" onClick={() => showConfig.removePresentationInstance(instance.id)}>Delete</button></li>)}</ul>}
          </fieldset>
          <fieldset className="panel-options"><legend>Presentation placement presets</legend>
            <p className="hint">Choose an active presentation instance and a profile-specific destination. These settings are saved with the reusable show package.</p>
            <label><span>Instance</span><select value={showConfig.layoutInstanceId} onChange={(event) => showConfig.setLayoutInstanceId(event.target.value)}><option value="scorebug">Main scorebug</option><option value="lower-third">Lower third</option><option value="primary">Sponsor panel</option><option value="ticker">Ticker</option><option value="scorebug-main">Acceptance scene scorebug</option><option value="lower-third-presenter-a">Acceptance presenter A</option><option value="lower-third-presenter-b">Acceptance presenter B</option><option value="sponsor-top-right">Acceptance sponsor</option><option value="programme-clock">Programme clock</option>{showConfig.presentationInstances.map((instance) => <option key={instance.id} value={instance.id}>{instance.label}{instance.enabled ? "" : " (disabled)"}</option>)}</select></label>
            <label><span>Profile</span><select value={showConfig.layoutProfile} onChange={(event) => showConfig.setLayoutProfile(event.target.value as "desktop" | "tv" | "mobile")}>{(["desktop", "tv", "mobile"] as const).map((profile) => <option key={profile}>{profile}</option>)}</select></label>
            <label><span>Surface</span><select value={showConfig.layoutSurface} onChange={(event) => showConfig.setLayoutSurface(event.target.value as "video" | "surround" | "companion")}>{(["video", "surround", "companion"] as const).map((surface) => <option key={surface}>{surface}</option>)}</select></label>
            <label><span>Preset</span><select value={showConfig.layoutAnchor} onChange={(event) => showConfig.setLayoutAnchor(event.target.value as "top-left" | "top-centre" | "top-right" | "centre-left" | "centre" | "centre-right" | "bottom-left" | "bottom-centre" | "bottom-right")}>{(["top-left", "top-centre", "top-right", "centre-left", "centre", "centre-right", "bottom-left", "bottom-centre", "bottom-right"] as const).map((anchor) => <option key={anchor}>{anchor}</option>)}</select></label>
            <label><span>Profile variant</span><select value={showConfig.layoutVariant} onChange={(event) => showConfig.setLayoutVariant(event.target.value)}><option value="standard">Standard</option><option value="wide">Wide</option><option value="broadcast">Broadcast</option><option value="compact">Compact</option><option value="headline">Headline</option></select></label>
            <label><span>Horizontal offset</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutX} onChange={(event) => showConfig.setLayoutX(Number(event.target.value))} /></label><label><span>Vertical offset</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutY} onChange={(event) => showConfig.setLayoutY(Number(event.target.value))} /></label><label><span>Width</span><input type="number" min={.08} max={1} step={.01} value={showConfig.layoutWidth} onChange={(event) => showConfig.setLayoutWidth(Number(event.target.value))} /></label><label><span>Height (optional)</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutHeight} onChange={(event) => showConfig.setLayoutHeight(event.target.value === "" ? "" : Number(event.target.value))} /></label>
            <label><span>Opacity</span><input type="number" min={0} max={1} step={.05} value={showConfig.layoutOpacity} onChange={(event) => showConfig.setLayoutOpacity(Number(event.target.value))} /></label><label><span>Rotation</span><input type="number" min={-180} max={180} step={1} value={showConfig.layoutRotation} onChange={(event) => showConfig.setLayoutRotation(Number(event.target.value))} /></label>
            <label><span>Crop top</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutCropTop} onChange={(event) => showConfig.setLayoutCropTop(Number(event.target.value))} /></label><label><span>Crop right</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutCropRight} onChange={(event) => showConfig.setLayoutCropRight(Number(event.target.value))} /></label><label><span>Crop bottom</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutCropBottom} onChange={(event) => showConfig.setLayoutCropBottom(Number(event.target.value))} /></label><label><span>Crop left</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutCropLeft} onChange={(event) => showConfig.setLayoutCropLeft(Number(event.target.value))} /></label>
            <label><span>Collision policy</span><select value={showConfig.layoutPolicy} onChange={(event) => showConfig.setLayoutPolicy(event.target.value as "single" | "row" | "column" | "overlay")}><option value="overlay">Overlay</option><option value="row">Stack in row</option><option value="column">Stack in column</option><option value="single">Single slot</option></select></label><label><span>Title/action safe area</span><input type="checkbox" checked={showConfig.layoutSafeArea} onChange={(event) => showConfig.setLayoutSafeArea(event.target.checked)} /></label>
            <label><span>Layer order</span><input type="number" min={0} max={999} step={1} value={showConfig.layoutZIndex} onChange={(event) => showConfig.setLayoutZIndex(Number(event.target.value))} /></label>
            <label><span>Transition</span><select value={showConfig.transitionKind} onChange={(event) => showConfig.setTransitionKind(event.target.value as "cut" | "fade" | "slide" | "scale")}><option value="cut">Cut</option><option value="fade">Fade</option><option value="slide">Slide</option><option value="scale">Scale</option></select></label>
            <label><span>Transition duration (ms)</span><input type="number" min={0} max={5000} step={10} value={showConfig.transitionDuration} onChange={(event) => showConfig.setTransitionDuration(Number(event.target.value))} /></label>
            <button type="button" onClick={showConfig.saveLayoutPreset}>Apply preset</button>
            {showConfig.presentationLayouts.length > 0 && <ul className="placement-summary">{showConfig.presentationLayouts.map((definition) => <li key={definition.instanceId}><span><b>{definition.instanceId}</b> · {Object.entries(definition.placementByProfile).map(([profile, placement]) => `${profile}: ${placement?.surface} ${placement?.anchor}`).join(" · ")}</span><button type="button" onClick={() => { showConfig.setLayoutInstanceId(definition.instanceId); setStatus(`${definition.instanceId} selected for placement editing.`); }}>Edit</button><button type="button" onClick={() => showConfig.duplicateLayoutDefinition(definition.instanceId)}>Duplicate</button><button type="button" onClick={() => showConfig.removeLayoutDefinition(definition.instanceId)}>Remove</button></li>)}</ul>}
          </fieldset>
          <button disabled={!productionId} onClick={() => mutate(`/api/productions/${productionId}`, "PUT", { configuration: showConfig.currentShowConfiguration() }, "Production presentation saved", showConfig.reloadProduction)}>Save into this production</button>
          <button onClick={() => mutate(`/api/channels/${productionId}/show-configurations`, "POST", { name: showConfig.configurationName, configuration: showConfig.currentShowConfiguration() }, "Show configuration saved", showConfig.reloadConfigurations)}>Save reusable configuration</button>
          <label><span>Copy into production</span><select onChange={(event) => { if (event.target.value) mutate(`/api/productions/${productionId}/copy-configuration`, "POST", { configurationId: event.target.value }, "Configuration copied into production", showConfig.reloadProduction); }} defaultValue=""><option value="">Choose a saved package</option>{showConfig.configurations.map((configuration) => <option key={configuration.id} value={configuration.id}>{configuration.name}</option>)}</select></label>
        </div>
        <p className="hint">Packages are copied into a production deliberately. Changing a package never rewrites an existing production.</p>
      </div>
    </section>

    <section className="section rehearsal-preview studio-preview" hidden={prepareTab !== "viewer" && prepareTab !== "rundown"}>
      <div className="workspace-heading"><div><h2>Placement preview</h2><p className="hint">The real Player renders the shared multi-instance scene using this production's saved layout configuration. This preview never changes live presentation state.</p></div><div className="profile-picker" role="group" aria-label="Placement preview profile">{(["desktop", "mobile", "tv"] as const).map((profile) => <button key={profile} className={previewProfile === profile ? "active" : ""} onClick={() => setPreviewProfile(profile)}>{profile}</button>)}</div></div>
      {layoutPreviewUrl ? <iframe title={`Placement Player ${previewProfile} preview`} src={layoutPreviewUrl} className={`player-preview player-preview--${previewProfile}`} /> : <p className="empty">Choose a channel to load the preview.</p>}
    </section>

    <section className="section rundown-editor" hidden={prepareTab !== "rundown"}>
      <h2>Rundown editor</h2>
      <div className="form"><label><span>Rundown name</span><input value={rundownEditor.rundownName} onChange={(event) => rundownEditor.setRundownName(event.target.value)} /></label><button disabled={!productionId} onClick={async () => { const result = await mutate(`/api/productions/${productionId}/rundowns`, "POST", { name: rundownEditor.rundownName || "New rundown" }, "Rundown created"); if (result?.id) { await refreshRundowns(); setRundownId(result.id); } }}>Create rundown</button><button disabled={!rundownId} onClick={() => mutate(`/api/rundowns/${rundownId}`, "PUT", { name: rundownEditor.rundownName }, "Rundown saved", rundownEditor.reloadRundownDefinition)}>Save rundown</button><button disabled={!rundownId} onClick={async () => { const result = await mutate(`/api/rundowns/${rundownId}/duplicate`, "POST", {}, "Rundown duplicated"); if (result?.id) { await refreshRundowns(); setRundownId(result.id); } }}>Duplicate rundown</button></div>
      {rundownEditor.rundownDefinition.map((cue, index) => <div className="cue-grid" key={cue.id}><strong>{cue.position}. {cue.label}</strong><span className="hint">{String(cue.commandPayload.k)} {cue.enabled ? "enabled" : "disabled"}</span><button onClick={() => rundownEditor.editCue(cue, { enabled: !cue.enabled })}>{cue.enabled ? "Disable" : "Enable"}</button><button disabled={index === 0} onClick={() => rundownEditor.moveCue(index, -1)}>Move up</button><button disabled={index === rundownEditor.rundownDefinition.length - 1} onClick={() => rundownEditor.moveCue(index, 1)}>Move down</button></div>)}
      <p className="hint">The typed command form below can send immediately or save a new cue into this rundown. Execution sessions use a frozen copy of this definition.</p>
    </section>
  </>;
}
