const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const scoreEvents = await prisma.battleScoreEvent.findMany({
    include: { supporter: true, battle: true },
    take: 10
  });
  console.log('Sample score events:');
  for (const se of scoreEvents) {
    console.log(`Battle: ${se.battleId} | Team: ${se.teamNumber} | Supporter: ${se.supporter.displayName} (@${se.supporter.username}) | Points: ${se.points}`);
  }
}

main().finally(() => prisma.$disconnect());
