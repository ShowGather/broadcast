import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminStateContext, type AdminStateValue } from "./components/AdminStateContext.js";
import { PrepareNavigationPanel, PrepareProductionEditor, PrepareReadinessPanel, PrepareSummaryPanel } from "./components/PrepareOverview.js";
import { ProductionDraftPanel, ProductionsCataloguePanel, ProductionsFilterPanel, ProductionSummaryPanel, productionVisibleInFilter } from "./components/ProductionsHome.js";
import { RehearsalCueStackPanel, RehearsalProgrammeStage, executeRehearsalCue, rehearsalGoDisabledReason } from "./components/RehearseWorkspace.js";
import { RunOperationsPanel, RunProgrammeStage, executeLiveCue, liveGoDisabledReason } from "./components/RunWorkspaceSection.js";
import { ConfigurationActionsPanel, ConfigurationEditorPanel, ConfigurationLibraryPanel, ConfigurationSummaryPanel, validateConfigurationDraft } from "./components/ShowConfigurationWorkspace.js";
import type { RundownCue } from "./types.js";

test("AdminStateContext exports expected interface shape", async () => {
  const mod = await import("./components/AdminStateContext.js");
  assert.equal(typeof mod.AdminStateContext, "object", "AdminStateContext should be a React context object");
  assert.equal(typeof mod.useAdminState, "function", "useAdminState should be an exported function");
});

test("all workspace components export named functions", async () => {
  const components = [
    "./components/AdminHeader.js",
    "./components/AdminContext.js",
    "./components/WorkspaceNavigation.js",
    "./components/ProductionsHome.js",
    "./components/PrepareOverview.js",
    "./components/RundownWorkspace.js",
    "./components/ViewerWorkspace.js",
    "./components/ShowConfigurationWorkspace.js",
    "./components/RehearseWorkspace.js",
    "./components/RunWorkspaceSection.js",
    "./components/DiagnosticsPanel.js",
    "./components/LegacyOverlay.js",
    "./components/layout/AdminShell.js",
  ];
  for (const path of components) {
    const mod = await import(path);
    const named = Object.keys(mod).filter((key) => key !== "default");
    assert.ok(named.length > 0, `${path} should export at least one named function`);
  }
});

test("all hooks export named functions", async () => {
  const hooks = [
    "./hooks/useSystemHealth.js",
    "./hooks/useAdminSelectors.js",
    "./hooks/useEventDispatch.js",
    "./hooks/useCommandBuilder.js",
    "./hooks/useRundownEditor.js",
    "./hooks/useShowConfiguration.js",
    "./hooks/useRunWorkspace.js",
  ];
  for (const path of hooks) {
    const mod = await import(path);
    const named = Object.keys(mod).filter((key) => key !== "default");
    assert.ok(named.length > 0, `${path} should export at least one named function`);
  }
});

test("types module imports without error", async () => {
  await import("./types.js");
});

const rehearsalCue: RundownCue = { id: "cue-1", label: "Opening score", order: 1, enabled: true, status: "pending" };
const rehearsalUi = {
  selectedCueId: "cue-1", setSelectedCueId: () => {}, selectedCue: rehearsalCue, selectedIndex: 0,
  currentCue: rehearsalCue, previousCue: null, nextCue: null, result: null, executing: false,
  go: async () => {}, reset: async () => {},
};

test("Rehearse stage is explicitly non-live and central preview content", () => {
  const html = renderToStaticMarkup(createElement(RehearsalProgrammeStage, { ui: rehearsalUi, previewProfile: "desktop", playerPreviewUrl: "" }));
  assert.match(html, /REHEARSAL — NOT LIVE/);
  assert.match(html, /16:9 rehearsal monitor/);
});

test("Rehearsal cue stack exposes rehearsal-only GO and no live GO label", () => {
  const html = renderToStaticMarkup(createElement(RehearsalCueStackPanel, { ui: rehearsalUi, rundown: [rehearsalCue], rundownId: "rundown-1", returnToPrepare: () => {} }));
  assert.match(html, /GO IN REHEARSAL/);
  assert.doesNotMatch(html, />GO</);
});

