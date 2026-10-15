import { prisma } from "../src/lib/prisma";

async function main() {
  const genuineUids = [
    "7619854442507240469",
    "7195697828512646150",
    "7231647479551312901",
    "7025941746752717830",
    "7066964264955692034",
    "6904004790612542469",
    "7648076701071557653",
    "6827229428000015366",
    "6805675736507761670",
    "7491206035992085511",
    "6939246458097828869",
    "7159654708531971074",
    "7037946826750460934",
    "6744986065553687557",
    "6872819913401598978",
    "6801647648425952262",
    "6720910233990677510"
  ];

  for (const uid of genuineUids) {
    const supp = await prisma.supporter.findFirst({
      where: { platformUserId: uid }
    });
    console.log(`UID ${uid} -> Supporter: @${supp?.username} (${supp?.displayName}) | Diamonds: ${supp?.totalDiamonds}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
