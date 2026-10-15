import { prisma } from "../src/lib/prisma";

async function main() {
  const events = await prisma.$queryRawUnsafe<any[]>(`
    SELECT id, eventType, sourceTimestamp, payload 
    FROM RawEvent 
    WHERE (payload LIKE '%"isEnigmaMaskOn":true%' OR payload LIKE '%"isEnigmaMaskOn": true%')
      AND payload LIKE '%njd_000%'
    LIMIT 5;
  `);

  console.log(`Events matching both isEnigmaMaskOn:true AND njd_000: ${events.length}`);
  for (const e of events) {
    const p = JSON.parse(e.payload);
    console.log("-----------------------------------------");
    console.log("Root user displayId:", p.user?.displayId, "nickname:", p.user?.nickname);
    console.log("Root user isEnigmaMaskOn:", p.user?.enigmaInfo?.isEnigmaMaskOn);
    // Is there another user in the payload? (e.g. mention, battle anchor, recipient)
    const str = JSON.stringify(p);
    // Find where isEnigmaMaskOn appears in the JSON
    const idx = str.indexOf("isEnigmaMaskOn");
    console.log("Snippet around isEnigmaMaskOn:", str.slice(Math.max(0, idx - 50), idx + 80));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
