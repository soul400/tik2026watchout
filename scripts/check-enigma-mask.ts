import { prisma } from "../src/lib/prisma";

async function main() {
  const enigmaTrue = await prisma.$queryRawUnsafe<any[]>(`
    SELECT id, sourceTimestamp, payload 
    FROM RawEvent 
    WHERE eventType = 'GIFT' 
      AND (payload LIKE '%"isEnigmaMaskOn":true%' OR payload LIKE '%"isEnigmaMaskOn": true%')
    LIMIT 20;
  `);

  console.log(`Events with isEnigmaMaskOn = true: ${enigmaTrue.length}`);
  for (const r of enigmaTrue) {
    const p = JSON.parse(r.payload);
    console.log("Enigma Mask ON Event:");
    console.log("User:", JSON.stringify(p.user, null, 2));
    console.log("Gift:", p.gift?.name || p.giftName, "Diamonds:", p.diamondCount);
  }

  // Also check if there are other enigma fields or masks in any raw events
  const otherEnigma = await prisma.$queryRawUnsafe<any[]>(`
    SELECT id, sourceTimestamp, payload 
    FROM RawEvent 
    WHERE eventType = 'GIFT' 
      AND payload LIKE '%mask%'
    LIMIT 10;
  `);
  console.log(`Events matching 'mask': ${otherEnigma.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
