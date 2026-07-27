import { useCallback, useEffect, useMemo, useState } from "react";
import { adminPath, parseAdminRoute, type AdminRoute } from "./routing.js";

import { AdminContext } from "./components/AdminContext.js";
import { AdminStateContext, type AdminStateValue } from "./components/AdminStateContext.js";
import { ProductionsHome } from "./components/ProductionsHome.js";
import { PrepareOverview } from "./components/PrepareOverview.js";
import { RundownCueEditor, RundownCueStackPanel, RundownElementsPanel, RundownProgrammeStage } from "./components/RundownWorkspace.js";
import { ViewerPlacementEditor, ViewerProgrammeStage, ViewerSelectionPanel, ViewerStatusPanel } from "./components/ViewerWorkspace.js";
import { ShowConfigurationWorkspace } from "./components/ShowConfigurationWorkspace.js";
import { RehearsalContextPanel, RehearsalCueStackPanel, RehearsalProgrammeStage, RehearsalResultPanel, useRehearsalWorkspace } from "./components/RehearseWorkspace.js";
import { ConfirmationDialog, RunContextPanel, RunDispatchPanel, RunOperationsPanel, RunProgrammeStage } from "./components/RunWorkspaceSection.js";
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
import { AdminShell } from "./components/layout/AdminShell.js";
import { TopBar } from "./components/layout/TopBar.js";

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
  const isRundownWorkspace = !isProductionsHome && workspace === "prepare" && prepareTab === "rundown";
  const isViewerWorkspace = !isProductionsHome && workspace === "prepare" && prepareTab === "viewer";
  const isRehearseWorkspace = workspace === "rehearse";

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

  const saveViewerProduction = useCallback(async () => {
    await mutate(
      `/api/productions/${productionId}`,
      "PUT",
      { configuration: showConfig.currentShowConfiguration() },
      "Production presentation saved",
      showConfig.reloadProduction
    );
  }, [mutate, productionId, showConfig]);

  const runWorkspace = useRunWorkspace({ rundownId, rundown, sessionId, rehearsal, send, mutate, fetchRundown, fetchEvents, fetchOutbox, workspace });
  const rehearsalWorkspace = useRehearsalWorkspace({ rundownId, rundown, sessionId, runWorkspace, mutate, fetchRundown });
  const returnToPrepare = useCallback(() => navigate({ workspace: "prepare", productionId }), [navigate, productionId]);

  const previewRundownCue = useCallback(async (cue: RundownCue) => {
    setError(""); setStatus("");
    try {
      const response = await fetch(`/api/rundown/rehearsal/go?rundownId=${encodeURIComponent(rundownId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cueId: cue.id }),
      });
      if (!response.ok) throw new Error(await response.text());
      setStatus(`Rehearsal preview: ${cue.label}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to preview cue in rehearsal");
    }
  }, [rundownId, setError, setStatus]);

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

  const disabledCueCount = rundown.filter((cue) => !cue.enabled).length;
  const productionSwitchLocked = workspace === "run" && runWorkspace.runReady;
  const playerPreviewUrl = channelId ? `${window.location.protocol}//${window.location.hostname}:3003/player/${encodeURIComponent(channelId)}?profile=${previewProfile}&rehearsal=1&embedded=1&productionId=${encodeURIComponent(productionId)}` : "";
  const layoutPreviewUrl = channelId ? `${window.location.protocol}//${window.location.hostname}:3003/player/${encodeURIComponent(channelId)}?scene=acceptance&profile=${previewProfile}&embedded=1&productionId=${encodeURIComponent(productionId)}` : "";
  const programmePreviewUrl = channelId ? `${window.location.protocol}//${window.location.hostname}:3003/player/${encodeURIComponent(channelId)}?profile=desktop&productionId=${encodeURIComponent(productionId)}` : "";

  const adminState = useMemo<AdminStateValue>(() => ({
    channelId, productionId, rundownId, workspace,
    navigate, mutate, send, status, setStatus, error, setError,
  }), [channelId, productionId, rundownId, workspace, navigate, mutate, send, status, setStatus, error, setError]);

  const navigatePrepareTab = useCallback((tab: string) => {
    navigate({ workspace: "prepare", productionId, prepareTab: tab as AdminRoute["prepareTab"] });
  }, [navigate, productionId]);

  const primaryWorkspace = <>
      {route.workspace === "productions" && <ProductionsHome channels={channels} productions={productions} rundowns={rundowns} setChannelId={setChannelId} setProductionId={setProductionId} createProduction={createProduction} refreshProductions={refreshProductions} />}

      {!isProductionsHome && workspace === "prepare" && prepareTab === "overview" && (
        <PrepareOverview showConfig={showConfig} rundownEditor={rundownEditor} selectedProduction={selectedProduction} disabledCueCount={disabledCueCount} createProduction={() => createProduction()} duplicateProduction={duplicateProduction} onNavigate={navigatePrepareTab} />
      )}

      {isRundownWorkspace && <RundownProgrammeStage rundownEditor={rundownEditor} previewProfile={previewProfile} setPreviewProfile={setPreviewProfile} realOutputUrl={layoutPreviewUrl} />}

      {isViewerWorkspace && <ViewerProgrammeStage showConfig={showConfig} previewProfile={previewProfile} setPreviewProfile={setPreviewProfile} realOutputUrl={layoutPreviewUrl} saveProduction={saveViewerProduction} />}

      {!isProductionsHome && workspace === "prepare" && prepareTab === "configuration" && (
        <ShowConfigurationWorkspace showConfig={showConfig} />
      )}

      {isRehearseWorkspace && <RehearsalProgrammeStage ui={rehearsalWorkspace} previewProfile={previewProfile} playerPreviewUrl={playerPreviewUrl} />}

      {workspace === "run" && <RunProgrammeStage sessionId={sessionId} rundown={rundown} events={events} outbox={outbox} programmePreviewUrl={programmePreviewUrl} runWorkspace={runWorkspace} />}

      {workspace === "prepare" && !isRundownWorkspace && !isViewerWorkspace && <LegacyOverlay title={title} setTitle={setTitle} message={message} setMessage={setMessage} duration={duration} setDuration={setDuration} />}
    </>;

  const rundownShellProps = { productionId, rundownId, rundowns, rundown, rundownEditor, commandBuilder, setRundownId, refreshRundowns, mutate, previewProfile, setPreviewProfile, realOutputUrl: layoutPreviewUrl, previewCue: previewRundownCue };
  const viewerShellProps = { showConfig, previewProfile, setPreviewProfile, realOutputUrl: layoutPreviewUrl, saveProduction: saveViewerProduction };
  const runShellProps = { rundowns, rundownId, rundown, selectedProduction, disabledCueCount, apiConnection, streamConnection, sessionId, unresolvedOutbox, outbox, events, status, error, programmePreviewUrl, runWorkspace, resolveOutbox };
  const farLeft = isRundownWorkspace
    ? <RundownElementsPanel {...rundownShellProps} />
    : isViewerWorkspace
      ? <ViewerSelectionPanel {...viewerShellProps} />
    : isRehearseWorkspace
      ? <><AdminContext route={route} channels={channels} productions={productions} rundowns={rundowns} channelId={channelId} productionId={productionId} rundownId={rundownId} productionSwitchLocked={productionSwitchLocked} selectionError={selectionError} onChannelChange={setChannelId} onProductionChange={setProductionId} onRundownChange={setRundownId} /><RehearsalContextPanel previewProfile={previewProfile} setPreviewProfile={setPreviewProfile} sessionId={sessionId} returnToPrepare={returnToPrepare} /></>
      : workspace === "run"
        ? <RunContextPanel {...runShellProps} />
    : <AdminContext route={route} channels={channels} productions={productions} rundowns={rundowns} channelId={channelId} productionId={productionId} rundownId={rundownId} productionSwitchLocked={productionSwitchLocked} selectionError={selectionError} onChannelChange={setChannelId} onProductionChange={setProductionId} onRundownChange={setRundownId} />;

  const centreBottom = isRundownWorkspace
    ? <RundownCueEditor rundownEditor={rundownEditor} commandBuilder={commandBuilder} />
    : isViewerWorkspace
      ? <ViewerPlacementEditor {...viewerShellProps} />
    : isRehearseWorkspace
      ? <RehearsalResultPanel ui={rehearsalWorkspace} rundownEditor={rundownEditor} sessionId={sessionId} />
    : workspace === "run"
      ? <RunDispatchPanel {...runShellProps} />
    : <section className="shell-context-panel" aria-label="Workspace context">
      <strong>{route.workspace === "productions" ? "Production library" : `${workspace} workspace`}</strong>
      <span>Select and operate within the active workspace above.</span>
    </section>;

  const farRight = isRundownWorkspace
    ? <RundownCueStackPanel rundownEditor={rundownEditor} commandBuilder={commandBuilder} rundown={rundown} previewCue={previewRundownCue} />
    : isViewerWorkspace
      ? <ViewerStatusPanel {...viewerShellProps} />
    : isRehearseWorkspace
      ? <RehearsalCueStackPanel ui={rehearsalWorkspace} rundown={rundown} rundownId={rundownId} returnToPrepare={returnToPrepare} />
    : workspace === "run"
      ? <RunOperationsPanel {...runShellProps} />
    : diagnosticsOpen
    ? <DiagnosticsPanel workspace={workspace} events={events} outbox={outbox} resolveOutbox={resolveOutbox} />
    : <section className="shell-operations-panel" aria-label="Operational status">
        <strong>Workspace status</strong>
        <span>{sessionId ? `Session ${sessionId}` : "No active execution session"}</span>
        <span>{unresolvedOutbox.length ? `${unresolvedOutbox.length} delivery issue${unresolvedOutbox.length === 1 ? "" : "s"}` : "No unresolved delivery issues"}</span>
        <button type="button" onClick={() => setDiagnosticsOpen(true)}>Open diagnostics</button>
      </section>;

  const statusBar = <>
    <span>API: {apiConnection}</span>
    <span>Stream: {streamConnection}</span>
    <span>{selectedProduction?.title ?? "No production selected"}</span>
    {status && <span className="status-msg">{status}</span>}
    {error && <span className="error-msg" role="alert">{error}</span>}
  </>;

  return <AdminStateContext.Provider value={adminState}>
    <AdminShell
      className={isViewerWorkspace ? "admin-shell--viewer" : workspace === "run" ? "admin-shell--run" : ""}
      topBar={<TopBar apiConnection={apiConnection} streamConnection={streamConnection} workspace={route.workspace} productionId={productionId} selectedProduction={selectedProduction} diagnosticsOpen={diagnosticsOpen} onToggleDiagnostics={() => setDiagnosticsOpen((open) => !open)} onNavigateHome={() => navigate({ workspace: "productions" })} onNavigate={navigate} />}
      farLeft={farLeft}
      centreTop={primaryWorkspace}
      centreBottom={centreBottom}
      farRight={farRight}
      statusBar={statusBar}
    />

    <ConfirmationDialog runWorkspace={runWorkspace} />
  </AdminStateContext.Provider>;
}
