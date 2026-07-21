import assert from "node:assert/strict";
import test from "node:test";
import { encodeEvent, validateEvent } from "./index";

test("accepts a compact presentation cue", () => {
  const event = validateEvent({ v: 1, id: "evt-goal", t: "presentation.cue", p: { cue: "goal-home", dur: 15_000 } });
  assert.deepEqual(event, { v: 1, id: "evt-goal", t: "presentation.cue", p: { cue: "goal-home", dur: 15_000 } });
});

test("rejects an unknown presentation cue", () => {
  assert.equal(validateEvent({ v: 1, id: "evt-unknown", t: "presentation.cue", p: { cue: "unknown" } }), null);
});

test("accepts a compact presentation safe clear", () => {
  assert.deepEqual(validateEvent({ v: 1, id: "evt-clear", t: "presentation.clear", p: {} }), {
    v: 1, id: "evt-clear", t: "presentation.clear", p: {},
  });
});

test("keeps a goal cue within the POC ID3 payload limit", () => {
  const encoded = encodeEvent({ v: 1, id: "evt-abcdefgh", t: "presentation.cue", p: { cue: "goal-home", dur: 15_000 } });
  assert.ok(new TextEncoder().encode(encoded).byteLength <= 127);
});
