const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const battles = await prisma.battle.findMany({
    where: {
      OR: [{ team1Score: { gt: 0 } }, { team2Score: { gt: 0 } }]
    },
    include: {
      participants: true,
      scoreEvents: {
        include: { supporter: true }
      }
    },
    orderBy: { startedAt: 'desc' },
    take: 10
  });

  console.log(`Found ${battles.length} non-zero battles.`);
  if (battles.length === 0) return;

  const minStart = battles[battles.length - 1].startedAt;
  const maxEnd = new Date(battles[0].startedAt.getTime() + 3600000);

  const gifts = await prisma.rawEvent.findMany({
    where: {
      eventType: { in: ['GIFT', 'gift'] },
      sourceTimestamp: { gte: minStart, lte: maxEnd }
    },
    select: { payload: true, sourceTimestamp: true }
  });

  console.log(`Fetched ${gifts.length} gifts in range for ${battles.length} battles.`);

  for (const b of battles.slice(0, 3)) {
    const bStart = b.startedAt.getTime();
    const bEnd = (b.endedAt || new Date(b.startedAt.getTime() + (b.durationSeconds || 300) * 1000)).getTime();

    const battleGifts = gifts.filter(g => {
      const t = g.sourceTimestamp.getTime();
      return t >= bStart && t <= bEnd;
    });

    const supMap = new Map();
    for (const ge of battleGifts) {
      try {
        const pl = JSON.parse(ge.payload);
        const name = pl.user?.nickname || pl.user?.displayId || pl.user?.uniqueId || 'داعم';
        const unit = Number(pl.diamondCount || pl.gift?.diamondCount || 0);
        const count = Number(pl.repeatCount || pl.comboCount || 1);
        const dia = unit * count;
        supMap.set(name, (supMap.get(name) || 0) + dia);
      } catch (e) {}
    }

    const top10 = Array.from(supMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log(`Battle ${b.id} (${b.battleType}): T1=${b.team1Score}, T2=${b.team2Score}`);
    console.log('Top 10 T1 supporters:', top10);
  }
}

main().finally(() => prisma.$disconnect());
