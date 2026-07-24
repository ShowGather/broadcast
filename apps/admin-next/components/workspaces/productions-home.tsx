"use client";

import { useState } from "react";
import { useAdminState } from "@/lib/admin-state";
import { ThreeColumnWorkspace } from "@/components/ui/three-column-workspace";
import { WorkspacePanel } from "@/components/ui/workspace-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PrimaryAction, SecondaryAction } from "@/components/ui/action-buttons";

export function ProductionsHome() {
  const { productionId, setProductionId, channelId, channels, productions, rundowns, navigate, mutate, refreshProductions } = useAdminState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const selectedProduction = productions.find((p) => p.id === selectedId);
  const filteredProductions = statusFilter === "all" ? productions : productions.filter((p) => p.status === statusFilter);
  const uniqueStatuses = [...new Set(productions.map((p) => p.status))];

  const handleSelect = (id: string) => { setSelectedId(id); setProductionId(id); };
  const handleOpen = (id: string) => { setProductionId(id); navigate(`/admin/productions/${encodeURIComponent(id)}/prepare`); };
  const handleDuplicate = async (id: string) => {
    const result = await mutate(`/api/productions/${id}/duplicate`, "POST", {}, "Production duplicated");
    if (result?.id) await refreshProductions();
  };
  const createProduction = async () => {
    const result = await mutate(`/api/channels/${channelId}/productions`, "POST", { title: "New production" }, "Production created");
    if (result?.id) { await refreshProductions(); handleOpen(result.id); }
  };

  const left = (
    <WorkspacePanel heading="Productions" hint="Select a channel and filter by status.">
      <div className="form">
        <label><span>Channel</span>
          <select value={channelId} onChange={() => {}}>
            {channels.map((ch) => (<option key={ch.id} value={ch.id}>{ch.name}</option>))}
          </select>
        </label>
        <label><span>Status filter</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {uniqueStatuses.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </label>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>{filteredProductions.length} production{filteredProductions.length === 1 ? "" : "s"}</p>
    </WorkspacePanel>
  );

  const centre = (
    <WorkspacePanel heading="Production list">
      <div className="workspace-panel__header">
        <PrimaryAction onClick={createProduction} disabled={!channelId}>New production</PrimaryAction>
      </div>
      {filteredProductions.length === 0 ? (
        <EmptyState heading="No productions yet" description="A production contains your programme details, viewer presentation, rundown, and live controls."
          action={<PrimaryAction onClick={createProduction} disabled={!channelId}>Create your first production</PrimaryAction>} />
      ) : (
        <div className="production-cards">
          {filteredProductions.map((p) => {
            const pRundowns = p.id === productionId ? rundowns : [];
            return (
              <article key={p.id} className={`production-card ${selectedId === p.id ? "production-card--selected" : ""}`} onClick={() => handleSelect(p.id)}>
                <div>
                  <StatusBadge status={p.status} />
                  <h3>{p.title}</h3>
                  <p>{channels.find((c) => c.id === p.channelId)?.name ?? "Channel"}{p.scheduledStart ? ` \u00B7 ${new Date(p.scheduledStart).toLocaleString()}` : " \u00B7 No schedule"}</p>
                  <p className="hint">{pRundowns.length ? `${pRundowns.length} rundown${pRundowns.length === 1 ? "" : "s"}` : "No rundown created"}{" \u00B7 "}{p.configuration ? "Configured" : "Not configured"}</p>
                </div>
                <div className="production-card__actions">
                  <PrimaryAction onClick={(e) => { e.stopPropagation(); handleOpen(p.id); }}>{pRundowns.length ? "Open" : "Continue setup"}</PrimaryAction>
                  <SecondaryAction onClick={(e) => { e.stopPropagation(); handleDuplicate(p.id); }}>Duplicate</SecondaryAction>
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
        <div>
          <StatusBadge status={selectedProduction.status} />
          <h3 style={{ margin: "8px 0 4px", color: "#f3f8ff" }}>{selectedProduction.title}</h3>
          {selectedProduction.description && <p className="hint">{selectedProduction.description}</p>}
          <dl style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <div style={{ padding: 10, border: "1px solid #3b4c63", borderRadius: 6, background: "#111a27" }}>
              <dt style={{ color: "#aeb9c9", fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".06em" }}>Schedule</dt>
              <dd style={{ margin: "4px 0 0", color: "#f4f8ff", fontSize: ".86rem" }}>{selectedProduction.scheduledStart ? new Date(selectedProduction.scheduledStart).toLocaleString() : "Not scheduled"}</dd>
            </div>
            <div style={{ padding: 10, border: "1px solid #3b4c63", borderRadius: 6, background: "#111a27" }}>
              <dt style={{ color: "#aeb9c9", fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".06em" }}>Rundowns</dt>
              <dd style={{ margin: "4px 0 0", color: "#f4f8ff", fontSize: ".86rem" }}>{selectedProduction.id === productionId ? rundowns.length : 0} total</dd>
            </div>
            <div style={{ padding: 10, border: "1px solid #3b4c63", borderRadius: 6, background: "#111a27" }}>
              <dt style={{ color: "#aeb9c9", fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".06em" }}>Configuration</dt>
              <dd style={{ margin: "4px 0 0", color: "#f4f8ff", fontSize: ".86rem" }}>{selectedProduction.configuration ? "Configured" : "Not configured"}</dd>
            </div>
          </dl>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <PrimaryAction onClick={() => handleOpen(selectedProduction.id)}>{rundowns.length ? "Open" : "Continue setup"}</PrimaryAction>
            <SecondaryAction onClick={() => handleDuplicate(selectedProduction.id)}>Duplicate</SecondaryAction>
          </div>
        </div>
      ) : (
        <p className="hint" style={{ padding: 20, textAlign: "center" }}>Select a production to view its summary.</p>
      )}
    </WorkspacePanel>
  );

  return <ThreeColumnWorkspace left={left} centre={centre} right={right} />;
}