test("Rehearsal GO handler is called once and disabled reasons remain explicit", async () => {
  let calls = 0;
  await executeRehearsalCue(rehearsalCue, async () => { calls += 1; return { success: "Rehearsal complete" }; });
  assert.equal(calls, 1);
  assert.equal(rehearsalGoDisabledReason(null, false, "rundown-1"), "Select a cue from the rehearsal stack.");
  assert.equal(rehearsalGoDisabledReason(rehearsalCue, false, ""), "Choose a rundown before rehearsing.");
});

const liveCue: RundownCue = { id: "live-cue-1", label: "Home goal", order: 3, enabled: true, status: "pending" };
const liveRunWorkspace = {
  runReady: true, going: false, runCueIndex: 0, setRunCueIndex: () => {}, runCue: liveCue, nextRunCue: null,
  confirmation: null, setConfirmation: () => {}, confirmationButton: { current: null },
  goCue: async () => ({ success: "Live rundown: Home goal dispatched" }), enterRun: async () => ({}), confirmSessionAction: async () => ({}),
};

test("Run stage is visibly LIVE and leaves GO out of the programme preview", () => {
  const html = renderToStaticMarkup(createElement(RunProgrammeStage, { sessionId: "live-session", rundown: [liveCue], events: [], outbox: [], programmePreviewUrl: "", runWorkspace: liveRunWorkspace }));
  assert.match(html, /LIVE/);
  assert.match(html, /16:9 live programme monitor/);
  assert.doesNotMatch(html, />GO</);
});

test("Run operational panel exposes only live controls and existing safety actions", () => {
  const html = renderToStaticMarkup(createElement(RunOperationsPanel, { rundownId: "rundown-1", rundown: [liveCue], unresolvedOutbox: [], runWorkspace: liveRunWorkspace }));
  assert.match(html, />GO</);
  assert.doesNotMatch(html, /GO IN REHEARSAL/);
  assert.match(html, /Safe Clear/);
  assert.match(html, /Complete show/);
  assert.match(html, /Abandon session/);
  assert.match(html, /Reset live session/);
});

test("Run GO handler invokes the live pathway once and durable delivery blocks it explicitly", async () => {
  let calls = 0;
  await executeLiveCue(liveCue, async () => { calls += 1; return {}; });
  assert.equal(calls, 1);
  assert.equal(liveGoDisabledReason({ runReady: true, unresolvedOutbox: [{ id: "outbox-1", eventId: "event-1", revision: 15, label: "Home goal", status: "failed", retryable: true, cancellable: true }], cue: liveCue, going: false }), "1 durable delivery issue is unresolved. Resolve it before taking another live cue.");
  assert.equal(liveGoDisabledReason({ runReady: true, unresolvedOutbox: [], cue: liveCue, going: true }), "Live cue dispatch is in progress.");
});

const configurationDraft = {
  name: "Sports Standard",
  homeTeam: "England",
  awayTeam: "France",
  tickerLabel: "LIVE",
  programmeTitle: "Cup Final 2026",
  programmeSubtitle: "Live from Oakhaven Stadium",
  liveLabel: "LIVE",
  accent: "#73e3ff",
  enabledPanels: ["match", "info", "partners", "interact"],
  panelLabels: { match: "Match", info: "Info", partners: "Partners", interact: "Interact" },
  presentationInstances: [{ id: "scorebug-main" }],
  presentationLayouts: [{ instanceId: "scorebug-main" }],
};

