import { prisma } from "../src/lib/prisma";

async function main() {
  const tenants = await prisma.tenant.findMany();
  console.log("Tenants:", tenants.map(t => ({ id: t.id, slug: t.slug, name: t.name })));

  const sessions = await prisma.liveSession.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  });
  console.log("Total Live Sessions:", await prisma.liveSession.count());
  console.log("Recent Live Sessions:", sessions.map(s => ({
    id: s.id,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    diamonds: s.totalDiamonds,
    peakViewers: s.peakViewers,
    likes: s.totalLikes,
    comments: s.totalComments
  })));

  const hourly = await prisma.hourlyAnalytics.findMany();
  console.log("Hourly Analytics Rows Count:", hourly.length);

  const rawCount = await prisma.rawEvent.count();
  console.log("Raw Events Count:", rawCount);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
