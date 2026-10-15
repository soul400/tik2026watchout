import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Checking who TRULY had Enigma mask on p.user...");

  // Only query rows that have isEnigmaMaskOn:true (exactly 620 rows)
  const events = await prisma.$queryRawUnsafe<any[]>(`
    SELECT id, eventType, sourceTimestamp, payload 
    FROM RawEvent 
    WHERE (payload LIKE '%"isEnigmaMaskOn":true%' OR payload LIKE '%"isEnigmaMaskOn": true%')
  `);

  console.log(`Fetched ${events.length} rows.`);

  const genuineEnigmaUsers = new Map<string, {
    uid: string;
    secUid: string;
    displayId: string;
    nickname: string;
    eventsCount: number;
    diamonds: number;
    gifts: Array<{ name: string; count: number; diamonds: number; time: string }>;
  }>();

  let excludedChattersCount = 0;

  for (const e of events) {
    try {
      const p = JSON.parse(e.payload);
      const u = p.user || {};
      const isMaskOn = u.enigmaInfo?.isEnigmaMaskOn === true;
      const hasEnigmaName = String(u.displayId || "").toLowerCase().startsWith("enigma");

      // STRICT CHECK:
      // If the user themselves did NOT wear the mask and does NOT have an Enigma name, EXCLUDE!
      if (!isMaskOn && !hasEnigmaName) {
        excludedChattersCount++;
        continue;
      }

      const uid = String(u.id || "");
      const secUid = String(u.secUid || "");
      const key = uid || secUid;
      if (!key) continue;

      if (!genuineEnigmaUsers.has(key)) {
        genuineEnigmaUsers.set(key, {
          uid,
          secUid,
          displayId: u.displayId || "Enigma",
          nickname: u.nickname || "Enigma",
          eventsCount: 0,
          diamonds: 0,
          gifts: [],
        });
      }

      const item = genuineEnigmaUsers.get(key)!;
      item.eventsCount++;

      if (p.gift || p.giftName) {
        const count = Number(p.repeatCount || 1);
        const dia = Number(p.diamondCount || p.gift?.diamondCount || 0) * count;
        item.diamonds += dia;
        item.gifts.push({
          name: p.gift?.name || p.giftName,
          count,
          diamonds: dia,
          time: new Date(e.sourceTimestamp).toISOString(),
        });
      }
    } catch {}
  }

  console.log(`Excluded regular chatters who only mentioned Enigma: ${excludedChattersCount}`);
  console.log(`GENUINE ENIGMA USERS COUNT: ${genuineEnigmaUsers.size}`);
  for (const [key, info] of genuineEnigmaUsers) {
    console.log(`- Masked: @${info.displayId} (${info.nickname}) | UID: ${info.uid} | Diamonds: ${info.diamonds.toLocaleString()} 💎 | Events: ${info.eventsCount}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
