import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPresentationCommand,
  createPresentationState,
  expirePresentationItems,
  resolvePresentationRegion,
} from "./index";

const defaultSponsor = {
  action: "activate" as const,
  eventId: "sponsor-default",
  targetPts: 100,
  region: "right.rail" as const,
  layer: "primary",
  item: { kind: "sponsor-panel" as const, brand: "ShowGather Partners" },
};

test("a temporary higher-priority takeover restores the underlying sponsor", () => {
  let state = applyPresentationCommand(createPresentationState(), defaultSponsor);
  state = applyPresentationCommand(state, {
    action: "activate",
    eventId: "goal-sponsor",
    targetPts: 110,
    region: "right.rail",
    layer: "primary",
    priority: 100,
    durationMs: 15_000,
    item: { kind: "sponsor-panel", brand: "Goal Sponsor" },
  });

  assert.equal(resolvePresentationRegion(state, "right.rail")[0]?.item.kind, "sponsor-panel");
  assert.equal((resolvePresentationRegion(state, "right.rail")[0]?.item as { brand: string }).brand, "Goal Sponsor");

  state = expirePresentationItems(state, 125);
  assert.equal((resolvePresentationRegion(state, "right.rail")[0]?.item as { brand: string }).brand, "ShowGather Partners");
});

test("separate overlay layers coexist", () => {
  let state = applyPresentationCommand(createPresentationState(), {
    action: "activate",
    eventId: "score",
    targetPts: 10,
    region: "video.overlay",
    layer: "scorebug",
    item: { kind: "scorebug", homeTeam: "HOME", homeScore: "1", awayTeam: "AWAY", awayScore: "0" },
  });
  state = applyPresentationCommand(state, {
    action: "activate",
    eventId: "lower-third",
    targetPts: 11,
    region: "video.overlay",
    layer: "lower-third",
    item: { kind: "lower-third", title: "Goal!", subtitle: "Home team scores" },
  });

  assert.deepEqual(
    resolvePresentationRegion(state, "video.overlay").map((entry) => entry.layer),
    ["lower-third", "scorebug"]
  );
});

test("a regional clear leaves other regions untouched", () => {
  let state = applyPresentationCommand(createPresentationState(), defaultSponsor);
  state = applyPresentationCommand(state, {
    action: "activate",
    eventId: "ticker",
    targetPts: 10,
    region: "footer",
    layer: "ticker",
    item: { kind: "ticker", text: "Live now" },
  });
  state = applyPresentationCommand(state, {
    action: "clear",
    eventId: "clear-rail",
    targetPts: 12,
    region: "right.rail",
  });

  assert.equal(resolvePresentationRegion(state, "right.rail").length, 0);
  assert.equal(resolvePresentationRegion(state, "footer").length, 1);
});
