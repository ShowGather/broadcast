import type { useShowConfiguration } from "../hooks/useShowConfiguration.js";
import type { LayoutAnchor, LayoutProfile, LayoutSurface } from "../types.js";
import { ProfileSelector } from "./ui/ProfileSelector.js";
import { DangerAction, PrimaryAction, SecondaryAction } from "./ui/ActionButtons.js";

type Profile = "desktop" | "mobile" | "tv";
type ElementKind = "scorebug" | "lower-third" | "ticker" | "alert" | "sponsor-panel" | "clock";
const anchors: LayoutAnchor[] = ["top-left", "top-centre", "top-right", "centre-left", "centre", "centre-right", "bottom-left", "bottom-centre", "bottom-right"];
const surfaces: LayoutSurface[] = ["video", "surround", "companion"];

export interface ViewerShellProps {
  showConfig: ReturnType<typeof useShowConfiguration>;
  previewProfile: Profile;
  setPreviewProfile: (profile: Profile) => void;
  realOutputUrl: string;
  saveProduction: () => Promise<void>;
}

function instanceLabel(props: ViewerShellProps, id: string) {
  if (!id) return "No instance selected";
  return props.showConfig.presentationInstances.find((instance) => instance.id === id)?.label
    ?? ({ scorebug: "Main scorebug", "lower-third": "Lower third", primary: "Sponsor panel", ticker: "Ticker" } as Record<string, string>)[id]
    ?? id;
}

function selectedLayout(props: ViewerShellProps) {
  return props.showConfig.presentationLayouts.find((layout) => layout.instanceId === props.showConfig.layoutInstanceId);
}

function chooseInstance(props: ViewerShellProps, id: string) {
  props.showConfig.setLayoutInstanceId(id);
  const definition = props.showConfig.presentationLayouts.find((layout) => layout.instanceId === id);
  const placement = definition?.placementByProfile[props.previewProfile];
  if (!placement) return;
  props.showConfig.setLayoutProfile(props.previewProfile);
  props.showConfig.setLayoutSurface(placement.surface);
  props.showConfig.setLayoutAnchor(placement.anchor);
  props.showConfig.setLayoutX(placement.x);
  props.showConfig.setLayoutY(placement.y);
  props.showConfig.setLayoutWidth(placement.width);
  props.showConfig.setLayoutHeight(placement.height ?? "");
  props.showConfig.setLayoutOpacity(placement.opacity ?? 1);
  props.showConfig.setLayoutRotation(placement.rotation ?? 0);
  props.showConfig.setLayoutSafeArea(placement.safeArea ?? false);
  props.showConfig.setLayoutPolicy(placement.layout ?? "overlay");
  props.showConfig.setLayoutVariant(definition?.variantByProfile?.[props.previewProfile] ?? "standard");
  props.showConfig.setLayoutZIndex(definition?.zIndex ?? 10);
  props.showConfig.setTransitionKind(definition?.transition?.enter ?? "fade");
  props.showConfig.setTransitionDuration(definition?.transition?.durationMs ?? 180);
  props.showConfig.setLayoutCropTop(placement.crop?.top ?? 0);
  props.showConfig.setLayoutCropRight(placement.crop?.right ?? 0);
  props.showConfig.setLayoutCropBottom(placement.crop?.bottom ?? 0);
  props.showConfig.setLayoutCropLeft(placement.crop?.left ?? 0);
}

