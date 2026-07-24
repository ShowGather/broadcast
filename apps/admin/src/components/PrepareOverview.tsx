import type { useShowConfiguration } from "../hooks/useShowConfiguration.js";
import type { useRundownEditor } from "../hooks/useRundownEditor.js";
import { useAdminState } from "./AdminStateContext.js";
import { ThreeColumnWorkspace } from "./layout/ThreeColumnWorkspace.js";
import { WorkspacePanel } from "./ui/WorkspacePanel.js";
import { PrimaryAction, SecondaryAction } from "./ui/ActionButtons.js";

interface Props {
  showConfig: ReturnType<typeof useShowConfiguration>;
  rundownEditor: ReturnType<typeof useRundownEditor>;
  selectedProduction: { configuration?: unknown } | undefined;
  disabledCueCount: number;
  createProduction: () => Promise<void>;
  duplicateProduction: () => Promise<void>;
  onNavigate: (tab: string) => void;
}

export function PrepareOverview({ showConfig, rundownEditor, selectedProduction, disabledCueCount, createProduction, duplicateProduction, onNavigate }: Props) {
  const { productionId, rundownId, navigate, mutate } = useAdminState();

  const left = (
    <WorkspacePanel heading="Prepare" hint="Choose a workspace to prepare your production.">
      <nav className="prepare-nav" role="navigation" aria-label="Prepare workspaces">
        <button
          type="button"
          className="prepare-nav__item prepare-nav__item--active"
          onClick={() => onNavigate("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className="prepare-nav__item"
          onClick={() => onNavigate("rundown")}
        >
          Rundown
        </button>
        <button
          type="button"
          className="prepare-nav__item"
          onClick={() => onNavigate("viewer")}
        >
          Viewer
        </button>
        <button
          type="button"
          className="prepare-nav__item"
          onClick={() => onNavigate("configuration")}
        >
          Show Configuration
        </button>
      </nav>

      <div className="prepare-context" style={{ marginTop: 16 }}>
        <h3 style={{ color: "#dbe8f8", fontSize: ".85rem", marginBottom: 8 }}>Current production</h3>
        <p className="hint">
          {showConfig.productionTitle || "Untitled production"}
        </p>
        <p className="hint">
          {rundownId ? `Rundown: ${rundownEditor.rundownName || "Unnamed"}` : "No rundown selected"}
        </p>
      </div>
    </WorkspacePanel>
  );

  const centre = (
    <WorkspacePanel heading="Production editor">
      <div className="form">
        <label>
          <span>Title</span>
          <input
            value={showConfig.productionTitle}
            onChange={(event) => showConfig.setProductionTitle(event.target.value)}
          />
        </label>
        <label>
          <span>Description</span>
          <input
            value={showConfig.productionDescription}
            onChange={(event) => showConfig.setProductionDescription(event.target.value)}
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={showConfig.productionStatus}
            onChange={(event) => showConfig.setProductionStatus(event.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="rehearsal">Rehearsal</option>
            <option value="live">Live</option>
            <option value="complete">Complete</option>
            <option value="archived">Archived</option>
          </select>
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <PrimaryAction onClick={() => createProduction()}>
            Create production
          </PrimaryAction>
          <PrimaryAction
            disabled={!productionId}
            onClick={() => mutate(
              `/api/productions/${productionId}`,
              "PUT",
              { title: showConfig.productionTitle, description: showConfig.productionDescription, status: showConfig.productionStatus },
              "Production saved",
              showConfig.reloadProduction
            )}
          >
            Save production
          </PrimaryAction>
          <SecondaryAction disabled={!productionId} onClick={duplicateProduction}>
            Duplicate production
          </SecondaryAction>
        </div>
      </div>
    </WorkspacePanel>
  );

  const right = (
    <WorkspacePanel heading="Show readiness" variant="readiness">
      <ul style={{ display: "grid", gap: 10, margin: "0 0 18px", padding: 0, listStyle: "none" }}>
        <li className={showConfig.productionTitle.trim() ? "ready" : "attention"}>
          {showConfig.productionTitle.trim() ? "Production details ready" : "Add production details"}
        </li>
        <li className={selectedProduction?.configuration ? "ready" : "attention"}>
          {selectedProduction?.configuration ? "Show configuration selected" : "Select or create show configuration"}
        </li>
        <li className={rundownId ? "ready" : "attention"}>
          {rundownId
            ? `Rundown created${rundownEditor.rundownDefinition.length ? ` · ${rundownEditor.rundownDefinition.length} cues` : " · add cues"}`
            : "Create a rundown"}
        </li>
        <li className={disabledCueCount === 0 ? "ready" : "attention"}>
          {disabledCueCount === 0 ? "No disabled cues" : `${disabledCueCount} disabled cue${disabledCueCount === 1 ? "" : "s"}`}
        </li>
        <li className="attention">No rehearsal completed yet</li>
      </ul>

      <PrimaryAction
        disabled={!productionId || !rundownId}
        onClick={() => navigate({ workspace: "rehearse", productionId })}
      >
        Open rehearsal
      </PrimaryAction>
    </WorkspacePanel>
  );

  return <ThreeColumnWorkspace left={left} centre={centre} right={right} />;
}
