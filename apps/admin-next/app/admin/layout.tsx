"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { AdminTopBar } from "@/components/layout/admin-top-bar";
import { AdminStatusBar } from "@/components/layout/admin-status-bar";
import { AdminStateContext, type AdminStateValue } from "@/lib/admin-state";
import { useSystemHealth } from "@/hooks/use-system-health";
import { useEventDispatch } from "@/hooks/use-event-dispatch";
import { useAdminSelectors } from "@/hooks/use-admin-selectors";
import { useCommandBuilder } from "@/hooks/use-command-builder";
import { useRundownEditor } from "@/hooks/use-rundown-editor";
import { useShowConfiguration } from "@/hooks/use-show-configuration";
import { useRunWorkspace } from "@/hooks/use-run-workspace";
import type { RundownCue } from "@/lib/types";
import { ProductionsHome } from "@/components/workspaces/productions-home";
import { PrepareOverview } from "@/components/workspaces/prepare-overview";
import { RundownWorkspace } from "@/components/workspaces/rundown-workspace";
import { ViewerWorkspace } from "@/components/workspaces/viewer-workspace";
import { ShowConfigurationWorkspace } from "@/components/workspaces/show-configuration-workspace";
import { RehearseWorkspace } from "@/components/workspaces/rehearse-workspace";
import { RunWorkspaceSection, ConfirmationDialog } from "@/components/workspaces/run-workspace-section";

function workspaceFromPath(pathname: string): string {
  if (/^\/admin\/productions\/?$/.test(pathname)) return "productions";
  if (/\/prepare/.test(pathname)) return "prepare";
  if (/\/rundown/.test(pathname)) return "rundown";
  if (/\/viewer/.test(pathname)) return "viewer";
  if (/\/configuration/.test(pathname)) return "configuration";
  if (/\/rehearse/.test(pathname)) return "rehearse";
  if (/\/run/.test(pathname)) return "run";
  return "productions";
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [channelId, setChannelId] = useState("");
  const [productionId, setProductionId] = useState("");
  const [rundownId, setRundownId] = useState("");
  const [rundown, setRundown] = useState<RundownCue[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [previewProfile, setPreviewProfile] = useState<"desktop" | "mobile" | "tv">("desktop");

  const workspace = useMemo(() => workspaceFromPath(pathname), [pathname]);
  const rehearsal = workspace === "rehearse";

  const navigate = useCallback((path: string) => router.push(path), [router]);
  const { apiConnection, streamConnection } = useSystemHealth();
  const { status, setStatus, error, setError, events, outbox, unresolvedOutbox, fetchEvents, fetchOutbox, send, mutate } = useEventDispatch({ rehearsal, channelId });
  const commandBuilder = useCommandBuilder();
  const { channels, productions, rundowns, selectionError, selectedProduction, refreshProductions, refreshRundowns } = useAdminSelectors({ channelId, productionId, setChannelId, setProductionId, setRundownId, navigate });

  const productionMatch = pathname.match(/\/admin\/productions\/([^/]+)/);
  const urlProductionId = productionMatch ? decodeURIComponent(productionMatch[1]) : "";
  useEffect(() => { if (urlProductionId && urlProductionId !== productionId) setProductionId(urlProductionId); }, [urlProductionId, productionId]);

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
  const showConfig = useShowConfiguration({ productionId, channelId, mutate, syncCommandFields: (kind: string, instanceId: string) => { commandBuilder.setCommandKind(kind); commandBuilder.setCommandInstanceId(instanceId); } });
  const runWorkspace = useRunWorkspace({ rundownId, rundown, sessionId, rehearsal, send, mutate, fetchRundown, fetchEvents, fetchOutbox, workspace });

  const disabledCueCount = rundown.filter((cue) => !cue.enabled).length;
  const layoutPreviewUrl = channelId && productionId ? `http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:3003/player/${encodeURIComponent(channelId)}?profile=${previewProfile}&embedded=1&productionId=${encodeURIComponent(productionId)}` : "";
  const playerPreviewUrl = channelId ? `http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:3003/player/${encodeURIComponent(channelId)}?profile=${previewProfile}&embedded=1&productionId=${encodeURIComponent(productionId)}&rehearsal=1` : "";
  const programmePreviewUrl = channelId ? `http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:3003/player/${encodeURIComponent(channelId)}?profile=desktop&embedded=1&productionId=${encodeURIComponent(productionId)}` : "";

  const adminState = useMemo<AdminStateValue>(() => ({
    channelId, setChannelId, productionId, setProductionId, rundownId, setRundownId, workspace,
    navigate, mutate, send, status, setStatus, error, setError,
    channels, productions, rundowns, selectedProduction, refreshProductions, refreshRundowns,
    rundown, sessionId, disabledCueCount, apiConnection, streamConnection,
    events, outbox, unresolvedOutbox, fetchEvents, fetchOutbox, fetchRundown,
    previewProfile, setPreviewProfile, layoutPreviewUrl, playerPreviewUrl, programmePreviewUrl,
    rundownEditor, commandBuilder, showConfig, runWorkspace,
  }), [channelId, productionId, rundownId, workspace, navigate, mutate, send, status, setStatus, error, setError, channels, productions, rundowns, selectedProduction, refreshProductions, refreshRundowns, rundown, sessionId, disabledCueCount, apiConnection, streamConnection, events, outbox, unresolvedOutbox, fetchEvents, fetchOutbox, fetchRundown, previewProfile, layoutPreviewUrl, playerPreviewUrl, programmePreviewUrl, rundownEditor, commandBuilder, showConfig, runWorkspace]);

  const renderWorkspace = () => {
    switch (workspace) {
      case "productions": return <ProductionsHome />;
      case "prepare": return <PrepareOverview />;
      case "rundown": return <RundownWorkspace />;
      case "viewer": return <ViewerWorkspace />;
      case "configuration": return <ShowConfigurationWorkspace />;
      case "rehearse": return <RehearseWorkspace />;
      case "run": return <RunWorkspaceSection />;
      default: return <ProductionsHome />;
    }
  };

  return (
    <AdminStateContext.Provider value={adminState}>
      <AdminShell
        topBar={<AdminTopBar workspace={workspace} productionId={productionId} productionTitle={selectedProduction?.title} />}
        workspace={renderWorkspace()}
        statusBar={<AdminStatusBar apiConnection={apiConnection} streamConnection={streamConnection} />}
      />
      <ConfirmationDialog />
      {error && <div className="error-msg" style={{ position: "fixed", bottom: 60, right: 20, zIndex: 20 }}>{error}</div>}
      {status && <div className="status-msg" style={{ position: "fixed", bottom: 60, right: 20, zIndex: 20 }}>{status}</div>}
    </AdminStateContext.Provider>
  );
}
