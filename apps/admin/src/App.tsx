import { useCallback, useEffect, useMemo, useState } from "react";
import { adminPath, parseAdminRoute, type AdminRoute } from "./routing.js";
import { AdminHeader } from "./components/AdminHeader.js";
import { WorkspaceNavigation } from "./components/WorkspaceNavigation.js";
import { AdminContext } from "./components/AdminContext.js";
import { AdminStateContext, type AdminStateValue } from "./components/AdminStateContext.js";
import { ProductionsHome } from "./components/ProductionsHome.js";
import { PrepareWorkspace } from "./components/PrepareWorkspace.js";
import { RehearseWorkspace } from "./components/RehearseWorkspace.js";
import { RunWorkspaceSection, ConfirmationDialog } from "./components/RunWorkspaceSection.js";
import { ControlSurface } from "./components/ControlSurface.js";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel.js";
import { LegacyOverlay } from "./components/LegacyOverlay.js";
import type { OutboxItem, RundownCue } from "./types.js";
import { useSystemHealth } from "./hooks/useSystemHealth.js";
import { useAdminSelectors } from "./hooks/useAdminSelectors.js";
import { useEventDispatch } from "./hooks/useEventDispatch.js";
import { useCommandBuilder } from "./hooks/useCommandBuilder.js";
import { useRundownEditor } from "./hooks/useRundownEditor.js";
import { useShowConfiguration } from "./hooks/useShowConfiguration.js";
import { useRunWorkspace } from "./hooks/useRunWorkspace.js";

