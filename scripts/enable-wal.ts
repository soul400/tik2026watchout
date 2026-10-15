import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await prisma.$queryRawUnsafe<any[]>("PRAGMA journal_mode = WAL;");
  console.log("Journal mode set:", result);
  await prisma.$executeRawUnsafe("PRAGMA busy_timeout = 10000;");
  console.log("Busy timeout set to 10s.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