function configurationWorkspaceMock(overrides: Record<string, unknown> = {}) {
  return {
    configurations: [
      { id: "config-1", name: "Sports Standard", configuration: { homeTeam: "England" } },
      { id: "config-2", name: "Awards Night", configuration: { homeTeam: "Stage" } },
    ],
    selectedConfiguration: { id: "config-1", name: "Sports Standard", configuration: { homeTeam: "England" } },
    selectedConfigurationId: "config-1",
    setSelectedConfigurationId: () => {},
    draft: configurationDraft,
    updateDraft: () => {},
    updatePanelLabel: () => {},
    togglePanel: () => {},
    validationErrors: [],
    productionId: "production-1",
    productionName: "Cup Final 2026",
    productionHasConfiguration: true,
    createConfiguration: async () => {},
    saveConfiguration: async () => {},
    duplicateConfiguration: async () => {},
    copyIntoProduction: async () => {},
    ...overrides,
  } as any;
}

test("Show Configuration library renders reusable configuration list", () => {
  const html = renderToStaticMarkup(createElement(ConfigurationLibraryPanel, { workspace: configurationWorkspaceMock() }));
  assert.match(html, /Sports Standard/);
  assert.match(html, /Awards Night/);
  assert.match(html, /Create configuration/);
});

test("Show Configuration selection state drives summary and editor draft", () => {
  const first = renderToStaticMarkup(createElement(ConfigurationEditorPanel, { workspace: configurationWorkspaceMock() }));
  const second = renderToStaticMarkup(createElement(ConfigurationEditorPanel, { workspace: configurationWorkspaceMock({ draft: { ...configurationDraft, name: "Awards Night", homeTeam: "Stage", awayTeam: "Audience" } }) }));
  assert.match(first, /England/);
  assert.match(second, /Stage/);
  assert.doesNotMatch(second, /England/);
});

test("Show Configuration no-selection state renders clearly", () => {
  const workspace = configurationWorkspaceMock({ selectedConfiguration: undefined, selectedConfigurationId: "" });
  const html = renderToStaticMarkup(createElement(ConfigurationSummaryPanel, { workspace }));
  assert.match(html, /No configuration selected/);
  assert.match(renderToStaticMarkup(createElement(ConfigurationEditorPanel, { workspace })), /Select a reusable configuration/);
});

test("Show Configuration action handlers are invoked once", async () => {
  let saves = 0; let duplicates = 0; let copies = 0;
  const workspace = configurationWorkspaceMock({
    saveConfiguration: async () => { saves += 1; },
    duplicateConfiguration: async () => { duplicates += 1; },
    copyIntoProduction: async () => { copies += 1; },
  });
  await workspace.saveConfiguration();
  await workspace.duplicateConfiguration();
  await workspace.copyIntoProduction();
  assert.equal(saves, 1);
  assert.equal(duplicates, 1);
  assert.equal(copies, 1);
});

test("Show Configuration copy is disabled without a valid production", () => {
  const html = renderToStaticMarkup(createElement(ConfigurationActionsPanel, { workspace: configurationWorkspaceMock({ productionId: "", productionName: "No production selected" }) }));
  assert.match(html, /Select a production before copying/);
  assert.match(html, /disabled=""/);
});

test("Show Configuration validation errors are visible", () => {
  const invalidDraft = { ...configurationDraft, name: "", accent: "blue", tickerLabel: "" };
  const errors = validateConfigurationDraft(invalidDraft as any);
  const html = renderToStaticMarkup(createElement(ConfigurationActionsPanel, { workspace: configurationWorkspaceMock({ draft: invalidDraft, validationErrors: errors }) }));
  assert.match(html, /Validation needs attention/);
  assert.match(html, /Configuration name is required/);
  assert.match(html, /Accent must be a six-digit hex colour/);
});

test("Show Configuration shell panels do not render a programme Player or duplicate Viewer placement controls", () => {
  const workspace = configurationWorkspaceMock();
  const html = [
    renderToStaticMarkup(createElement(ConfigurationSummaryPanel, { workspace })),
    renderToStaticMarkup(createElement(ConfigurationEditorPanel, { workspace })),
    renderToStaticMarkup(createElement(ConfigurationActionsPanel, { workspace })),
  ].join("");
  assert.doesNotMatch(html, /player-preview/);
  assert.doesNotMatch(html, /Open real output/);
  assert.doesNotMatch(html, /Placement and appearance/);
});

