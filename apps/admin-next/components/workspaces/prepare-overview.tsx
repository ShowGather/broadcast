"use client";

import { useAdminState } from "@/lib/admin-state";
import { ThreeColumnWorkspace } from "@/components/ui/three-column-workspace";
import { WorkspacePanel } from "@/components/ui/workspace-panel";
import { PrimaryAction, SecondaryAction } from "@/components/ui/action-buttons";

export function PrepareOverview() {
  const { productionId, rundownId, navigate, mutate, showConfig, rundownEditor, selectedProduction, rundowns, refreshRundowns, setRundownId } = useAdminState();
  const disabledCueCount = rundownEditor.rundownDefinition.filter((c) => !c.enabled).length;

  const createProduction = async () => {
    const result = await mutate(`/api/channels/${useAdminState().channelId}/productions`, "POST", { title: showConfig.productionTitle || "New production" }, "Production created");
    if (result?.id) navigate(`/admin/productions/${encodeURIComponent(result.id)}/prepare`);
  };
  const duplicateProduction = async () => {
    if (!productionId) return;
    const result = await mutate(`/api/productions/${productionId}/duplicate`, "POST", {}, "Production duplicated");
    if (result?.id) navigate(`/admin/productions/${encodeURIComponent(result.id)}/prepare`);
  };

  const left = (
    <WorkspacePanel heading="Prepare" hint="Choose a workspace to prepare your production.">
      <nav className="prepare-nav" role="navigation" aria-label="Prepare workspaces">
        {(["overview", "rundown", "viewer", "configuration"] as const).map((tab) => (
          <button key={tab} type="button" className={`prepare-nav__item ${tab === "overview" ? "prepare-nav__item--active" : ""}`}
            onClick={() => navigate(tab === "overview" ? `/admin/productions/${encodeURIComponent(productionId)}/prepare` : `/admin/productions/${encodeURIComponent(productionId)}/${tab}`)}>
            {tab === "configuration" ? "Show Configuration" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>
      <div style={{ marginTop: 16 }}>
        <h3 style={{ color: "#dbe8f8", fontSize: ".85rem", marginBottom: 8 }}>Current production</h3>
        <p className="hint">{showConfig.productionTitle || "Untitled production"}</p>
        <p className="hint">{rundownId ? `Rundown: ${rundownEditor.rundownName || "Unnamed"}` : "No rundown selected"}</p>
      </div>
    </WorkspacePanel>
  );

  const centre = (
    <WorkspacePanel heading="Production editor">
      <div className="form">
        <label><span>Title</span><input value={showConfig.productionTitle} onChange={(e) => showConfig.setProductionTitle(e.target.value)} /></label>
        <label><span>Description</span><input value={showConfig.productionDescription} onChange={(e) => showConfig.setProductionDescription(e.target.value)} /></label>
        <label><span>Status</span>
          <select value={showConfig.productionStatus} onChange={(e) => showConfig.setProductionStatus(e.target.value)}>
            <option value="draft">Draft</option><option value="rehearsal">Rehearsal</option><option value="live">Live</option><option value="complete">Complete</option><option value="archived">Archived</option>
          </select>
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <PrimaryAction onClick={createProduction}>Create production</PrimaryAction>
          <PrimaryAction disabled={!productionId} onClick={() => mutate(`/api/productions/${productionId}`, "PUT", { title: showConfig.productionTitle, description: showConfig.productionDescription, status: showConfig.productionStatus }, "Production saved", showConfig.reloadProduction)}>Save production</PrimaryAction>
          <SecondaryAction disabled={!productionId} onClick={duplicateProduction}>Duplicate production</SecondaryAction>
        </div>
      </div>
    </WorkspacePanel>
  );

  const right = (
    <WorkspacePanel heading="Show readiness" variant="readiness">
      <ul className="readiness-list">
        <li className={showConfig.productionTitle.trim() ? "ready" : "attention"}>{showConfig.productionTitle.trim() ? "Production details ready" : "Add production details"}</li>
        <li className={selectedProduction?.configuration ? "ready" : "attention"}>{selectedProduction?.configuration ? "Show configuration selected" : "Select or create show configuration"}</li>
        <li className={rundownId ? "ready" : "attention"}>{rundownId ? `Rundown created${rundownEditor.rundownDefinition.length ? ` \u00B7 ${rundownEditor.rundownDefinition.length} cues` : " \u00B7 add cues"}` : "Create a rundown"}</li>
        <li className={disabledCueCount === 0 ? "ready" : "attention"}>{disabledCueCount === 0 ? "No disabled cues" : `${disabledCueCount} disabled cue${disabledCueCount === 1 ? "" : "s"}`}</li>
        <li className="attention">No rehearsal completed yet</li>
      </ul>
      <PrimaryAction disabled={!productionId || !rundownId} onClick={() => navigate(`/admin/productions/${encodeURIComponent(productionId)}/rehearse`)}>Open rehearsal</PrimaryAction>
    </WorkspacePanel>
  );

  return <ThreeColumnWorkspace left={left} centre={centre} right={right} />;
}
