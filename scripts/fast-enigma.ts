import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Fast Enigma Analysis starting...");

  // 1. Fetch all supporters indexed by platformUserId
  const supporters = await prisma.supporter.findMany();
  const supporterMap = new Map<string, typeof supporters[0]>();
  for (const s of supporters) {
    supporterMap.set(s.platformUserId, s);
  }
  console.log(`Loaded ${supporters.length} supporters into memory.`);

  // 2. Fetch all 620 Enigma events in ONE single query
  const enigmaEvents = await prisma.$queryRawUnsafe<any[]>(`
    SELECT id, sourceTimestamp, payload 
    FROM RawEvent 
    WHERE (payload LIKE '%"isEnigmaMaskOn":true%' OR payload LIKE '%"isEnigmaMaskOn": true%')
    ORDER BY sourceTimestamp ASC;
  `);

  console.log(`Fetched ${enigmaEvents.length} Enigma events.`);

  const enigmaUserMap = new Map<string, {
    uid: string;
    secUid: string;
    displayId: string;
    nickname: string;
    eventsCount: number;
    diamonds: number;
    gifts: Array<{ name: string; count: number; diamonds: number; time: string }>;
  }>();

  for (const ev of enigmaEvents) {
    try {
      const p = JSON.parse(ev.payload);
      const u = p.user || {};
      const uid = String(u.id || "");
      const secUid = String(u.secUid || "");
      const key = uid || secUid;
      if (!key) continue;

      if (!enigmaUserMap.has(key)) {
        enigmaUserMap.set(key, {
          uid,
          secUid,
          displayId: u.displayId || "Enigma",
          nickname: u.nickname || "Enigma",
          eventsCount: 0,
          diamonds: 0,
          gifts: [],
        });
      }

      const item = enigmaUserMap.get(key)!;
      item.eventsCount++;
      if (p.gift || p.giftName) {
        const count = Number(p.repeatCount || 1);
        const dia = Number(p.diamondCount || p.gift?.diamondCount || 0) * count;
        item.diamonds += dia;
        item.gifts.push({
          name: p.gift?.name || p.giftName,
          count,
          diamonds: dia,
          time: new Date(ev.sourceTimestamp).toISOString(),
        });
      }
    } catch {}
  }

  console.log(`\nFound ${enigmaUserMap.size} distinct Enigma personas.`);

  const resolvedMatches: any[] = [];

  for (const [key, enigma] of enigmaUserMap) {
    // Check match in supporterMap
    const supp = supporterMap.get(enigma.uid) || supporterMap.get(enigma.secUid);
    const isEnigmaName = (name: string) => (name || "").toLowerCase().startsWith("enigma");

    if (supp) {
      const realUsername = !isEnigmaName(supp.username) ? supp.username : null;
      const realDisplayName = !isEnigmaName(supp.displayName) ? supp.displayName : null;

      resolvedMatches.push({
        uid: enigma.uid,
        secUid: enigma.secUid,
        enigmaUsername: enigma.displayId,
        enigmaDisplayName: enigma.nickname,
        realUsername: realUsername || supp.username,
        realDisplayName: realDisplayName || supp.displayName,
        isDirectIdentityMatch: true,
        matchLevel: realUsername ? "STRONG_MATCH" : "PROBABLE_MATCH",
        confidenceScore: realUsername ? 0.99 : 0.85,
        diamondsWithEnigma: enigma.diamonds,
        diamondsPublic: supp.totalDiamonds,
        enigmaEventsCount: enigma.eventsCount,
        supporterId: supp.id,
        gifts: enigma.gifts,
      });
    } else {
      resolvedMatches.push({
        uid: enigma.uid,
        secUid: enigma.secUid,
        enigmaUsername: enigma.displayId,
        enigmaDisplayName: enigma.nickname,
        realUsername: "حساب خفي غير مسجل سابقاً",
        realDisplayName: "مجهول",
        isDirectIdentityMatch: false,
        matchLevel: "INSUFFICIENT_EVIDENCE",
        confidenceScore: 0.40,
        diamondsWithEnigma: enigma.diamonds,
        diamondsPublic: 0,
        enigmaEventsCount: enigma.eventsCount,
        supporterId: null,
        gifts: enigma.gifts,
      });
    }
  }

  console.log(`\n=== RESOLVED MATCHES: ${resolvedMatches.length} ===`);
  const strongMatches = resolvedMatches.filter(m => m.matchLevel === "STRONG_MATCH");
  console.log(`Strong Matches (Identified Real Supporter): ${strongMatches.length}`);

  for (const m of strongMatches) {
    console.log(`--------------------------------------------------`);
    console.log(`🎯 Real Profile: @${m.realUsername} (${m.realDisplayName})`);
    console.log(`🎭 Enigma Mask: @${m.enigmaUsername} (${m.enigmaDisplayName})`);
    console.log(`💎 Diamonds with Mask: ${m.diamondsWithEnigma.toLocaleString()} 💎 | Public: ${m.diamondsPublic.toLocaleString()} 💎`);
    console.log(`🔢 Enigma Events: ${m.enigmaEventsCount}`);
    if (m.gifts.length > 0) {
      console.log(`🎁 Top Gift: ${m.gifts[0].name} (${m.gifts[0].diamonds} 💎)`);
    }
  }

  // Also check if any persona named Enigma RMM77 is linked
  const rmm = resolvedMatches.find(m => m.enigmaUsername.includes("RMM77") || m.uid.includes("7195697828512646150"));
  console.log("\nEnigma RMM77 match details:", rmm);
}

main().catch(console.error).finally(() => prisma.$disconnect());
