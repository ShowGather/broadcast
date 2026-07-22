import assert from "node:assert/strict";
import test from "node:test";
import { adminPath, parseAdminRoute } from "./routing.js";

test("Admin workspace routes recover production context", () => {
  assert.deepEqual(parseAdminRoute("/admin/productions/demo/prepare"), { workspace: "prepare", productionId: "demo", prepareTab: "overview" });
  assert.deepEqual(parseAdminRoute("/admin/productions/demo/prepare", "?tab=rundown"), { workspace: "prepare", productionId: "demo", prepareTab: "rundown" });
  assert.deepEqual(parseAdminRoute("/admin/productions/demo/rehearse"), { workspace: "rehearse", productionId: "demo" });
  assert.deepEqual(parseAdminRoute("/admin/productions/demo/run/"), { workspace: "run", productionId: "demo" });
  assert.equal(adminPath({ workspace: "run", productionId: "demo show" }), "/admin/productions/demo%20show/run");
  assert.equal(adminPath({ workspace: "prepare", productionId: "demo", prepareTab: "viewer" }), "/admin/productions/demo/prepare?tab=viewer");
});

test("invalid Admin routes return to production selection", () => {
  assert.deepEqual(parseAdminRoute("/"), { workspace: "productions" });
  assert.deepEqual(parseAdminRoute("/admin/productions/missing"), { workspace: "productions" });
});
