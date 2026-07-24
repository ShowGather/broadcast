import type { useShowConfiguration } from "../hooks/useShowConfiguration.js";
import { useAdminState } from "./AdminStateContext.js";
import { ThreeColumnWorkspace } from "./layout/ThreeColumnWorkspace.js";
import { WorkspacePanel } from "./ui/WorkspacePanel.js";
import { ProfileSelector } from "./ui/ProfileSelector.js";
import { PrimaryAction, SecondaryAction, DangerAction } from "./ui/ActionButtons.js";
import { PlayerPreview } from "./ui/PlayerPreview.js";

interface Props {
  showConfig: ReturnType<typeof useShowConfiguration>;
  previewProfile: "desktop" | "mobile" | "tv";
  setPreviewProfile: (p: "desktop" | "mobile" | "tv") => void;
  layoutPreviewUrl: string;
}

export function ViewerWorkspace({ showConfig, previewProfile, setPreviewProfile, layoutPreviewUrl }: Props) {
  const { setStatus, setError } = useAdminState();

  const left = (
    <WorkspacePanel heading="Viewer configuration">
      <ProfileSelector
        profiles={["desktop", "mobile", "tv"]}
        selected={previewProfile}
        onSelect={(p) => setPreviewProfile(p as "desktop" | "mobile" | "tv")}
        label="Preview profile"
      />

      <div style={{ marginTop: 14 }}>
        <h3 style={{ color: "#dbe8f8", fontSize: ".85rem", marginBottom: 8 }}>Elements library</h3>
        <div className="element-library" role="list" aria-label="Presentation elements">
          {(["scorebug", "lower-third", "ticker", "alert", "sponsor-panel", "clock"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              role="listitem"
              draggable
              className={showConfig.selectedElement === kind ? "active" : ""}
              onDragStart={(event) => {
                event.dataTransfer.setData("application/x-showgather-element", kind);
                event.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => showConfig.chooseElement(kind)}
            >
              {kind === "sponsor-panel" ? "Sponsor bug" : kind.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="placement-zones" style={{ marginTop: 14 }} aria-label="Video placement presets">
        <span>Drag an element onto a named placement preset</span>
        <div>
          {(["top-left", "top-centre", "top-right", "centre-left", "centre", "centre-right", "bottom-left", "bottom-centre", "bottom-right"] as const).map((anchor) => (
            <button
              key={anchor}
              type="button"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const kind = event.dataTransfer.getData("application/x-showgather-element");
                if (["scorebug", "lower-third", "ticker", "alert", "sponsor-panel", "clock"].includes(kind)) {
                  showConfig.dropElementOnPreset(kind as "scorebug" | "lower-third" | "ticker" | "alert" | "sponsor-panel" | "clock", anchor);
                }
              }}
              onClick={() => showConfig.dropElementOnPreset(showConfig.selectedElement as "scorebug" | "lower-third" | "ticker" | "alert" | "sponsor-panel" | "clock", anchor)}
            >
              {anchor.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <h3 style={{ color: "#dbe8f8", fontSize: ".85rem", marginBottom: 8 }}>Presentation instances</h3>
        <div className="form">
          <label>
            <span>Instance ID</span>
            <input value={showConfig.newInstanceId} onChange={(event) => showConfig.setNewInstanceId(event.target.value)} placeholder="presenter-b" />
          </label>
          <label>
            <span>Label</span>
            <input value={showConfig.newInstanceLabel} onChange={(event) => showConfig.setNewInstanceLabel(event.target.value)} placeholder="Presenter B lower third" />
          </label>
          <label>
            <span>Component</span>
            <select value={showConfig.newInstanceKind} onChange={(event) => showConfig.setNewInstanceKind(event.target.value as "lower-third" | "scorebug" | "ticker" | "alert" | "sponsor" | "clock" | "live-badge" | "poll" | "custom")}>
              {(["lower-third", "scorebug", "ticker", "alert", "sponsor", "clock", "live-badge", "poll", "custom"] as const).map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>
          </label>
          <PrimaryAction onClick={() => {
            const result = showConfig.addPresentationInstance();
            if ("error" in result) {
              setError(result.error!);
            } else {
              setStatus(result.success);
              showConfig.setLayoutInstanceId(result.instanceId);
            }
          }}>
            Add instance
          </PrimaryAction>
        </div>

        {showConfig.presentationInstances.length > 0 && (
          <ul className="placement-summary" style={{ marginTop: 12 }}>
            {showConfig.presentationInstances.map((instance) => (
              <li key={instance.id}>
                <span><b>{instance.label}</b> · {instance.kind} · {instance.enabled ? "Enabled" : "Disabled"}</span>
                <button onClick={() => { showConfig.setLayoutInstanceId(instance.id); }}>Select</button>
                <button onClick={() => showConfig.setPresentationInstances((current) => current.map((item) => item.id === instance.id ? { ...item, enabled: !item.enabled } : item))}>
                  {instance.enabled ? "Disable" : "Enable"}
                </button>
                <SecondaryAction onClick={() => showConfig.duplicatePresentationInstance(instance.id)}>
                  Duplicate
                </SecondaryAction>
                <DangerAction onClick={() => showConfig.removePresentationInstance(instance.id)}>
                  Delete
                </DangerAction>
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
        <label>
          <span>Instance</span>
          <select value={showConfig.layoutInstanceId} onChange={(event) => showConfig.setLayoutInstanceId(event.target.value)}>
            <option value="scorebug">Main scorebug</option>
            <option value="lower-third">Lower third</option>
            <option value="primary">Sponsor panel</option>
            <option value="ticker">Ticker</option>
            {showConfig.presentationInstances.map((instance) => (
              <option key={instance.id} value={instance.id}>{instance.label}{instance.enabled ? "" : " (disabled)"}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Profile</span>
          <select value={showConfig.layoutProfile} onChange={(event) => showConfig.setLayoutProfile(event.target.value as "desktop" | "tv" | "mobile")}>
            {(["desktop", "tv", "mobile"] as const).map((profile) => (
              <option key={profile}>{profile}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Surface</span>
          <select value={showConfig.layoutSurface} onChange={(event) => showConfig.setLayoutSurface(event.target.value as "video" | "surround" | "companion")}>
            {(["video", "surround", "companion"] as const).map((surface) => (
              <option key={surface}>{surface}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Preset</span>
          <select value={showConfig.layoutAnchor} onChange={(event) => showConfig.setLayoutAnchor(event.target.value as "top-left" | "top-centre" | "top-right" | "centre-left" | "centre" | "centre-right" | "bottom-left" | "bottom-centre" | "bottom-right")}>
            {(["top-left", "top-centre", "top-right", "centre-left", "centre", "centre-right", "bottom-left", "bottom-centre", "bottom-right"] as const).map((anchor) => (
              <option key={anchor}>{anchor}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Profile variant</span>
          <select value={showConfig.layoutVariant} onChange={(event) => showConfig.setLayoutVariant(event.target.value)}>
            <option value="standard">Standard</option>
            <option value="wide">Wide</option>
            <option value="broadcast">Broadcast</option>
            <option value="compact">Compact</option>
            <option value="headline">Headline</option>
          </select>
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label><span>Horizontal offset</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutX} onChange={(event) => showConfig.setLayoutX(Number(event.target.value))} /></label>
          <label><span>Vertical offset</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutY} onChange={(event) => showConfig.setLayoutY(Number(event.target.value))} /></label>
          <label><span>Width</span><input type="number" min={.08} max={1} step={.01} value={showConfig.layoutWidth} onChange={(event) => showConfig.setLayoutWidth(Number(event.target.value))} /></label>
          <label><span>Height (optional)</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutHeight} onChange={(event) => showConfig.setLayoutHeight(event.target.value === "" ? "" : Number(event.target.value))} /></label>
          <label><span>Opacity</span><input type="number" min={0} max={1} step={.05} value={showConfig.layoutOpacity} onChange={(event) => showConfig.setLayoutOpacity(Number(event.target.value))} /></label>
          <label><span>Rotation</span><input type="number" min={-180} max={180} step={1} value={showConfig.layoutRotation} onChange={(event) => showConfig.setLayoutRotation(Number(event.target.value))} /></label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
          <label><span>Crop top</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutCropTop} onChange={(event) => showConfig.setLayoutCropTop(Number(event.target.value))} /></label>
          <label><span>Crop right</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutCropRight} onChange={(event) => showConfig.setLayoutCropRight(Number(event.target.value))} /></label>
          <label><span>Crop bottom</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutCropBottom} onChange={(event) => showConfig.setLayoutCropBottom(Number(event.target.value))} /></label>
          <label><span>Crop left</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutCropLeft} onChange={(event) => showConfig.setLayoutCropLeft(Number(event.target.value))} /></label>
        </div>

        <label>
          <span>Collision policy</span>
          <select value={showConfig.layoutPolicy} onChange={(event) => showConfig.setLayoutPolicy(event.target.value as "single" | "row" | "column" | "overlay")}>
            <option value="overlay">Overlay</option>
            <option value="row">Stack in row</option>
            <option value="column">Stack in column</option>
            <option value="single">Single slot</option>
          </select>
        </label>

        <label>
          <span>Title/action safe area</span>
          <input type="checkbox" checked={showConfig.layoutSafeArea} onChange={(event) => showConfig.setLayoutSafeArea(event.target.checked)} />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label><span>Layer order</span><input type="number" min={0} max={999} step={1} value={showConfig.layoutZIndex} onChange={(event) => showConfig.setLayoutZIndex(Number(event.target.value))} /></label>
          <label><span>Transition</span><select value={showConfig.transitionKind} onChange={(event) => showConfig.setTransitionKind(event.target.value as "cut" | "fade" | "slide" | "scale")}>
            <option value="cut">Cut</option>
            <option value="fade">Fade</option>
            <option value="slide">Slide</option>
            <option value="scale">Scale</option>
          </select></label>
          <label><span>Transition duration (ms)</span><input type="number" min={0} max={5000} step={10} value={showConfig.transitionDuration} onChange={(event) => showConfig.setTransitionDuration(Number(event.target.value))} /></label>
        </div>

        <PrimaryAction onClick={showConfig.saveLayoutPreset}>
          Apply preset
        </PrimaryAction>
      </div>

      {showConfig.presentationLayouts.length > 0 && (
        <ul className="placement-summary" style={{ marginTop: 14 }}>
          {showConfig.presentationLayouts.map((definition) => (
            <li key={definition.instanceId}>
              <span><b>{definition.instanceId}</b> · {Object.entries(definition.placementByProfile).map(([profile, placement]) => `${profile}: ${placement?.surface} ${placement?.anchor}`).join(" · ")}</span>
              <button onClick={() => { showConfig.setLayoutInstanceId(definition.instanceId); setStatus(`${definition.instanceId} selected for placement editing.`); }}>Edit</button>
              <SecondaryAction onClick={() => showConfig.duplicateLayoutDefinition(definition.instanceId)}>Duplicate</SecondaryAction>
              <DangerAction onClick={() => showConfig.removeLayoutDefinition(definition.instanceId)}>Remove</DangerAction>
            </li>
          ))}
        </ul>
      )}
    </WorkspacePanel>
  );

  const right = (
    <WorkspacePanel heading="Player preview" variant="preview">
      <PlayerPreview
        url={layoutPreviewUrl}
        title={`Placement Player ${previewProfile} preview`}
        profile={previewProfile}
      />
    </WorkspacePanel>
  );

  return <ThreeColumnWorkspace left={left} centre={centre} right={right} />;
}
