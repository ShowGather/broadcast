import { useEffect, useMemo, useState } from "react";
import type { AdminRoute } from "../routing.js";
import type { Channel, Production, Rundown } from "../types.js";
import { WorkspacePanel } from "./ui/WorkspacePanel.js";
import { StatusBadge } from "./ui/StatusBadge.js";
import { EmptyState } from "./ui/EmptyState.js";
import { PrimaryAction, SecondaryAction } from "./ui/ActionButtons.js";

type ProductionDraftMode = "create" | "edit";

interface ProductionDraft {
  title: string;
  description: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
}

interface ProductionsWorkspaceProps {
  channels: Channel[];
  productions: Production[];
  rundowns: Rundown[];
  channelId: string;
  productionId: string;
  setChannelId: (id: string) => void;
  setProductionId: (id: string) => void;
  setRundownId: (id: string) => void;
  refreshProductions: () => Promise<void>;
  refreshRundowns: () => Promise<void>;
  navigate: (route: AdminRoute) => void;
  mutate: (url: string, method: "POST" | "PUT", body: Record<string, unknown>, success: string, reload?: () => Promise<void>) => Promise<{ id?: string } | undefined>;
}

export interface ProductionsWorkspace {
  channels: Channel[];
  productions: Production[];
  filteredProductions: Production[];
  rundowns: Rundown[];
  channelId: string;
  productionId: string;
  selectedProduction?: Production;
  selectedChannel?: Channel;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  statuses: string[];
  draftMode: ProductionDraftMode;
  setDraftMode: (mode: ProductionDraftMode) => void;
  draft: ProductionDraft;
  updateDraft: (field: keyof ProductionDraft, value: string) => void;
  validationErrors: string[];
  pending: boolean;
  createProduction: () => Promise<void>;
  saveProduction: () => Promise<void>;
  duplicateProduction: (id?: string) => Promise<void>;
  selectProduction: (id: string) => void;
  openPrepare: (id?: string) => void;
  openRundown: (id?: string) => void;
  openViewer: (id?: string) => void;
  openRehearse: (id?: string) => void;
  openRun: (id?: string) => void;
  changeChannel: (id: string) => void;
}

const SUPPORTED_STATUSES = ["draft", "rehearsal", "live", "complete", "archived"];

function toInputDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return date.toISOString().slice(0, 16);
}

function fromInputDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function productionDraft(production?: Production): ProductionDraft {
  return {
    title: production?.title ?? "New production",
    description: production?.description ?? "",
    status: production?.status ?? "draft",
    scheduledStart: toInputDateTime(production?.scheduledStart),
    scheduledEnd: toInputDateTime(production?.scheduledEnd),
  };
}

function formatSchedule(production?: Production) {
  if (!production) return "No schedule";
  if (!production.scheduledStart) return "Not scheduled";
  const start = new Date(production.scheduledStart).toLocaleString();
  return production.scheduledEnd ? `${start} → ${new Date(production.scheduledEnd).toLocaleString()}` : start;
}

function configurationLabel(production?: Production) {
  if (!production) return "No production selected";
  return production.configuration ? "Presentation configuration present" : "No presentation configuration";
}

export function productionVisibleInFilter(production: Production | undefined, statusFilter: string) {
  return Boolean(production && (statusFilter === "all" || production.status === statusFilter));
}

