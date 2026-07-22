import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { ShowService } from "./showService.js";
import { PersistentRundown } from "../rundown/persistentRundown.js";

if (!process.env.DATABASE_URL && existsSync("../../.env")) process.loadEnvFile("../../.env");
const prisma = process.env.DATABASE_URL ? new PrismaClient() : null;

async function fixture() {
  if (!prisma) throw new Error("DATABASE_URL is required");
  const suffix = randomUUID();
  const organisation = await prisma.organisation.create({ data: { name: "V1.2 test", slug: `v12-org-${suffix}` } });
  const channel = await prisma.channel.create({ data: { name: "V1.2 channel", slug: `v12-channel-${suffix}`, organisationId: organisation.id } });
  return { channel, async remove() { await prisma!.organisation.delete({ where: { id: organisation.id } }); } };
}

test("show configuration is copied into a production and later edits stay independent", { skip: !prisma }, async () => {
  const data = await fixture();
  try {
    const show = new ShowService(prisma!);
    const configuration = await show.createConfiguration(data.channel.id, { name: "Football", configuration: { homeTeam: "HOME" } });
    const production = await show.createProduction(data.channel.id, { title: "Match", status: "draft" });
    await show.copyConfigurationIntoProduction(production.id, configuration.id);
    await show.updateConfiguration(configuration.id, { configuration: { homeTeam: "CHANGED" } });
    const saved = await prisma!.production.findUniqueOrThrow({ where: { id: production.id } });
    assert.deepEqual(saved.configuration, { homeTeam: "HOME" });
  } finally { await data.remove(); }
});

test("production duplication copies editable definitions but no execution state", { skip: !prisma }, async () => {
  const data = await fixture();
  try {
    const show = new ShowService(prisma!);
    const production = await show.createProduction(data.channel.id, { title: "Match", configuration: { tickerLabel: "LIVE" } });
    const rundown = await show.createRundown(production.id, { name: "Main" });
    await show.createCue(rundown.id, { label: "Score", command: { k: "score", h: 1, a: 0 } });
    const duplicate = await show.duplicateProduction(production.id);
    const copied = await prisma!.production.findUniqueOrThrow({ where: { id: duplicate.id }, include: { rundowns: { include: { cues: true } }, sessions: true, commands: true } });
    assert.equal(copied.status, "draft"); assert.equal(copied.rundowns[0]?.cues[0]?.label, "Score"); assert.equal(copied.sessions.length, 0); assert.equal(copied.commands.length, 0);
  } finally { await data.remove(); }
});

test("profile-aware layout definitions are persisted as bounded production configuration", { skip: !prisma }, async () => {
  const data = await fixture();
  try {
    const show = new ShowService(prisma!);
    const configuration = { presentationLayouts: [{ instanceId: "scorebug", placementByProfile: { tv: { surface: "video", anchor: "top-left", x: .04, y: .04, width: .28, safeArea: true, layout: "overlay" } } }] };
    const production = await show.createProduction(data.channel.id, { title: "Match", configuration });
    const saved = await prisma!.production.findUniqueOrThrow({ where: { id: production.id } });
    assert.deepEqual(saved.configuration, configuration);
    await assert.rejects(() => show.updateProduction(production.id, { configuration: { presentationLayouts: [{ instanceId: "bad layout", placementByProfile: {} }] } }), /stable instance IDs/);
  } finally { await data.remove(); }
});

test("cue reordering stays contiguous and active execution uses its immutable snapshot", { skip: !prisma }, async () => {
  const data = await fixture();
  try {
    const show = new ShowService(prisma!);
    const production = await show.createProduction(data.channel.id, { title: "Match" });
    const rundown = await show.createRundown(production.id, { name: "Main" });
    const first = await show.createCue(rundown.id, { label: "First", command: { k: "ticker", t: "One" } });
    const second = await show.createCue(rundown.id, { label: "Second", command: { k: "ticker", t: "Two" } });
    const third = await show.createCue(rundown.id, { label: "Third", command: { k: "ticker", t: "Three" } });
    const reordered = await show.reorder(rundown.id, [third.id, first.id, second.id]);
    assert.deepEqual(reordered.map((cue) => cue.position), [1, 2, 3]);
    const execution = new PersistentRundown(prisma!);
    await execution.startSession("rehearsal", rundown.id);
    await show.updateCue(first.id, { label: "Edited", command: { k: "ticker", t: "Edited" }, enabled: false });
    const active = await execution.snapshot("rehearsal", rundown.id);
    assert.equal(active.cues.find((cue) => cue.id === first.id)?.label, "First");
    assert.equal(active.cues.find((cue) => cue.id === first.id)?.enabled, true);
    await execution.startSession("rehearsal", rundown.id);
    const future = await execution.snapshot("rehearsal", rundown.id);
    assert.equal(future.cues.find((cue) => cue.id === first.id)?.label, "Edited");
    assert.equal(future.cues.find((cue) => cue.id === first.id)?.enabled, false);
    await assert.rejects(() => execution.go("rehearsal", first.id, false, rundown.id), /cue not found or disabled/);
  } finally { await data.remove(); }
});

test.after(async () => { await prisma?.$disconnect(); });