function prepareWorkspaceMock(overrides: Record<string, unknown> = {}) {
  return {
    showConfig: {
      productionTitle: "Cup Final 2026",
      setProductionTitle: () => {},
      productionDescription: "Final match",
      setProductionDescription: () => {},
      productionStatus: "rehearsal",
      setProductionStatus: () => {},
      productionScheduledStart: "2026-07-25T14:30:00.000Z",
      setProductionScheduledStart: () => {},
      productionScheduledEnd: "",
      setProductionScheduledEnd: () => {},
    },
    rundownEditor: { rundownName: "V1 Demonstration", rundownDefinition: [{ id: "cue-1" }] },
    selectedProduction: { id: "production-1", channelId: "channel-1", title: "Cup Final 2026", status: "rehearsal", configuration: { programmeTitle: "Cup Final 2026" }, scheduledStart: "2026-07-25T14:30:00.000Z" },
    channels: [{ id: "channel-1", name: "Demo Channel", slug: "demo", status: "active" }],
    rundowns: [{ id: "rundown-1", name: "V1 Demonstration", version: 1 }],
    channelId: "channel-1",
    productionId: "production-1",
    rundownId: "rundown-1",
    disabledCueCount: 0,
    apiConnection: "connected",
    streamConnection: "connected",
    createProduction: async () => {},
    duplicateProduction: async () => {},
    saveProduction: async () => {},
    onNavigatePrepareTab: () => {},
    onNavigateWorkspace: () => {},
    legacyOverlay: { title: "", setTitle: () => {}, message: "", setMessage: () => {}, duration: 5000, setDuration: () => {} },
    readiness: {
      hasProduction: true,
      hasTitle: true,
      hasRundown: true,
      cueCount: 1,
      hasCues: true,
      hasConfiguration: true,
      disabledCueCount: 0,
      apiReady: true,
      streamReady: true,
    },
    validationErrors: [],
    saving: false,
    save: async () => {},
    ...overrides,
  } as any;
}

function renderWithAdminState(element: ReturnType<typeof createElement>) {
  const state: AdminStateValue = {
    channelId: "channel-1",
    productionId: "production-1",
    rundownId: "rundown-1",
    workspace: "prepare",
    navigate: () => {},
    mutate: async () => undefined,
    send: () => {},
    status: "",
    setStatus: () => {},
    error: "",
    setError: () => {},
  };
  return renderToStaticMarkup(createElement(AdminStateContext.Provider, { value: state }, element));
}

test("Prepare summary renders for a selected production", () => {
  const html = renderToStaticMarkup(createElement(PrepareSummaryPanel, { workspace: prepareWorkspaceMock() }));
  assert.match(html, /Cup Final 2026/);
  assert.match(html, /V1 Demonstration/);
  assert.match(html, /Production configuration present/);
});

test("Prepare no-production state renders clearly", () => {
  const html = renderToStaticMarkup(createElement(PrepareSummaryPanel, { workspace: prepareWorkspaceMock({ productionId: "", selectedProduction: undefined, readiness: { ...prepareWorkspaceMock().readiness, hasProduction: false } }) }));
  assert.match(html, /No production selected/);
  assert.match(html, /Create production/);
});

test("Prepare production editor renders selected production form values", () => {
  const html = renderToStaticMarkup(createElement(PrepareProductionEditor, { workspace: prepareWorkspaceMock() }));
  assert.match(html, /Cup Final 2026/);
  assert.match(html, /Final match/);
  assert.match(html, /Save production/);
});

test("Prepare save handler invokes the existing update pathway once", async () => {
  let saves = 0;
  const workspace = prepareWorkspaceMock({ save: async () => { saves += 1; } });
  await workspace.save();
  assert.equal(saves, 1);
});

