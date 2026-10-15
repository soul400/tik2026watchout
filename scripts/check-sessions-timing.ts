import { prisma } from "../src/lib/prisma";

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
  if (!tenant) return;

  const sessions = await prisma.liveSession.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        { totalDiamonds: { gt: 0 } },
        { totalLikes: { gt: 0 } },
        { totalComments: { gt: 0 } },
      ]
    },
    orderBy: { startedAt: "asc" }
  });

  console.log(`Found ${sessions.length} active sessions.`);
  for (const s of sessions) {
    const started = new Date(s.startedAt);
    const ended = s.endedAt ? new Date(s.endedAt) : new Date(started.getTime() + 60 * 60 * 1000);
    const durationMin = Math.max(1, Math.round((ended.getTime() - started.getTime()) / 60000));
    const startHourRiyadh = (started.getUTCHours() + 3) % 24;
    const endHourRiyadh = (ended.getUTCHours() + 3) % 24;
    console.log(
      `Session ${s.id.slice(0, 10)} | Date: ${started.toISOString().slice(0, 10)} | Start(Riyadh): ${startHourRiyadh}:00 | End(Riyadh): ${endHourRiyadh}:00 | Dur: ${durationMin}m | Diamonds: ${s.totalDiamonds} | Likes: ${s.totalLikes} | Comments: ${s.totalComments}`
    );
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
