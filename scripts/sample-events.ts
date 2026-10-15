import { prisma } from "../src/lib/prisma";

async function main() {
  const events = await prisma.rawEvent.findMany({
    select: {
      eventType: true,
      sourceTimestamp: true,
      payload: true,
    },
    take: 200,
  });

  console.log("Sample 5 raw events:");
  for (const e of events.slice(0, 5)) {
    const d = new Date(e.sourceTimestamp);
    const riyadhHour = (d.getUTCHours() + 3) % 24;
    console.log(`Type: ${e.eventType} | UTC: ${d.toISOString()} | RiyadhHour: ${riyadhHour}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
