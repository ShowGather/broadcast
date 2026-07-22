import { useCallback, useEffect, useRef, useState } from "react";
import { adminPath, parseAdminRoute, type AdminRoute, type PrepareTab } from "./routing.js";

interface StoredEvent {
  event: { id: string; t: string; p: Record<string, unknown> };
  injectedAt: string;
}
interface RundownCue { id: string; label: string; order: number; enabled: boolean; status: "pending" | "active" | "complete" | "failed" | "cancelled"; executionId?: string; }
interface Channel { id: string; name: string; slug: string; status: string; }
interface Production { id: string; channelId: string; title: string; description?: string | null; status: string; scheduledStart?: string | null; scheduledEnd?: string | null; configuration?: Record<string, unknown> | null; showConfigurationId?: string | null; }
interface Rundown { id: string; name: string; version: number; }
interface RundownDefinitionCue { id: string; label: string; position: number; enabled: boolean; commandPayload: Record<string, unknown>; }
interface ShowConfiguration { id: string; name: string; configuration: Record<string, unknown>; }
interface PresentationInstanceDefinition { id: string; kind: "lower-third" | "scorebug" | "ticker" | "alert" | "sponsor" | "clock" | "live-badge" | "poll" | "custom"; label: string; enabled: boolean; }
interface OutboxItem { id: string; eventId: string; revision: number; label: string; status: "pending" | "dispatched" | "failed" | "cancelled"; error?: string; retryable: boolean; cancellable: boolean; }
type LayoutProfile = "desktop" | "tv" | "mobile";
type LayoutSurface = "video" | "surround" | "companion";
type LayoutAnchor = "top-left" | "top-centre" | "top-right" | "centre-left" | "centre" | "centre-right" | "bottom-left" | "bottom-centre" | "bottom-right";
interface LayoutDefinition { instanceId: string; placementByProfile: Partial<Record<LayoutProfile, { surface: LayoutSurface; anchor: LayoutAnchor; x: number; y: number; width: number; height?: number; crop?: { top: number; right: number; bottom: number; left: number }; opacity?: number; rotation?: number; safeArea?: boolean; layout: "single" | "row" | "column" | "overlay" }>>; variantByProfile?: Partial<Record<LayoutProfile, string>>; zIndex?: number; transition?: { enter: "cut" | "fade" | "slide" | "scale"; exit: "cut" | "fade" | "slide" | "scale"; durationMs: number }; }

const placementPreset = (surface: LayoutSurface, anchor: LayoutAnchor) => {
  const x = anchor.endsWith("left") || anchor.endsWith("right") ? .04 : 0;
  const y = anchor.startsWith("top") || anchor.startsWith("bottom") ? .04 : 0;
  return { surface, anchor, x, y, width: surface === "surround" ? 1 : .36, safeArea: surface === "video", layout: anchor.startsWith("bottom") ? "column" as const : "overlay" as const };
};

function eventLabel(event: StoredEvent["event"]) {
  if (event.t === "presentation.cue") return `Cue: ${event.p.cue ?? "unknown"}`;
  if (event.t === "pc") return `Command: ${event.p.k ?? "unknown"}`;
  if (event.t === "presentation.clear") return "Safe Clear";
  return String(event.p.title ?? "Overlay");
}

