import assert from "node:assert/strict";
import test from "node:test";
import { createPresentationState, type PresentationSnapshot } from "@showgather/presentation-model";
import { PersistentRevisionGate } from "./persistent-revision.js";

function snapshot(revision: number): PresentationSnapshot {
  return { revision, state: createPresentationState() };
}

test("a live durable cue prevents an older in-flight snapshot from replacing state", () => {
  const gate = new PersistentRevisionGate();
  assert.equal(gate.applyEvent(2).applyPersistent, true);
  assert.equal(gate.applySnapshot(snapshot(1)), false);
  assert.equal(gate.currentRevision(), 2);
});

test("a snapshot hydrates first load and suppresses its duplicate timed event", () => {
  const gate = new PersistentRevisionGate();
  assert.equal(gate.applySnapshot(snapshot(4)), true);
  assert.deepEqual(gate.applyEvent(4), { applyPersistent: false, needsRecovery: false });
});

test("a revision gap accepts the live cue and requests an equal-or-newer recovery snapshot", () => {
  const gate = new PersistentRevisionGate();
  assert.deepEqual(gate.applyEvent(3), { applyPersistent: true, needsRecovery: true });
  assert.equal(gate.applySnapshot(snapshot(2)), false);
  assert.equal(gate.applySnapshot(snapshot(3)), true);
});
