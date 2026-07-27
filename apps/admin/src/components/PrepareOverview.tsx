import { useMemo, useState } from "react";
import type { AdminRoute } from "../routing.js";
import type { Channel, Production, Rundown } from "../types.js";
import type { useShowConfiguration } from "../hooks/useShowConfiguration.js";
import type { useRundownEditor } from "../hooks/useRundownEditor.js";
import { LegacyOverlay } from "./LegacyOverlay.js";
import { PrimaryAction, SecondaryAction } from "./ui/ActionButtons.js";

interface PrepareShellProps {
  showConfig: ReturnType<typeof useShowConfiguration>;
  rundownEditor: ReturnType<typeof useRundownEditor>;
  selectedProduction: Production | undefined;
  channels: Channel[];
  rundowns: Rundown[];
  channelId: string;
  productionId: string;
  rundownId: string;
  disabledCueCount: number;
  apiConnection: "checking" | "connected" | "offline";
  streamConnection: "checking" | "connected" | "offline";
  createProduction: () => Promise<void>;
  duplicateProduction: () => Promise<void>;
  saveProduction: () => Promise<unknown>;
  onNavigatePrepareTab: (tab: "overview" | "rundown" | "viewer" | "configuration") => void;
  onNavigateWorkspace: (route: AdminRoute) => void;
  legacyOverlay: {
    title: string;
    setTitle: (value: string) => void;
    message: string;
    setMessage: (value: string) => void;
    duration: number;
    setDuration: (value: number) => void;
  };
}

export function usePrepareWorkspace(props: PrepareShellProps) {
  const [saving, setSaving] = useState(false);
  const readiness = useMemo(() => {
    const cueCount = props.rundownEditor.rundownDefinition.length;
    return {
      hasProduction: Boolean(props.productionId && props.selectedProduction),
      hasTitle: Boolean(props.showConfig.productionTitle.trim()),
      hasRundown: Boolean(props.rundownId),
      cueCount,
      hasCues: cueCount > 0,
      hasConfiguration: Boolean(props.selectedProduction?.configuration),
      disabledCueCount: props.disabledCueCount,
      apiReady: props.apiConnection === "connected",
      streamReady: props.streamConnection === "connected",
    };
  }, [props.apiConnection, props.disabledCueCount, props.productionId, props.rundownEditor.rundownDefinition.length, props.rundownId, props.selectedProduction, props.showConfig.productionTitle, props.streamConnection]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!props.showConfig.productionTitle.trim()) errors.push("Production title is required.");
    if (props.showConfig.productionScheduledStart && props.showConfig.productionScheduledEnd && new Date(props.showConfig.productionScheduledEnd) < new Date(props.showConfig.productionScheduledStart)) errors.push("Scheduled end must be after scheduled start.");
    return errors;
  }, [props.showConfig.productionScheduledEnd, props.showConfig.productionScheduledStart, props.showConfig.productionTitle]);

  const save = async () => {
    if (saving || !props.productionId || validationErrors.length) return;
    setSaving(true);
    try { return await props.saveProduction(); }
    finally { setSaving(false); }
  };

  return { ...props, readiness, validationErrors, saving, save } as const;
}

type PrepareWorkspace = ReturnType<typeof usePrepareWorkspace>;

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : "Not scheduled";
const scheduleInputValue = (value: string) => value ? value.slice(0, 16) : "";
const scheduleApiValue = (value: string) => value ? new Date(value).toISOString() : "";

export function PrepareNavigationPanel({ workspace }: { workspace: PrepareWorkspace }) {
  const items: Array<{ label: string; action: () => void; state: "ready" | "attention" | "neutral" }> = [
    { label: "Overview", action: () => workspace.onNavigatePrepareTab("overview"), state: "ready" },
    { label: "Rundown", action: () => workspace.onNavigatePrepareTab("rundown"), state: workspace.readiness.hasRundown ? "ready" : "attention" },
    { label: "Viewer", action: () => workspace.onNavigatePrepareTab("viewer"), state: workspace.readiness.hasConfiguration ? "ready" : "attention" },
    { label: "Show Configuration", action: () => workspace.onNavigatePrepareTab("configuration"), state: workspace.readiness.hasConfiguration ? "ready" : "attention" },
  ];
  return <section className="prepare-navigation-panel" aria-label="Preparation navigation">
    <div className="prepare-panel-heading">
      <span>Prepare</span>
      <h2>{workspace.showConfig.productionTitle || "No production selected"}</h2>
    </div>
    <nav className="prepare-shell-nav" aria-label="Prepare sections">
      {items.map((item) => <button key={item.label} type="button" onClick={item.action}>
        <strong>{item.label}</strong>
        <span className={`prepare-state prepare-state--${item.state}`}>{item.state}</span>
      </button>)}
    </nav>
    <div className="prepare-context-card">
      <strong>Production context</strong>
      <span>Channel: {workspace.channels.find((channel) => channel.id === workspace.channelId)?.name ?? "Unknown"}</span>
      <span>Rundown: {workspace.rundownEditor.rundownName || workspace.rundowns.find((item) => item.id === workspace.rundownId)?.name || "Not selected"}</span>
      <span>Status: {workspace.showConfig.productionStatus || "draft"}</span>
    </div>
    <SecondaryAction disabled={!workspace.productionId} onClick={() => workspace.onNavigateWorkspace({ workspace: "rehearse", productionId: workspace.productionId })}>Start rehearsal</SecondaryAction>
    <SecondaryAction disabled={!workspace.productionId} onClick={() => workspace.onNavigateWorkspace({ workspace: "run", productionId: workspace.productionId })}>Open Run gate</SecondaryAction>
  </section>;
}