export function useProductionsWorkspace(props: ProductionsWorkspaceProps): ProductionsWorkspace {
  const { channels, productions, rundowns, channelId, productionId, setChannelId, setProductionId, setRundownId, refreshProductions, refreshRundowns, navigate, mutate } = props;
  const [statusFilter, setStatusFilter] = useState("all");
  const [draftMode, setDraftMode] = useState<ProductionDraftMode>("create");
  const [draft, setDraft] = useState<ProductionDraft>(() => productionDraft());
  const [pending, setPending] = useState(false);

  const selectedProduction = productions.find((production) => production.id === productionId);
  const selectedChannel = channels.find((channel) => channel.id === channelId);
  const statuses = useMemo(() => SUPPORTED_STATUSES.filter((status) => productions.some((production) => production.status === status)), [productions]);
  const filteredProductions = statusFilter === "all" ? productions : productions.filter((production) => production.status === statusFilter);
  const validationErrors = [
    ...(channelId ? [] : ["Select a channel before creating a production."]),
    ...(draft.title.trim() ? [] : ["Production title is required."]),
    ...(SUPPORTED_STATUSES.includes(draft.status) ? [] : ["Choose a supported production status."]),
  ];

  useEffect(() => {
    if (draftMode === "edit") setDraft(productionDraft(selectedProduction));
  }, [draftMode, selectedProduction]);

  useEffect(() => {
    if (statusFilter !== "all" && !statuses.includes(statusFilter)) setStatusFilter("all");
  }, [statusFilter, statuses]);

  useEffect(() => {
    if (statusFilter !== "all" && selectedProduction && !productionVisibleInFilter(selectedProduction, statusFilter)) {
      setProductionId("");
      setRundownId("");
    }
  }, [selectedProduction, setProductionId, setRundownId, statusFilter]);

  const selectProduction = (id: string) => {
    setProductionId(id);
    setDraftMode("edit");
  };

  const changeChannel = (id: string) => {
    setChannelId(id);
    setDraftMode("create");
    setDraft(productionDraft());
  };

  const createProduction = async () => {
    if (pending || validationErrors.length) return;
    setPending(true);
    try {
      const result = await mutate(`/api/channels/${channelId}/productions`, "POST", {
        title: draft.title,
        description: draft.description,
        status: draft.status,
        scheduledStart: fromInputDateTime(draft.scheduledStart),
        scheduledEnd: fromInputDateTime(draft.scheduledEnd),
      }, "Production created");
      if (result?.id) {
        await refreshProductions();
        setProductionId(result.id);
        setDraftMode("edit");
      }
    } finally {
      setPending(false);
    }
  };

  const saveProduction = async () => {
    if (pending || !selectedProduction || validationErrors.length) return;
    setPending(true);
    try {
      await mutate(`/api/productions/${selectedProduction.id}`, "PUT", {
        title: draft.title,
        description: draft.description,
        status: draft.status,
        scheduledStart: fromInputDateTime(draft.scheduledStart),
        scheduledEnd: fromInputDateTime(draft.scheduledEnd),
      }, "Production updated");
      await refreshProductions();
    } finally {
      setPending(false);
    }
  };

  const duplicateProduction = async (id = productionId) => {
    if (pending || !id) return;
    setPending(true);
    try {
      const result = await mutate(`/api/productions/${id}/duplicate`, "POST", {}, "Production duplicated");
      if (result?.id) {
        await refreshProductions();
        setProductionId(result.id);
        setDraftMode("edit");
      }
    } finally {
      setPending(false);
    }
  };

  const withProduction = (workspace: AdminRoute["workspace"], id = productionId, prepareTab?: AdminRoute["prepareTab"]) => {
    if (!id) return;
    setProductionId(id);
    navigate(workspace === "prepare" ? { workspace, productionId: id, prepareTab } : { workspace, productionId: id });
  };

  return {
    channels, productions, filteredProductions, rundowns, channelId, productionId, selectedProduction, selectedChannel,
    statusFilter, setStatusFilter, statuses, draftMode, setDraftMode,
    draft, updateDraft: (field, value) => setDraft((current) => ({ ...current, [field]: value })),
    validationErrors, pending, createProduction, saveProduction, duplicateProduction, selectProduction,
    openPrepare: (id) => withProduction("prepare", id, "overview"),
    openRundown: (id) => withProduction("prepare", id, "rundown"),
    openViewer: (id) => withProduction("prepare", id, "viewer"),
    openRehearse: (id) => withProduction("rehearse", id),
    openRun: (id) => withProduction("run", id),
    changeChannel,
  };
}

