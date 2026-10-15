import { prisma } from "../src/lib/prisma";

async function main() {
  const sessions = await prisma.liveSession.findMany({
    where: {
      OR: [
        { totalDiamonds: { gt: 0 } },
        { totalLikes: { gt: 0 } },
        { totalComments: { gt: 0 } }
      ]
    },
    orderBy: { startedAt: "desc" }
  });

  console.log(`Sessions with activity: ${sessions.length}`);
  for (const s of sessions) {
    const started = new Date(s.startedAt);
    const ended = s.endedAt ? new Date(s.endedAt) : null;
    const durationMin = ended ? Math.round((ended.getTime() - started.getTime()) / 60000) : "ongoing";
    // Convert to Riyadh time (UTC+3)
    const riyadhHour = (started.getUTCHours() + 3) % 24;
    console.log(`Session ${s.id}: Started UTC ${started.toISOString()} | RiyadhHour: ${riyadhHour} | Dur: ${durationMin}m | 💎: ${s.totalDiamonds} | ❤️: ${s.totalLikes} | 💬: ${s.totalComments} | 👥: ${s.peakViewers}`);
  }

  // Also check RawEvents distribution by eventType
  const rawEventsGroup = await prisma.rawEvent.groupBy({
    by: ['eventType'],
    _count: { id: true }
  });
  console.log("Raw events by type:", rawEventsGroup);
}

main().catch(console.error).finally(() => prisma.$disconnect());