export function ViewerSelectionPanel(props: ViewerShellProps) {
  const { showConfig } = props;
  return <section className="viewer-selection-panel" aria-label="Viewer profiles and presentation instances">
    <div className="viewer-panel-heading"><span>Prepare</span><h2>Viewer</h2></div>
    <ProfileSelector profiles={["desktop", "mobile", "tv"]} selected={props.previewProfile} onSelect={(profile) => { props.setPreviewProfile(profile as Profile); showConfig.setLayoutProfile(profile as LayoutProfile); }} label="Audience output profile" />
    <SecondaryAction disabled={!showConfig.layoutInstanceId} onClick={() => showConfig.setLayoutInstanceId("")}>Clear instance selection</SecondaryAction>
    <div className="viewer-element-library"><h3>Presentation elements</h3>{(["scorebug", "lower-third", "ticker", "alert", "sponsor-panel", "clock"] as ElementKind[]).map((kind) => <button key={kind} type="button" className={showConfig.selectedElement === kind ? "active" : ""} onClick={() => showConfig.chooseElement(kind)}><strong>{kind === "sponsor-panel" ? "Sponsor bug" : kind.replace("-", " ")}</strong></button>)}</div>
    <div className="viewer-instance-create"><h3>Add presentation instance</h3><label><span>Instance ID</span><input value={showConfig.newInstanceId} onChange={(event) => showConfig.setNewInstanceId(event.target.value)} placeholder="presenter-b" /></label><label><span>Label</span><input value={showConfig.newInstanceLabel} onChange={(event) => showConfig.setNewInstanceLabel(event.target.value)} placeholder="Presenter B lower third" /></label><label><span>Component</span><select value={showConfig.newInstanceKind} onChange={(event) => showConfig.setNewInstanceKind(event.target.value as typeof showConfig.newInstanceKind)}>{(["lower-third", "scorebug", "ticker", "alert", "sponsor", "clock", "live-badge", "poll", "custom"] as const).map((kind) => <option key={kind}>{kind}</option>)}</select></label><PrimaryAction onClick={() => { const result = showConfig.addPresentationInstance(); if (typeof result.instanceId === "string") chooseInstance(props, result.instanceId); }}>Add instance</PrimaryAction></div>
    <div className="viewer-instance-list"><h3>Presentation instances</h3>{showConfig.presentationInstances.length ? showConfig.presentationInstances.map((instance) => <div key={instance.id} className={instance.id === showConfig.layoutInstanceId ? "active" : ""}><button type="button" onClick={() => chooseInstance(props, instance.id)}><strong>{instance.label}</strong><span>{instance.kind} · {instance.enabled ? "Enabled" : "Disabled"}</span></button><div><button onClick={() => showConfig.setPresentationInstances((current) => current.map((item) => item.id === instance.id ? { ...item, enabled: !item.enabled } : item))}>{instance.enabled ? "Disable" : "Enable"}</button><SecondaryAction onClick={() => showConfig.duplicatePresentationInstance(instance.id)}>Duplicate</SecondaryAction><DangerAction onClick={() => showConfig.removePresentationInstance(instance.id)}>Delete</DangerAction></div></div>) : <p className="hint">No reusable instances are configured for this production.</p>}</div>
    <fieldset className="viewer-companion-options"><legend>Companion panels</legend>{(["match", "info", "partners", "interact"] as const).map((panel) => <label key={panel}><input type="checkbox" checked={showConfig.enabledPanels.includes(panel)} onChange={() => showConfig.setEnabledPanels((current) => current.includes(panel) ? current.filter((item) => item !== panel) : [...current, panel])} /> {panel}</label>)}</fieldset>
  </section>;
}

function anchorStyle(anchor: LayoutAnchor) {
  const [vertical, horizontal] = anchor.split("-");
  return { [vertical === "centre" ? "top" : vertical]: vertical === "centre" ? "50%" : "5%", [horizontal ?? "left"]: horizontal === "centre" || vertical === "centre" && !horizontal ? "50%" : "5%" } as Record<string, string>;
}

export function ViewerProgrammeStage(props: ViewerShellProps) {
  const { showConfig } = props;
  const layouts = showConfig.presentationLayouts.map((definition) => ({ definition, placement: definition.placementByProfile[props.previewProfile] })).filter((item) => item.placement);
  const selectedId = showConfig.layoutInstanceId;
  const renderItem = (item: typeof layouts[number]) => {
    const placement = item.placement!;
    const selected = item.definition.instanceId === selectedId;
    return <div key={item.definition.instanceId} className={`viewer-stage__instance viewer-stage__instance--${placement.surface} ${selected ? "viewer-stage__instance--selected" : ""}`} style={{ ...anchorStyle(placement.anchor), width: `${Math.max(12, placement.width * 100)}%`, opacity: placement.opacity ?? 1, zIndex: item.definition.zIndex ?? 1, transform: `${placement.anchor.includes("centre") ? "translate(-50%, -50%) " : ""}rotate(${placement.rotation ?? 0}deg)` }}><span>{instanceLabel(props, item.definition.instanceId)}</span>{selected && <b>{placement.surface} · {placement.anchor}</b>}</div>;
  };
  const videoItems = layouts.filter((item) => item.placement?.surface === "video");
  const surroundItems = layouts.filter((item) => item.placement?.surface === "surround");
  return <section className="viewer-programme-stage" aria-label="Fitted audience composition preview"><div className="viewer-stage__heading"><div><span>Audience composition</span><h1>{instanceLabel(props, selectedId)}</h1></div><span className="viewer-stage__profile">{props.previewProfile} profile</span></div><div className={`viewer-stage__canvas viewer-stage__canvas--${props.previewProfile}`}><div className="viewer-stage__header">Header {surroundItems.filter((item) => item.placement?.anchor.startsWith("top")).map(renderItem)}</div><div className="viewer-stage__rail viewer-stage__rail--left">Left rail {surroundItems.filter((item) => item.placement?.anchor.endsWith("left") && !item.placement?.anchor.startsWith("top") && !item.placement?.anchor.startsWith("bottom")).map(renderItem)}</div><div className="viewer-stage__video"><span>16:9 video</span>{showConfig.layoutSafeArea && <div className="viewer-stage__safe-area" aria-label="Title and action safe area" />}{videoItems.map(renderItem)}{!layouts.length && <strong>No saved presentation layout</strong>}</div><div className="viewer-stage__rail viewer-stage__rail--right">Right rail {surroundItems.filter((item) => item.placement?.anchor.endsWith("right") && !item.placement?.anchor.startsWith("top") && !item.placement?.anchor.startsWith("bottom")).map(renderItem)}</div><div className="viewer-stage__footer">Footer {surroundItems.filter((item) => item.placement?.anchor.startsWith("bottom")).map(renderItem)}</div></div><p>Fitted configuration preview. Editing never dispatches a timed command.</p></section>;
}

