import { useCallback, useEffect, useMemo, useState } from "react";
import type { useShowConfiguration } from "../hooks/useShowConfiguration.js";
import type { Production, ShowConfiguration } from "../types.js";
import { PrimaryAction, SecondaryAction } from "./ui/ActionButtons.js";
import { EmptyState } from "./ui/EmptyState.js";

interface ShowConfigurationShellProps {
  showConfig: ReturnType<typeof useShowConfiguration>;
  selectedProduction?: Production;
  channelId: string;
  productionId: string;
  mutate: (url: string, method: "POST" | "PUT", body: Record<string, unknown>, success: string, reload?: () => Promise<void>) => Promise<{ id?: string } | undefined>;
}

type CompanionPanel = "match" | "info" | "partners" | "interact";

interface ConfigurationDraft {
  name: string;
  homeTeam: string;
  awayTeam: string;
  tickerLabel: string;
  programmeTitle: string;
  programmeSubtitle: string;
  liveLabel: string;
  accent: string;
  enabledPanels: CompanionPanel[];
  panelLabels: Record<CompanionPanel, string>;
  presentationInstances: unknown[];
  presentationLayouts: unknown[];
}

const panels: CompanionPanel[] = ["match", "info", "partners", "interact"];
const defaultPanels: CompanionPanel[] = ["match", "info", "partners", "interact"];

const defaultDraft = (name = "Football package"): ConfigurationDraft => ({
  name,
  homeTeam: "HOME",
  awayTeam: "AWAY",
  tickerLabel: "LIVE",
  programmeTitle: "",
  programmeSubtitle: "",
  liveLabel: "LIVE",
  accent: "#73e3ff",
  enabledPanels: defaultPanels,
  panelLabels: { match: "Match", info: "Info", partners: "Partners", interact: "Interact" },
  presentationInstances: [],
  presentationLayouts: [],
});

const text = (configuration: Record<string, unknown>, key: string, fallback: string) =>
  typeof configuration[key] === "string" ? configuration[key] as string : fallback;

const draftFromConfiguration = (configuration: ShowConfiguration): ConfigurationDraft => {
  const body = configuration.configuration ?? {};
  const enabledPanels = Array.isArray(body.enabledCompanionPanels)
    ? body.enabledCompanionPanels.filter((panel): panel is CompanionPanel => panels.includes(panel as CompanionPanel))
    : defaultPanels;
  const labels = body.companionPanelLabels && typeof body.companionPanelLabels === "object" && !Array.isArray(body.companionPanelLabels)
    ? body.companionPanelLabels as Record<string, unknown>
    : {};
  return {
    name: configuration.name,
    homeTeam: text(body, "homeTeam", "HOME"),
    awayTeam: text(body, "awayTeam", "AWAY"),
    tickerLabel: text(body, "tickerLabel", "LIVE"),
    programmeTitle: text(body, "programmeTitle", ""),
    programmeSubtitle: text(body, "programmeSubtitle", ""),
    liveLabel: text(body, "liveLabel", "LIVE"),
    accent: text(body, "accent", "#73e3ff"),
    enabledPanels,
    panelLabels: {
      match: typeof labels.match === "string" ? labels.match : "Match",
      info: typeof labels.info === "string" ? labels.info : "Info",
      partners: typeof labels.partners === "string" ? labels.partners : "Partners",
      interact: typeof labels.interact === "string" ? labels.interact : "Interact",
    },
    presentationInstances: Array.isArray(body.presentationInstances) ? body.presentationInstances : [],
    presentationLayouts: Array.isArray(body.presentationLayouts) ? body.presentationLayouts : [],
  };
};

const configurationPayload = (draft: ConfigurationDraft): Record<string, unknown> => ({
  sport: "football",
  homeTeam: draft.homeTeam.trim(),
  awayTeam: draft.awayTeam.trim(),
  tickerLabel: draft.tickerLabel.trim(),
  ...(draft.programmeTitle.trim() ? { programmeTitle: draft.programmeTitle.trim() } : {}),
  ...(draft.programmeSubtitle.trim() ? { programmeSubtitle: draft.programmeSubtitle.trim() } : {}),
  ...(draft.liveLabel.trim() ? { liveLabel: draft.liveLabel.trim() } : {}),
  accent: draft.accent.trim(),
  enabledCompanionPanels: draft.enabledPanels,
  companionPanelLabels: {
    match: draft.panelLabels.match.trim() || "Match",
    info: draft.panelLabels.info.trim() || "Info",
    partners: draft.panelLabels.partners.trim() || "Partners",
    interact: draft.panelLabels.interact.trim() || "Interact",
  },
  ...(draft.presentationInstances.length ? { presentationInstances: draft.presentationInstances } : {}),
  ...(draft.presentationLayouts.length ? { presentationLayouts: draft.presentationLayouts } : {}),
});

