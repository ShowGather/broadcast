import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { createPersistentPresentationSnapshot, createV1PresentationBaseline } from "@showgather/presentation-model";
import { PersistentPresentationStore } from "./persistentStore.js";

if (!process.env.DATABASE_URL) process.loadEnvFile("../../.env");
const databaseUrl = process.env.DATABASE_URL;
const prisma = databaseUrl ? new PrismaClient() : null;

async function fixture() {
  if (!prisma) throw new Error("DATABASE_URL is required for persistent store tests");
  const suffix = randomUUID();
  const organisation = await prisma.organisation.create({ data: { name: "Test organisation", slug: `test-org-${suffix}` } });
  const channel = await prisma.channel.create({ data: { name: "Test channel", slug: `test-channel-${suffix}`, organisationId: organisation.id } });
  const snapshot = createPersistentPresentationSnapshot(createV1PresentationBaseline(), 0);
  await prisma.presentationSnapshot.create({ data: { channelId: channel.id, revision: 0, state: snapshot.state as unknown as Prisma.InputJsonValue } });
  return { channel, async remove() { await prisma!.organisation.delete({ where: { id: organisation.id } }); } };
}

test("failed durable dispatch does not publish snapshot state and blocks the next revision", { skip: !databaseUrl }, async () => {
  const data = await fixture();
  try {
    const store = new PersistentPresentationStore(prisma!, async () => { throw new Error("injector unavailable"); });
    const first = await store.accept({ v: 1, id: `score-${randomUUID()}`, t: "pc", p: { k: "score", h: 2, a: 0, l: "GOAL" } }, "test", undefined, data.channel.slug);
    assert.equal(first.status, "failed");
    assert.equal((await store.snapshot(data.channel.slug)).revision, 0);

    const second = await store.accept({ v: 1, id: `ticker-${randomUUID()}`, t: "pc", p: { k: "ticker", t: "Still waiting" } }, "test", undefined, data.channel.slug);
    assert.equal(second.status, "accepted");
    assert.equal(second.revision, 2);
    assert.equal((await store.snapshot(data.channel.slug)).revision, 0);
  } finally { await data.remove(); }
});

test("successful durable dispatch publishes exactly once and duplicate event IDs are idempotent", { skip: !databaseUrl }, async () => {
  const data = await fixture();
  try {
    const sent: string[] = [];
    const store = new PersistentPresentationStore(prisma!, async (event) => { sent.push(event.id); return { accepted: true }; });
    const event = { v: 1 as const, id: `ticker-${randomUUID()}`, t: "pc" as const, p: { k: "ticker" as const, t: "Published" } };
    const first = await store.accept(event, "test", undefined, data.channel.slug);
    const duplicate = await store.accept(event, "test", undefined, data.channel.slug);
    assert.equal(first.status, "dispatched");
    assert.equal(first.revision, 1);
    assert.equal(duplicate.revision, 1);
    assert.deepEqual(sent, [event.id]);
    assert.equal((await store.snapshot(data.channel.slug)).revision, 1);
  } finally { await data.remove(); }
});

test.after(async () => { await prisma?.$disconnect(); });
