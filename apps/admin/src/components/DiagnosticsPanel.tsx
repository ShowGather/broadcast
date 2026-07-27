import { useMemo, useState } from "react";
import type { Channel, OutboxItem, Production, Rundown, StoredEvent } from "../types.js";
import { WorkspacePanel } from "./ui/WorkspacePanel.js";
import { StatusBadge } from "./ui/StatusBadge.js";
import { PrimaryAction, SecondaryAction } from "./ui/ActionButtons.js";
import { EmptyState } from "./ui/EmptyState.js";

type DiagnosticCategory = "overview" | "events" | "outbox";
type DiagnosticRecord =
  | { type: "event"; id: string; label: string; status: string; timestamp?: string; payload: StoredEvent }
  | { type: "outbox"; id: string; label: string; status: string; revision?: number; error?: string; payload: OutboxItem };

interface DiagnosticsWorkspaceProps {
  workspace: string;
  apiConnection: "checking" | "connected" | "offline";
  streamConnection: "checking" | "connected" | "offline";
  channels: Channel[];
  productions: Production[];
  rundowns: Rundown[];
  channelId: string;
  productionId: string;
  rundownId: string;
  selectedProduction?: Production;
  sessionId: string;
  status: string;
  error: string;
  events: StoredEvent[];
  outbox: OutboxItem[];
  unresolvedOutbox: OutboxItem[];
  refreshEvents: () => Promise<void>;
  refreshOutbox: () => Promise<void>;
  refreshRundown: () => Promise<void>;
  resolveOutbox: (item: OutboxItem, action: "retry" | "cancel") => Promise<void>;
}

export interface DiagnosticsWorkspace {
  workspace: string;
  apiConnection: "checking" | "connected" | "offline";
  streamConnection: "checking" | "connected" | "offline";
  selectedChannel?: Channel;
  selectedProduction?: Production;
  selectedRundown?: Rundown;
  channelId: string;
  productionId: string;
  rundownId: string;
  sessionId: string;
  status: string;
  error: string;
  events: StoredEvent[];
  outbox: OutboxItem[];
  unresolvedOutbox: OutboxItem[];
  category: DiagnosticCategory;
  setCategory: (category: DiagnosticCategory) => void;
  records: DiagnosticRecord[];
  selectedRecord?: DiagnosticRecord;
  setSelectedRecordId: (id: string) => void;
  refresh: () => Promise<void>;
  resolveOutbox: (item: OutboxItem, action: "retry" | "cancel") => Promise<void>;
}

export function eventLabel(event: StoredEvent["event"]) {
  if (event.t === "presentation.cue") return `Cue: ${String(event.p.cue ?? "unknown")}`;
  if (event.t === "pc") return `Command: ${String(event.p.k ?? "unknown")}`;
  if (event.t === "presentation.clear") return "Safe Clear";
  return String(event.p.title ?? "Overlay");
}

function formatTime(value?: string) {
  if (!value) return "Not reported";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Not reported" : date.toLocaleString();
}

function healthStatus(value: "checking" | "connected" | "offline") {
  return value === "connected" ? "healthy" : value === "checking" ? "unknown" : "failed";
}

function recordId(record: DiagnosticRecord) {
  return `${record.type}:${record.id}`;
}

export function useDiagnosticsWorkspace(props: DiagnosticsWorkspaceProps): DiagnosticsWorkspace {
  const [category, setCategory] = useState<DiagnosticCategory>("overview");
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const selectedChannel = props.channels.find((channel) => channel.id === props.channelId);
  const selectedRundown = props.rundowns.find((rundown) => rundown.id === props.rundownId);

  const records = useMemo<DiagnosticRecord[]>(() => {
    const eventRecords = props.events.map((stored) => ({
      type: "event" as const,
      id: stored.event.id,
      label: eventLabel(stored.event),
      status: "dispatched",
      timestamp: stored.injectedAt,
      payload: stored,
    }));
    const outboxRecords = props.outbox.map((item) => ({
      type: "outbox" as const,
      id: item.id,
      label: item.label,
      status: item.status,
      revision: item.revision,
      error: item.error,
      payload: item,
    }));
    if (category === "events") return eventRecords;
    if (category === "outbox") return outboxRecords;
    return [...props.unresolvedOutbox.map((item) => ({
      type: "outbox" as const,
      id: item.id,
      label: item.label,
      status: item.status,
      revision: item.revision,
      error: item.error,
      payload: item,
    })), ...eventRecords.slice(0, 5), ...outboxRecords.slice(0, 5)];
  }, [category, props.events, props.outbox, props.unresolvedOutbox]);

  const selectedRecord = records.find((record) => recordId(record) === selectedRecordId) ?? records[0];

  return {
    workspace: props.workspace,
    apiConnection: props.apiConnection,
    streamConnection: props.streamConnection,
    selectedChannel,
    selectedProduction: props.selectedProduction,
    selectedRundown,
    channelId: props.channelId,
    productionId: props.productionId,
    rundownId: props.rundownId,
    sessionId: props.sessionId,
    status: props.status,
    error: props.error,
    events: props.events,
    outbox: props.outbox,
    unresolvedOutbox: props.unresolvedOutbox,
    category,
    setCategory,
    records,
    selectedRecord,
    setSelectedRecordId,
    refresh: async () => {
      await Promise.all([props.refreshEvents(), props.refreshOutbox(), props.refreshRundown()]);
    },
    resolveOutbox: props.resolveOutbox,
  };
}

