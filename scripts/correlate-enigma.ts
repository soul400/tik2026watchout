import { prisma } from "../src/lib/prisma";

async function main() {
  const enigmaEvents = await prisma.$queryRawUnsafe<any[]>(`
    SELECT id, sourceTimestamp, payload 
    FROM RawEvent 
    WHERE (payload LIKE '%"isEnigmaMaskOn":true%' OR payload LIKE '%"isEnigmaMaskOn": true%')
  `);

  console.log(`Total events with isEnigmaMaskOn: true: ${enigmaEvents.length}`);

  const enigmaUsers = new Map<string, {
    secUid: string;
    id: string;
    displayIds: Set<string>;
    nicknames: Set<string>;
    eventCount: number;
    gifts: Array<{ name: string; count: number; diamonds: number; time: string }>;
  }>();

  for (const r of enigmaEvents) {
    try {
      const p = JSON.parse(r.payload);
      const u = p.user || {};
      const uid = String(u.id || u.secUid || p.secUid || "unknown");
      if (!enigmaUsers.has(uid)) {
        enigmaUsers.set(uid, {
          secUid: String(u.secUid || ""),
          id: String(u.id || ""),
          displayIds: new Set<string>(),
          nicknames: new Set<string>(),
          eventCount: 0,
          gifts: [],
        });
      }

      const entry = enigmaUsers.get(uid)!;
      entry.eventCount++;
      if (u.displayId) entry.displayIds.add(u.displayId);
      if (u.nickname) entry.nicknames.add(u.nickname);

      if (p.gift || p.giftName) {
        entry.gifts.push({
          name: p.gift?.name || p.giftName,
          count: p.repeatCount || 1,
          diamonds: (p.diamondCount || p.gift?.diamondCount || 0) * (p.repeatCount || 1),
          time: new Date(r.sourceTimestamp).toISOString(),
        });
      }
    } catch {}
  }

  console.log(`\nDistinct users who used Enigma mask: ${enigmaUsers.size}`);
  for (const [uid, info] of enigmaUsers) {
    console.log(`\n--- User UID: ${uid} (id: ${info.id}) ---`);
    console.log(`secUid: ${info.secUid}`);
    console.log(`displayIds:`, Array.from(info.displayIds));
    console.log(`nicknames:`, Array.from(info.nicknames));
    console.log(`Total events under enigma: ${info.eventCount}`);
    const totalDiamonds = info.gifts.reduce((sum, g) => sum + g.diamonds, 0);
    console.log(`Total diamonds under enigma: ${totalDiamonds}`);
    console.log(`Sample gifts:`, info.gifts.slice(0, 5));

    // Now search for this user in DB WITHOUT enigma!
    const nonEnigmaSupporter = await prisma.supporter.findFirst({
      where: {
        OR: [
          { platformUserId: info.id },
          { platformUserId: info.secUid },
        ]
      }
    });

    if (nonEnigmaSupporter) {
      console.log(`--> MATCHED IN SUPPORTER TABLE:`);
      console.log(`    Supporter ID: ${nonEnigmaSupporter.id}`);
      console.log(`    Username: ${nonEnigmaSupporter.username}`);
      console.log(`    DisplayName: ${nonEnigmaSupporter.displayName}`);
      console.log(`    Total Diamonds: ${nonEnigmaSupporter.totalDiamonds}`);
      console.log(`    Category: ${nonEnigmaSupporter.category}`);
    } else {
      console.log(`--> No direct supporter record found by platformUserId.`);
    }

    // Also check raw events for this user where isEnigmaMaskOn is FALSE
    const nonEnigmaEvents = await prisma.$queryRawUnsafe<any[]>(`
      SELECT payload FROM RawEvent 
      WHERE (payload LIKE '%${info.id}%' OR (payload LIKE '%${info.secUid}%' AND length('${info.secUid}') > 10))
        AND payload LIKE '%"isEnigmaMaskOn":false%'
      LIMIT 5;
    `);
    console.log(`--> Found ${nonEnigmaEvents.length} raw events where isEnigmaMaskOn was FALSE for this user!`);
    for (const ne of nonEnigmaEvents) {
      try {
        const nep = JSON.parse(ne.payload);
        console.log(`    Regular profile: @${nep.user?.displayId} (${nep.user?.nickname})`);
      } catch {}
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
