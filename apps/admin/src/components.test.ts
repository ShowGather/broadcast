import assert from "node:assert/strict";
import test from "node:test";
import type { AdminStateValue } from "./components/AdminStateContext.js";

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
    "./components/PrepareWorkspace.js",
    "./components/RehearseWorkspace.js",
    "./components/RunWorkspaceSection.js",
    "./components/ControlSurface.js",
    "./components/DiagnosticsPanel.js",
    "./components/LegacyOverlay.js",
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
