import { prisma } from "../src/lib/prisma";

async function main() {
  const events = await prisma.$queryRawUnsafe<any[]>(`
    SELECT id, eventType, sourceTimestamp, payload 
    FROM RawEvent 
    WHERE (payload LIKE '%7195697828512646150%' OR payload LIKE '%AMLFsBY6Ut9GrZwzTA0ZOtNimHXnBU-F9D7g_Dye4kqTrZZE-8TxTHZlw5nt95dY6%')
      AND payload NOT LIKE '%"isEnigmaMaskOn":true%'
    LIMIT 10;
  `);

  console.log(`Events for 7195697828512646150 without Enigma mask: ${events.length}`);
  for (const e of events) {
    const p = JSON.parse(e.payload);
    console.log(`displayId: ${p.user?.displayId} | nickname: ${p.user?.nickname} | mask: ${JSON.stringify(p.user?.enigmaInfo)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