export function DiagnosticsNavigationPanel({ diagnostics }: { diagnostics: DiagnosticsWorkspace }) {
  const categories: Array<{ id: DiagnosticCategory; label: string; count?: number; hint: string }> = [
    { id: "overview", label: "Overview", count: diagnostics.records.length, hint: "Current health and priority records" },
    { id: "events", label: "Events", count: diagnostics.events.length, hint: "Recent submitted live events" },
    { id: "outbox", label: "Delivery", count: diagnostics.outbox.length, hint: "Durable command and outbox state" },
  ];
  return (
    <WorkspacePanel heading="Diagnostics" hint="Technical observability for the selected channel and production." className="diagnostics-navigation-panel">
      <div className="diagnostics-context-card">
        <span>Channel</span>
        <strong>{diagnostics.selectedChannel?.name ?? (diagnostics.channelId || "Unknown")}</strong>
        <span>Production</span>
        <strong>{diagnostics.selectedProduction?.title ?? (diagnostics.productionId || "Unknown")}</strong>
        <span>Rundown</span>
        <strong>{diagnostics.selectedRundown?.name ?? (diagnostics.rundownId || "Unknown")}</strong>
      </div>
      <div className="diagnostics-category-list" role="list" aria-label="Diagnostic categories">
        {categories.map((category) => (
          <button key={category.id} type="button" className={diagnostics.category === category.id ? "active" : ""} onClick={() => diagnostics.setCategory(category.id)}>
            <strong>{category.label}</strong>
            <span>{category.hint}</span>
            <em>{category.count ?? 0}</em>
          </button>
        ))}
      </div>
      <SecondaryAction onClick={diagnostics.refresh}>Refresh diagnostics</SecondaryAction>
      <p className="hint">Refreshing reads existing health, events, outbox and rundown state only.</p>
    </WorkspacePanel>
  );
}

