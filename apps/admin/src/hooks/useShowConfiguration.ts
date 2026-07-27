import { useCallback, useEffect, useState } from "react";
import type { LayoutDefinition, LayoutProfile, LayoutSurface, LayoutAnchor, PresentationInstanceDefinition, ShowConfiguration, Production } from "../types.js";

const placementPreset = (surface: LayoutSurface, anchor: LayoutAnchor) => {
  const x = anchor.endsWith("left") || anchor.endsWith("right") ? .04 : 0;
  const y = anchor.startsWith("top") || anchor.startsWith("bottom") ? .04 : 0;
  return { surface, anchor, x, y, width: surface === "surround" ? 1 : .36, safeArea: surface === "video", layout: anchor.startsWith("bottom") ? "column" as const : "overlay" as const };
};

interface Params {
  productionId: string;
  channelId: string;
  mutate: (url: string, method: "POST" | "PUT", body: Record<string, unknown>, success: string, reload?: () => Promise<void>) => Promise<{ id?: string } | undefined>;
  syncCommandFields?: (kind: string, instanceId: string) => void;
}

export function useShowConfiguration({ productionId, channelId, mutate, syncCommandFields }: Params) {
  const [productionTitle, setProductionTitle] = useState("");
  const [productionDescription, setProductionDescription] = useState("");
  const [productionStatus, setProductionStatus] = useState("draft");
  const [productionScheduledStart, setProductionScheduledStart] = useState("");
  const [productionScheduledEnd, setProductionScheduledEnd] = useState("");
  const [configurationName, setConfigurationName] = useState("Football package");
  const [homeTeam, setHomeTeam] = useState("HOME");
  const [awayTeam, setAwayTeam] = useState("AWAY");
  const [tickerLabel, setTickerLabel] = useState("LIVE");
  const [programmeTitle, setProgrammeTitle] = useState("");
  const [programmeSubtitle, setProgrammeSubtitle] = useState("");
  const [liveLabel, setLiveLabel] = useState("LIVE");
  const [accent, setAccent] = useState("#73e3ff");
  const [enabledPanels, setEnabledPanels] = useState(["match", "info", "partners", "interact"]);
  const [matchPanelLabel, setMatchPanelLabel] = useState("Match");
  const [infoPanelLabel, setInfoPanelLabel] = useState("Info");
  const [partnersPanelLabel, setPartnersPanelLabel] = useState("Partners");
  const [interactPanelLabel, setInteractPanelLabel] = useState("Interact");
  const [presentationLayouts, setPresentationLayouts] = useState<LayoutDefinition[]>([]);
  const [presentationInstances, setPresentationInstances] = useState<PresentationInstanceDefinition[]>([]);
  const [newInstanceId, setNewInstanceId] = useState("");
  const [newInstanceLabel, setNewInstanceLabel] = useState("");
  const [newInstanceKind, setNewInstanceKind] = useState<PresentationInstanceDefinition["kind"]>("lower-third");
  const [layoutInstanceId, setLayoutInstanceId] = useState("scorebug");
  const [layoutProfile, setLayoutProfile] = useState<LayoutProfile>("desktop");
  const [layoutSurface, setLayoutSurface] = useState<LayoutSurface>("video");
  const [layoutAnchor, setLayoutAnchor] = useState<LayoutAnchor>("top-left");
  const [layoutX, setLayoutX] = useState(.04);
  const [layoutY, setLayoutY] = useState(.04);
  const [layoutWidth, setLayoutWidth] = useState(.36);
  const [layoutHeight, setLayoutHeight] = useState<number | "">("");
  const [layoutOpacity, setLayoutOpacity] = useState(1);
  const [layoutRotation, setLayoutRotation] = useState(0);
  const [layoutCropTop, setLayoutCropTop] = useState(0);
  const [layoutCropRight, setLayoutCropRight] = useState(0);
  const [layoutCropBottom, setLayoutCropBottom] = useState(0);
  const [layoutCropLeft, setLayoutCropLeft] = useState(0);
  const [layoutSafeArea, setLayoutSafeArea] = useState(true);
  const [layoutPolicy, setLayoutPolicy] = useState<"single" | "row" | "column" | "overlay">("overlay");
  const [layoutVariant, setLayoutVariant] = useState("standard");
  const [layoutZIndex, setLayoutZIndex] = useState(10);
  const [transitionKind, setTransitionKind] = useState<"cut" | "fade" | "slide" | "scale">("fade");
  const [transitionDuration, setTransitionDuration] = useState(180);
  const [selectedElement, setSelectedElement] = useState("scorebug");
  const [elementsOpen, setElementsOpen] = useState(true);
  const [deckPinned, setDeckPinned] = useState(false);
  const [configurations, setConfigurations] = useState<ShowConfiguration[]>([]);

  const reloadProduction = useCallback(async () => {
    if (!productionId) return;
    const response = await fetch(`/api/productions/${productionId}`);
    if (!response.ok) throw new Error("Unable to load production");
    const item = await response.json() as Production;
    setProductionTitle(item.title); setProductionDescription(item.description ?? ""); setProductionStatus(item.status);
    setProductionScheduledStart(item.scheduledStart ?? ""); setProductionScheduledEnd(item.scheduledEnd ?? "");
    const configuration = item.configuration ?? {};
    const text = (key: string, fallback: string) => typeof configuration[key] === "string" ? configuration[key] as string : fallback;
    setHomeTeam(text("homeTeam", "HOME")); setAwayTeam(text("awayTeam", "AWAY")); setTickerLabel(text("tickerLabel", "LIVE")); setProgrammeTitle(text("programmeTitle", "")); setProgrammeSubtitle(text("programmeSubtitle", "")); setLiveLabel(text("liveLabel", "LIVE")); setAccent(text("accent", "#73e3ff"));
    const panels = configuration.enabledCompanionPanels; if (Array.isArray(panels) && panels.every((panel) => typeof panel === "string")) setEnabledPanels(panels as string[]);
    const labels = configuration.companionPanelLabels as Record<string, unknown> | undefined;
    setMatchPanelLabel(typeof labels?.match === "string" ? labels.match : "Match"); setInfoPanelLabel(typeof labels?.info === "string" ? labels.info : "Info"); setPartnersPanelLabel(typeof labels?.partners === "string" ? labels.partners : "Partners"); setInteractPanelLabel(typeof labels?.interact === "string" ? labels.interact : "Interact");
    const nextLayouts = Array.isArray(configuration.presentationLayouts) ? configuration.presentationLayouts as LayoutDefinition[] : [];
    const nextInstances = Array.isArray(configuration.presentationInstances) ? configuration.presentationInstances as PresentationInstanceDefinition[] : [];
    setPresentationLayouts(nextLayouts);
    setPresentationInstances(nextInstances);
    setLayoutInstanceId((current) => nextLayouts.some((layout) => layout.instanceId === current) || nextInstances.some((instance) => instance.id === current) || ["scorebug", "lower-third", "primary", "ticker"].includes(current)
      ? current
      : nextLayouts[0]?.instanceId ?? nextInstances[0]?.id ?? "scorebug");
  }, [productionId]);

  useEffect(() => { reloadProduction().catch(() => {}); }, [reloadProduction]);

  const reloadConfigurations = useCallback(async () => {
    if (!channelId) return;
    const response = await fetch(`/api/channels/${channelId}/show-configurations`);
    if (!response.ok) throw new Error("Unable to load show configurations");
    setConfigurations(await response.json() as ShowConfiguration[]);
  }, [channelId]);

  useEffect(() => { reloadConfigurations().catch(() => {}); }, [reloadConfigurations]);

  const currentShowConfiguration = useCallback((): Record<string, unknown> => ({ sport: "football", homeTeam, awayTeam, tickerLabel, ...(programmeTitle.trim() ? { programmeTitle: programmeTitle.trim() } : {}), ...(programmeSubtitle.trim() ? { programmeSubtitle: programmeSubtitle.trim() } : {}), ...(liveLabel.trim() ? { liveLabel: liveLabel.trim() } : {}), accent, enabledCompanionPanels: enabledPanels, companionPanelLabels: { match: matchPanelLabel.trim() || "Match", info: infoPanelLabel.trim() || "Info", partners: partnersPanelLabel.trim() || "Partners", interact: interactPanelLabel.trim() || "Interact" }, ...(presentationInstances.length ? { presentationInstances } : {}), ...(presentationLayouts.length ? { presentationLayouts } : {}) }), [homeTeam, awayTeam, tickerLabel, programmeTitle, programmeSubtitle, liveLabel, accent, enabledPanels, matchPanelLabel, infoPanelLabel, partnersPanelLabel, interactPanelLabel, presentationInstances, presentationLayouts]);

  const saveLayoutPreset = useCallback(() => setPresentationLayouts((current) => {
    const placement = { ...placementPreset(layoutSurface, layoutAnchor), x: layoutX, y: layoutY, width: layoutWidth, ...(layoutHeight === "" ? {} : { height: layoutHeight }), opacity: layoutOpacity, rotation: layoutRotation, crop: { top: layoutCropTop, right: layoutCropRight, bottom: layoutCropBottom, left: layoutCropLeft }, safeArea: layoutSafeArea, layout: layoutPolicy };
    const existing = current.find((definition) => definition.instanceId === layoutInstanceId);
    const transition = { enter: transitionKind, exit: transitionKind, durationMs: transitionDuration };
    if (existing) return current.map((definition) => definition.instanceId === layoutInstanceId ? { ...definition, placementByProfile: { ...definition.placementByProfile, [layoutProfile]: placement }, variantByProfile: { ...definition.variantByProfile, [layoutProfile]: layoutVariant }, zIndex: layoutZIndex, transition } : definition);
    return [...current, { instanceId: layoutInstanceId, placementByProfile: { [layoutProfile]: placement }, variantByProfile: { [layoutProfile]: layoutVariant }, zIndex: layoutZIndex, transition }];
  }), [layoutSurface, layoutAnchor, layoutX, layoutY, layoutWidth, layoutHeight, layoutOpacity, layoutRotation, layoutCropTop, layoutCropRight, layoutCropBottom, layoutCropLeft, layoutSafeArea, layoutPolicy, layoutInstanceId, transitionKind, transitionDuration, layoutProfile, layoutVariant, layoutZIndex]);

  const duplicateLayoutDefinition = useCallback((instanceId: string) => setPresentationLayouts((current) => {
    const source = current.find((definition) => definition.instanceId === instanceId); if (!source) return current;
    let copyId = `${instanceId}-copy`; let suffix = 2;
    while (current.some((definition) => definition.instanceId === copyId)) copyId = `${instanceId}-copy-${suffix++}`;
    return [...current, { ...source, instanceId: copyId }];
  }), []);

  const removeLayoutDefinition = useCallback((instanceId: string) => setPresentationLayouts((current) => current.filter((definition) => definition.instanceId !== instanceId)), []);

  const addPresentationInstance = useCallback(() => {
    const id = newInstanceId.trim().toLowerCase(); const label = newInstanceLabel.trim();
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) { return { error: "Instance ID must use letters, numbers, and hyphens." }; }
    if (!label) { return { error: "Give the presentation instance a label." }; }
    if (presentationInstances.some((instance) => instance.id === id)) { return { error: "That instance ID is already in this production." }; }
    setPresentationInstances((current) => [...current, { id, label, kind: newInstanceKind, enabled: true }]); setLayoutInstanceId(id); setNewInstanceId(""); setNewInstanceLabel(""); return { success: `${label} added to the reusable instance library.`, instanceId: id };
  }, [newInstanceId, newInstanceLabel, newInstanceKind, presentationInstances]);

  const duplicatePresentationInstance = useCallback((id: string) => {
    const source = presentationInstances.find((instance) => instance.id === id); if (!source) return;
    let copyId = `${id}-copy`; let suffix = 2;
    while (presentationInstances.some((instance) => instance.id === copyId)) copyId = `${id}-copy-${suffix++}`;
    setPresentationInstances((current) => [...current, { ...source, id: copyId, label: `${source.label} copy`, enabled: false }]);
    const sourceLayout = presentationLayouts.find((layout) => layout.instanceId === id);
    if (sourceLayout) setPresentationLayouts((current) => [...current, { ...sourceLayout, instanceId: copyId }]);
    setLayoutInstanceId(copyId);
  }, [presentationInstances, presentationLayouts]);

  const removePresentationInstance = useCallback((id: string) => {
    setPresentationInstances((current) => current.filter((instance) => instance.id !== id));
    setPresentationLayouts((current) => current.filter((layout) => layout.instanceId !== id));
    setLayoutInstanceId((current) => current === id ? "scorebug" : current);
  }, []);

  const chooseElement = useCallback((kind: "scorebug" | "lower-third" | "ticker" | "alert" | "sponsor-panel" | "clock") => {
    const defaults: Record<typeof kind, { instanceId: string; command?: string; surface: LayoutSurface; anchor: LayoutAnchor }> = {
      scorebug: { instanceId: "scorebug-main", command: "score", surface: "video", anchor: "top-left" },
      "lower-third": { instanceId: "lower-third-presenter-a", command: "lower", surface: "video", anchor: "bottom-left" },
      ticker: { instanceId: "ticker-main", command: "ticker", surface: "surround", anchor: "bottom-centre" },
      alert: { instanceId: "alert-main", command: "alert", surface: "video", anchor: "centre" },
      "sponsor-panel": { instanceId: "sponsor-top-right", command: "sponsor", surface: "surround", anchor: "top-right" },
      clock: { instanceId: "programme-clock", command: "clock", surface: "video", anchor: "top-centre" },
    };
    const selected = defaults[kind];
    const preset = placementPreset(selected.surface, selected.anchor);
    setSelectedElement(kind); if (selected.command) syncCommandFields?.(selected.command, selected.instanceId);
    setLayoutInstanceId(selected.instanceId); setLayoutSurface(selected.surface); setLayoutAnchor(selected.anchor); setLayoutX(preset.x); setLayoutY(preset.y); setLayoutWidth(preset.width); setLayoutHeight(""); setLayoutOpacity(1); setLayoutRotation(0); setLayoutCropTop(0); setLayoutCropRight(0); setLayoutCropBottom(0); setLayoutCropLeft(0); setLayoutSafeArea(preset.safeArea ?? false); setLayoutPolicy(preset.layout === "column" ? "column" : "overlay");
    return `${kind} selected. Choose a profile and apply a placement preset, then configure its typed command.`;
  }, [syncCommandFields]);

  const dropElementOnPreset = useCallback((kind: "scorebug" | "lower-third" | "ticker" | "alert" | "sponsor-panel" | "clock", anchor: LayoutAnchor) => {
    chooseElement(kind);
    const preset = placementPreset("video", anchor);
    setLayoutSurface("video"); setLayoutAnchor(anchor); setLayoutX(preset.x); setLayoutY(preset.y); setLayoutWidth(preset.width); setLayoutSafeArea(true); setLayoutPolicy(preset.layout === "column" ? "column" : "overlay");
    return `${kind.replace("-", " ")} assigned to the ${anchor.replace("-", " ")} video preset. Apply the profile placement to save it.`;
  }, [chooseElement]);

  return {
    productionTitle, setProductionTitle,
    productionDescription, setProductionDescription,
    productionStatus, setProductionStatus,
    productionScheduledStart, setProductionScheduledStart,
    productionScheduledEnd, setProductionScheduledEnd,
    configurationName, setConfigurationName,
    homeTeam, setHomeTeam,
    awayTeam, setAwayTeam,
    tickerLabel, setTickerLabel,
    programmeTitle, setProgrammeTitle,
    programmeSubtitle, setProgrammeSubtitle,
    liveLabel, setLiveLabel,
    accent, setAccent,
    enabledPanels, setEnabledPanels,
    matchPanelLabel, setMatchPanelLabel,
    infoPanelLabel, setInfoPanelLabel,
    partnersPanelLabel, setPartnersPanelLabel,
    interactPanelLabel, setInteractPanelLabel,
    presentationLayouts, setPresentationLayouts,
    presentationInstances, setPresentationInstances,
    newInstanceId, setNewInstanceId,
    newInstanceLabel, setNewInstanceLabel,
    newInstanceKind, setNewInstanceKind,
    layoutInstanceId, setLayoutInstanceId,
    layoutProfile, setLayoutProfile,
    layoutSurface, setLayoutSurface,
    layoutAnchor, setLayoutAnchor,
    layoutX, setLayoutX,
    layoutY, setLayoutY,
    layoutWidth, setLayoutWidth,
    layoutHeight, setLayoutHeight,
    layoutOpacity, setLayoutOpacity,
    layoutRotation, setLayoutRotation,
    layoutCropTop, setLayoutCropTop,
    layoutCropRight, setLayoutCropRight,
    layoutCropBottom, setLayoutCropBottom,
    layoutCropLeft, setLayoutCropLeft,
    layoutSafeArea, setLayoutSafeArea,
    layoutPolicy, setLayoutPolicy,
    layoutVariant, setLayoutVariant,
    layoutZIndex, setLayoutZIndex,
    transitionKind, setTransitionKind,
    transitionDuration, setTransitionDuration,
    selectedElement, setSelectedElement,
    elementsOpen, setElementsOpen,
    deckPinned, setDeckPinned,
    configurations,
    reloadProduction,
    reloadConfigurations,
    currentShowConfiguration,
    saveLayoutPreset,
    duplicateLayoutDefinition,
    removeLayoutDefinition,
    addPresentationInstance,
    duplicatePresentationInstance,
    removePresentationInstance,
    chooseElement,
    dropElementOnPreset,
  } as const;
}
