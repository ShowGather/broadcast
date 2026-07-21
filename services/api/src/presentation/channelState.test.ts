import assert from "node:assert/strict";
import test from "node:test";
import { resolvePresentationRegion } from "@showgather/presentation-model";
import { ChannelPresentationState } from "./channelState.js";

test("late-join snapshot retains persistent score state but excludes temporary graphics", () => {
  const channel = new ChannelPresentationState();
  channel.apply({ v: 1, id: "goal-1", t: "presentation.cue", p: { cue: "goal-home" } });
  const snapshot = channel.snapshot();

  const overlay = resolvePresentationRegion(snapshot.state, "video.overlay");
  assert.equal(overlay.some((entry) => entry.layer === "scorebug"), true);
  assert.equal(overlay.some((entry) => entry.layer === "lower-third"), false);
  assert.equal(resolvePresentationRegion(snapshot.state, "right.rail")[0]?.eventId, "baseline-right-rail");
});

test("duplicate events are idempotent and safe clear is reflected in the snapshot", () => {
  const channel = new ChannelPresentationState();
  const goal = { v: 1 as const, id: "goal-1", t: "presentation.cue" as const, p: { cue: "goal-home" as const } };
  assert.equal(channel.apply(goal), true);
  assert.equal(channel.apply(goal), false);
  assert.equal(channel.snapshot().revision, 1);

  channel.apply({ v: 1, id: "clear-1", t: "presentation.clear", p: {} });
  assert.equal(channel.snapshot().revision, 2);
  assert.equal(resolvePresentationRegion(channel.snapshot().state, "video.overlay").length, 0);
  assert.equal(resolvePresentationRegion(channel.snapshot().state, "footer").length, 0);
});

test("revisions are assigned monotonically and clear followed by cue has deterministic state", () => {
  const channel = new ChannelPresentationState();
  const clear = channel.withRevision({ v: 1, id: "clear-1", t: "presentation.clear", p: {} });
  assert.equal(clear.r, 1);
  assert.equal(channel.apply(clear), true);

  const goal = channel.withRevision({ v: 1, id: "goal-2", t: "presentation.cue", p: { cue: "goal-home" } });
  assert.equal(goal.r, 2);
  assert.equal(channel.apply(goal), true);
  const visible = resolvePresentationRegion(channel.snapshot().state, "video.overlay");
  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.eventId, "goal-2:score");
});

test("configurable durable commands become late-join snapshot state", () => {
  const channel = new ChannelPresentationState();
  const ticker = channel.withRevision({ v: 1, id: "ticker-1", t: "pc", p: { k: "ticker", l: "LIVE", t: "Second half" } });
  assert.equal(ticker.r, 1);
  channel.apply(ticker);
  const footer = resolvePresentationRegion(channel.snapshot().state, "footer");
  assert.equal((footer[0]?.item as { text: string }).text, "Second half");
});