export function ViewerPlacementEditor(props: ViewerShellProps) {
  const { showConfig } = props;
  const hasSelection = Boolean(showConfig.layoutInstanceId);
  if (!hasSelection) return <section className="viewer-placement-editor viewer-placement-editor--empty"><strong>No presentation instance selected</strong><span>Select an instance from the Viewer panel to edit its placement.</span></section>;
  return <section className="viewer-placement-editor" aria-label="Placement and appearance controls"><div className="viewer-editor__heading"><div><span>Placement and appearance</span><h2>{instanceLabel(props, showConfig.layoutInstanceId)}</h2></div><span>{props.previewProfile}</span></div><div className="viewer-placement-editor__form form"><label><span>Instance</span><select value={showConfig.layoutInstanceId} onChange={(event) => chooseInstance(props, event.target.value)}><option value="scorebug">Main scorebug</option><option value="lower-third">Lower third</option><option value="primary">Sponsor panel</option><option value="ticker">Ticker</option>{showConfig.presentationInstances.map((instance) => <option key={instance.id} value={instance.id}>{instance.label}{instance.enabled ? "" : " (disabled)"}</option>)}</select></label><label><span>Surface</span><select value={showConfig.layoutSurface} onChange={(event) => showConfig.setLayoutSurface(event.target.value as LayoutSurface)}>{surfaces.map((surface) => <option key={surface}>{surface}</option>)}</select></label><label><span>Anchor</span><select value={showConfig.layoutAnchor} onChange={(event) => showConfig.setLayoutAnchor(event.target.value as LayoutAnchor)}>{anchors.map((anchor) => <option key={anchor}>{anchor}</option>)}</select></label><label><span>Profile variant</span><select value={showConfig.layoutVariant} onChange={(event) => showConfig.setLayoutVariant(event.target.value)}>{["standard", "wide", "broadcast", "compact", "headline"].map((variant) => <option key={variant}>{variant}</option>)}</select></label><div className="viewer-number-grid"><label><span>X</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutX} onChange={(event) => showConfig.setLayoutX(Number(event.target.value))} /></label><label><span>Y</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutY} onChange={(event) => showConfig.setLayoutY(Number(event.target.value))} /></label><label><span>Width</span><input type="number" min={.08} max={1} step={.01} value={showConfig.layoutWidth} onChange={(event) => showConfig.setLayoutWidth(Number(event.target.value))} /></label><label><span>Height</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutHeight} onChange={(event) => showConfig.setLayoutHeight(event.target.value === "" ? "" : Number(event.target.value))} /></label><label><span>Opacity</span><input type="number" min={0} max={1} step={.05} value={showConfig.layoutOpacity} onChange={(event) => showConfig.setLayoutOpacity(Number(event.target.value))} /></label><label><span>Rotation</span><input type="number" min={-180} max={180} step={1} value={showConfig.layoutRotation} onChange={(event) => showConfig.setLayoutRotation(Number(event.target.value))} /></label><label><span>Layer order</span><input type="number" min={0} max={999} step={1} value={showConfig.layoutZIndex} onChange={(event) => showConfig.setLayoutZIndex(Number(event.target.value))} /></label><label><span>Transition</span><select value={showConfig.transitionKind} onChange={(event) => showConfig.setTransitionKind(event.target.value as typeof showConfig.transitionKind)}>{["cut", "fade", "slide", "scale"].map((transition) => <option key={transition}>{transition}</option>)}</select></label></div><div className="viewer-crop-grid"><label><span>Crop top</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutCropTop} onChange={(event) => showConfig.setLayoutCropTop(Number(event.target.value))} /></label><label><span>Crop right</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutCropRight} onChange={(event) => showConfig.setLayoutCropRight(Number(event.target.value))} /></label><label><span>Crop bottom</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutCropBottom} onChange={(event) => showConfig.setLayoutCropBottom(Number(event.target.value))} /></label><label><span>Crop left</span><input type="number" min={0} max={1} step={.01} value={showConfig.layoutCropLeft} onChange={(event) => showConfig.setLayoutCropLeft(Number(event.target.value))} /></label></div><label className="viewer-safe-toggle"><input type="checkbox" checked={showConfig.layoutSafeArea} onChange={(event) => showConfig.setLayoutSafeArea(event.target.checked)} /><span>Title/action safe area</span></label><label><span>Collision policy</span><select value={showConfig.layoutPolicy} onChange={(event) => showConfig.setLayoutPolicy(event.target.value as typeof showConfig.layoutPolicy)}><option value="overlay">Overlay</option><option value="row">Stack in row</option><option value="column">Stack in column</option><option value="single">Single slot</option></select></label><label><span>Transition duration (ms)</span><input type="number" min={0} max={5000} step={10} value={showConfig.transitionDuration} onChange={(event) => showConfig.setTransitionDuration(Number(event.target.value))} /></label></div><div className="viewer-editor__actions"><PrimaryAction onClick={showConfig.saveLayoutPreset}>Apply placement</PrimaryAction><span>Apply updates this local production draft; save it from the status panel.</span></div></section>;
}

