import assert from "node:assert/strict";
import test from "node:test";
import { resolvePresentationCue, resolveTimedPresentationEvent } from "./cues";

test("goal-home coordinates overlay and surround presentation regions", () => {
  const commands = resolvePresentationCue({ v: 1, id: "evt-goal", t: "presentation.cue", p: { cue: "goal-home" } }, 120.5);

  assert.deepEqual(commands.map((command) => command.region), ["video.overlay", "video.overlay", "right.rail"]);
  assert.equal(commands[1]?.durationMs, 15_000);
  assert.equal(commands[2]?.priority, 100);
});

test("a duration override is applied to all transient goal presentation", () => {
  const commands = resolvePresentationCue({ v: 1, id: "evt-goal", t: "presentation.cue", p: { cue: "goal-home", dur: 5_000 } }, 20);
  assert.equal(commands[1]?.durationMs, 5_000);
  assert.equal(commands[2]?.durationMs, 5_000);
});

test("safe clear produces a global presentation clear command", () => {
  assert.deepEqual(resolveTimedPresentationEvent({ v: 1, id: "evt-clear", t: "presentation.clear", p: {} }, 30), [
    { action: "clear", eventId: "evt-clear", targetPts: 30 },
  ]);
});
