import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Searching for events with enigmaInfo or secret...");

  // Search in batches of 1000
  let skip = 0;
  const take = 2000;
  let foundEnigma = 0;
  let foundSecret = 0;
  const samples: any[] = [];

  while (true) {
    const events = await prisma.rawEvent.findMany({
      where: { eventType: "GIFT" },
      select: { payload: true, sourceTimestamp: true },
      skip,
      take,
    });

    if (events.length === 0) break;
    skip += events.length;

    for (const ev of events) {
      try {
        const p = JSON.parse(ev.payload);
        const u = p.user || {};
        if (u.enigmaInfo) {
          foundEnigma++;
          if (samples.length < 10) {
            samples.push({
              type: "enigmaInfo",
              enigmaInfo: u.enigmaInfo,
              user: {
                id: u.id,
                displayId: u.displayId,
                nickname: u.nickname,
                secUid: u.secUid,
                secret: u.secret,
              },
              gift: p.gift?.name || p.giftName,
              diamonds: p.diamondCount,
            });
          }
        }
        if (u.secret === 1 || u.secret === true) {
          foundSecret++;
        }
      } catch {}
    }
  }

  console.log(`Total GIFT events checked: ${skip}`);
  console.log(`Events with enigmaInfo: ${foundEnigma}`);
  console.log(`Events with secret=true/1: ${foundSecret}`);
  console.log("Samples:", JSON.stringify(samples, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
