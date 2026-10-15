import { prisma } from "../src/lib/prisma";
import { EnigmaEngine } from "../src/lib/enigma-engine";

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
  if (!tenant) return;

  console.log(`Running Enigma analysis for ${tenant.name}...`);
  const synced = await EnigmaEngine.analyzeAndSyncEnigmaReviews(tenant.id);
  console.log(`Successfully synced ${synced} Enigma reviews.`);

  const reviews = await EnigmaEngine.getEnigmaReviews(tenant.id);
  console.log(`Retrieved ${reviews.length} Enigma candidates:`);

  for (const r of reviews.slice(0, 10)) {
    console.log(`- [${r.matchLevel}] @${r.evidence.realUsername} <---> @${r.evidence.enigmaUsername} | Diamonds: ${r.evidence.diamondsWithEnigma.toLocaleString()} 💎 | Score: ${(r.confidenceScore * 100).toFixed(0)}%`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