export function PrepareSummaryPanel({ workspace }: { workspace: PrepareWorkspace }) {
  if (!workspace.productionId) {
    return <section className="prepare-summary-panel prepare-summary-panel--empty" aria-label="Prepare summary">
      <div className="prepare-panel-heading">
        <span>Production setup</span>
        <h1>No production selected</h1>
      </div>
      <p>Choose or create a production before preparing rundowns, viewer presentation, or rehearsals.</p>
      <PrimaryAction onClick={workspace.createProduction}>Create production</PrimaryAction>
    </section>;
  }

  const missing = [
    !workspace.readiness.hasTitle ? "production title" : "",
    !workspace.readiness.hasRundown ? "rundown" : "",
    !workspace.readiness.hasCues ? "rundown cues" : "",
    !workspace.readiness.hasConfiguration ? "viewer configuration" : "",
  ].filter(Boolean);

  return <section className="prepare-summary-panel" aria-label="Prepare summary">
    <div className="prepare-panel-heading">
      <span>Production setup</span>
      <h1>{workspace.showConfig.productionTitle || "Untitled production"}</h1>
    </div>
    <div className="prepare-summary-grid">
      <SummaryMetric label="Status" value={workspace.showConfig.productionStatus || "draft"} />
      <SummaryMetric label="Schedule" value={formatDate(workspace.selectedProduction?.scheduledStart)} />
      <SummaryMetric label="Rundown" value={workspace.readiness.hasRundown ? `${workspace.rundownEditor.rundownName || "Selected"} · ${workspace.readiness.cueCount} cues` : "Not selected"} />
      <SummaryMetric label="Viewer" value={workspace.readiness.hasConfiguration ? "Production configuration present" : "Needs configuration"} />
      <SummaryMetric label="API" value={workspace.apiConnection} />
      <SummaryMetric label="Stream" value={workspace.streamConnection} />
    </div>
    <div className="prepare-next-step">
      <strong>{missing.length ? "Next recommended action" : "Ready to rehearse"}</strong>
      <p>{missing.length ? `Complete ${missing[0]} before moving confidently into rehearsal.` : "The main preparation checks are in place. Rehearsal remains the next safe stage before Run."}</p>
    </div>
  </section>;
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <div>
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>;
}

export function PrepareProductionEditor({ workspace }: { workspace: PrepareWorkspace }) {
  if (!workspace.productionId) {
    return <section className="prepare-production-editor prepare-production-editor--empty" aria-label="Production editor">
      <strong>No production selected</strong>
      <span>Create or select a production to edit its details.</span>
    </section>;
  }
  const saveDisabled = workspace.saving || workspace.validationErrors.length > 0;
  return <section className="prepare-production-editor" aria-label="Production editor">
    <div className="prepare-editor-heading">
      <div>
        <span>Production editor</span>
        <h2>{workspace.showConfig.productionTitle || "Untitled production"}</h2>
      </div>
      <span>{workspace.saving ? "Saving..." : "Explicit save required"}</span>
    </div>
    <div className="prepare-editor-grid form">
      <label><span>Title</span><input value={workspace.showConfig.productionTitle} onChange={(event) => workspace.showConfig.setProductionTitle(event.target.value)} /></label>
      <label><span>Description</span><input value={workspace.showConfig.productionDescription} onChange={(event) => workspace.showConfig.setProductionDescription(event.target.value)} /></label>
      <label><span>Status</span><select value={workspace.showConfig.productionStatus} onChange={(event) => workspace.showConfig.setProductionStatus(event.target.value)}>
        <option value="draft">Draft</option>
        <option value="rehearsal">Rehearsal</option>
        <option value="live">Live</option>
        <option value="complete">Complete</option>
        <option value="archived">Archived</option>
      </select></label>
      <label><span>Scheduled start</span><input type="datetime-local" value={scheduleInputValue(workspace.showConfig.productionScheduledStart)} onChange={(event) => workspace.showConfig.setProductionScheduledStart(scheduleApiValue(event.target.value))} /></label>
      <label><span>Scheduled end</span><input type="datetime-local" value={scheduleInputValue(workspace.showConfig.productionScheduledEnd)} onChange={(event) => workspace.showConfig.setProductionScheduledEnd(scheduleApiValue(event.target.value))} /></label>
    </div>
    {workspace.validationErrors.length > 0 && <div className="prepare-editor-validation" role="alert">{workspace.validationErrors.map((error) => <p key={error}>{error}</p>)}</div>}
    <div className="prepare-editor-actions">
      <PrimaryAction disabled={saveDisabled} onClick={workspace.save}>{workspace.saving ? "Saving production" : "Save production"}</PrimaryAction>
      <SecondaryAction onClick={workspace.createProduction}>Create production</SecondaryAction>
      <SecondaryAction disabled={!workspace.productionId} onClick={workspace.duplicateProduction}>Duplicate production</SecondaryAction>
    </div>
  </section>;
}

