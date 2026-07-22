import { PrismaClient } from "@prisma/client";
import { createPersistentPresentationSnapshot, createV1PresentationBaseline } from "@showgather/presentation-model";

const prisma = new PrismaClient();

const cues = [
  { position: 1, label: "Opening ticker", command: { k: "ticker", t: "Welcome to ShowGather V1", l: "LIVE" } },
  { position: 2, label: "Speaker lower third", command: { k: "lower", t: "HOST NAME", s: "ShowGather Live", d: 8_000 } },
  { position: 3, label: "Score update", command: { k: "score", h: 1, a: 0, l: "GOAL" } },
  { position: 4, label: "Sponsor takeover", command: { k: "sponsor", b: "Goal Partner", s: "Celebrating the moment", d: 8_000 } },
  { position: 5, label: "Alert", command: { k: "alert", t: "Match update", m: "Goal confirmed", x: "w", d: 8_000 } },
  { position: 6, label: "Regional clear", command: { k: "clear", g: "r" } },
] as const;

async function main() {
  const organisation = await prisma.organisation.upsert({
    where: { slug: "showgather-demo" },
    update: { name: "ShowGather Demo" },
    create: { name: "ShowGather Demo", slug: "showgather-demo" },
  });
  const channel = await prisma.channel.upsert({
    where: { slug: "demo-channel" },
    update: { name: "Demo Channel", organisationId: organisation.id },
    create: { name: "Demo Channel", slug: "demo-channel", organisationId: organisation.id },
  });
  const production = await prisma.production.upsert({
    where: { id: "showgather-v1-pilot" },
    update: { title: "ShowGather V1 Pilot", channelId: channel.id },
    create: { id: "showgather-v1-pilot", channelId: channel.id, title: "ShowGather V1 Pilot", status: "rehearsal" },
  });
  const rundown = await prisma.rundown.upsert({
    where: { id: "showgather-v1-demonstration" },
    update: { name: "V1 Demonstration", productionId: production.id },
    create: { id: "showgather-v1-demonstration", productionId: production.id, name: "V1 Demonstration" },
  });

  for (const cue of cues) {
    await prisma.rundownCue.upsert({
      where: { rundownId_position: { rundownId: rundown.id, position: cue.position } },
      update: { label: cue.label, commandType: cue.command.k, commandPayload: cue.command },
      create: { rundownId: rundown.id, position: cue.position, label: cue.label, commandType: cue.command.k, commandPayload: cue.command },
    });
  }

  const snapshot = createPersistentPresentationSnapshot(createV1PresentationBaseline(), 0);
  await prisma.presentationSnapshot.upsert({
    where: { channelId: channel.id },
    update: {},
    create: { channelId: channel.id, productionId: production.id, revision: snapshot.revision, state: snapshot.state },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