export function ViewerStatusPanel(props: ViewerShellProps) {
  const definition = selectedLayout(props);
  const placement = definition?.placementByProfile[props.previewProfile];
  const instance = props.showConfig.presentationInstances.find((item) => item.id === props.showConfig.layoutInstanceId);
  const errors: string[] = [];
  if (props.showConfig.layoutWidth < .08 || props.showConfig.layoutWidth > 1) errors.push("Width must be between 0.08 and 1.");
  if (props.showConfig.layoutX < 0 || props.showConfig.layoutX > 1 || props.showConfig.layoutY < 0 || props.showConfig.layoutY > 1) errors.push("Position must use normalised values from 0 to 1.");
  const warning = placement?.surface === "video" && !placement.safeArea ? "Video placement is not constrained to the title/action safe area." : null;
  return <section className="viewer-status-panel" aria-label="Viewer configuration status"><div className="viewer-panel-heading"><span>Selected instance</span><h2>{instanceLabel(props, props.showConfig.layoutInstanceId)}</h2></div>{props.showConfig.layoutInstanceId ? <><dl><div><dt>Profile</dt><dd>{props.previewProfile}</dd></div><div><dt>Surface</dt><dd>{placement?.surface ?? props.showConfig.layoutSurface}</dd></div><div><dt>Anchor</dt><dd>{placement?.anchor ?? props.showConfig.layoutAnchor}</dd></div><div><dt>Save state</dt><dd>Explicit save required</dd></div></dl>{instance && <p className={instance.enabled ? "viewer-status--ok" : "viewer-status--warning"}>{instance.enabled ? "Instance is enabled." : "Instance is disabled."}</p>}{warning && <p className="viewer-status--warning">{warning}</p>}{errors.length ? <div className="viewer-status--error" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div> : <p className="viewer-status--ok">Placement values are within supported bounds.</p>}</> : <p className="hint">Choose an instance to inspect its placement and validation.</p>}<p className="viewer-status__note">The current model records collision policy but does not calculate collisions, so no collision warning is shown.</p><PrimaryAction disabled={errors.length > 0} onClick={props.saveProduction}>Save into this production</PrimaryAction>{props.realOutputUrl ? <a className="viewer-open-output" href={props.realOutputUrl} target="_blank" rel="noreferrer">Open real output</a> : <span className="hint">Choose a channel to open real output.</span>}</section>;
}
