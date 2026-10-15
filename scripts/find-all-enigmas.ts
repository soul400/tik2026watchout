import { prisma } from "../src/lib/prisma";

interface EnigmaMatch {
  platformUserId: string;
  secUid: string;
  realUsername: string;
  realDisplayName: string;
  enigmaUsername: string;
  enigmaDisplayName: string;
  diamondsUnderEnigma: number;
  diamondsUnderReal: number;
  giftsUnderEnigma: Array<{ name: string; count: number; diamonds: number; time: string }>;
  enigmaEventsCount: number;
  realEventsCount: number;
  confidenceScore: number;
  matchLevel: "STRONG_MATCH" | "PROBABLE_MATCH";
}

async function main() {
  console.log("Analyzing all Enigma users across database...");

  // 1. Find all events where isEnigmaMaskOn is true
  const enigmaEvents = await prisma.$queryRawUnsafe<any[]>(`
    SELECT id, sourceTimestamp, payload 
    FROM RawEvent 
    WHERE (payload LIKE '%"isEnigmaMaskOn":true%' OR payload LIKE '%"isEnigmaMaskOn": true%')
    ORDER BY sourceTimestamp ASC;
  `);

  console.log(`Found ${enigmaEvents.length} Enigma events.`);

  const userMap = new Map<string, {
    enigmaPayloads: any[];
    gifts: Array<{ name: string; count: number; diamonds: number; time: string }>;
    diamonds: number;
  }>();

  for (const ev of enigmaEvents) {
    try {
      const p = JSON.parse(ev.payload);
      const u = p.user || {};
      const uid = String(u.id || u.secUid || p.secUid || "");
      if (!uid) continue;

      if (!userMap.has(uid)) {
        userMap.set(uid, { enigmaPayloads: [], gifts: [], diamonds: 0 });
      }

      const entry = userMap.get(uid)!;
      entry.enigmaPayloads.push({ p, timestamp: ev.sourceTimestamp });

      if (p.gift || p.giftName) {
        const repeatCount = Number(p.repeatCount || 1);
        const diamondCount = Number(p.diamondCount || p.gift?.diamondCount || 0) * repeatCount;
        entry.diamonds += diamondCount;
        entry.gifts.push({
          name: p.gift?.name || p.giftName,
          count: repeatCount,
          diamonds: diamondCount,
          time: new Date(ev.sourceTimestamp).toISOString(),
        });
      }
    } catch {}
  }

  console.log(`Distinct Enigma UIDs: ${userMap.size}`);

  const matches: EnigmaMatch[] = [];

  for (const [uid, data] of userMap) {
    // Check if this UID has events with isEnigmaMaskOn: false
    const firstEnigma = data.enigmaPayloads[0].p;
    const enigmaUser = firstEnigma.user || {};
    const enigmaUsername = enigmaUser.displayId || enigmaUser.uniqueId || "Enigma";
    const enigmaDisplayName = enigmaUser.nickname || enigmaUsername;
    const secUid = enigmaUser.secUid || "";

    // Query non-enigma events for this user
    const nonEnigmaEvents = await prisma.$queryRawUnsafe<any[]>(`
      SELECT sourceTimestamp, payload 
      FROM RawEvent 
      WHERE (payload LIKE '%${uid}%' OR (length('${secUid}') > 15 AND payload LIKE '%${secUid}%'))
        AND payload LIKE '%"isEnigmaMaskOn":false%'
      ORDER BY sourceTimestamp DESC
      LIMIT 10;
    `);

    let realUsername = "";
    let realDisplayName = "";
    let realEventsCount = nonEnigmaEvents.length;

    for (const ne of nonEnigmaEvents) {
      try {
        const nep = JSON.parse(ne.payload);
        const neu = nep.user || {};
        if (neu.displayId && !neu.displayId.toLowerCase().includes("enigma")) {
          realUsername = neu.displayId;
          realDisplayName = neu.nickname || neu.displayId;
          break;
        }
      } catch {}
    }

    // Also check Supporter table
    let diamondsUnderReal = 0;
    const supporter = await prisma.supporter.findFirst({
      where: {
        OR: [
          { platformUserId: uid },
          { platformUserId: secUid },
        ]
      }
    });

    if (supporter) {
      diamondsUnderReal = supporter.totalDiamonds;
      if (!realUsername && !supporter.username.toLowerCase().includes("enigma")) {
        realUsername = supporter.username;
        realDisplayName = supporter.displayName;
      }
    }

    if (realUsername) {
      matches.push({
        platformUserId: uid,
        secUid,
        realUsername,
        realDisplayName,
        enigmaUsername,
        enigmaDisplayName,
        diamondsUnderEnigma: data.diamonds,
        diamondsUnderReal,
        giftsUnderEnigma: data.gifts,
        enigmaEventsCount: data.enigmaPayloads.length,
        realEventsCount,
        confidenceScore: 0.99, // Exact technical secUid / platformUserId match
        matchLevel: "STRONG_MATCH",
      });
    }
  }

  console.log(`\n=== IDENTIFIED ENIGMA MATCHES: ${matches.length} ===`);
  for (const m of matches) {
    console.log(`--------------------------------------------------`);
    console.log(`🎯 Real Persona: @${m.realUsername} (${m.realDisplayName})`);
    console.log(`🎭 Enigma Persona: @${m.enigmaUsername} (${m.enigmaDisplayName})`);
    console.log(`🆔 UID: ${m.platformUserId}`);
    console.log(`💎 Diamonds with Enigma: ${m.diamondsUnderEnigma.toLocaleString()} | Real Diamonds: ${m.diamondsUnderReal.toLocaleString()}`);
    console.log(`📊 Enigma Events: ${m.enigmaEventsCount} | Real Events: ${m.realEventsCount}`);
    console.log(`🎁 Enigma Gifts:`, m.giftsUnderEnigma.slice(0, 3));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