test("Prepare save disabled and pending states are explicit", () => {
  const invalid = renderToStaticMarkup(createElement(PrepareProductionEditor, { workspace: prepareWorkspaceMock({ validationErrors: ["Production title is required."] }) }));
  const pending = renderToStaticMarkup(createElement(PrepareProductionEditor, { workspace: prepareWorkspaceMock({ saving: true }) }));
  assert.match(invalid, /Production title is required/);
  assert.match(invalid, /disabled=""/);
  assert.match(pending, /Saving production/);
});

test("Prepare readiness and next actions preserve production context without live GO", () => {
  const html = renderWithAdminState(createElement(PrepareReadinessPanel, { workspace: prepareWorkspaceMock() }));
  assert.match(html, /Production details ready/);
  assert.match(html, /Open rehearsal/);
  assert.match(html, /Open Run gate/);
  assert.doesNotMatch(html, />GO</);
});

test("Prepare navigation exposes setup sections and not operational controls", () => {
  const html = renderToStaticMarkup(createElement(PrepareNavigationPanel, { workspace: prepareWorkspaceMock() }));
  assert.match(html, /Overview/);
  assert.match(html, /Rundown/);
  assert.match(html, /Viewer/);
  assert.match(html, /Show Configuration/);
  assert.doesNotMatch(html, /Safe Clear/);
});

test("Prepare legacy overlay is retained only as secondary advanced content", () => {
  const html = renderWithAdminState(createElement(PrepareReadinessPanel, { workspace: prepareWorkspaceMock() }));
  assert.match(html, /Advanced legacy overlay controls/);
  assert.match(html, /Custom legacy overlay/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(PrepareSummaryPanel, { workspace: prepareWorkspaceMock() })), /Custom legacy overlay/);
});

const productionChannel = { id: "channel-1", name: "Demo Channel", slug: "demo", status: "active" };
const productionItem = { id: "production-1", channelId: "channel-1", title: "Cup Final 2026", description: "Final match", status: "rehearsal", scheduledStart: "2026-07-25T14:30:00.000Z", configuration: { programmeTitle: "Cup Final 2026" } };
const draftProductionItem = { id: "production-2", channelId: "channel-1", title: "Community Awards", description: "", status: "draft", scheduledStart: null, configuration: null };

function productionsWorkspaceMock(overrides: Record<string, unknown> = {}) {
  return {
    channels: [productionChannel],
    productions: [productionItem, draftProductionItem],
    filteredProductions: [productionItem, draftProductionItem],
    rundowns: [{ id: "rundown-1", name: "V1 Demonstration", version: 1 }],
    channelId: "channel-1",
    productionId: "production-1",
    selectedProduction: productionItem,
    selectedChannel: productionChannel,
    statusFilter: "all",
    setStatusFilter: () => {},
    statuses: ["draft", "rehearsal"],
    draftMode: "edit",
    setDraftMode: () => {},
    draft: { title: "Cup Final 2026", description: "Final match", status: "rehearsal", scheduledStart: "2026-07-25T14:30", scheduledEnd: "" },
    updateDraft: () => {},
    validationErrors: [],
    pending: false,
    createProduction: async () => {},
    saveProduction: async () => {},
    duplicateProduction: async () => {},
    selectProduction: () => {},
    openPrepare: () => {},
    openRundown: () => {},
    openViewer: () => {},
    openRehearse: () => {},
    openRun: () => {},
    changeChannel: () => {},
    ...overrides,
  } as any;
}

test("Productions catalogue renders production cards in the centre slot", () => {
  const html = renderToStaticMarkup(createElement(ProductionsCataloguePanel, { workspace: productionsWorkspaceMock() }));
  assert.match(html, /Production catalogue/);
  assert.match(html, /Cup Final 2026/);
  assert.match(html, /Community Awards/);
  assert.match(html, /Open Prepare/);
});

