const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const battles = await prisma.battle.findMany({
    where: {
      team1Score: { gt: 0 }
    },
    include: {
      participants: true,
      scoreEvents: {
        include: { supporter: true }
      }
    },
    take: 5,
    orderBy: { startedAt: 'desc' }
  });

  for (const b of battles) {
    console.log('--------------------------------------------------');
    console.log(`Battle ID: ${b.id} | Type: ${b.battleType} | T1: ${b.team1Score} | T2: ${b.team2Score}`);
    console.log(`Started: ${b.startedAt.toISOString()} | Ended: ${b.endedAt ? b.endedAt.toISOString() : 'null'} | Dur: ${b.durationSeconds}`);
    console.log('Participants:', b.participants.map(p => `Team ${p.teamNumber}: ${p.displayName} (@${p.username})`));
    console.log('ScoreEvents in DB:', b.scoreEvents.length);

    // Let's check gifts during this battle window!
    const battleStart = b.startedAt;
    const battleEnd = b.endedAt || new Date(battleStart.getTime() + (b.durationSeconds || 300) * 1000);

    const giftsDuringBattle = await prisma.rawEvent.findMany({
      where: {
        eventType: { in: ['GIFT', 'gift'] },
        sourceTimestamp: { gte: battleStart, lte: battleEnd }
      },
      select: { payload: true, sourceTimestamp: true }
    });

    console.log(`Gifts found in RawEvent during battle window (${giftsDuringBattle.length} gifts):`);
    const supporterMap = new Map();
    for (const ge of giftsDuringBattle) {
      try {
        const pl = JSON.parse(ge.payload);
        const sender = pl.user?.nickname || pl.user?.displayId || pl.user?.uniqueId || 'Unknown';
        const unit = Number(pl.diamondCount || pl.gift?.diamondCount || 0);
        const count = Number(pl.repeatCount || pl.comboCount || 1);
        const diamonds = unit * count;
        supporterMap.set(sender, (supporterMap.get(sender) || 0) + diamonds);
      } catch (e) {}
    }

    const topSupporters = Array.from(supporterMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    console.log('Top Supporters during battle:', topSupporters);
  }
}

main().finally(() => prisma.$disconnect());