export function PrepareReadinessPanel({ workspace }: { workspace: PrepareWorkspace }) {
  const checks = [
    { label: workspace.readiness.hasTitle ? "Production details ready" : "Add production details", ready: workspace.readiness.hasTitle },
    { label: workspace.readiness.hasRundown ? `Rundown selected · ${workspace.readiness.cueCount} cues` : "Select or create a rundown", ready: workspace.readiness.hasRundown },
    { label: workspace.readiness.hasCues ? "Rundown contains cues" : "Add cues to the rundown", ready: workspace.readiness.hasCues },
    { label: workspace.readiness.hasConfiguration ? "Viewer configuration present" : "Configure the viewer", ready: workspace.readiness.hasConfiguration },
    { label: workspace.readiness.disabledCueCount === 0 ? "No disabled cues" : `${workspace.readiness.disabledCueCount} disabled cue${workspace.readiness.disabledCueCount === 1 ? "" : "s"}`, ready: workspace.readiness.disabledCueCount === 0 },
    { label: workspace.readiness.apiReady ? "API connected" : `API ${workspace.apiConnection}`, ready: workspace.readiness.apiReady },
    { label: workspace.readiness.streamReady ? "Stream connected" : `Stream ${workspace.streamConnection}`, ready: workspace.readiness.streamReady },
  ];
  return <section className="prepare-readiness-panel" aria-label="Prepare readiness">
    <div className="prepare-panel-heading">
      <span>Readiness</span>
      <h2>Next actions</h2>
    </div>
    <ul className="prepare-readiness-list">
      {checks.map((check) => <li key={check.label} className={check.ready ? "ready" : "attention"}>{check.label}</li>)}
    </ul>
    <div className="prepare-next-actions">
      <PrimaryAction disabled={!workspace.productionId || !workspace.rundownId} onClick={() => workspace.onNavigateWorkspace({ workspace: "rehearse", productionId: workspace.productionId })}>Open rehearsal</PrimaryAction>
      <SecondaryAction disabled={!workspace.productionId} onClick={() => workspace.onNavigatePrepareTab("rundown")}>Open Rundown</SecondaryAction>
      <SecondaryAction disabled={!workspace.productionId} onClick={() => workspace.onNavigatePrepareTab("viewer")}>Open Viewer</SecondaryAction>
      <SecondaryAction disabled={!workspace.productionId} onClick={() => workspace.onNavigatePrepareTab("configuration")}>Open Show Configuration</SecondaryAction>
      <SecondaryAction disabled={!workspace.productionId} onClick={() => workspace.onNavigateWorkspace({ workspace: "run", productionId: workspace.productionId })}>Open Run gate</SecondaryAction>
      {!workspace.rundownId && <p className="prepare-action-reason">Choose a rundown before rehearsing.</p>}
    </div>
    <details className="prepare-legacy-tools">
      <summary>Advanced legacy overlay controls</summary>
      <p className="hint">Legacy overlay sends the older custom overlay event through the current dispatch path. It is retained for diagnostics, not normal preparation.</p>
      <LegacyOverlay {...workspace.legacyOverlay} />
    </details>
  </section>;
}

export function PrepareOverview(props: PrepareShellProps) {
  const workspace = usePrepareWorkspace(props);
  return <>
    <PrepareNavigationPanel workspace={workspace} />
    <PrepareSummaryPanel workspace={workspace} />
    <PrepareProductionEditor workspace={workspace} />
    <PrepareReadinessPanel workspace={workspace} />
  </>;
}
