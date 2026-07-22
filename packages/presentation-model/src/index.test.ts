import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPresentationCommand,
  createV13PresentationAcceptanceScene,
  createPresentationState,
  expirePresentationItems,
  normalisePlacement,
  placementFromPreset,
  resolvePresentationRegion,
  resolvePresentationTarget,
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

test("stable instance IDs allow multiple lower thirds in one layer", () => {
  let state = applyPresentationCommand(createPresentationState(), {
    action: "activate", eventId: "presenter-a", targetPts: 10, region: "video.overlay", layer: "lower-third", instanceId: "lower-third-presenter-a",
    item: { kind: "lower-third", title: "Presenter A" },
  });
  state = applyPresentationCommand(state, {
    action: "activate", eventId: "presenter-b", targetPts: 11, region: "video.overlay", layer: "lower-third", instanceId: "lower-third-presenter-b",
    item: { kind: "lower-third", title: "Presenter B" },
  });

  assert.deepEqual(resolvePresentationRegion(state, "video.overlay").map((entry) => entry.instanceId), ["lower-third-presenter-a", "lower-third-presenter-b"]);
});

test("profile placement moves legacy surround items to intentional TV and mobile targets", () => {
  const state = applyPresentationCommand(createPresentationState(), defaultSponsor);
  assert.equal(resolvePresentationTarget(state, "right.rail", "desktop").length, 1);
  assert.equal(resolvePresentationTarget(state, "video.overlay", "tv")[0]?.placement.anchor, "top-right");
  assert.equal(resolvePresentationTarget(state, "video.overlay", "mobile").length, 0);
});

test("placement presets produce normalised title-safe transforms", () => {
  const placement = placementFromPreset("video", "bottom-left", { x: -2, y: 2, width: 2 });
  assert.deepEqual(placement, { surface: "video", anchor: "bottom-left", x: 0.04, y: 0.96, width: 0.92, safeArea: true, layout: "column" });
  assert.equal(normalisePlacement({ surface: "video", anchor: "top-left", x: Number.NaN, y: 0, width: 0 }).width, 0.08);
});

test("the shared acceptance scene resolves the same instances for every profile", () => {
  const state = createV13PresentationAcceptanceScene();
  const desktopVideo = resolvePresentationTarget(state, "video.overlay", "desktop");
  const tvVideo = resolvePresentationTarget(state, "video.overlay", "tv");
  const mobileVideo = resolvePresentationTarget(state, "video.overlay", "mobile");

  assert.deepEqual(desktopVideo.map((instance) => instance.entry.instanceId), ["scorebug-main", "programme-clock", "lower-third-presenter-a", "lower-third-presenter-b"]);
  assert.equal(resolvePresentationTarget(state, "right.rail", "desktop")[0]?.entry.instanceId, "sponsor-top-right");
  assert.equal(tvVideo.some((instance) => instance.entry.instanceId === "sponsor-top-right"), true);
  assert.deepEqual(mobileVideo.filter((instance) => instance.entry.item.kind === "lower-third").map((instance) => instance.placement.y), [.18, .05]);
});

test("persisted layout definitions override placement without changing active state", () => {
  const state = createV13PresentationAcceptanceScene();
  const configured = resolvePresentationTarget(state, "video.overlay", "tv", [{ instanceId: "scorebug-main", placementByProfile: { tv: { surface: "video", anchor: "bottom-right", x: .04, y: .04, width: .2, safeArea: true, layout: "overlay" } } }]);
  const scorebug = configured.find((instance) => instance.entry.instanceId === "scorebug-main");
  assert.equal(scorebug?.placement.anchor, "bottom-right");
  assert.equal(configured.length, resolvePresentationTarget(state, "video.overlay", "tv").length);
});