export function ProductionsFilterPanel({ workspace }: { workspace: ProductionsWorkspace }) {
  return (
    <WorkspacePanel heading="Productions" hint="Choose a channel, narrow the catalogue, or start a new draft." className="productions-filter-panel">
      <div className="form">
        <label>
          <span>Channel</span>
          <select value={workspace.channelId} onChange={(event) => workspace.changeChannel(event.target.value)}>
            {workspace.channels.length ? workspace.channels.map((channel) => (
              <option key={channel.id} value={channel.id}>{channel.name}</option>
            )) : <option value="">No channels available</option>}
          </select>
        </label>
        <label>
          <span>Status filter</span>
          <select value={workspace.statusFilter} onChange={(event) => workspace.setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {workspace.statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="productions-filter-panel__counts">
        <strong>{workspace.filteredProductions.length}</strong>
        <span>visible of {workspace.productions.length} production{workspace.productions.length === 1 ? "" : "s"}</span>
      </div>
      <PrimaryAction onClick={() => { workspace.setDraftMode("create"); }} disabled={!workspace.channelId}>
        New production
      </PrimaryAction>
      <p className="hint">Production setup continues in Prepare. Live operation stays in Run.</p>
    </WorkspacePanel>
  );
}

export function ProductionsCataloguePanel({ workspace }: { workspace: ProductionsWorkspace }) {
  return (
    <WorkspacePanel heading="Production catalogue" hint={workspace.selectedChannel ? `Viewing ${workspace.selectedChannel.name}` : "Select a channel to load productions."} className="productions-catalogue-panel">
      {!workspace.channelId ? (
        <EmptyState heading="No channel selected" description="Choose a channel before creating or opening a production." />
      ) : workspace.filteredProductions.length === 0 ? (
        <EmptyState
          heading={workspace.productions.length ? "No productions match this filter" : "No productions yet"}
          description={workspace.productions.length ? "Change the status filter to show more productions." : "A production contains programme details, viewer presentation, rundown, and live controls."}
          action={<PrimaryAction onClick={() => workspace.setDraftMode("create")}>Create your first production</PrimaryAction>}
        />
      ) : (
        <div className="production-cards" role="list">
          {workspace.filteredProductions.map((production) => {
            const selected = workspace.productionId === production.id;
            const currentRundowns = selected ? workspace.rundowns : [];
            return (
              <article key={production.id} className={`production-card ${selected ? "production-card--selected" : ""}`} role="listitem">
                <button type="button" className="production-card__select" onClick={() => workspace.selectProduction(production.id)} aria-pressed={selected}>
                  <span className="production-card__topline">
                    <StatusBadge status={production.status} />
                    <span>{formatSchedule(production)}</span>
                  </span>
                  <strong>{production.title}</strong>
                  <span>{production.description || "No description"}</span>
                  <span className="hint">
                    {workspace.channels.find((channel) => channel.id === production.channelId)?.name ?? "Selected channel"}
                    {" · "}
                    {currentRundowns.length ? `${currentRundowns.length} rundown${currentRundowns.length === 1 ? "" : "s"}` : "Rundown details load when selected"}
                    {" · "}
                    {production.configuration ? "Configured" : "Configuration missing"}
                  </span>
                </button>
                <div className="production-card__actions">
                  <PrimaryAction onClick={() => workspace.openPrepare(production.id)}>Open Prepare</PrimaryAction>
                  <SecondaryAction onClick={() => workspace.duplicateProduction(production.id)} disabled={workspace.pending}>Duplicate</SecondaryAction>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </WorkspacePanel>
  );
}

export function ProductionDraftPanel({ workspace }: { workspace: ProductionsWorkspace }) {
  const editing = workspace.draftMode === "edit" && workspace.selectedProduction;
  const saveDisabled = workspace.pending || workspace.validationErrors.length > 0 || (workspace.draftMode === "edit" && !workspace.selectedProduction);

  return (
    <WorkspacePanel heading={editing ? "Catalogue edit" : "Create production"} hint="Only catalogue-level metadata lives here. Detailed preparation belongs in Prepare." className="production-draft-panel" variant="control">
      <div className="production-draft-panel__mode">
        <SecondaryAction onClick={() => { workspace.setDraftMode("create"); }} aria-pressed={workspace.draftMode === "create"}>New draft</SecondaryAction>
        <SecondaryAction onClick={() => { workspace.setDraftMode("edit"); }} disabled={!workspace.selectedProduction} aria-pressed={workspace.draftMode === "edit"}>Edit selected</SecondaryAction>
      </div>
      <div className="form production-draft-form">
        <label>
          <span>Title</span>
          <input value={workspace.draft.title} onChange={(event) => workspace.updateDraft("title", event.target.value)} />
        </label>
        <label>
          <span>Description</span>
          <textarea value={workspace.draft.description} onChange={(event) => workspace.updateDraft("description", event.target.value)} rows={2} />
        </label>
        <label>
          <span>Status</span>
          <select value={workspace.draft.status} onChange={(event) => workspace.updateDraft("status", event.target.value)}>
            {SUPPORTED_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label>
          <span>Scheduled start</span>
          <input type="datetime-local" value={workspace.draft.scheduledStart} onChange={(event) => workspace.updateDraft("scheduledStart", event.target.value)} />
        </label>
        <label>
          <span>Scheduled end</span>
          <input type="datetime-local" value={workspace.draft.scheduledEnd} onChange={(event) => workspace.updateDraft("scheduledEnd", event.target.value)} />
        </label>
      </div>
      {workspace.validationErrors.length > 0 && (
        <ul className="validation-list" aria-label="Production validation errors">
          {workspace.validationErrors.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
      )}
      <div className="production-draft-panel__actions">
        <PrimaryAction onClick={editing ? workspace.saveProduction : workspace.createProduction} disabled={saveDisabled}>
          {workspace.pending ? "Saving…" : editing ? "Save catalogue changes" : "Create production"}
        </PrimaryAction>
        <SecondaryAction onClick={() => { workspace.setDraftMode("create"); }} disabled={workspace.pending}>Cancel draft</SecondaryAction>
      </div>
    </WorkspacePanel>
  );
}

export function ProductionSummaryPanel({ workspace }: { workspace: ProductionsWorkspace }) {
  const production = workspace.selectedProduction;
  const cueCount = workspace.rundowns.length;
  return (
    <WorkspacePanel heading="Selected production" hint="Context and next action for the catalogue selection." variant="readiness" className="production-summary-panel">
      {production ? (
        <div className="production-summary">
          <StatusBadge status={production.status} />
          <h3>{production.title}</h3>
          <p className="hint">{production.description || "No description has been added yet."}</p>
          <dl className="summary-list">
            <div><dt>Channel</dt><dd>{workspace.selectedChannel?.name ?? "Selected channel"}</dd></div>
            <div><dt>Schedule</dt><dd>{formatSchedule(production)}</dd></div>
            <div><dt>Rundowns</dt><dd>{workspace.rundowns.length ? `${workspace.rundowns.length} available` : "No rundown selected yet"}</dd></div>
            <div><dt>Cues</dt><dd>{cueCount ? `${cueCount} cue source${cueCount === 1 ? "" : "s"} available via selected rundown list` : "Open Rundown to build cues"}</dd></div>
            <div><dt>Presentation</dt><dd>{configurationLabel(production)}</dd></div>
            <div><dt>Live / rehearsal</dt><dd>Open Rehearse or Run to inspect execution sessions.</dd></div>
          </dl>
          <div className="production-summary__actions">
            <PrimaryAction onClick={() => workspace.openPrepare(production.id)}>Open Prepare</PrimaryAction>
            <SecondaryAction onClick={() => workspace.openRundown(production.id)}>Open Rundown</SecondaryAction>
            <SecondaryAction onClick={() => workspace.openViewer(production.id)}>Open Viewer</SecondaryAction>
            <SecondaryAction onClick={() => workspace.openRehearse(production.id)}>Open Rehearse</SecondaryAction>
            <SecondaryAction onClick={() => workspace.openRun(production.id)}>Open Run</SecondaryAction>
            <SecondaryAction onClick={() => workspace.duplicateProduction(production.id)} disabled={workspace.pending}>Duplicate</SecondaryAction>
          </div>
        </div>
      ) : (
        <EmptyState heading="No production selected" description="Select a production from the catalogue, or create a new one in the lower panel." />
      )}
    </WorkspacePanel>
  );
}

export function ProductionsHome(props: ProductionsWorkspaceProps) {
  const workspace = useProductionsWorkspace(props);
  return <ProductionsCataloguePanel workspace={workspace} />;
}
