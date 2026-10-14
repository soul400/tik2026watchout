import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=================================================");
  console.log("CLEANING CORRUPTED HISTORICAL PK BATTLE GRANTS...");
  console.log("=================================================");

  // 1. Find all 88 distorted battle grants (card_...)
  const distortedGrants = await prisma.toolGrant.findMany({
    where: {
      sourceEventId: { startsWith: "card_" },
      auditReference: { contains: "TikTok Battle Item Card Award" },
    },
    select: { id: true, sourceEventId: true },
  });

  console.log(`Identified ${distortedGrants.length} distorted battle grants falsely attributed to GLOVE.`);

  const grantIds = distortedGrants.map((g) => g.id);

  // 2. Delete all consumptions linked to these grants or battle activation
  const deletedConsumptions = await prisma.toolConsumption.deleteMany({
    where: {
      OR: [
        { toolGrantId: { in: grantIds } },
        { notes: { contains: "Live TikTok Battle Card Activation" } },
      ],
    },
  });
  console.log(`Deleted ${deletedConsumptions.count} historical tool consumptions.`);

  // 3. Delete any related alerts
  const deletedAlerts = await prisma.inventoryAlert.deleteMany({
    where: { toolGrantId: { in: grantIds } },
  });
  console.log(`Deleted ${deletedAlerts.count} inventory alerts.`);

  // 4. Delete the distorted grants
  const deletedGrants = await prisma.toolGrant.deleteMany({
    where: { id: { in: grantIds } },
  });
  console.log(`Deleted ${deletedGrants.count} distorted tool grants.`);

  // 5. Reset verified remaining gift grants
  const remainingGrants = await prisma.toolGrant.findMany({
    include: {
      toolDefinition: true,
      supporter: { select: { username: true, displayName: true } },
    },
  });

  for (const g of remainingGrants) {
    await prisma.toolGrant.update({
      where: { id: g.id },
      data: {
        quantityConsumed: 0,
        status: "AVAILABLE",
      },
    });
  }

  console.log("=================================================");
  console.log(`CLEANUP COMPLETE! Remaining Verified Grants: ${remainingGrants.length}`);
  for (const g of remainingGrants) {
    console.log(`  - [${g.toolDefinition.key}] ${g.toolDefinition.name} x${g.quantityGranted} -> @${g.supporter.username} (${g.auditReference})`);
  }
  console.log("=================================================");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