export default function App() {
  const [route, setRoute] = useState<AdminRoute>(() => parseAdminRoute(window.location.pathname, window.location.search));
  const [previewProfile, setPreviewProfile] = useState<"desktop" | "mobile" | "tv">("desktop");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState(5000);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const isProductionsHome = route.workspace === "productions";
  const workspace = isProductionsHome ? "prepare" : route.workspace;
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

  /* ── Hook instances ────────────────────────────────────────────────────── */
  const { apiConnection, streamConnection } = useSystemHealth();
  const { channels, productions, rundowns, channelId, setChannelId, productionId, setProductionId, rundownId, setRundownId, selectionError, selectedProduction, refreshProductions, refreshRundowns } = useAdminSelectors({ route, navigate });
  const { status, setStatus, error, setError, events, outbox, unresolvedOutbox, fetchEvents, fetchOutbox, send, mutate } = useEventDispatch({ rehearsal, channelId });
  const commandBuilder = useCommandBuilder();

  const [rundown, setRundown] = useState<RundownCue[]>([]);
  const [sessionId, setSessionId] = useState("");

  const fetchRundown = useCallback(async () => {
    if (!rundownId) return;
    const response = await fetch(`/api/rundown/${rehearsal ? "rehearsal" : "live"}?rundownId=${encodeURIComponent(rundownId)}`);
    if (response.ok) {
      const result = await response.json() as { cues: RundownCue[]; sessionId?: string };
      setRundown(result.cues); setSessionId(result.sessionId ?? "");
    }
  }, [rehearsal, rundownId]);

  useEffect(() => { fetchRundown().catch(() => {}); }, [fetchRundown]);

  const rundownEditor = useRundownEditor({ rundownId, mutate, fetchRundown, currentCommand: commandBuilder.currentCommand });

  const showConfig = useShowConfiguration({
    productionId, channelId, mutate,
    syncCommandFields: (kind, instanceId) => { commandBuilder.setCommandKind(kind); commandBuilder.setCommandInstanceId(instanceId); },
  });

  const runWorkspace = useRunWorkspace({ rundownId, rundown, sessionId, rehearsal, send, mutate, fetchRundown, fetchEvents, fetchOutbox, workspace });

  /* ── Cross-cutting functions ───────────────────────────────────────────── */
  const sendCommand = () => send({ command: commandBuilder.currentCommand() }, `${commandBuilder.commandKind} command sent`);

  const createProduction = async (fresh = false) => {
    const result = await mutate(`/api/channels/${channelId}/productions`, "POST", { title: fresh ? "New production" : showConfig.productionTitle || "New production", description: fresh ? "" : showConfig.productionDescription, status: fresh ? "draft" : showConfig.productionStatus }, "Production created");
    if (result?.id) { await refreshProductions(); setProductionId(result.id); navigate({ workspace: "prepare", productionId: result.id }); }
  };

  const duplicateProduction = async () => {
    const result = await mutate(`/api/productions/${productionId}/duplicate`, "POST", {}, "Production duplicated");
    if (result?.id) { await refreshProductions(); setProductionId(result.id); navigate({ workspace: "prepare", productionId: result.id }); }
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

  /* ── Derived values ────────────────────────────────────────────────────── */
  const disabledCueCount = rundown.filter((cue) => !cue.enabled).length;
  const productionSwitchLocked = workspace === "run" && runWorkspace.runReady;
  const playerPreviewUrl = channelId ? `${window.location.protocol}//${window.location.hostname}:3003/player/${encodeURIComponent(channelId)}?profile=${previewProfile}&rehearsal=1&embedded=1&productionId=${encodeURIComponent(productionId)}` : "";
  const layoutPreviewUrl = channelId ? `${window.location.protocol}//${window.location.hostname}:3003/player/${encodeURIComponent(channelId)}?scene=acceptance&profile=${previewProfile}&embedded=1&productionId=${encodeURIComponent(productionId)}` : "";
  const programmePreviewUrl = channelId ? `${window.location.protocol}//${window.location.hostname}:3003/player/${encodeURIComponent(channelId)}?profile=desktop&embedded=1&productionId=${encodeURIComponent(productionId)}` : "";
  const studioRundown = workspace === "prepare" && prepareTab === "rundown";
  const studioConfig = workspace === "prepare" && prepareTab === "configuration";

  /* ── Shared state context ─────────────────────────────────────────────── */
  const adminState = useMemo<AdminStateValue>(() => ({
    channelId, productionId, rundownId, workspace,
    navigate, mutate, send, status, setStatus, error, setError,
  }), [channelId, productionId, rundownId, workspace, navigate, mutate, send, status, setStatus, error, setError]);

  /* ── Render ────────────────────────────────────────────────────────────── */
  return <AdminStateContext.Provider value={adminState}>
  <div className={`container workspace workspace--${workspace}${studioRundown ? " workspace--prepare-rundown" : ""}${studioConfig ? " workspace--prepare-config" : ""}`}>
    <AdminHeader route={route} workspace={workspace} apiConnection={apiConnection} streamConnection={streamConnection} diagnosticsOpen={diagnosticsOpen} onToggleDiagnostics={() => setDiagnosticsOpen((open) => !open)} onNavigateHome={() => navigate({ workspace: "productions" })} />
    <WorkspaceNavigation route={route} productionId={productionId} productionSwitchLocked={productionSwitchLocked} onNavigate={navigate} />
    <AdminContext route={route} channels={channels} productions={productions} rundowns={rundowns} channelId={channelId} productionId={productionId} rundownId={rundownId} productionSwitchLocked={productionSwitchLocked} selectionError={selectionError} onChannelChange={setChannelId} onProductionChange={(value) => { setProductionId(value); navigate({ workspace: route.workspace === "productions" ? "prepare" : workspace, productionId: value }); }} onRundownChange={setRundownId} />

    {route.workspace === "productions" && <ProductionsHome channels={channels} productions={productions} rundowns={rundowns} setProductionId={setProductionId} createProduction={createProduction} refreshProductions={refreshProductions} />}

    {!isProductionsHome && workspace === "prepare" && <PrepareWorkspace prepareTab={prepareTab} showConfig={showConfig} rundownEditor={rundownEditor} commandBuilder={commandBuilder} setRundownId={setRundownId} selectedProduction={selectedProduction} disabledCueCount={disabledCueCount} createProduction={() => createProduction()} duplicateProduction={duplicateProduction} refreshRundowns={refreshRundowns} previewProfile={previewProfile} setPreviewProfile={setPreviewProfile} layoutPreviewUrl={layoutPreviewUrl} />}

    {workspace === "rehearse" && <RehearseWorkspace playerPreviewUrl={playerPreviewUrl} previewProfile={previewProfile} setPreviewProfile={setPreviewProfile} rundowns={rundowns} rundown={rundown} rehearsal={rehearsal} runWorkspace={runWorkspace} fetchRundown={fetchRundown} />}

    {workspace === "run" && <RunWorkspaceSection rundowns={rundowns} rundown={rundown} selectedProduction={selectedProduction} disabledCueCount={disabledCueCount} apiConnection={apiConnection} streamConnection={streamConnection} sessionId={sessionId} unresolvedOutbox={unresolvedOutbox} programmePreviewUrl={programmePreviewUrl} runWorkspace={runWorkspace} setDiagnosticsOpen={setDiagnosticsOpen} />}

    <ConfirmationDialog runWorkspace={runWorkspace} />

    {workspace !== "run" && <ControlSurface commandBuilder={commandBuilder} showConfig={showConfig} rehearsal={rehearsal} workspace={workspace} prepareTab={prepareTab} sendCommand={sendCommand} addCue={rundownEditor.addCue} />}

    {workspace === "prepare" && <LegacyOverlay title={title} setTitle={setTitle} message={message} setMessage={setMessage} duration={duration} setDuration={setDuration} />}

    {status && <p className="status-msg">{status}</p>}
    {error && <p className="error-msg">{error}</p>}
    {diagnosticsOpen && <DiagnosticsPanel workspace={workspace} events={events} outbox={outbox} resolveOutbox={resolveOutbox} />}
  </div>
  </AdminStateContext.Provider>;
}