export default function App() {
  const [route, setRoute] = useState<AdminRoute>(() => parseAdminRoute(window.location.pathname, window.location.search));
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState(5000);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [commandKind, setCommandKind] = useState("score");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [label, setLabel] = useState("");
  const [commandDuration, setCommandDuration] = useState(8000);
  const [commandInstanceId, setCommandInstanceId] = useState("");
  const [rundown, setRundown] = useState<RundownCue[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [apiConnection, setApiConnection] = useState<"checking" | "connected" | "offline">("checking");
  const [streamConnection, setStreamConnection] = useState<"checking" | "connected" | "offline">("checking");
  const [runReady, setRunReady] = useState(false);
  const [runCueIndex, setRunCueIndex] = useState(0);
  const [previewProfile, setPreviewProfile] = useState<"desktop" | "mobile" | "tv">("desktop");
  const [confirmation, setConfirmation] = useState<"complete" | "abandon" | "reset" | "safe-clear" | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const confirmationButton = useRef<HTMLButtonElement>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [rundowns, setRundowns] = useState<Rundown[]>([]);
  const [channelId, setChannelId] = useState(() => localStorage.getItem("showgather.channelId") ?? "");
  const [productionId, setProductionId] = useState(() => route.productionId ?? localStorage.getItem("showgather.productionId") ?? "");
  const [rundownId, setRundownId] = useState(() => localStorage.getItem("showgather.rundownId") ?? "");
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [selectionError, setSelectionError] = useState("");
  const [productionTitle, setProductionTitle] = useState("");
  const [productionDescription, setProductionDescription] = useState("");
  const [productionStatus, setProductionStatus] = useState("draft");
  const [rundownName, setRundownName] = useState("");
  const [rundownDefinition, setRundownDefinition] = useState<RundownDefinitionCue[]>([]);
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
  const workspace = route.workspace === "productions" ? "prepare" : route.workspace;
  const prepareTab = route.prepareTab ?? "overview";
  const rehearsal = workspace === "rehearse";
  const navigate = useCallback((next: AdminRoute, replace = false) => {
    const path = adminPath(next);
    window.history[replace ? "replaceState" : "pushState"]({}, "", path);
    setRoute(next);
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(parseAdminRoute(window.location.pathname, window.location.search));
    window.addEventListener("popstate", onPopState);
    if (route.workspace === "productions" && window.location.pathname !== "/admin/productions") navigate({ workspace: "productions" }, true);
    return () => window.removeEventListener("popstate", onPopState);
  }, [navigate, route.workspace]);
  useEffect(() => { if (route.productionId && route.productionId !== productionId) setProductionId(route.productionId); }, [productionId, route.productionId]);

  useEffect(() => {
    fetch("/api/channels").then(async (response) => {
      if (!response.ok) throw new Error("Unable to load channels");
      const items = await response.json() as Channel[]; setChannels(items);
      setChannelId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
    }).catch((reason) => setSelectionError(reason instanceof Error ? reason.message : "Unable to load channels"));
  }, []);
  useEffect(() => { if (channelId) localStorage.setItem("showgather.channelId", channelId); }, [channelId]);
  useEffect(() => { if (productionId) localStorage.setItem("showgather.productionId", productionId); }, [productionId]);
  useEffect(() => { if (rundownId) localStorage.setItem("showgather.rundownId", rundownId); }, [rundownId]);
  useEffect(() => {
    if (!channelId) return;
    fetch(`/api/channels/${channelId}/productions`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load productions");
      const items = await response.json() as Production[]; setProductions(items);
      if (route.productionId && !items.some((item) => item.id === route.productionId)) {
        setSelectionError("That production is unavailable. Choose an existing production or create a new one.");
        navigate({ workspace: "productions" }, true);
      }
      setProductionId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
    }).catch((reason) => setSelectionError(reason instanceof Error ? reason.message : "Unable to load productions"));
  }, [channelId, navigate, route.productionId]);
  useEffect(() => {
    if (!productionId) return;
    fetch(`/api/productions/${productionId}/rundowns`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load rundowns");
      const items = await response.json() as Rundown[]; setRundowns(items);
      setRundownId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
    }).catch((reason) => setSelectionError(reason instanceof Error ? reason.message : "Unable to load rundowns"));
  }, [productionId]);
  const reloadProduction = useCallback(async () => {
    if (!productionId) return;
    const response = await fetch(`/api/productions/${productionId}`);
    if (!response.ok) throw new Error("Unable to load production");
    const item = await response.json() as Production;
    setProductionTitle(item.title); setProductionDescription(item.description ?? ""); setProductionStatus(item.status);
    const configuration = item.configuration ?? {};
    const text = (key: string, fallback: string) => typeof configuration[key] === "string" ? configuration[key] as string : fallback;
    setHomeTeam(text("homeTeam", "HOME")); setAwayTeam(text("awayTeam", "AWAY")); setTickerLabel(text("tickerLabel", "LIVE")); setProgrammeTitle(text("programmeTitle", "")); setProgrammeSubtitle(text("programmeSubtitle", "")); setLiveLabel(text("liveLabel", "LIVE")); setAccent(text("accent", "#73e3ff"));
    const panels = configuration.enabledCompanionPanels; if (Array.isArray(panels) && panels.every((panel) => typeof panel === "string")) setEnabledPanels(panels as string[]);
    const labels = configuration.companionPanelLabels as Record<string, unknown> | undefined;
    setMatchPanelLabel(typeof labels?.match === "string" ? labels.match : "Match"); setInfoPanelLabel(typeof labels?.info === "string" ? labels.info : "Info"); setPartnersPanelLabel(typeof labels?.partners === "string" ? labels.partners : "Partners"); setInteractPanelLabel(typeof labels?.interact === "string" ? labels.interact : "Interact");
    setPresentationLayouts(Array.isArray(configuration.presentationLayouts) ? configuration.presentationLayouts as LayoutDefinition[] : []);
    setPresentationInstances(Array.isArray(configuration.presentationInstances) ? configuration.presentationInstances as PresentationInstanceDefinition[] : []);
  }, [productionId]);
  const reloadRundownDefinition = useCallback(async () => {
    if (!rundownId) return;
    const response = await fetch(`/api/rundowns/${rundownId}`);
    if (!response.ok) throw new Error("Unable to load rundown editor");
    const item = await response.json() as { name: string; cues: RundownDefinitionCue[] };
    setRundownName(item.name); setRundownDefinition(item.cues);
  }, [rundownId]);
  const reloadConfigurations = useCallback(async () => {
    if (!channelId) return;
    const response = await fetch(`/api/channels/${channelId}/show-configurations`);
    if (!response.ok) throw new Error("Unable to load show configurations");
    setConfigurations(await response.json() as ShowConfiguration[]);
  }, [channelId]);
  useEffect(() => { reloadProduction().catch((reason) => setSelectionError(reason.message)); }, [reloadProduction]);
  useEffect(() => { reloadRundownDefinition().catch((reason) => setSelectionError(reason.message)); }, [reloadRundownDefinition]);
  useEffect(() => { reloadConfigurations().catch((reason) => setSelectionError(reason.message)); }, [reloadConfigurations]);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch("/api/events");
      if (response.ok) setEvents(await response.json());
    } catch { /* Keep the latest known operator history. */ }
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = window.setInterval(fetchEvents, 5_000);
    return () => window.clearInterval(interval);
  }, [fetchEvents]);

  const fetchRundown = useCallback(async () => {
    if (!rundownId) return;
    const response = await fetch(`/api/rundown/${rehearsal ? "rehearsal" : "live"}?rundownId=${encodeURIComponent(rundownId)}`);
    if (response.ok) {
      const result = await response.json() as { cues: RundownCue[]; sessionId?: string };
      setRundown(result.cues); setSessionId(result.sessionId ?? "");
    }
  }, [rehearsal, rundownId]);
  useEffect(() => { fetchRundown().catch(() => {}); }, [fetchRundown]);

  const fetchOutbox = useCallback(async () => {
    if (!channelId) return;
    const response = await fetch(`/api/channels/${channelId}/presentation/outbox`);
    if (response.ok) setOutbox(await response.json());
  }, [channelId]);
  useEffect(() => { fetchOutbox().catch(() => {}); const interval = window.setInterval(() => { fetchOutbox().catch(() => {}); }, 5_000); return () => window.clearInterval(interval); }, [fetchOutbox]);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch("/api/status");
        const result = response.ok ? await response.json() as { stream?: "connected" | "offline" } : null;
        if (active) { setApiConnection(response.ok ? "connected" : "offline"); setStreamConnection(result?.stream === "connected" ? "connected" : "offline"); }
      } catch { if (active) { setApiConnection("offline"); setStreamConnection("offline"); } }
    };
    check(); const interval = window.setInterval(check, 5_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  useEffect(() => { if (workspace !== "run") setRunReady(false); }, [workspace]);
  useEffect(() => { if (confirmation) confirmationButton.current?.focus(); }, [confirmation]);
  useEffect(() => {
    setRunCueIndex((current) => {
      const firstPending = rundown.findIndex((cue) => cue.enabled && cue.status === "pending");
      if (firstPending >= 0 && (current >= rundown.length || rundown[current]?.status === "complete")) return firstPending;
      return Math.max(0, Math.min(current, Math.max(0, rundown.length - 1)));
    });
  }, [rundown]);

  const send = async (body: Record<string, unknown>, success: string) => {
    setStatus(""); setError("");
    try {
      const response = await fetch(rehearsal ? "/api/rehearsal/events" : "/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      setStatus(`${rehearsal ? "Rehearsal: " : "Live: "}${success} — ${result.event?.id ?? "queued"} (${result.status ?? "pending"})`);
      if (!rehearsal) fetchEvents();
      if (!rehearsal) fetchOutbox();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send event");
    }
  };

  const currentCommand = () => {
    const duration = Number.isFinite(commandDuration) && commandDuration > 0 ? commandDuration : undefined;
    const instance = commandInstanceId.trim() ? { i: commandInstanceId.trim() } : {};
    return commandKind === "score" ? { k: "score", h: Number(primary), a: Number(secondary), ...(label.trim() ? { l: label.trim() } : {}), ...instance }
      : commandKind === "lower" ? { k: "lower", t: primary.trim(), ...(secondary.trim() ? { s: secondary.trim() } : {}), ...(duration ? { d: duration } : {}), ...instance }
      : commandKind === "alert" ? { k: "alert", t: primary.trim(), m: secondary.trim(), x: "w", ...(duration ? { d: duration } : {}), ...instance }
      : commandKind === "sponsor" ? { k: "sponsor", b: primary.trim(), ...(secondary.trim() ? { s: secondary.trim() } : {}), ...(duration ? { d: duration } : {}), ...instance }
      : commandKind === "ticker" ? { k: "ticker", t: primary.trim(), ...(label.trim() ? { l: label.trim() } : {}), ...instance }
      : commandKind === "clock" ? { k: "clock", t: primary.trim(), ...(label.trim() ? { l: label.trim() } : {}), ...instance }
      : { k: "clear", ...(primary ? { g: primary } : {}), ...(secondary.trim() ? { y: secondary.trim() } : {}) };
  };
  const sendCommand = () => send({ command: currentCommand() }, `${commandKind} command sent`);

  const mutate = async (url: string, method: "POST" | "PUT", body: Record<string, unknown>, success: string, reload?: () => Promise<void>) => {
    setStatus(""); setError("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json() as { id?: string };
      setStatus(success);
      await reload?.();
      return result;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save"); return undefined; }
  };
  const refreshShowContext = async () => { await reloadProduction(); await reloadRundownDefinition(); await reloadConfigurations(); };
  const createProduction = async (fresh = false) => {
    const result = await mutate(`/api/channels/${channelId}/productions`, "POST", { title: fresh ? "New production" : productionTitle || "New production", description: fresh ? "" : productionDescription, status: fresh ? "draft" : productionStatus }, "Production created");
    if (result?.id) { setProductions(await (await fetch(`/api/channels/${channelId}/productions`)).json() as Production[]); setProductionId(result.id); navigate({ workspace: "prepare", productionId: result.id }); }
  };
  const duplicateProduction = async () => {
    const result = await mutate(`/api/productions/${productionId}/duplicate`, "POST", {}, "Production duplicated");
    if (result?.id) { setProductions(await (await fetch(`/api/channels/${channelId}/productions`)).json() as Production[]); setProductionId(result.id); navigate({ workspace: "prepare", productionId: result.id }); }
  };
  const addCue = async () => { await mutate(`/api/rundowns/${rundownId}/cues`, "POST", { label: label.trim() || `${commandKind} cue`, command: currentCommand(), enabled: true }, "Cue saved", async () => { await reloadRundownDefinition(); await fetchRundown(); }); };
  const editCue = async (cue: RundownDefinitionCue, changes: Record<string, unknown>) => { await mutate(`/api/rundown-cues/${cue.id}`, "PUT", changes, "Cue updated", async () => { await reloadRundownDefinition(); await fetchRundown(); }); };
  const moveCue = async (index: number, direction: -1 | 1) => {
    const reordered = [...rundownDefinition]; const next = index + direction; if (next < 0 || next >= reordered.length) return;
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    await mutate(`/api/rundowns/${rundownId}/cues/reorder`, "POST", { cueIds: reordered.map((cue) => cue.id) }, "Cue order saved", reloadRundownDefinition);
  };

  const goCue = async (cue: RundownCue, rerun = false) => {
    setStatus(""); setError("");
    try {
      const response = await fetch(`/api/rundown/${rehearsal ? "rehearsal" : "live"}/go?rundownId=${encodeURIComponent(rundownId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cueId: cue.id, ...(rerun ? { rerun: true } : {}) }) });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json(); setRundown(result.cues); setStatus(`${rehearsal ? "Rehearsal" : "Live"} rundown: ${cue.label} ${result.dispatchStatus ?? "complete"}`); if (!rehearsal) { fetchEvents(); fetchOutbox(); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to execute cue"); }
  };

  const resolveOutbox = async (item: OutboxItem, action: "retry" | "cancel") => {
    setError(""); setStatus("");
    try {
      const response = await fetch(`/api/channels/${channelId}/presentation/outbox/${item.id}/${action}`, { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      setStatus(`${item.label} revision ${item.revision}: ${result.status}`); await fetchOutbox(); await fetchRundown();
    } catch (reason) { setError(reason instanceof Error ? reason.message : `Unable to ${action} command`); }
  };

  const selectedProduction = productions.find((production) => production.id === productionId);
  const playerPreviewUrl = channelId ? `${window.location.protocol}//${window.location.hostname}:3003/player/${encodeURIComponent(channelId)}?profile=${previewProfile}&rehearsal=1&embedded=1&productionId=${encodeURIComponent(productionId)}` : "";
  const layoutPreviewUrl = channelId ? `${window.location.protocol}//${window.location.hostname}:3003/player/${encodeURIComponent(channelId)}?scene=acceptance&profile=${previewProfile}&embedded=1&productionId=${encodeURIComponent(productionId)}` : "";
  const programmePreviewUrl = channelId ? `${window.location.protocol}//${window.location.hostname}:3003/player/${encodeURIComponent(channelId)}?profile=desktop&embedded=1&productionId=${encodeURIComponent(productionId)}` : "";
  const disabledCueCount = rundown.filter((cue) => !cue.enabled).length;
  const unresolvedOutbox = outbox.filter((item) => item.status === "failed" || item.status === "pending");
  const productionSwitchLocked = workspace === "run" && runReady;
  const enterRun = async () => {
    if (sessionId) { setRunReady(true); setStatus("Resumed the existing live session."); return; }
    const result = await mutate(`/api/rundown/live/sessions?rundownId=${encodeURIComponent(rundownId)}`, "POST", {}, "Live session started", fetchRundown);
    if (result) setRunReady(true);
  };
  const confirmSessionAction = async () => {
    if (!confirmation) return;
    if (confirmation === "safe-clear") {
      await send({ action: "safe-clear" }, "Safe Clear sent");
    } else if (confirmation === "reset") {
      const result = await mutate(`/api/rundown/live/sessions?rundownId=${encodeURIComponent(rundownId)}`, "POST", {}, "New live session started", fetchRundown);
      if (result) setRunReady(true);
    } else if (sessionId) {
      const response = await fetch(`/api/rundown/live/sessions/${encodeURIComponent(sessionId)}/${confirmation}?rundownId=${encodeURIComponent(rundownId)}`, { method: "POST" });
      if (!response.ok) { setError(await response.text()); return; }
      setStatus(confirmation === "complete" ? "Live session completed." : "Live session abandoned."); setRunReady(false); await fetchRundown();
    }
    setConfirmation(null);
  };
  const runCue = rundown[runCueIndex];
  const nextRunCue = rundown.slice(runCueIndex + 1).find((cue) => cue.enabled && cue.status !== "complete");
  const saveLayoutPreset = () => setPresentationLayouts((current) => {
    const placement = { ...placementPreset(layoutSurface, layoutAnchor), x: layoutX, y: layoutY, width: layoutWidth, ...(layoutHeight === "" ? {} : { height: layoutHeight }), opacity: layoutOpacity, rotation: layoutRotation, crop: { top: layoutCropTop, right: layoutCropRight, bottom: layoutCropBottom, left: layoutCropLeft }, safeArea: layoutSafeArea, layout: layoutPolicy };
    const existing = current.find((definition) => definition.instanceId === layoutInstanceId);
    const transition = { enter: transitionKind, exit: transitionKind, durationMs: transitionDuration };
    if (existing) return current.map((definition) => definition.instanceId === layoutInstanceId ? { ...definition, placementByProfile: { ...definition.placementByProfile, [layoutProfile]: placement }, variantByProfile: { ...definition.variantByProfile, [layoutProfile]: layoutVariant }, zIndex: layoutZIndex, transition } : definition);
    return [...current, { instanceId: layoutInstanceId, placementByProfile: { [layoutProfile]: placement }, variantByProfile: { [layoutProfile]: layoutVariant }, zIndex: layoutZIndex, transition }];
  });
  const duplicateLayoutDefinition = (instanceId: string) => setPresentationLayouts((current) => {
    const source = current.find((definition) => definition.instanceId === instanceId); if (!source) return current;
    let copyId = `${instanceId}-copy`; let suffix = 2;
    while (current.some((definition) => definition.instanceId === copyId)) copyId = `${instanceId}-copy-${suffix++}`;
    return [...current, { ...source, instanceId: copyId }];
  });
  const removeLayoutDefinition = (instanceId: string) => setPresentationLayouts((current) => current.filter((definition) => definition.instanceId !== instanceId));
  const addPresentationInstance = () => {
    const id = newInstanceId.trim().toLowerCase(); const label = newInstanceLabel.trim();
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) { setError("Instance ID must use letters, numbers, and hyphens."); return; }
    if (!label) { setError("Give the presentation instance a label."); return; }
    if (presentationInstances.some((instance) => instance.id === id)) { setError("That instance ID is already in this production."); return; }
    setPresentationInstances((current) => [...current, { id, label, kind: newInstanceKind, enabled: true }]); setLayoutInstanceId(id); setCommandInstanceId(id); setNewInstanceId(""); setNewInstanceLabel(""); setStatus(`${label} added to the reusable instance library.`); setError("");
  };
  const duplicatePresentationInstance = (id: string) => setPresentationInstances((current) => {
    const source = current.find((instance) => instance.id === id); if (!source) return current; let copyId = `${id}-copy`; let suffix = 2;
    while (current.some((instance) => instance.id === copyId)) copyId = `${id}-copy-${suffix++}`;
    setLayoutInstanceId(copyId); return [...current, { ...source, id: copyId, label: `${source.label} copy`, enabled: false }];
  });
  const removePresentationInstance = (id: string) => { setPresentationInstances((current) => current.filter((instance) => instance.id !== id)); setPresentationLayouts((current) => current.filter((layout) => layout.instanceId !== id)); };
  const chooseElement = (kind: "scorebug" | "lower-third" | "ticker" | "alert" | "sponsor-panel" | "clock") => {
    const defaults: Record<typeof kind, { instanceId: string; command?: string; surface: LayoutSurface; anchor: LayoutAnchor }> = {
      scorebug: { instanceId: "scorebug-main", command: "score", surface: "video", anchor: "top-left" },
      "lower-third": { instanceId: "lower-third-presenter-a", command: "lower", surface: "video", anchor: "bottom-left" },
      ticker: { instanceId: "ticker-main", command: "ticker", surface: "surround", anchor: "bottom-centre" },
      alert: { instanceId: "alert-main", command: "alert", surface: "video", anchor: "centre" },
      "sponsor-panel": { instanceId: "sponsor-top-right", command: "sponsor", surface: "surround", anchor: "top-right" },
      clock: { instanceId: "programme-clock", command: "clock", surface: "video", anchor: "top-centre" },
    };
    const selected = defaults[kind];
    const placement = placementPreset(selected.surface, selected.anchor);
    setSelectedElement(kind); if (selected.command) setCommandKind(selected.command); setCommandInstanceId(selected.instanceId); setLayoutInstanceId(selected.instanceId); setLayoutSurface(selected.surface); setLayoutAnchor(selected.anchor); setLayoutX(placement.x); setLayoutY(placement.y); setLayoutWidth(placement.width); setLayoutHeight(""); setLayoutOpacity(1); setLayoutRotation(0); setLayoutCropTop(0); setLayoutCropRight(0); setLayoutCropBottom(0); setLayoutCropLeft(0); setLayoutSafeArea(placement.safeArea ?? false); setLayoutPolicy(placement.layout === "column" ? "column" : "overlay");
    setStatus(`${kind} selected. Choose a profile and apply a placement preset, then configure its typed command.`);
  };
  const dropElementOnPreset = (kind: "scorebug" | "lower-third" | "ticker" | "alert" | "sponsor-panel" | "clock", anchor: LayoutAnchor) => {
    chooseElement(kind);
    const placement = placementPreset("video", anchor);
    setLayoutSurface("video"); setLayoutAnchor(anchor); setLayoutX(placement.x); setLayoutY(placement.y); setLayoutWidth(placement.width); setLayoutSafeArea(true); setLayoutPolicy(placement.layout === "column" ? "column" : "overlay");
    setStatus(`${kind.replace("-", " ")} assigned to the ${anchor.replace("-", " ")} video preset. Apply the profile placement to save it.`);
  };
  const currentShowConfiguration = () => ({ sport: "football", homeTeam, awayTeam, tickerLabel, ...(programmeTitle.trim() ? { programmeTitle: programmeTitle.trim() } : {}), ...(programmeSubtitle.trim() ? { programmeSubtitle: programmeSubtitle.trim() } : {}), ...(liveLabel.trim() ? { liveLabel: liveLabel.trim() } : {}), accent, enabledCompanionPanels: enabledPanels, companionPanelLabels: { match: matchPanelLabel.trim() || "Match", info: infoPanelLabel.trim() || "Info", partners: partnersPanelLabel.trim() || "Partners", interact: interactPanelLabel.trim() || "Interact" }, ...(presentationInstances.length ? { presentationInstances } : {}), ...(presentationLayouts.length ? { presentationLayouts } : {}) });

  return <div className={`container workspace workspace--${workspace}`}>
    <header className="admin-shell__header"><div><a className="admin-shell__brand" href="/admin/productions" onClick={(event) => { event.preventDefault(); navigate({ workspace: "productions" }); }}>ShowGather</a><p>{workspace === "run" ? "Focused live operation" : workspace === "rehearse" ? "Safe rehearsal — no live presentation changes" : "Prepare saved productions and rundowns"}</p></div><div className="admin-shell__status"><p className={`connection connection--${apiConnection}`}>API {apiConnection}</p><p className={`connection connection--${streamConnection}`}>Stream {streamConnection}</p><button type="button" className="diagnostics-toggle" aria-expanded={diagnosticsOpen} onClick={() => setDiagnosticsOpen((open) => !open)}>{diagnosticsOpen ? "Hide diagnostics" : "Diagnostics"}</button></div></header>
    <nav className="admin-shell__nav" aria-label="Production workspace">
      <button className={route.workspace === "productions" ? "active" : ""} onClick={() => navigate({ workspace: "productions" })}>Productions</button>
      {(["prepare", "rehearse", "run"] as const).map((item) => <button key={item} disabled={!productionId} className={workspace === item ? "active" : ""} onClick={() => navigate({ workspace: item, productionId })}>{item}</button>)}
    </nav>

    {workspace === "prepare" && <nav className="prepare-tabs" aria-label="Prepare workspace sections">{(["overview", "rundown", "viewer", "configuration"] as PrepareTab[]).map((tab) => <button key={tab} className={(route.prepareTab ?? "overview") === tab ? "active" : ""} onClick={() => navigate({ workspace: "prepare", productionId, prepareTab: tab })}>{tab === "configuration" ? "Show configuration" : tab}</button>)}</nav>}
    {workspace === "rehearse" && <section className="rehearsal-banner" role="status"><strong>REHEARSAL OUTPUT ONLY</strong><span>Changes are visible only in opted-in rehearsal Players. Live presentation state will not change.</span></section>}

    <section className="section admin-context">
      <h2>{route.workspace === "productions" ? "Choose a production" : `${workspace} · ${selectedProduction?.title ?? "Loading production"}`}</h2>
      <div className="form">
        <label><span>Channel</span><select disabled={productionSwitchLocked} value={channelId} onChange={(event) => setChannelId(event.target.value)}>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</select></label>
        <label><span>Production</span><select disabled={productionSwitchLocked} value={productionId} onChange={(event) => { setProductionId(event.target.value); navigate({ workspace: route.workspace === "productions" ? "prepare" : workspace, productionId: event.target.value }); }}>{productions.map((production) => <option key={production.id} value={production.id}>{production.title}</option>)}</select></label>
        {route.workspace !== "productions" && <label><span>Rundown</span><select disabled={productionSwitchLocked} value={rundownId} onChange={(event) => setRundownId(event.target.value)}>{rundowns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      </div>
      {productionSwitchLocked && <p className="hint">Production context is locked for this active live session. Complete or abandon the session before switching.</p>}
      {selectionError && <p className="error-msg" role="alert">{selectionError}</p>}
    </section>

    {route.workspace === "productions" && <section className="section productions-home">
      <div className="workspace-heading"><div><h2>Productions</h2><p className="hint">Open a saved production to prepare, rehearse, or run it. Technical delivery details remain outside this starting view.</p></div><button onClick={() => createProduction(true)} disabled={!channelId}>New production</button></div>
      {productions.length === 0 ? <div className="productions-empty"><h3>You have not created a production yet.</h3><p>A production contains your programme details, viewer presentation, rundown, and live controls.</p><button onClick={() => createProduction(true)} disabled={!channelId}>Create your first production</button></div>
        : <div className="production-cards">{productions.map((production) => {
          const productionRundowns = production.id === productionId ? rundowns : [];
          return <article key={production.id} className="production-card"><div><span className={`production-card__status production-card__status--${production.status}`}>{production.status}</span><h3>{production.title}</h3><p>{channels.find((channel) => channel.id === production.channelId)?.name ?? "Selected channel"}{production.scheduledStart ? ` · ${new Date(production.scheduledStart).toLocaleString()}` : " · No schedule"}</p><p className="hint">{productionRundowns.length ? `${productionRundowns.length} rundown${productionRundowns.length === 1 ? "" : "s"}` : "No rundown created"} · {production.configuration ? "Show configuration selected" : "No show configuration"}</p></div><div className="production-card__actions"><button onClick={() => { setProductionId(production.id); navigate({ workspace: "prepare", productionId: production.id, prepareTab: "overview" }); }}>{productionRundowns.length ? "Open" : "Continue setup"}</button><button onClick={async () => { const result = await mutate(`/api/productions/${production.id}/duplicate`, "POST", {}, "Production duplicated"); if (result?.id) { setProductions(await (await fetch(`/api/channels/${channelId}/productions`)).json() as Production[]); } }}>Duplicate</button></div></article>;
        })}</div>}
    </section>}

    {workspace === "prepare" && <><section className={`section elements-panel${elementsOpen ? "" : " elements-panel--collapsed"}`} hidden={prepareTab !== "rundown"}>
      <div className="workspace-heading"><div><h2>Elements</h2><p className="hint">Choose a presentation source to target its stable instance, suggested command, and placement preset.</p></div><button type="button" className="elements-panel__toggle" aria-expanded={elementsOpen} onClick={() => setElementsOpen((open) => !open)}>{elementsOpen ? "Collapse" : "Open elements"}</button></div>
      {elementsOpen && <div className="element-library" role="list" aria-label="Presentation elements">
        {(["scorebug", "lower-third", "ticker", "alert", "sponsor-panel", "clock"] as const).map((kind) => <button key={kind} type="button" role="listitem" draggable className={selectedElement === kind ? "active" : ""} onDragStart={(event) => { event.dataTransfer.setData("application/x-showgather-element", kind); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => chooseElement(kind)}>{kind === "sponsor-panel" ? "Sponsor bug" : kind.replace("-", " ")}</button>)}
      </div>}
      {elementsOpen && <div className="placement-zones" aria-label="Video placement presets"><span>Drag an element onto a named placement preset</span><div>{(["top-left", "top-centre", "top-right", "centre-left", "centre", "centre-right", "bottom-left", "bottom-centre", "bottom-right"] as const).map((anchor) => <button key={anchor} type="button" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const kind = event.dataTransfer.getData("application/x-showgather-element"); if (["scorebug", "lower-third", "ticker", "alert", "sponsor-panel", "clock"].includes(kind)) dropElementOnPreset(kind as "scorebug" | "lower-third" | "ticker" | "alert" | "sponsor-panel" | "clock", anchor); }} onClick={() => dropElementOnPreset(selectedElement as "scorebug" | "lower-third" | "ticker" | "alert" | "sponsor-panel" | "clock", anchor)}>{anchor.replace("-", " ")}</button>)}</div></div>}
    </section><section className="section">
      <div hidden={prepareTab !== "overview"} className="prepare-overview">
      <div>
      <h2>Production editor</h2>
      <div className="form">
        <label><span>Title</span><input value={productionTitle} onChange={(event) => setProductionTitle(event.target.value)} /></label>
        <label><span>Description</span><input value={productionDescription} onChange={(event) => setProductionDescription(event.target.value)} /></label>
        <label><span>Status</span><select value={productionStatus} onChange={(event) => setProductionStatus(event.target.value)}><option value="draft">Draft</option><option value="rehearsal">Rehearsal</option><option value="live">Live</option><option value="complete">Complete</option><option value="archived">Archived</option></select></label>
        <button onClick={() => createProduction()}>Create production</button><button disabled={!productionId} onClick={() => mutate(`/api/productions/${productionId}`, "PUT", { title: productionTitle, description: productionDescription, status: productionStatus }, "Production saved", refreshShowContext)}>Save production</button><button disabled={!productionId} onClick={duplicateProduction}>Duplicate production</button>
      </div></div><aside className="readiness-panel" aria-label="Show readiness"><h2>Show readiness</h2><ul><li className={productionTitle.trim() ? "ready" : "attention"}>{productionTitle.trim() ? "Production details ready" : "Add production details"}</li><li className={selectedProduction?.configuration ? "ready" : "attention"}>{selectedProduction?.configuration ? "Show configuration selected" : "Select or create show configuration"}</li><li className={rundownId ? "ready" : "attention"}>{rundownId ? `Rundown created${rundownDefinition.length ? ` · ${rundownDefinition.length} cues` : " · add cues"}` : "Create a rundown"}</li><li className={disabledCueCount === 0 ? "ready" : "attention"}>{disabledCueCount === 0 ? "No disabled cues" : `${disabledCueCount} disabled cue${disabledCueCount === 1 ? "" : "s"}`}</li><li className="attention">No rehearsal completed yet</li></ul><button type="button" disabled={!productionId || !rundownId} onClick={() => navigate({ workspace: "rehearse", productionId })}>Open rehearsal</button></aside></div>
      <div hidden={prepareTab !== "configuration"}><h2>Show configuration</h2>
      <div className="form">
        <label><span>Package name</span><input value={configurationName} onChange={(event) => setConfigurationName(event.target.value)} /></label>
        <label><span>Home team</span><input maxLength={20} value={homeTeam} onChange={(event) => setHomeTeam(event.target.value)} /></label>
        <label><span>Away team</span><input maxLength={20} value={awayTeam} onChange={(event) => setAwayTeam(event.target.value)} /></label>
        <label><span>Ticker label</span><input maxLength={12} value={tickerLabel} onChange={(event) => setTickerLabel(event.target.value)} /></label>
        <label><span>Programme title</span><input maxLength={80} value={programmeTitle} onChange={(event) => setProgrammeTitle(event.target.value)} placeholder="Saturday Match" /></label>
        <label><span>Programme subtitle</span><input maxLength={80} value={programmeSubtitle} onChange={(event) => setProgrammeSubtitle(event.target.value)} placeholder="Live from the stadium" /></label>
        <label><span>Live label</span><input maxLength={80} value={liveLabel} onChange={(event) => setLiveLabel(event.target.value)} /></label>
        <label><span>Accent</span><input pattern="#[0-9a-fA-F]{6}" value={accent} onChange={(event) => setAccent(event.target.value)} /></label>
        <fieldset className="panel-options"><legend>Mobile companion panels</legend>{(["match", "info", "partners", "interact"] as const).map((panel) => <label key={panel}><input type="checkbox" checked={enabledPanels.includes(panel)} onChange={() => setEnabledPanels((current) => current.includes(panel) ? current.filter((item) => item !== panel) : [...current, panel])} /> {panel}</label>)}</fieldset>
        <fieldset className="panel-options"><legend>Companion tab labels</legend>
          <label><span>Match</span><input maxLength={30} value={matchPanelLabel} onChange={(event) => setMatchPanelLabel(event.target.value)} /></label>
          <label><span>Info</span><input maxLength={30} value={infoPanelLabel} onChange={(event) => setInfoPanelLabel(event.target.value)} /></label>
          <label><span>Partners</span><input maxLength={30} value={partnersPanelLabel} onChange={(event) => setPartnersPanelLabel(event.target.value)} /></label>
          <label><span>Interact</span><input maxLength={30} value={interactPanelLabel} onChange={(event) => setInteractPanelLabel(event.target.value)} /></label>
        </fieldset>
        <fieldset className="panel-options"><legend>Reusable presentation instances</legend>
          <p className="hint">Instances are named show building blocks. They can be placed differently per profile and targeted by typed cues without exposing transport data.</p>
          <label><span>Instance ID</span><input value={newInstanceId} onChange={(event) => setNewInstanceId(event.target.value)} placeholder="presenter-b" /></label>
          <label><span>Label</span><input value={newInstanceLabel} onChange={(event) => setNewInstanceLabel(event.target.value)} placeholder="Presenter B lower third" /></label>
          <label><span>Component</span><select value={newInstanceKind} onChange={(event) => setNewInstanceKind(event.target.value as PresentationInstanceDefinition["kind"])}>{(["lower-third", "scorebug", "ticker", "alert", "sponsor", "clock", "live-badge", "poll", "custom"] as const).map((kind) => <option key={kind}>{kind}</option>)}</select></label>
          <button type="button" onClick={addPresentationInstance}>Add instance</button>
          {presentationInstances.length > 0 && <ul className="placement-summary">{presentationInstances.map((instance) => <li key={instance.id}><span><b>{instance.label}</b> · {instance.kind} · {instance.enabled ? "Enabled" : "Disabled"}</span><button type="button" onClick={() => { setLayoutInstanceId(instance.id); setCommandInstanceId(instance.id); }}>Select</button><button type="button" onClick={() => setPresentationInstances((current) => current.map((item) => item.id === instance.id ? { ...item, enabled: !item.enabled } : item))}>{instance.enabled ? "Disable" : "Enable"}</button><button type="button" onClick={() => duplicatePresentationInstance(instance.id)}>Duplicate</button><button type="button" onClick={() => removePresentationInstance(instance.id)}>Delete</button></li>)}</ul>}
        </fieldset>
        <fieldset className="panel-options"><legend>Presentation placement presets</legend>
          <p className="hint">Choose an active presentation instance and a profile-specific destination. These settings are saved with the reusable show package.</p>
          <label><span>Instance</span><select value={layoutInstanceId} onChange={(event) => setLayoutInstanceId(event.target.value)}><option value="scorebug">Main scorebug</option><option value="lower-third">Lower third</option><option value="primary">Sponsor panel</option><option value="ticker">Ticker</option><option value="scorebug-main">Acceptance scene scorebug</option><option value="lower-third-presenter-a">Acceptance presenter A</option><option value="lower-third-presenter-b">Acceptance presenter B</option><option value="sponsor-top-right">Acceptance sponsor</option><option value="programme-clock">Programme clock</option>{presentationInstances.map((instance) => <option key={instance.id} value={instance.id}>{instance.label}{instance.enabled ? "" : " (disabled)"}</option>)}</select></label>
          <label><span>Profile</span><select value={layoutProfile} onChange={(event) => setLayoutProfile(event.target.value as LayoutProfile)}>{(["desktop", "tv", "mobile"] as const).map((profile) => <option key={profile}>{profile}</option>)}</select></label>
          <label><span>Surface</span><select value={layoutSurface} onChange={(event) => setLayoutSurface(event.target.value as LayoutSurface)}>{(["video", "surround", "companion"] as const).map((surface) => <option key={surface}>{surface}</option>)}</select></label>
          <label><span>Preset</span><select value={layoutAnchor} onChange={(event) => setLayoutAnchor(event.target.value as LayoutAnchor)}>{(["top-left", "top-centre", "top-right", "centre-left", "centre", "centre-right", "bottom-left", "bottom-centre", "bottom-right"] as const).map((anchor) => <option key={anchor}>{anchor}</option>)}</select></label>
          <label><span>Profile variant</span><select value={layoutVariant} onChange={(event) => setLayoutVariant(event.target.value)}><option value="standard">Standard</option><option value="wide">Wide</option><option value="broadcast">Broadcast</option><option value="compact">Compact</option><option value="headline">Headline</option></select></label>
          <label><span>Horizontal offset</span><input type="number" min={0} max={1} step={.01} value={layoutX} onChange={(event) => setLayoutX(Number(event.target.value))} /></label><label><span>Vertical offset</span><input type="number" min={0} max={1} step={.01} value={layoutY} onChange={(event) => setLayoutY(Number(event.target.value))} /></label><label><span>Width</span><input type="number" min={.08} max={1} step={.01} value={layoutWidth} onChange={(event) => setLayoutWidth(Number(event.target.value))} /></label><label><span>Height (optional)</span><input type="number" min={0} max={1} step={.01} value={layoutHeight} onChange={(event) => setLayoutHeight(event.target.value === "" ? "" : Number(event.target.value))} /></label>
          <label><span>Opacity</span><input type="number" min={0} max={1} step={.05} value={layoutOpacity} onChange={(event) => setLayoutOpacity(Number(event.target.value))} /></label><label><span>Rotation</span><input type="number" min={-180} max={180} step={1} value={layoutRotation} onChange={(event) => setLayoutRotation(Number(event.target.value))} /></label>
          <label><span>Crop top</span><input type="number" min={0} max={1} step={.01} value={layoutCropTop} onChange={(event) => setLayoutCropTop(Number(event.target.value))} /></label><label><span>Crop right</span><input type="number" min={0} max={1} step={.01} value={layoutCropRight} onChange={(event) => setLayoutCropRight(Number(event.target.value))} /></label><label><span>Crop bottom</span><input type="number" min={0} max={1} step={.01} value={layoutCropBottom} onChange={(event) => setLayoutCropBottom(Number(event.target.value))} /></label><label><span>Crop left</span><input type="number" min={0} max={1} step={.01} value={layoutCropLeft} onChange={(event) => setLayoutCropLeft(Number(event.target.value))} /></label>
          <label><span>Collision policy</span><select value={layoutPolicy} onChange={(event) => setLayoutPolicy(event.target.value as "single" | "row" | "column" | "overlay")}><option value="overlay">Overlay</option><option value="row">Stack in row</option><option value="column">Stack in column</option><option value="single">Single slot</option></select></label><label><span>Title/action safe area</span><input type="checkbox" checked={layoutSafeArea} onChange={(event) => setLayoutSafeArea(event.target.checked)} /></label>
          <label><span>Layer order</span><input type="number" min={0} max={999} step={1} value={layoutZIndex} onChange={(event) => setLayoutZIndex(Number(event.target.value))} /></label>
          <label><span>Transition</span><select value={transitionKind} onChange={(event) => setTransitionKind(event.target.value as "cut" | "fade" | "slide" | "scale")}><option value="cut">Cut</option><option value="fade">Fade</option><option value="slide">Slide</option><option value="scale">Scale</option></select></label>
          <label><span>Transition duration (ms)</span><input type="number" min={0} max={5000} step={10} value={transitionDuration} onChange={(event) => setTransitionDuration(Number(event.target.value))} /></label>
          <button type="button" onClick={saveLayoutPreset}>Apply preset</button>
          {presentationLayouts.length > 0 && <ul className="placement-summary">{presentationLayouts.map((definition) => <li key={definition.instanceId}><span><b>{definition.instanceId}</b> · {Object.entries(definition.placementByProfile).map(([profile, placement]) => `${profile}: ${placement?.surface} ${placement?.anchor}`).join(" · ")}</span><button type="button" onClick={() => { setLayoutInstanceId(definition.instanceId); setStatus(`${definition.instanceId} selected for placement editing.`); }}>Edit</button><button type="button" onClick={() => duplicateLayoutDefinition(definition.instanceId)}>Duplicate</button><button type="button" onClick={() => removeLayoutDefinition(definition.instanceId)}>Remove</button></li>)}</ul>}
        </fieldset>
        <button disabled={!productionId} onClick={() => mutate(`/api/productions/${productionId}`, "PUT", { configuration: currentShowConfiguration() }, "Production presentation saved", reloadProduction)}>Save into this production</button>
        <button onClick={() => mutate(`/api/channels/${channelId}/show-configurations`, "POST", { name: configurationName, configuration: currentShowConfiguration() }, "Show configuration saved", reloadConfigurations)}>Save reusable configuration</button>
        <label><span>Copy into production</span><select onChange={(event) => { if (event.target.value) mutate(`/api/productions/${productionId}/copy-configuration`, "POST", { configurationId: event.target.value }, "Configuration copied into production", reloadProduction); }} defaultValue=""><option value="">Choose a saved package</option>{configurations.map((configuration) => <option key={configuration.id} value={configuration.id}>{configuration.name}</option>)}</select></label>
      </div>
      <p className="hint">Packages are copied into a production deliberately. Changing a package never rewrites an existing production.</p></div>
    </section>

    <section className="section rehearsal-preview" hidden={prepareTab !== "viewer"}>
      <div className="workspace-heading"><div><h2>Placement preview</h2><p className="hint">The real Player renders the shared multi-instance scene using this production's saved layout configuration. This preview never changes live presentation state.</p></div><div className="profile-picker" role="group" aria-label="Placement preview profile">{(["desktop", "mobile", "tv"] as const).map((profile) => <button key={profile} className={previewProfile === profile ? "active" : ""} onClick={() => setPreviewProfile(profile)}>{profile}</button>)}</div></div>
      {layoutPreviewUrl ? <iframe title={`Placement Player ${previewProfile} preview`} src={layoutPreviewUrl} className={`player-preview player-preview--${previewProfile}`} /> : <p className="empty">Choose a channel to load the preview.</p>}
    </section>

    <section className="section" hidden={prepareTab !== "rundown"}>
      <h2>Rundown editor</h2>
      <div className="form"><label><span>Rundown name</span><input value={rundownName} onChange={(event) => setRundownName(event.target.value)} /></label><button disabled={!productionId} onClick={async () => { const result = await mutate(`/api/productions/${productionId}/rundowns`, "POST", { name: rundownName || "New rundown" }, "Rundown created"); if (result?.id) { setRundowns(await (await fetch(`/api/productions/${productionId}/rundowns`)).json() as Rundown[]); setRundownId(result.id); } }}>Create rundown</button><button disabled={!rundownId} onClick={() => mutate(`/api/rundowns/${rundownId}`, "PUT", { name: rundownName }, "Rundown saved", reloadRundownDefinition)}>Save rundown</button><button disabled={!rundownId} onClick={async () => { const result = await mutate(`/api/rundowns/${rundownId}/duplicate`, "POST", {}, "Rundown duplicated"); if (result?.id) { setRundowns(await (await fetch(`/api/productions/${productionId}/rundowns`)).json() as Rundown[]); setRundownId(result.id); } }}>Duplicate rundown</button></div>
      {rundownDefinition.map((cue, index) => <div className="cue-grid" key={cue.id}><strong>{cue.position}. {cue.label}</strong><span className="hint">{String(cue.commandPayload.k)} {cue.enabled ? "enabled" : "disabled"}</span><button onClick={() => editCue(cue, { enabled: !cue.enabled })}>{cue.enabled ? "Disable" : "Enable"}</button><button disabled={index === 0} onClick={() => moveCue(index, -1)}>Move up</button><button disabled={index === rundownDefinition.length - 1} onClick={() => moveCue(index, 1)}>Move down</button></div>)}
      <p className="hint">The typed command form below can send immediately or save a new cue into this rundown. Execution sessions use a frozen copy of this definition.</p>
    </section></>}

    {workspace === "rehearse" && <section className="section rehearsal-preview">
      <div className="workspace-heading"><div><h2>Rehearsal preview</h2><p className="hint">This embeds the real Player in rehearsal mode. It never sends rehearsal cues to the live stream.</p></div><div className="profile-picker" role="group" aria-label="Preview profile">{(["desktop", "mobile", "tv"] as const).map((profile) => <button key={profile} className={previewProfile === profile ? "active" : ""} onClick={() => setPreviewProfile(profile)}>{profile}</button>)}</div></div>
      {playerPreviewUrl ? <iframe title={`Rehearsal Player ${previewProfile} preview`} src={playerPreviewUrl} className={`player-preview player-preview--${previewProfile}`} /> : <p className="empty">Choose a channel to load the preview.</p>}
    </section>}

    {workspace === "run" && !runReady && <section className="section run-entry" aria-labelledby="run-entry-title">
      <h2 id="run-entry-title">Confirm live operation</h2>
      <p className="hint">Entering this workspace does not put the programme live. Review the current operational state, then explicitly start or resume the live session.</p>
      <dl className="run-entry__summary"><div><dt>Production</dt><dd>{selectedProduction?.title ?? "Not selected"}</dd></div><div><dt>Rundown</dt><dd>{rundowns.find((item) => item.id === rundownId)?.name ?? "Not selected"}</dd></div><div><dt>Cues</dt><dd>{rundown.length} total · {disabledCueCount} disabled</dd></div><div><dt>Connection</dt><dd>API {apiConnection} · Stream {streamConnection}</dd></div><div><dt>Live session</dt><dd>{sessionId ? "Existing session can be resumed" : "No active session"}</dd></div><div><dt>Dispatch issues</dt><dd>{unresolvedOutbox.length ? `${unresolvedOutbox.length} pending or failed` : "None"}</dd></div></dl>
      {unresolvedOutbox.length > 0 && <p className="error-msg" role="alert">Resolve or acknowledge the listed dispatch issues before operating live. Retry and Cancel remain available below.</p>}
      <button className="run-entry__go" disabled={!rundownId || apiConnection !== "connected" || streamConnection !== "connected"} onClick={enterRun}>{sessionId ? "Resume live session" : "Start live session"}</button>
    </section>}

    {workspace === "run" && runReady && <section className="section run-preview"><h2>Programme preview</h2>{programmePreviewUrl && <iframe title="Programme Player preview" src={programmePreviewUrl} className="player-preview" />}</section>}

    {workspace === "rehearse" && <section className="section quick-cues">
      <h2>On-air cues</h2>
      <div className="cue-grid">
        <button onClick={() => send({ cue: "goal-home", durationMs: 15_000 }, "Home Goal sent")}>⚽ Home Goal</button>
        <button onClick={() => send({ cue: "speaker-intro", durationMs: 8_000 }, "Speaker intro sent")}>🎙 Speaker Intro</button>
        <button onClick={() => send({ cue: "alert-test", durationMs: 8_000 }, "Alert sent")}>⚠ Alert</button>
        <button className="safe-clear" onClick={() => send({ action: "safe-clear" }, "Safe Clear sent")}>✕ Safe Clear</button>
      </div>
      <p className="hint">Safe Clear removes presentation only. The programme video continues uninterrupted.</p>
    </section>}

    {workspace === "run" && runReady && <section className="section run-console" aria-label="Live cue control">
      {unresolvedOutbox.length > 0 && <section className="run-console__failure" role="alert"><strong>COMMAND DELIVERY BLOCKED</strong><span>{unresolvedOutbox.length} pending or failed durable command{unresolvedOutbox.length === 1 ? "" : "s"} must be resolved before later live cues can be sent.</span><button onClick={() => setDiagnosticsOpen(true)}>Open diagnostics and recovery</button></section>}
      <div className="run-console__cue"><span className="run-console__eyebrow">Current cue</span><h2>{runCue?.label ?? "No enabled cue remaining"}</h2><p>{runCue ? `${runCue.order}. ${runCue.status}` : "The rundown is complete or has no enabled cues."}</p></div>
      <div className="run-console__next"><span>Next</span><strong>{nextRunCue?.label ?? "—"}</strong></div>
      <div className="run-console__actions"><button disabled={runCueIndex === 0} onClick={() => setRunCueIndex((index) => Math.max(0, index - 1))}>Previous</button><button className="run-console__go" disabled={unresolvedOutbox.length > 0 || !runCue || !runCue.enabled || runCue.status === "active" || runCue.status === "cancelled"} onClick={() => { if (runCue) goCue(runCue); }}>{unresolvedOutbox.length > 0 ? "Resolve delivery issue" : runCue?.status === "failed" ? "Retry cue" : "GO"}</button><button className="safe-clear" onClick={() => setConfirmation("safe-clear")}>Safe Clear</button></div>
      <div className="run-console__list" aria-label="Rundown cue navigation">{rundown.map((cue, index) => <button key={cue.id} className={index === runCueIndex ? "active" : ""} disabled={!cue.enabled} onClick={() => setRunCueIndex(index)}>{cue.order}. {cue.label}<span>{cue.status}</span></button>)}</div>
      <div className="run-console__session-actions"><button onClick={() => setConfirmation("complete")}>Complete show</button><button onClick={() => setConfirmation("abandon")}>Abandon session</button><button onClick={() => setConfirmation("reset")}>Reset live session</button></div>
    </section>}

    {confirmation && <div className="confirmation-backdrop" role="presentation"><section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-description"><h2 id="confirmation-title">{confirmation === "complete" ? "Complete this live show?" : confirmation === "abandon" ? "Abandon this live session?" : confirmation === "safe-clear" ? "Confirm Safe Clear?" : "Start a new live session?"}</h2><p id="confirmation-description">{confirmation === "complete" ? "The current session will be marked complete. Programme presentation is not cleared automatically." : confirmation === "abandon" ? "The current session will be recorded as abandoned. Programme presentation is not cleared automatically." : confirmation === "safe-clear" ? "Safe Clear removes active presentation graphics. Programme video will continue uninterrupted." : "The current live session will be completed and a fresh immutable rundown session will begin."}</p><div><button onClick={() => setConfirmation(null)}>Cancel</button><button ref={confirmationButton} className="danger" onClick={confirmSessionAction}>{confirmation === "safe-clear" ? "Confirm Safe Clear" : "Confirm"}</button></div></section></div>}

    {workspace === "rehearse" && <section className="section rehearsal-console">
      <h2>Rehearsal rundown</h2>
      <p className="hint">GO uses an idempotent execution ID. Completed cues require explicit re-run; rehearsal state is separate from live.</p>
      <button disabled={!rundownId} onClick={() => mutate(`/api/rundown/${rehearsal ? "rehearsal" : "live"}/sessions?rundownId=${encodeURIComponent(rundownId)}`, "POST", {}, `${rehearsal ? "Rehearsal" : "Live"} session started`, fetchRundown)}>{rehearsal ? "Reset rehearsal session" : "Start new live session"}</button>
      <div className="cue-grid">
        {rundown.map((cue) => <div key={cue.id}><strong>{cue.order}. {cue.label}</strong><span className="hint"> {cue.status}</span><button disabled={cue.status === "active" || cue.status === "cancelled"} onClick={() => goCue(cue)}>{cue.status === "failed" ? "Retry rehearsal cue" : "GO IN REHEARSAL"}</button>{cue.status === "complete" && <button onClick={() => goCue(cue, true)}>Re-run in rehearsal</button>}</div>)}
      </div>
    </section>}

    {workspace !== "run" && <section className="section control-surface" hidden={workspace === "prepare" && prepareTab !== "rundown"}>
      <div className="workspace-heading"><div><h2>Control Surface</h2><p className="hint">Typed controls follow the selected presentation element, or can remain pinned while you work elsewhere.</p></div><div className="control-surface__mode" role="group" aria-label="Control Surface mode"><button type="button" className={!deckPinned ? "active" : ""} onClick={() => setDeckPinned(false)}>Follow selected cue</button><button type="button" className={deckPinned ? "active" : ""} onClick={() => setDeckPinned(true)}>Pinned controls</button></div></div>
      <div className="form">
        <label><span>Action</span><select value={commandKind} onChange={(event) => { setCommandKind(event.target.value); setPrimary(""); setSecondary(""); setLabel(""); }}>
          <option value="score">Score update</option><option value="lower">Lower third</option><option value="alert">Alert</option><option value="sponsor">Sponsor takeover</option><option value="ticker">Ticker update</option><option value="clock">Programme clock</option><option value="clear">Regional clear</option>
        </select></label>
        {commandKind !== "clear" && <label><span>Presentation instance (optional)</span><input value={commandInstanceId} maxLength={24} pattern="[A-Za-z0-9][A-Za-z0-9-]*" onChange={(event) => setCommandInstanceId(event.target.value)} placeholder="scorebug-main" /></label>}
        {commandKind === "score" ? <><label><span>Home score</span><input type="number" min={0} max={999} value={primary} onChange={(event) => setPrimary(event.target.value)} /></label><label><span>Away score</span><input type="number" min={0} max={999} value={secondary} onChange={(event) => setSecondary(event.target.value)} /></label><label><span>Label</span><input value={label} maxLength={12} onChange={(event) => setLabel(event.target.value)} placeholder="GOAL" /></label></>
          : commandKind === "clear" ? <><label><span>Region</span><select value={primary} onChange={(event) => setPrimary(event.target.value)}><option value="">All regions</option><option value="v">Video overlay</option><option value="h">Header</option><option value="l">Left rail</option><option value="r">Right rail</option><option value="f">Footer</option></select></label><label><span>Layer (optional)</span><input value={secondary} maxLength={16} onChange={(event) => setSecondary(event.target.value)} placeholder="primary" /></label></>
          : commandKind === "clock" ? <><label><span>Clock time</span><input value={primary} maxLength={12} onChange={(event) => setPrimary(event.target.value)} placeholder="78:42" /></label><label><span>Clock label</span><input value={label} maxLength={12} onChange={(event) => setLabel(event.target.value)} placeholder="LIVE" /></label></>
          : <><label><span>{commandKind === "sponsor" ? "Brand" : commandKind === "ticker" ? "Ticker text" : "Title"}</span><input value={primary} maxLength={20} onChange={(event) => setPrimary(event.target.value)} /></label>{commandKind !== "ticker" && <label><span>{commandKind === "alert" ? "Message" : "Subtitle / tagline"}</span><input value={secondary} maxLength={20} onChange={(event) => setSecondary(event.target.value)} /></label>}{commandKind === "ticker" && <label><span>Label</span><input value={label} maxLength={12} onChange={(event) => setLabel(event.target.value)} /></label>}{commandKind !== "ticker" && <label><span>Duration (ms)</span><input type="number" min={1000} step={1000} value={commandDuration} onChange={(event) => setCommandDuration(Number(event.target.value))} /></label>}</>}
        <button onClick={sendCommand}>{rehearsal ? "Trigger rehearsal command" : "Send configurable command"}</button>{workspace === "prepare" && <button disabled={!rundownId} onClick={addCue}>Save as rundown cue</button>}
      </div>
      {rehearsal && <div className="control-surface__macros" aria-label="Rehearsal macro bank"><span>Macro bank</span><button onClick={() => send({ cue: "goal-home", durationMs: 15_000 }, "Home Goal macro sent")}>Home Goal</button><button onClick={() => send({ cue: "speaker-intro", durationMs: 8_000 }, "Lower Third macro sent")}>Lower Third</button><button onClick={() => send({ cue: "alert-test", durationMs: 8_000 }, "Alert macro sent")}>Alert</button><button className="safe-clear" onClick={() => send({ action: "safe-clear" }, "Safe Clear macro sent")}>Safe Clear</button></div>}
      <p className="hint">Text is byte-bounded for the compact timed-ID3 envelope. Score, ticker, persistent sponsor, and clear update the late-join snapshot.</p>
    </section>}

    {workspace === "prepare" && <section className="section" hidden={prepareTab !== "rundown"}>
      <h2>Custom legacy overlay</h2>
      <div className="form">
        <label><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Goal!" /></label>
        <label><span>Message</span><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="e.g. 1–0" /></label>
        <label><span>Duration (ms)</span><input type="number" min={1000} step={1000} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
        <button onClick={() => send({ title: title.trim(), message: message.trim() || undefined, durationMs: duration }, "Overlay sent")}>Send Overlay</button>
      </div>
    </section>}

    {status && <p className="status-msg">{status}</p>}
    {error && <p className="error-msg">{error}</p>}
    {diagnosticsOpen && <aside className="diagnostics-panel" aria-label="Technical diagnostics"><p>Technical diagnostics are secondary. They expose delivery history and recovery detail without changing presentation state.</p>
    {workspace !== "run" && <section className="section"><h2>Recent on-air events</h2>
      {events.length === 0 ? <p className="empty">No events yet.</p> : <table className="events-table"><thead><tr><th>Event</th><th>Type</th><th>Time</th></tr></thead><tbody>
        {events.map((stored) => <tr key={stored.event.id}><td>{eventLabel(stored.event)}</td><td className="mono">{stored.event.t}</td><td className="mono">{new Date(stored.injectedAt).toLocaleTimeString()}</td></tr>)}
      </tbody></table>}
    </section>}
    <section className="section"><h2>Live dispatch status</h2>
      {outbox.length === 0 ? <p className="empty">No durable commands have been submitted.</p> : <table className="events-table"><thead><tr><th>Command</th><th>Revision</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {outbox.map((item) => <tr key={item.id}><td>{item.label}{workspace !== "run" && <><br /><span className="hint mono">{item.eventId}</span></>}{item.error && <p className="error-msg">{item.error}</p>}</td><td>{item.revision}</td><td>{item.status}</td><td>{item.retryable && <button onClick={() => resolveOutbox(item, "retry")}>Retry</button>}{item.cancellable && <button className="safe-clear" onClick={() => resolveOutbox(item, "cancel")}>Cancel</button>}</td></tr>)}
      </tbody></table>}
    </section></aside>}
  </div>;
}
