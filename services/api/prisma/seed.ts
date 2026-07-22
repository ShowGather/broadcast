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
  let organisation = await prisma.organisation.findUnique({ where: { slug: "showgather-demo" } });
  if (!organisation) organisation = await prisma.organisation.create({ data: { name: "ShowGather Demo", slug: "showgather-demo" } });
  let channel = await prisma.channel.findUnique({ where: { slug: "demo-channel" } });
  if (!channel) channel = await prisma.channel.create({ data: { name: "Demo Channel", slug: "demo-channel", organisationId: organisation.id } });

  let configuration = await prisma.showConfiguration.findFirst({ where: { channelId: channel.id, name: "Football Demo" } });
  if (!configuration) configuration = await prisma.showConfiguration.create({ data: { channelId: channel.id, name: "Football Demo", configuration: { sport: "football", homeTeam: "HOME", awayTeam: "AWAY", tickerLabel: "LIVE" } } });

  let production = await prisma.production.findUnique({ where: { id: "showgather-v1-pilot" } });
  if (!production) production = await prisma.production.create({ data: { id: "showgather-v1-pilot", channelId: channel.id, title: "ShowGather V1 Pilot", status: "rehearsal", showConfigurationId: configuration.id, configuration: configuration.configuration } });
  let rundown = await prisma.rundown.findUnique({ where: { id: "showgather-v1-demonstration" } });
  if (!rundown) rundown = await prisma.rundown.create({ data: { id: "showgather-v1-demonstration", productionId: production.id, name: "V1 Demonstration" } });

  const existingCues = await prisma.rundownCue.count({ where: { rundownId: rundown.id } });
  if (existingCues === 0) await prisma.rundownCue.createMany({ data: cues.map((cue) => ({ rundownId: rundown.id, position: cue.position, label: cue.label, commandType: cue.command.k, commandPayload: cue.command })) });

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
