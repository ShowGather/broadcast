import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import type { ShowGatherEvent } from "@showgather/event-schema";
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
    assert.equal(second.status, "pending");
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

test("retry preserves the failed event identity and unblocks later revisions", { skip: !databaseUrl }, async () => {
  const data = await fixture();
  try {
    let available = false;
    const sent: string[] = [];
    const store = new PersistentPresentationStore(prisma!, async (event) => {
      sent.push(event.id); if (!available) throw new Error("injector unavailable"); return { accepted: true };
    });
    const firstEvent = { v: 1 as const, id: `score-${randomUUID()}`, t: "pc" as const, p: { k: "score" as const, h: 2, a: 0 } };
    assert.equal((await store.accept(firstEvent, "test", undefined, data.channel.slug)).status, "failed");
    assert.equal((await store.accept({ v: 1, id: `ticker-${randomUUID()}`, t: "pc", p: { k: "ticker", t: "Blocked" } }, "test", undefined, data.channel.slug)).status, "pending");
    const failed = (await store.outbox(data.channel.id)).find((item) => item.status === "failed");
    assert.ok(failed);
    available = true;
    const retried = await store.retry(data.channel.id, failed.id);
    assert.equal(retried.status, "dispatched");
    assert.equal(retried.event.id, firstEvent.id);
    assert.equal(retried.revision, 1);
    assert.equal((await store.outbox(data.channel.id)).filter((item) => item.revision === 1).length, 1);
    assert.equal((await store.snapshot(data.channel.slug)).revision, 2);
    assert.equal(sent.filter((id) => id === firstEvent.id).length, 2);
  } finally { await data.remove(); }
});

test("cancellation publishes a same-revision no-op and unblocks the next command", { skip: !databaseUrl }, async () => {
  const data = await fixture();
  try {
    let available = false;
    const sent: ShowGatherEvent[] = [];
    const store = new PersistentPresentationStore(prisma!, async (event) => {
      sent.push(event); if (!available) throw new Error("injector unavailable"); return { accepted: true };
    });
    await store.accept({ v: 1, id: `score-${randomUUID()}`, t: "pc", p: { k: "score", h: 9, a: 0 } }, "test", undefined, data.channel.slug);
    await store.accept({ v: 1, id: `ticker-${randomUUID()}`, t: "pc", p: { k: "ticker", t: "After cancel" } }, "test", undefined, data.channel.slug);
    const failed = (await store.outbox(data.channel.id)).find((item) => item.status === "failed");
    assert.ok(failed);
    available = true;
    const cancelled = await store.cancel(data.channel.id, failed.id);
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.revision, 1);
    assert.equal((await store.snapshot(data.channel.slug)).revision, 2);
    assert.equal(sent.some((event) => event.t === "pc" && event.p.k === "noop" && event.r === 1), true);
  } finally { await data.remove(); }
});

test.after(async () => { await prisma?.$disconnect(); });