test("Productions empty channel state renders clearly", () => {
  const html = renderToStaticMarkup(createElement(ProductionsCataloguePanel, { workspace: productionsWorkspaceMock({ channelId: "", selectedChannel: undefined, productions: [], filteredProductions: [] }) }));
  assert.match(html, /No channel selected/);
  assert.match(html, /Choose a channel/);
});

test("Productions channel selection invokes shared setter", () => {
  let changedTo = "";
  const workspace = productionsWorkspaceMock({
    channels: [productionChannel, { id: "channel-2", name: "Main Channel", slug: "main", status: "active" }],
    changeChannel: (id: string) => { changedTo = id; },
  });
  const html = renderToStaticMarkup(createElement(ProductionsFilterPanel, { workspace }));
  assert.match(html, /Demo Channel/);
  workspace.changeChannel("channel-2");
  assert.equal(changedTo, "channel-2");
});

test("Productions status filtering updates visible catalogue", () => {
  const html = renderToStaticMarkup(createElement(ProductionsCataloguePanel, { workspace: productionsWorkspaceMock({ statusFilter: "draft", filteredProductions: [draftProductionItem] }) }));
  assert.match(html, /Community Awards/);
  assert.doesNotMatch(html, /Cup Final 2026/);
});

test("Productions filter rule identifies stale selected production context", () => {
  assert.equal(productionVisibleInFilter(productionItem as any, "all"), true);
  assert.equal(productionVisibleInFilter(productionItem as any, "rehearsal"), true);
  assert.equal(productionVisibleInFilter(productionItem as any, "draft"), false);
  assert.equal(productionVisibleInFilter(undefined, "all"), false);
});

test("Productions selection updates selected summary", () => {
  const html = renderToStaticMarkup(createElement(ProductionSummaryPanel, { workspace: productionsWorkspaceMock({ selectedProduction: draftProductionItem, productionId: "production-2", rundowns: [] }) }));
  assert.match(html, /Community Awards/);
  assert.match(html, /Open Prepare/);
  assert.match(html, /Open Rundown/);
});

test("Productions draft panel opens new production and invokes create once", async () => {
  let creates = 0;
  const workspace = productionsWorkspaceMock({ draftMode: "create", createProduction: async () => { creates += 1; } });
  const html = renderToStaticMarkup(createElement(ProductionDraftPanel, { workspace }));
  assert.match(html, /Create production/);
  await workspace.createProduction();
  assert.equal(creates, 1);
});

test("Productions pending create state prevents duplicate requests", () => {
  const html = renderToStaticMarkup(createElement(ProductionDraftPanel, { workspace: productionsWorkspaceMock({ draftMode: "create", pending: true }) }));
  assert.match(html, /Saving/);
  assert.match(html, /disabled=""/);
});

test("Productions Open Prepare preserves production context", () => {
  let opened = "";
  const workspace = productionsWorkspaceMock({ openPrepare: (id?: string) => { opened = id ?? ""; } });
  workspace.openPrepare("production-1");
  assert.equal(opened, "production-1");
});

test("Productions duplicate action is available through existing support", async () => {
  let duplicates = 0;
  const workspace = productionsWorkspaceMock({ duplicateProduction: async () => { duplicates += 1; } });
  await workspace.duplicateProduction("production-1");
  assert.equal(duplicates, 1);
});

test("Productions panels do not duplicate Prepare controls, LegacyOverlay, or live GO", () => {
  const workspace = productionsWorkspaceMock();
  const html = [
    renderToStaticMarkup(createElement(ProductionsFilterPanel, { workspace })),
    renderToStaticMarkup(createElement(ProductionsCataloguePanel, { workspace })),
    renderToStaticMarkup(createElement(ProductionDraftPanel, { workspace })),
    renderToStaticMarkup(createElement(ProductionSummaryPanel, { workspace })),
  ].join("");
  assert.doesNotMatch(html, /Custom legacy overlay/);
  assert.doesNotMatch(html, /Advanced legacy overlay controls/);
  assert.doesNotMatch(html, />GO</);
  assert.doesNotMatch(html, /Save production/);
});