const uniqueConfigurationName = (baseName: string, configurations: ShowConfiguration[]) => {
  const names = new Set(configurations.map((configuration) => configuration.name.trim().toLowerCase()));
  if (!names.has(baseName.trim().toLowerCase())) return baseName;
  let suffix = 2;
  let candidate = `${baseName} ${suffix}`;
  while (names.has(candidate.trim().toLowerCase())) candidate = `${baseName} ${++suffix}`;
  return candidate;
};

export const validateConfigurationDraft = (draft: ConfigurationDraft) => {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push("Configuration name is required.");
  if (!draft.homeTeam.trim() || draft.homeTeam.length > 20) errors.push("Home team must be 1-20 characters.");
  if (!draft.awayTeam.trim() || draft.awayTeam.length > 20) errors.push("Away team must be 1-20 characters.");
  if (!draft.tickerLabel.trim() || draft.tickerLabel.length > 12) errors.push("Ticker label must be 1-12 characters.");
  if (draft.programmeTitle.length > 80 || draft.programmeSubtitle.length > 80 || draft.liveLabel.length > 80) errors.push("Programme text fields must be 80 characters or fewer.");
  if (!/^#[0-9a-fA-F]{6}$/.test(draft.accent.trim())) errors.push("Accent must be a six-digit hex colour.");
  for (const panel of panels) {
    if (draft.panelLabels[panel].length > 30) errors.push(`${panel} panel label must be 30 characters or fewer.`);
  }
  return errors;
};

export function useShowConfigurationWorkspace({ showConfig, selectedProduction, channelId, productionId, mutate }: ShowConfigurationShellProps) {
  const [selectedConfigurationId, setSelectedConfigurationId] = useState("");
  const [draft, setDraft] = useState<ConfigurationDraft>(() => defaultDraft());
  const selectedConfiguration = useMemo(
    () => showConfig.configurations.find((configuration) => configuration.id === selectedConfigurationId),
    [selectedConfigurationId, showConfig.configurations]
  );

  useEffect(() => {
    if (!selectedConfigurationId) return;
    if (!selectedConfiguration) {
      setSelectedConfigurationId("");
      return;
    }
    setDraft(draftFromConfiguration(selectedConfiguration));
  }, [selectedConfiguration, selectedConfigurationId]);

  const validationErrors = useMemo(() => validateConfigurationDraft(draft), [draft]);
  const productionHasConfiguration = Boolean(selectedProduction?.configuration);
  const productionName = selectedProduction?.title ?? "No production selected";

  const updateDraft = useCallback(<K extends keyof ConfigurationDraft>(key: K, value: ConfigurationDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);

  const updatePanelLabel = useCallback((panel: CompanionPanel, value: string) => {
    setDraft((current) => ({ ...current, panelLabels: { ...current.panelLabels, [panel]: value } }));
  }, []);

  const togglePanel = useCallback((panel: CompanionPanel) => {
    setDraft((current) => ({
      ...current,
      enabledPanels: current.enabledPanels.includes(panel)
        ? current.enabledPanels.filter((item) => item !== panel)
        : [...current.enabledPanels, panel],
    }));
  }, []);

  const createConfiguration = useCallback(async () => {
    if (!channelId) return;
    const nextDraft = defaultDraft(uniqueConfigurationName("New configuration", showConfig.configurations));
    setDraft(nextDraft);
    const result = await mutate(
      `/api/channels/${channelId}/show-configurations`,
      "POST",
      { name: nextDraft.name, configuration: configurationPayload(nextDraft) },
      "Show configuration created",
      showConfig.reloadConfigurations
    );
    if (result?.id) setSelectedConfigurationId(result.id);
  }, [channelId, mutate, showConfig]);

  const saveConfiguration = useCallback(async () => {
    if (validationErrors.length || !channelId) return;
    const body = { name: draft.name.trim(), configuration: configurationPayload(draft) };
    const result = selectedConfigurationId
      ? await mutate(`/api/show-configurations/${selectedConfigurationId}`, "PUT", body, "Show configuration saved", showConfig.reloadConfigurations)
      : await mutate(`/api/channels/${channelId}/show-configurations`, "POST", body, "Show configuration saved", showConfig.reloadConfigurations);
    if (!selectedConfigurationId && result?.id) setSelectedConfigurationId(result.id);
  }, [channelId, draft, mutate, selectedConfigurationId, showConfig.reloadConfigurations, validationErrors.length]);

  const duplicateConfiguration = useCallback(async () => {
    if (validationErrors.length || !channelId || !selectedConfigurationId) return;
    const copyName = uniqueConfigurationName(`${draft.name.trim()} copy`, showConfig.configurations);
    const result = await mutate(
      `/api/channels/${channelId}/show-configurations`,
      "POST",
      { name: copyName, configuration: configurationPayload({ ...draft, name: copyName }) },
      "Show configuration duplicated",
      showConfig.reloadConfigurations
    );
    if (result?.id) setSelectedConfigurationId(result.id);
  }, [channelId, draft, mutate, selectedConfigurationId, showConfig.configurations, showConfig.reloadConfigurations, validationErrors.length]);

  const copyIntoProduction = useCallback(async () => {
    if (!productionId || !selectedConfigurationId) return;
    await mutate(
      `/api/productions/${productionId}/copy-configuration`,
      "POST",
      { configurationId: selectedConfigurationId },
      "Configuration copied into production",
      showConfig.reloadProduction
    );
  }, [mutate, productionId, selectedConfigurationId, showConfig.reloadProduction]);

  return {
    configurations: showConfig.configurations,
    selectedConfiguration,
    selectedConfigurationId,
    setSelectedConfigurationId,
    draft,
    updateDraft,
    updatePanelLabel,
    togglePanel,
    validationErrors,
    productionId,
    productionName,
    productionHasConfiguration,
    createConfiguration,
    saveConfiguration,
    duplicateConfiguration,
    copyIntoProduction,
  } as const;
}

type WorkspaceState = ReturnType<typeof useShowConfigurationWorkspace>;

export function ConfigurationLibraryPanel({ workspace }: { workspace: WorkspaceState }) {
  return <section className="configuration-library-panel" aria-label="Reusable configuration library">
    <div className="configuration-panel-heading">
      <span>Prepare</span>
      <h2>Show configurations</h2>
    </div>
    <PrimaryAction onClick={workspace.createConfiguration}>Create configuration</PrimaryAction>
    {workspace.configurations.length === 0 ? (
      <EmptyState heading="No saved configurations" description="Create a reusable package to use as a starting point for productions." />
    ) : (
      <ul className="configuration-library-list">
        {workspace.configurations.map((configuration) => (
          <li key={configuration.id} className={configuration.id === workspace.selectedConfigurationId ? "active" : ""}>
            <button type="button" onClick={() => workspace.setSelectedConfigurationId(configuration.id)}>
              <strong>{configuration.name}</strong>
              <span>{Object.keys(configuration.configuration ?? {}).length} defaults</span>
            </button>
          </li>
        ))}
      </ul>
    )}
    {!workspace.selectedConfigurationId && <p className="hint">Select a package to inspect, edit, duplicate, or copy it into the selected production.</p>}
  </section>;
}

export function ConfigurationSummaryPanel({ workspace }: { workspace: WorkspaceState }) {
  if (!workspace.selectedConfiguration) {
    return <section className="configuration-summary-panel configuration-summary-panel--empty" aria-label="Show configuration summary">
      <div className="configuration-panel-heading">
        <span>Reusable defaults</span>
        <h1>No configuration selected</h1>
      </div>
      <p>Choose or create a reusable package from the library.</p>
    </section>;
  }

  return <section className="configuration-summary-panel" aria-label="Show configuration summary">
    <div className="configuration-panel-heading">
      <span>Reusable defaults</span>
      <h1>{workspace.draft.name || "Untitled configuration"}</h1>
    </div>
    <div className="configuration-summary-grid">
      <SummaryMetric label="Teams" value={`${workspace.draft.homeTeam || "HOME"} vs ${workspace.draft.awayTeam || "AWAY"}`} />
      <SummaryMetric label="Ticker" value={workspace.draft.tickerLabel || "LIVE"} />
      <SummaryMetric label="Programme" value={workspace.draft.programmeTitle || "Default viewer title"} />
      <SummaryMetric label="Companion panels" value={workspace.draft.enabledPanels.length.toString()} />
      <SummaryMetric label="Instances" value={workspace.draft.presentationInstances.length.toString()} />
      <SummaryMetric label="Layouts" value={workspace.draft.presentationLayouts.length.toString()} />
    </div>
    <div className="configuration-impact">
      <strong>Copy destination</strong>
      <span>{workspace.productionName}</span>
      <p>
        Copying creates an independent production-owned copy. Later edits to this reusable configuration will not update the production automatically.
      </p>
      <p>{workspace.productionHasConfiguration ? "This production already has its own configuration and copy will replace it through the existing API path." : "This production does not yet have a production-owned configuration."}</p>
    </div>
  </section>;
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <div>
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>;
}

export function ConfigurationEditorPanel({ workspace }: { workspace: WorkspaceState }) {
  if (!workspace.selectedConfigurationId) {
    return <section className="configuration-editor-panel configuration-editor-panel--empty" aria-label="Configuration editor">
      <strong>Select a reusable configuration</strong>
      <span>The editor opens here without adding a programme preview or live controls.</span>
    </section>;
  }

  return <section className="configuration-editor-panel" aria-label="Configuration editor">
    <div className="configuration-editor-heading">
      <div>
        <span>Configuration editor</span>
        <h2>{workspace.draft.name || "Untitled configuration"}</h2>
      </div>
      <span>Explicit save required</span>
    </div>
    <div className="configuration-editor-grid form">
      <fieldset>
        <legend>Package</legend>
        <label><span>Name</span><input value={workspace.draft.name} onChange={(event) => workspace.updateDraft("name", event.target.value)} /></label>
      </fieldset>
      <fieldset>
        <legend>Team defaults</legend>
        <label><span>Home team</span><input maxLength={20} value={workspace.draft.homeTeam} onChange={(event) => workspace.updateDraft("homeTeam", event.target.value)} /></label>
        <label><span>Away team</span><input maxLength={20} value={workspace.draft.awayTeam} onChange={(event) => workspace.updateDraft("awayTeam", event.target.value)} /></label>
      </fieldset>
      <fieldset>
        <legend>Ticker defaults</legend>
        <label><span>Ticker label</span><input maxLength={12} value={workspace.draft.tickerLabel} onChange={(event) => workspace.updateDraft("tickerLabel", event.target.value)} /></label>
      </fieldset>
      <fieldset>
        <legend>Programme defaults</legend>
        <label><span>Programme title</span><input maxLength={80} value={workspace.draft.programmeTitle} onChange={(event) => workspace.updateDraft("programmeTitle", event.target.value)} /></label>
        <label><span>Programme subtitle</span><input maxLength={80} value={workspace.draft.programmeSubtitle} onChange={(event) => workspace.updateDraft("programmeSubtitle", event.target.value)} /></label>
        <label><span>Live label</span><input maxLength={80} value={workspace.draft.liveLabel} onChange={(event) => workspace.updateDraft("liveLabel", event.target.value)} /></label>
        <label><span>Accent</span><input value={workspace.draft.accent} onChange={(event) => workspace.updateDraft("accent", event.target.value)} /></label>
      </fieldset>
      <fieldset>
        <legend>Companion defaults</legend>
        <div className="configuration-panel-toggles">
          {panels.map((panel) => (
            <label key={panel}>
              <input type="checkbox" checked={workspace.draft.enabledPanels.includes(panel)} onChange={() => workspace.togglePanel(panel)} />
              <span>{panel}</span>
            </label>
          ))}
        </div>
        {panels.map((panel) => (
          <label key={panel}><span>{panel} label</span><input maxLength={30} value={workspace.draft.panelLabels[panel]} onChange={(event) => workspace.updatePanelLabel(panel, event.target.value)} /></label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Presentation defaults</legend>
        <dl className="configuration-inline-summary">
          <div><dt>Instances</dt><dd>{workspace.draft.presentationInstances.length}</dd></div>
          <div><dt>Layouts</dt><dd>{workspace.draft.presentationLayouts.length}</dd></div>
        </dl>
        <p className="hint">Presentation instance and layout editing remains in the Viewer workspace. Saved definitions are preserved when this package is saved or copied.</p>
      </fieldset>
    </div>
  </section>;
}

export function ConfigurationActionsPanel({ workspace }: { workspace: WorkspaceState }) {
  const copyDisabled = !workspace.productionId || !workspace.selectedConfigurationId;
  const saveDisabled = !workspace.selectedConfigurationId || workspace.validationErrors.length > 0;
  return <section className="configuration-actions-panel" aria-label="Configuration actions">
    <div className="configuration-panel-heading">
      <span>Actions</span>
      <h2>Save and copy</h2>
    </div>
    <div className="configuration-validation">
      <strong>{workspace.validationErrors.length ? "Validation needs attention" : "Validation passed"}</strong>
      {workspace.validationErrors.length ? (
        <ul>{workspace.validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>
      ) : (
        <p>Supported fields are ready to save.</p>
      )}
    </div>
    <PrimaryAction disabled={saveDisabled} onClick={workspace.saveConfiguration}>Save reusable configuration</PrimaryAction>
    <SecondaryAction disabled={!workspace.selectedConfigurationId || workspace.validationErrors.length > 0} onClick={workspace.duplicateConfiguration}>Duplicate configuration</SecondaryAction>
    <div className="configuration-copy-card">
      <strong>Copy into production</strong>
      <span>{workspace.productionName}</span>
      <p>Creates an independent production-owned copy. Later edits to this reusable configuration will not update the production automatically.</p>
      {!workspace.productionId && <p className="configuration-actions-panel__warning">Select a production before copying.</p>}
      {!workspace.selectedConfigurationId && <p className="configuration-actions-panel__warning">Select a reusable configuration before copying.</p>}
      <PrimaryAction disabled={copyDisabled} onClick={workspace.copyIntoProduction}>Copy into production</PrimaryAction>
    </div>
  </section>;
}
