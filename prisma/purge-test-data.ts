import { prisma } from "../src/lib/prisma";

async function purgeTestData() {
  console.log("==========================================");
  console.log("PURGING TEST RESIDUALS FROM DATABASE...");
  console.log("==========================================");

  // 1. Identify test supporters
  const testSupporters = await prisma.supporter.findMany({
    where: {
      OR: [
        { displayName: { contains: "التكامل" } },
        { displayName: { contains: "تجريبي" } },
        { username: { startsWith: "agg_" } },
        { platformUserId: { startsWith: "supporter_cross_" } },
        { platformUserId: { startsWith: "test_" } },
      ],
    },
    select: { id: true, platformUserId: true, displayName: true },
  });

  const testSupporterIds = testSupporters.map((s) => s.id);
  console.log(`Found ${testSupporters.length} test supporter records.`);

  // 2. Identify test tool grants
  const testGrants = await prisma.toolGrant.findMany({
    where: {
      OR: [
        { supporterId: { in: testSupporterIds } },
        { sourceEventId: { startsWith: "test_" } },
        { sourceEventId: { startsWith: "evt_gift_tactical_" } },
        { sourceEventId: { startsWith: "grant_fog_" } },
        { sourceEventId: { startsWith: "notice_tiktok_" } },
        { sourceEventId: { startsWith: "expired_grant_" } },
        { sourceEventId: { contains: "cross_" } },
      ],
    },
    select: { id: true },
  });

  const testGrantIds = testGrants.map((g) => g.id);
  console.log(`Found ${testGrants.length} test tool grant records.`);

  // 3. Delete related consumptions and alerts
  if (testGrantIds.length > 0 || testSupporterIds.length > 0) {
    const deletedConsumptions = await prisma.toolConsumption.deleteMany({
      where: {
        OR: [
          { toolGrantId: { in: testGrantIds } },
          { supporterId: { in: testSupporterIds } },
          { notes: { contains: "Tactical Fog Triggered in PK Round" } },
        ],
      },
    });
    console.log(`Deleted ${deletedConsumptions.count} test tool consumptions.`);

    const deletedAlerts = await prisma.inventoryAlert.deleteMany({
      where: { toolGrantId: { in: testGrantIds } },
    });
    console.log(`Deleted ${deletedAlerts.count} test inventory alerts.`);

    const deletedGrants = await prisma.toolGrant.deleteMany({
      where: { id: { in: testGrantIds } },
    });
    console.log(`Deleted ${deletedGrants.count} test tool grants.`);
  }

  // 4. Delete test battles
  const testBattles = await prisma.battle.findMany({
    where: {
      OR: [
        { id: { startsWith: "battle_test_" } },
        { participants: { some: { username: { contains: "cross" } } } },
        { participants: { some: { platformUserId: { startsWith: "test_" } } } },
      ],
    },
    select: { id: true },
  });

  if (testBattles.length > 0) {
    const testBattleIds = testBattles.map((b) => b.id);
    await prisma.battleParticipant.deleteMany({
      where: { battleId: { in: testBattleIds } },
    });
    await prisma.battleScoreEvent.deleteMany({
      where: { battleId: { in: testBattleIds } },
    });
    const deletedBattles = await prisma.battle.deleteMany({
      where: { id: { in: testBattleIds } },
    });
    console.log(`Deleted ${deletedBattles.count} test battles.`);
  }

  // 5. Delete test supporters
  if (testSupporterIds.length > 0) {
    const deletedSupporters = await prisma.supporter.deleteMany({
      where: { id: { in: testSupporterIds } },
    });
    console.log(`Deleted ${deletedSupporters.count} test supporters.`);
  }

  console.log("==========================================");
  console.log("DATABASE IS NOW 100% CLEAN OF TEST DATA!");
  console.log("==========================================");
}

purgeTestData()
  .catch((err) => {
    console.error("Error purging test data:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
