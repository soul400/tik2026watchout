const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupTestData() {
  // Cutoff set to 3.5 hours ago to safely encompass all testing activity from 13:00+03:00 onwards
  const cutoff = new Date(Date.now() - 3.5 * 60 * 60 * 1000);
  console.log('=== Cleaning Test Data Generated in Last 3.5 Hours ===');
  console.log('Cutoff timestamp (UTC):', cutoff.toISOString());
  console.log('Cutoff timestamp (Local Riyadh):', cutoff.toLocaleString('ar-SA'));

  const results = {};

  // 1. BattleScoreEvents from test suites
  const deletedScoreEvents = await prisma.battleScoreEvent.deleteMany({
    where: { timestamp: { gte: cutoff } }
  });
  results.battleScoreEvents = deletedScoreEvents.count;

  // 2. Recent test battles and participants
  const testBattles = await prisma.battle.findMany({
    where: { startedAt: { gte: cutoff } },
    select: { id: true }
  });
  const testBattleIds = testBattles.map(b => b.id);

  const deletedParticipants = await prisma.battleParticipant.deleteMany({
    where: { battleId: { in: testBattleIds } }
  });
  results.battleParticipants = deletedParticipants.count;

  const deletedBattles = await prisma.battle.deleteMany({
    where: { id: { in: testBattleIds } }
  });
  results.battles = deletedBattles.count;

  // 3. Recent test LiveSessions
  const deletedSessions = await prisma.liveSession.deleteMany({
    where: { startedAt: { gte: cutoff } }
  });
  results.liveSessions = deletedSessions.count;

  // 4. Test ToolLedgerMovements
  const deletedMovements = await prisma.toolLedgerMovement.deleteMany({
    where: { createdAt: { gte: cutoff } }
  });
  results.toolLedgerMovements = deletedMovements.count;

  // 5. Test StreamHealthLogs
  const deletedHealthLogs = await prisma.streamHealthLog.deleteMany({
    where: { timestamp: { gte: cutoff } }
  });
  results.streamHealthLogs = deletedHealthLogs.count;

  // 6. Test AuditLogs
  const deletedAuditLogs = await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { createdAt: { gte: cutoff } },
        { tenantId: 'test-upgrade-tenant' },
        { tenantId: 'test-inventory-tenant' }
      ]
    }
  });
  results.auditLogs = deletedAuditLogs.count;

  // 7. Test EnigmaReviews
  const deletedEnigmas = await prisma.enigmaReview.deleteMany({
    where: {
      OR: [
        { tenantId: 'test-upgrade-tenant' },
        { tenantId: 'test-inventory-tenant' }
      ]
    }
  });
  results.enigmaReviews = deletedEnigmas.count;

  // 8. Test TelegramNotificationLogs
  const deletedTelegramLogs = await prisma.telegramNotificationLog.deleteMany({
    where: { createdAt: { gte: cutoff } }
  });
  results.telegramNotificationLogs = deletedTelegramLogs.count;

  // 9. Test Tenants
  const deletedTenants = await prisma.tenant.deleteMany({
    where: { id: { in: ['test-upgrade-tenant', 'test-inventory-tenant'] } }
  });
  results.testTenants = deletedTenants.count;

  console.log('\n--- Deletion Summary ---');
  console.table(results);

  // 10. Verify remaining clean state for mohra-live
  const mohraTenant = await prisma.tenant.findUnique({ where: { slug: 'mohra-live' } });
  if (mohraTenant) {
    const remainingSessions = await prisma.liveSession.count({ where: { tenantId: mohraTenant.id } });
    const remainingBattles = await prisma.battle.count({ where: { tenantId: mohraTenant.id } });
    const remainingSupporters = await prisma.supporter.count({ where: { tenantId: mohraTenant.id } });
    const remainingGrants = await prisma.toolGrant.count({ where: { tenantId: mohraTenant.id } });

    console.log('\n--- Verified Production State (mohra-live) ---');
    console.log(`Remaining Historical Sessions: ${remainingSessions}`);
    console.log(`Remaining Battles: ${remainingBattles}`);
    console.log(`Remaining Supporters: ${remainingSupporters}`);
    console.log(`Remaining Tool Grants: ${remainingGrants}`);
  }
}

cleanupTestData()
  .catch((err) => {
    console.error('Cleanup error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
