import type { useShowConfiguration } from "../hooks/useShowConfiguration.js";
import { useAdminState } from "./AdminStateContext.js";
import { ThreeColumnWorkspace } from "./layout/ThreeColumnWorkspace.js";
import { WorkspacePanel } from "./ui/WorkspacePanel.js";
import { PrimaryAction, SecondaryAction } from "./ui/ActionButtons.js";
import { EmptyState } from "./ui/EmptyState.js";

interface Props {
  showConfig: ReturnType<typeof useShowConfiguration>;
}

export function ShowConfigurationWorkspace({ showConfig }: Props) {
  const { productionId, channelId, mutate } = useAdminState();

  const left = (
    <WorkspacePanel heading="Reusable configurations">
      <p className="hint" style={{ marginBottom: 12 }}>
        Saved packages can be copied into any production. Changing a package never rewrites an existing production.
      </p>

      {showConfig.configurations.length === 0 ? (
        <EmptyState
          heading="No saved configurations"
          description="Create a reusable configuration in the editor, then save it here."
        />
      ) : (
        <ul className="placement-summary">
          {showConfig.configurations.map((config) => (
            <li key={config.id}>
              <span><b>{config.name}</b></span>
              <button onClick={() => { showConfig.setConfigurationName(config.name); }}>Load</button>
            </li>
          ))}
        </ul>
      )}
    </WorkspacePanel>
  );

  const centre = (
    <WorkspacePanel heading="Configuration editor">
      <div className="form">
        <label>
          <span>Package name</span>
          <input value={showConfig.configurationName} onChange={(event) => showConfig.setConfigurationName(event.target.value)} />
        </label>
        <label>
          <span>Home team</span>
          <input maxLength={20} value={showConfig.homeTeam} onChange={(event) => showConfig.setHomeTeam(event.target.value)} />
        </label>
        <label>
          <span>Away team</span>
          <input maxLength={20} value={showConfig.awayTeam} onChange={(event) => showConfig.setAwayTeam(event.target.value)} />
        </label>
        <label>
          <span>Ticker label</span>
          <input maxLength={12} value={showConfig.tickerLabel} onChange={(event) => showConfig.setTickerLabel(event.target.value)} />
        </label>
        <label>
          <span>Programme title</span>
          <input maxLength={80} value={showConfig.programmeTitle} onChange={(event) => showConfig.setProgrammeTitle(event.target.value)} placeholder="Saturday Match" />
        </label>
        <label>
          <span>Programme subtitle</span>
          <input maxLength={80} value={showConfig.programmeSubtitle} onChange={(event) => showConfig.setProgrammeSubtitle(event.target.value)} placeholder="Live from the stadium" />
        </label>
        <label>
          <span>Live label</span>
          <input maxLength={80} value={showConfig.liveLabel} onChange={(event) => showConfig.setLiveLabel(event.target.value)} />
        </label>
        <label>
          <span>Accent</span>
          <input pattern="#[0-9a-fA-F]{6}" value={showConfig.accent} onChange={(event) => showConfig.setAccent(event.target.value)} />
        </label>

        <fieldset className="panel-options">
          <legend>Mobile companion panels</legend>
          {(["match", "info", "partners", "interact"] as const).map((panel) => (
            <label key={panel}>
              <input
                type="checkbox"
                checked={showConfig.enabledPanels.includes(panel)}
                onChange={() => showConfig.setEnabledPanels((current) => current.includes(panel) ? current.filter((item) => item !== panel) : [...current, panel])}
              /> {panel}
            </label>
          ))}
        </fieldset>

        <fieldset className="panel-options">
          <legend>Companion tab labels</legend>
          <label><span>Match</span><input maxLength={30} value={showConfig.matchPanelLabel} onChange={(event) => showConfig.setMatchPanelLabel(event.target.value)} /></label>
          <label><span>Info</span><input maxLength={30} value={showConfig.infoPanelLabel} onChange={(event) => showConfig.setInfoPanelLabel(event.target.value)} /></label>
          <label><span>Partners</span><input maxLength={30} value={showConfig.partnersPanelLabel} onChange={(event) => showConfig.setPartnersPanelLabel(event.target.value)} /></label>
          <label><span>Interact</span><input maxLength={30} value={showConfig.interactPanelLabel} onChange={(event) => showConfig.setInteractPanelLabel(event.target.value)} /></label>
        </fieldset>

        <PrimaryAction onClick={() => mutate(
          `/api/channels/${productionId}/show-configurations`,
          "POST",
          { name: showConfig.configurationName, configuration: showConfig.currentShowConfiguration() },
          "Show configuration saved",
          showConfig.reloadConfigurations
        )}>
          Save reusable configuration
        </PrimaryAction>
      </div>
    </WorkspacePanel>
  );

  const right = (
    <WorkspacePanel heading="Configuration summary" variant="readiness">
      <dl style={{ display: "grid", gap: 10 }}>
        <div style={{ padding: 10, border: "1px solid #3b4c63", borderRadius: 6, background: "#111a27" }}>
          <dt style={{ color: "#aeb9c9", fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".06em" }}>Package</dt>
          <dd style={{ margin: "4px 0 0", color: "#f4f8ff", fontSize: ".86rem" }}>{showConfig.configurationName}</dd>
        </div>
        <div style={{ padding: 10, border: "1px solid #3b4c63", borderRadius: 6, background: "#111a27" }}>
          <dt style={{ color: "#aeb9c9", fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".06em" }}>Teams</dt>
          <dd style={{ margin: "4px 0 0", color: "#f4f8ff", fontSize: ".86rem" }}>{showConfig.homeTeam} vs {showConfig.awayTeam}</dd>
        </div>
        <div style={{ padding: 10, border: "1px solid #3b4c63", borderRadius: 6, background: "#111a27" }}>
          <dt style={{ color: "#aeb9c9", fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".06em" }}>Instances</dt>
          <dd style={{ margin: "4px 0 0", color: "#f4f8ff", fontSize: ".86rem" }}>{showConfig.presentationInstances.length} configured</dd>
        </div>
        <div style={{ padding: 10, border: "1px solid #3b4c63", borderRadius: 6, background: "#111a27" }}>
          <dt style={{ color: "#aeb9c9", fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".06em" }}>Layouts</dt>
          <dd style={{ margin: "4px 0 0", color: "#f4f8ff", fontSize: ".86rem" }}>{showConfig.presentationLayouts.length} defined</dd>
        </div>
      </dl>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ color: "#dbe8f8", fontSize: ".85rem", marginBottom: 8 }}>Copy into production</h3>
        <p className="hint" style={{ marginBottom: 8 }}>
          Packages are copied into a production deliberately. Changing a package never rewrites an existing production.
        </p>
        <div className="form">
          <label>
            <span>Choose a saved package</span>
            <select onChange={(event) => {
              if (event.target.value) {
                mutate(
                  `/api/productions/${productionId}/copy-configuration`,
                  "POST",
                  { configurationId: event.target.value },
                  "Configuration copied into production",
                  showConfig.reloadProduction
                );
              }
            }} defaultValue="">
              <option value="">Choose a saved package</option>
              {showConfig.configurations.map((configuration) => (
                <option key={configuration.id} value={configuration.id}>{configuration.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <PrimaryAction
        disabled={!productionId}
        onClick={() => mutate(
          `/api/productions/${productionId}`,
          "PUT",
          { configuration: showConfig.currentShowConfiguration() },
          "Production presentation saved",
          showConfig.reloadProduction
        )}
        style={{ marginTop: 16 }}
      >
        Save into this production
      </PrimaryAction>
    </WorkspacePanel>
  );

  return <ThreeColumnWorkspace left={left} centre={centre} right={right} />;
}
