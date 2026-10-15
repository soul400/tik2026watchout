import { prisma } from "../src/lib/prisma";

async function main() {
  const events = await prisma.$queryRawUnsafe<any[]>(`
    SELECT id, eventType, sourceTimestamp, payload 
    FROM RawEvent 
    WHERE payload LIKE '%Enigma RMM77%'
    LIMIT 3;
  `);

  for (const e of events) {
    const p = JSON.parse(e.payload);
    console.log("Enigma event user object:");
    console.log({
      id: p.user?.id,
      secUid: p.user?.secUid,
      displayId: p.user?.displayId,
      nickname: p.user?.nickname,
      enigmaInfo: p.user?.enigmaInfo,
      payGrade: p.user?.payGrade?.level,
    });
  }

  const njdEvents = await prisma.$queryRawUnsafe<any[]>(`
    SELECT id, eventType, sourceTimestamp, payload 
    FROM RawEvent 
    WHERE payload LIKE '%njd_000%'
    LIMIT 3;
  `);

  for (const e of njdEvents) {
    const p = JSON.parse(e.payload);
    console.log("njd_000 event user object:");
    console.log({
      id: p.user?.id,
      secUid: p.user?.secUid,
      displayId: p.user?.displayId,
      nickname: p.user?.nickname,
      enigmaInfo: p.user?.enigmaInfo,
      payGrade: p.user?.payGrade?.level,
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
