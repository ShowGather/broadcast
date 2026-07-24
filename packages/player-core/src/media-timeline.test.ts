import assert from "node:assert/strict";
import test from "node:test";
import { advanceMediaTimeline, seekMediaTimeline, type ActiveEvent, type ScheduledEvent } from "./media-timeline.js";

const event = (overrides: Partial<ScheduledEvent<string>> = {}): ScheduledEvent<string> => ({
  eventId: "evt-1",
  targetPts: 10,
  durationMs: 5_000,
  payload: "test",
  ...overrides,
});

test("fires when the media playhead reaches the target PTS", () => {
  const result = advanceMediaTimeline([event()], [], 10);

  assert.deepEqual(result.fired.map((item) => item.eventId), ["evt-1"]);
  assert.equal(result.queue.length, 0);
  assert.equal(result.active.length, 1);
  assert.equal(result.active[0]?.expiresAtPts, 15);
});

test("retains a future event in the queue", () => {
  const result = advanceMediaTimeline([event()], [], 9.999);

  assert.equal(result.fired.length, 0);
  assert.equal(result.queue.length, 1);
  assert.equal(result.active.length, 0);
});

test("expires an active item from media time rather than wall-clock time", () => {
  const active: ActiveEvent<ScheduledEvent<string>>[] = [{ ...event(), expiresAtPts: 15 }];

  assert.equal(advanceMediaTimeline([], active, 14.999).active.length, 1);
  assert.equal(advanceMediaTimeline([], active, 15).active.length, 0);
});

test("acknowledges a late event without displaying an already-expired item", () => {
  const result = advanceMediaTimeline([event()], [], 16);

  assert.equal(result.fired.length, 1);
  assert.equal(result.active.length, 0);
});

test("seek policy removes past queued events and media-expired items", () => {
  const active: ActiveEvent<ScheduledEvent<string>>[] = [{ ...event(), expiresAtPts: 15 }];
  const result = seekMediaTimeline([event(), event({ eventId: "evt-2", targetPts: 20 })], active, 16);

  assert.deepEqual(result.queue.map((item) => item.eventId), ["evt-2"]);
  assert.equal(result.active.length, 0);
});
