"use client";

import { useAdminState } from "@/lib/admin-state";
import { ThreeColumnWorkspace } from "@/components/ui/three-column-workspace";
import { WorkspacePanel } from "@/components/ui/workspace-panel";
import { PrimaryAction, SecondaryAction, DangerAction } from "@/components/ui/action-buttons";
import { ProfileSelector } from "@/components/ui/profile-selector";
import { PlayerPreview } from "@/components/ui/player-preview";

export function ViewerWorkspace() {
  const { setStatus, setError, showConfig, previewProfile, setPreviewProfile, layoutPreviewUrl } = useAdminState();

  const left = (
    <WorkspacePanel heading="Viewer configuration">
      <ProfileSelector profiles={["desktop", "mobile", "tv"]} selected={previewProfile} onSelect={(p) => setPreviewProfile(p as "desktop" | "mobile" | "tv")} label="Preview profile" />
      <div style={{ marginTop: 14 }}>
        <h3 style={{ color: "#dbe8f8", fontSize: ".85rem", marginBottom: 8 }}>Elements library</h3>
        <div className="element-library" role="list" aria-label="Presentation elements">
          {(["scorebug", "lower-third", "ticker", "alert", "sponsor-panel", "clock"] as const).map((kind) => (
            <button key={kind} type="button" role="listitem" draggable className={showConfig.selectedElement === kind ? "active" : ""}
              onDragStart={(e) => { e.dataTransfer.setData("application/x-showgather-element", kind); e.dataTransfer.effectAllowed = "copy"; }}
              onClick={() => showConfig.chooseElement(kind)}>
              {kind === "sponsor-panel" ? "Sponsor bug" : kind.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>
      <div className="placement-zones" style={{ marginTop: 14 }} aria-label="Video placement presets">
        <span>Drag an element onto a named placement preset</span>
        <div>
          {(["top-left", "top-centre", "top-right", "centre-left", "centre", "centre-right", "bottom-left", "bottom-centre", "bottom-right"] as const).map((anchor) => (
            <button key={anchor} type="button" onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const kind = e.dataTransfer.getData("application/x-showgather-element"); if (["scorebug", "lower-third", "ticker", "alert", "sponsor-panel", "clock"].includes(kind)) showConfig.dropElementOnPreset(kind as "scorebug" | "lower-third" | "ticker" | "alert" | "sponsor-panel" | "clock", anchor); }}
              onClick={() => showConfig.dropElementOnPreset(showConfig.selectedElement as "scorebug" | "lower-third" | "ticker" | "alert" | "sponsor-panel" | "clock", anchor)}>
              {anchor.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <h3 style={{ color: "#dbe8f8", fontSize: ".85rem", marginBottom: 8 }}>Presentation instances</h3>
        <div className="form">
          <label><span>Instance ID</span><input value={showConfig.newInstanceId} onChange={(e) => showConfig.setNewInstanceId(e.target.value)} placeholder="presenter-b" /></label>
          <label><span>Label</span><input value={showConfig.newInstanceLabel} onChange={(e) => showConfig.setNewInstanceLabel(e.target.value)} placeholder="Presenter B lower third" /></label>
          <label><span>Component</span>
            <select value={showConfig.newInstanceKind} onChange={(e) => showConfig.setNewInstanceKind(e.target.value as "lower-third" | "scorebug" | "ticker" | "alert" | "sponsor" | "clock" | "live-badge" | "poll" | "custom")}>
              {(["lower-third", "scorebug", "ticker", "alert", "sponsor", "clock", "live-badge", "poll", "custom"] as const).map((k) => (<option key={k}>{k}</option>))}
            </select>
          </label>
          <PrimaryAction onClick={() => { const result = showConfig.addPresentationInstance(); if ("error" in result) setError(result.error!); else { setStatus(result.success); showConfig.setLayoutInstanceId(result.instanceId); } }}>Add instance</PrimaryAction>
        </div>
        {showConfig.presentationInstances.length > 0 && (
          <ul className="placement-summary" style={{ marginTop: 12 }}>
            {showConfig.presentationInstances.map((instance) => (
              <li key={instance.id}>
                <span><b>{instance.label}</b> {"\u00B7"} {instance.kind} {"\u00B7"} {instance.enabled ? "Enabled" : "Disabled"}</span>
                <button onClick={() => showConfig.setLayoutInstanceId(instance.id)}>Select</button>
                <button onClick={() => showConfig.setPresentationInstances((c) => c.map((i) => i.id === instance.id ? { ...i, enabled: !i.enabled } : i))}>{instance.enabled ? "Disable" : "Enable"}</button>
                <SecondaryAction onClick={() => showConfig.duplicatePresentationInstance(instance.id)}>Duplicate</SecondaryAction>
                <DangerAction onClick={() => showConfig.removePresentationInstance(instance.id)}>Delete</DangerAction>
              </li>
            ))}
          </ul>
        )}
      </div>
    </WorkspacePanel>
  );

  const centre = (
    <WorkspacePanel heading="Placement editor">
      <div className="form">
        <label><span>Instance</span>
          <select value={showConfig.layoutInstanceId} onChange={(e) => showConfig.setLayoutInstanceId(e.target.value)}>
            <option value="scorebug">Main scorebug</option><option value="lower-third">Lower third</option><option value="primary">Sponsor panel</option><option value="ticker">Ticker</option>
            {showConfig.presentationInstances.map((i) => (<option key={i.id} value={i.id}>{i.label}{i.enabled ? "" : " (disabled)"}</option>))}
          </select>
        </label>
        <label><span>Profile</span>
          <select value={showConfig.layoutProfile} onChange={(e) => showConfig.setLayoutProfile(e.target.value as "desktop" | "tv" | "mobile")}>
            {(["desktop", "tv", "mobile"] as const).map((p) => (<option key={p}>{p}</option>))}
          </select>
        </label>
        <label><span>Surface</span>
          <select value={showConfig.layoutSurface} onChange={(e) => showConfig.setLayoutSurface(e.target.value as "video" | "surround" | "companion")}>
            {(["video", "surround", "companion"] as const).map((s) => (<option key={s}>{s}</option>))}
          </select>
        </label>
        <label><span>Preset</span>
          <select value={showConfig.layoutAnchor} onChange={(e) => showConfig.setLayoutAnchor(e.target.value as "top-left" | "top-centre" | "top-right" | "centre-left" | "centre" | "centre-right" | "bottom-left" | "bottom-centre" | "bottom-right")}>
            {(["top-left", "top-centre", "top-right", "centre-left", "centre", "centre-right", "bottom-left", "bottom-centre", "bottom-right"] as const).map((a) => (<option key={a}>{a}</option>))}
          </select>
        </label>
        <label><span>Profile variant</span>
          <select value={showConfig.layoutVariant} onChange={(e) => showConfig.setLayoutVariant(e.target.value)}>
            <option value="standard">Standard</option><option value="wide">Wide</option><option value="broadcast">Broadcast</option><option value="compact">Compact</option><option value="headline">Headline</option>
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label><span>Horizontal offset</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutX} onChange={(e) => showConfig.setLayoutX(Number(e.target.value))} /></label>
          <label><span>Vertical offset</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutY} onChange={(e) => showConfig.setLayoutY(Number(e.target.value))} /></label>
          <label><span>Width</span><input type="number" min={.08} max={1} step={.01} value={showConfig.layoutWidth} onChange={(e) => showConfig.setLayoutWidth(Number(e.target.value))} /></label>
          <label><span>Height (optional)</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutHeight} onChange={(e) => showConfig.setLayoutHeight(e.target.value === "" ? "" : Number(e.target.value))} /></label>
          <label><span>Opacity</span><input type="number" min={0} max={1} step={.05} value={showConfig.layoutOpacity} onChange={(e) => showConfig.setLayoutOpacity(Number(e.target.value))} /></label>
          <label><span>Rotation</span><input type="number" min={-180} max={180} step={1} value={showConfig.layoutRotation} onChange={(e) => showConfig.setLayoutRotation(Number(e.target.value))} /></label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
          <label><span>Crop top</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutCropTop} onChange={(e) => showConfig.setLayoutCropTop(Number(e.target.value))} /></label>
          <label><span>Crop right</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutCropRight} onChange={(e) => showConfig.setLayoutCropRight(Number(e.target.value))} /></label>
          <label><span>Crop bottom</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutCropBottom} onChange={(e) => showConfig.setLayoutCropBottom(Number(e.target.value))} /></label>
          <label><span>Crop left</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutCropLeft} onChange={(e) => showConfig.setLayoutCropLeft(Number(e.target.value))} /></label>
        </div>
        <label><span>Collision policy</span>
          <select value={showConfig.layoutPolicy} onChange={(e) => showConfig.setLayoutPolicy(e.target.value as "single" | "row" | "column" | "overlay")}>
            <option value="overlay">Overlay</option><option value="row">Stack in row</option><option value="column">Stack in column</option><option value="single">Single slot</option>
          </select>
        </label>
        <label><span>Title/action safe area</span><input type="checkbox" checked={showConfig.layoutSafeArea} onChange={(e) => showConfig.setLayoutSafeArea(e.target.checked)} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label><span>Layer order</span><input type="number" min={0} max={999} step={1} value={showConfig.layoutZIndex} onChange={(e) => showConfig.setLayoutZIndex(Number(e.target.value))} /></label>
          <label><span>Transition</span>
            <select value={showConfig.transitionKind} onChange={(e) => showConfig.setTransitionKind(e.target.value as "cut" | "fade" | "slide" | "scale")}>
              <option value="cut">Cut</option><option value="fade">Fade</option><option value="slide">Slide</option><option value="scale">Scale</option>
            </select>
          </label>
          <label><span>Transition duration (ms)</span><input type="number" min={0} max={5000} step={10} value={showConfig.transitionDuration} onChange={(e) => showConfig.setTransitionDuration(Number(e.target.value))} /></label>
        </div>
        <PrimaryAction onClick={showConfig.saveLayoutPreset}>Apply preset</PrimaryAction>
      </div>
      {showConfig.presentationLayouts.length > 0 && (
        <ul className="placement-summary" style={{ marginTop: 14 }}>
          {showConfig.presentationLayouts.map((def) => (
            <li key={def.instanceId}>
              <span><b>{def.instanceId}</b> {"\u00B7"} {Object.entries(def.placementByProfile).map(([profile, placement]) => `${profile}: ${placement?.surface} ${placement?.anchor}`).join(" \u00B7 ")}</span>
              <button onClick={() => { showConfig.setLayoutInstanceId(def.instanceId); setStatus(`${def.instanceId} selected for placement editing.`); }}>Edit</button>
              <SecondaryAction onClick={() => showConfig.duplicateLayoutDefinition(def.instanceId)}>Duplicate</SecondaryAction>
              <DangerAction onClick={() => showConfig.removeLayoutDefinition(def.instanceId)}>Remove</DangerAction>
            </li>
          ))}
        </ul>
      )}
    </WorkspacePanel>
  );

  const right = (
    <WorkspacePanel heading="Player preview" variant="preview">
      <PlayerPreview url={layoutPreviewUrl} title={`Placement Player ${previewProfile} preview`} profile={previewProfile} />
    </WorkspacePanel>
  );

  return <ThreeColumnWorkspace left={left} centre={centre} right={right} />;
}