export function DiagnosticsOverviewPanel({ diagnostics }: { diagnostics: DiagnosticsWorkspace }) {
  const healthCards = [
    { label: "API", value: diagnostics.apiConnection, state: healthStatus(diagnostics.apiConnection), detail: diagnostics.apiConnection === "connected" ? "Status endpoint responded" : diagnostics.apiConnection === "checking" ? "Checking status endpoint" : "Status endpoint unavailable" },
    { label: "Stream", value: diagnostics.streamConnection, state: healthStatus(diagnostics.streamConnection), detail: diagnostics.streamConnection === "connected" ? "Injector reachable via API status" : diagnostics.streamConnection === "checking" ? "Checking stream reachability" : "Injector or stream offline" },
    { label: "Player", value: "Unknown", state: "unknown", detail: "No player heartbeat endpoint is currently available" },
    { label: "Database", value: diagnostics.outbox.length || diagnostics.events.length ? "Reported indirectly" : "Unknown", state: diagnostics.outbox.length || diagnostics.events.length ? "unknown" : "unknown", detail: "No dedicated database health endpoint is exposed to Admin" },
  ];

  return (
    <WorkspacePanel heading="System health" hint="Real reported state only. Unknown is not treated as healthy." className="diagnostics-overview-panel">
      {diagnostics.error && <div className="diagnostics-critical" role="alert"><strong>Latest Admin error</strong><span>{diagnostics.error}</span></div>}
      {diagnostics.unresolvedOutbox.length > 0 && (
        <div className="diagnostics-critical" role="alert">
          <strong>{diagnostics.unresolvedOutbox.length} durable delivery issue{diagnostics.unresolvedOutbox.length === 1 ? "" : "s"}</strong>
          <span>Use Run for operational decisions. Diagnostics can inspect and use existing retry/cancel where eligible.</span>
        </div>
      )}
      <div className="diagnostics-health-grid">
        {healthCards.map((card) => (
          <article key={card.label} className={`diagnostics-health-card diagnostics-health-card--${card.state}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>
      <dl className="summary-list diagnostics-summary-list">
        <div><dt>Workspace</dt><dd>{diagnostics.workspace}</dd></div>
        <div><dt>Session</dt><dd>{diagnostics.sessionId || "No active session reported"}</dd></div>
        <div><dt>Recent events</dt><dd>{diagnostics.events.length}</dd></div>
        <div><dt>Outbox records</dt><dd>{diagnostics.outbox.length}</dd></div>
        <div><dt>Latest status</dt><dd>{diagnostics.status || "Not reported"}</dd></div>
      </dl>
    </WorkspacePanel>
  );
}

export function DiagnosticsRecordsPanel({ diagnostics }: { diagnostics: DiagnosticsWorkspace }) {
  return (
    <WorkspacePanel heading="Technical records" hint="Events and delivery records already available to the Admin." className="diagnostics-records-panel" variant="control">
      {diagnostics.records.length === 0 ? (
        <EmptyState heading="No diagnostic records" description="No events or durable delivery records match the selected category." />
      ) : (
        <div className="diagnostics-record-list" role="list" aria-label="Diagnostic records">
          {diagnostics.records.map((record) => {
            const selected = diagnostics.selectedRecord && recordId(diagnostics.selectedRecord) === recordId(record);
            return (
              <button key={recordId(record)} type="button" role="listitem" className={selected ? "active" : ""} onClick={() => diagnostics.setSelectedRecordId(recordId(record))}>
                <span><StatusBadge status={record.status} /></span>
                <strong>{record.label}</strong>
                <span className="mono">{record.type === "outbox" ? `Revision ${record.revision ?? "Unknown"}` : formatTime(record.timestamp)}</span>
                <span className="mono">{record.id}</span>
                {record.type === "outbox" && record.error && <span className="error-msg">{record.error}</span>}
              </button>
            );
          })}
        </div>
      )}
    </WorkspacePanel>
  );
}

export function DiagnosticsInspectorPanel({ diagnostics }: { diagnostics: DiagnosticsWorkspace }) {
  const record = diagnostics.selectedRecord;
  const outbox = record?.type === "outbox" ? record.payload : undefined;
  return (
    <WorkspacePanel heading="Inspector" hint="Selected diagnostic detail and existing safe recovery actions." className="diagnostics-inspector-panel" variant="readiness">
      {record ? (
        <div className="diagnostics-inspector">
          <StatusBadge status={record.status} />
          <h3>{record.label}</h3>
          <dl className="summary-list">
            <div><dt>Type</dt><dd>{record.type}</dd></div>
            <div><dt>ID</dt><dd className="mono">{record.id}</dd></div>
            <div><dt>Revision</dt><dd>{record.type === "outbox" ? record.revision ?? "Not reported" : "Not reported"}</dd></div>
            <div><dt>Timestamp</dt><dd>{record.type === "event" ? formatTime(record.timestamp) : "Not reported"}</dd></div>
            <div><dt>Error</dt><dd>{record.type === "outbox" ? record.error ?? "None reported" : "None reported"}</dd></div>
          </dl>
          <details className="diagnostics-payload">
            <summary>Show technical detail</summary>
            <pre>{JSON.stringify(record.payload, null, 2)}</pre>
          </details>
          <div className="diagnostics-inspector__actions">
            <SecondaryAction onClick={diagnostics.refresh}>Refresh</SecondaryAction>
            {outbox?.retryable && <PrimaryAction onClick={() => diagnostics.resolveOutbox(outbox, "retry")}>Retry delivery</PrimaryAction>}
            {outbox?.cancellable && <SecondaryAction onClick={() => diagnostics.resolveOutbox(outbox, "cancel")}>Cancel delivery</SecondaryAction>}
          </div>
        </div>
      ) : (
        <EmptyState heading="No record selected" description="Choose a diagnostic record to inspect its details." />
      )}
    </WorkspacePanel>
  );
}

export function DiagnosticsPanel({ workspace, events, outbox, resolveOutbox }: Pick<DiagnosticsWorkspaceProps, "workspace" | "events" | "outbox" | "resolveOutbox">) {
  const diagnostics = useDiagnosticsWorkspace({
    workspace,
    apiConnection: "checking",
    streamConnection: "checking",
    channels: [],
    productions: [],
    rundowns: [],
    channelId: "",
    productionId: "",
    rundownId: "",
    sessionId: "",
    status: "",
    error: "",
    events,
    outbox,
    unresolvedOutbox: outbox.filter((item) => item.status === "failed" || item.status === "pending"),
    refreshEvents: async () => {},
    refreshOutbox: async () => {},
    refreshRundown: async () => {},
    resolveOutbox,
  });
  return <DiagnosticsRecordsPanel diagnostics={diagnostics} />;
}
