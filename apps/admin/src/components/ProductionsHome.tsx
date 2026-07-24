import { useState } from "react";
import type { Channel, Production, Rundown } from "../types.js";
import { useAdminState } from "./AdminStateContext.js";
import { ThreeColumnWorkspace } from "./layout/ThreeColumnWorkspace.js";
import { WorkspacePanel } from "./ui/WorkspacePanel.js";
import { StatusBadge } from "./ui/StatusBadge.js";
import { EmptyState } from "./ui/EmptyState.js";
import { PrimaryAction, SecondaryAction } from "./ui/ActionButtons.js";

interface Props {
  channels: Channel[];
  productions: Production[];
  rundowns: Rundown[];
  setProductionId: (id: string) => void;
  createProduction: (fresh?: boolean) => Promise<void>;
  refreshProductions: () => Promise<void>;
}

export function ProductionsHome({ channels, productions, rundowns, setProductionId, createProduction, refreshProductions }: Props) {
  const { productionId, channelId, navigate, mutate } = useAdminState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const selectedProduction = productions.find((p) => p.id === selectedId);
  const filteredProductions = statusFilter === "all"
    ? productions
    : productions.filter((p) => p.status === statusFilter);

  const uniqueStatuses = [...new Set(productions.map((p) => p.status))];

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setProductionId(id);
  };

  const handleOpen = (id: string) => {
    setProductionId(id);
    navigate({ workspace: "prepare", productionId: id, prepareTab: "overview" });
  };

  const handleDuplicate = async (id: string) => {
    const result = await mutate(`/api/productions/${id}/duplicate`, "POST", {}, "Production duplicated");
    if (result?.id) {
      await refreshProductions();
    }
  };

  const left = (
    <WorkspacePanel heading="Productions" hint="Select a channel and filter by status.">
      <div className="form">
        <label>
          <span>Channel</span>
          <select value={channelId} onChange={(e) => {}}>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>{channel.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Status filter</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {uniqueStatuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>
        {filteredProductions.length} production{filteredProductions.length === 1 ? "" : "s"}
      </p>
    </WorkspacePanel>
  );

  const centre = (
    <WorkspacePanel heading="Production list">
      <div className="workspace-panel__header">
        <PrimaryAction onClick={() => createProduction(true)} disabled={!channelId}>
          New production
        </PrimaryAction>
      </div>

      {filteredProductions.length === 0 ? (
        <EmptyState
          heading="No productions yet"
          description="A production contains your programme details, viewer presentation, rundown, and live controls."
          action={
            <PrimaryAction onClick={() => createProduction(true)} disabled={!channelId}>
              Create your first production
            </PrimaryAction>
          }
        />
      ) : (
        <div className="production-cards">
          {filteredProductions.map((production) => {
            const productionRundowns = production.id === productionId ? rundowns : [];
            return (
              <article
                key={production.id}
                className={`production-card ${selectedId === production.id ? "production-card--selected" : ""}`}
                onClick={() => handleSelect(production.id)}
              >
                <div>
                  <StatusBadge status={production.status} />
                  <h3>{production.title}</h3>
                  <p>
                    {channels.find((channel) => channel.id === production.channelId)?.name ?? "Selected channel"}
                    {production.scheduledStart ? ` · ${new Date(production.scheduledStart).toLocaleString()}` : " · No schedule"}
                  </p>
                  <p className="hint">
                    {productionRundowns.length ? `${productionRundowns.length} rundown${productionRundowns.length === 1 ? "" : "s"}` : "No rundown created"}
                    {" · "}
                    {production.configuration ? "Show configuration selected" : "No show configuration"}
                  </p>
                </div>
                <div className="production-card__actions">
                  <PrimaryAction onClick={(e) => { e.stopPropagation(); handleOpen(production.id); }}>
                    {productionRundowns.length ? "Open" : "Continue setup"}
                  </PrimaryAction>
                  <SecondaryAction onClick={(e) => { e.stopPropagation(); handleDuplicate(production.id); }}>
                    Duplicate
                  </SecondaryAction>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </WorkspacePanel>
  );

  const right = (
    <WorkspacePanel heading="Production summary" variant="readiness">
      {selectedProduction ? (
        <div className="production-summary">
          <StatusBadge status={selectedProduction.status} />
          <h3 style={{ margin: "8px 0 4px", color: "#f3f8ff" }}>{selectedProduction.title}</h3>
          {selectedProduction.description && (
            <p className="hint">{selectedProduction.description}</p>
          )}

          <dl style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <div style={{ padding: 10, border: "1px solid #3b4c63", borderRadius: 6, background: "#111a27" }}>
              <dt style={{ color: "#aeb9c9", fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".06em" }}>Schedule</dt>
              <dd style={{ margin: "4px 0 0", color: "#f4f8ff", fontSize: ".86rem" }}>
                {selectedProduction.scheduledStart
                  ? new Date(selectedProduction.scheduledStart).toLocaleString()
                  : "Not scheduled"}
              </dd>
            </div>
            <div style={{ padding: 10, border: "1px solid #3b4c63", borderRadius: 6, background: "#111a27" }}>
              <dt style={{ color: "#aeb9c9", fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".06em" }}>Rundowns</dt>
              <dd style={{ margin: "4px 0 0", color: "#f4f8ff", fontSize: ".86rem" }}>
                {selectedProduction.id === productionId ? rundowns.length : 0} total
              </dd>
            </div>
            <div style={{ padding: 10, border: "1px solid #3b4c63", borderRadius: 6, background: "#111a27" }}>
              <dt style={{ color: "#aeb9c9", fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".06em" }}>Configuration</dt>
              <dd style={{ margin: "4px 0 0", color: "#f4f8ff", fontSize: ".86rem" }}>
                {selectedProduction.configuration ? "Configured" : "Not configured"}
              </dd>
            </div>
          </dl>

          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <PrimaryAction onClick={() => handleOpen(selectedProduction.id)}>
              {rundowns.length ? "Open" : "Continue setup"}
            </PrimaryAction>
            <SecondaryAction onClick={() => handleDuplicate(selectedProduction.id)}>
              Duplicate
            </SecondaryAction>
          </div>
        </div>
      ) : (
        <p className="hint" style={{ padding: 20, textAlign: "center" }}>
          Select a production to view its summary.
        </p>
      )}
    </WorkspacePanel>
  );

  return <ThreeColumnWorkspace left={left} centre={centre} right={right} />;
}
