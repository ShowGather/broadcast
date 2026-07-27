import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdminStateValue } from "./components/AdminStateContext.js";
import { RehearsalCueStackPanel, RehearsalProgrammeStage, executeRehearsalCue, rehearsalGoDisabledReason } from "./components/RehearseWorkspace.js";
import { RunOperationsPanel, RunProgrammeStage, executeLiveCue, liveGoDisabledReason } from "./components/RunWorkspaceSection.js";
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
