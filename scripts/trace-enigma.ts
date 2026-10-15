import { prisma } from "../src/lib/prisma";

async function main() {
  const events = await prisma.$queryRawUnsafe<any[]>(`
    SELECT id, eventType, sourceTimestamp, payload 
    FROM RawEvent 
    WHERE (payload LIKE '%Enigma RMM77%' OR payload LIKE '%7195697828512646150%')
    ORDER BY sourceTimestamp ASC
    LIMIT 20;
  `);

  console.log(`Found ${events.length} events for Enigma RMM77 / 7195697828512646150:`);
  for (const e of events) {
    const p = JSON.parse(e.payload);
    const u = p.user || {};
    const isMaskOn = u.enigmaInfo?.isEnigmaMaskOn ?? false;
    console.log(`[${e.sourceTimestamp}] Type: ${e.eventType} | displayId: ${u.displayId} | nickname: ${u.nickname} | MaskOn: ${isMaskOn} | Gift: ${p.gift?.name || p.giftName || 'none'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
