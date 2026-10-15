import { prisma } from "../src/lib/prisma";

async function main() {
  const count = await prisma.supporter.count();
  console.log("Total supporters count:", count);

  const top10 = await prisma.supporter.findMany({
    orderBy: { totalDiamonds: "desc" },
    take: 10,
    select: {
      id: true,
      platformUserId: true,
      username: true,
      displayName: true,
      totalDiamonds: true,
    }
  });
  console.log("Top 10 supporters:", top10);
}

main().catch(console.error).finally(() => prisma.$disconnect());
