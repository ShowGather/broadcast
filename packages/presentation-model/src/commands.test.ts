import assert from "node:assert/strict";
import test from "node:test";
import { resolvePresentationCommand } from "./commands.js";

test("an instance-targeted programme clock resolves to the clock layer", () => {
  const command = resolvePresentationCommand({ id: "clock-1", p: { k: "clock", t: "78:42", l: "LIVE", i: "programme-clock" } }, 42)[0];
  assert.deepEqual(command, {
    action: "activate", eventId: "clock-1:clock", targetPts: 42, region: "video.overlay", layer: "clock", instanceId: "programme-clock", priority: 15,
    item: { kind: "clock", time: "78:42", label: "LIVE" },
  });
});
