import { prisma } from "../src/lib/prisma";

async function main() {
  const genuineUids = [
    "7231647479551312901", // Enigma 003300
    "7025941746752717830", // Enigma ANGLER
    "7066964264955692034", // Enigma MBZ007
    "6904004790612542469", // Enigma TNWEEN
    "7648076701071557653", // Enigma 39512
    "6827229428000015366", // Enigma 29457
    "6805675736507761670", // Enigma XXBBXX
    "7491206035992085511", // Enigma AURA1
    "6939246458097828869", // Enigma 35451
    "7159654708531971074", // Enigma TOP001
    "7037946826750460934", // Enigma Q800Q8
    "6744986065553687557", // Enigma AURORA
    "6872819913401598978", // Enigma KINGDM
    "6801647648425952262", // Enigma LAW205
    "6720910233990677510"  // Enigma 99496
  ];

  for (const uid of genuineUids) {
    const events = await prisma.$queryRawUnsafe<any[]>(`
      SELECT payload FROM RawEvent 
      WHERE payload LIKE '%${uid}%'
        AND payload LIKE '%"isEnigmaMaskOn":false%'
      LIMIT 1;
    `);

    if (events.length > 0) {
      const p = JSON.parse(events[0].payload);
      console.log(`UID ${uid} has non-enigma event! displayId: @${p.user?.displayId} (${p.user?.nickname})`);
    } else {
      console.log(`UID ${uid} has only enigma events.`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
