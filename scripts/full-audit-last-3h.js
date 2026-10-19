const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fullAudit() {
  const cutoff = new Date(Date.now() - 3.5 * 60 * 60 * 1000);
  console.log('Cutoff:', cutoff.toISOString());

  // 1. LiveSessions
  const sessions = await prisma.liveSession.findMany({
    where: { startedAt: { gte: cutoff } },
  });
  console.log(`LiveSession (last 3.5h): ${sessions.length}`);

  // 2. Battles
  const battles = await prisma.battle.findMany({
    where: { startedAt: { gte: cutoff } },
  });
  console.log(`Battle (last 3.5h): ${battles.length}`);

  // 3. BattleParticipants
  const participants = await prisma.battleParticipant.findMany({
    where: { battleId: { in: battles.map(b => b.id) } }
  });
  console.log(`BattleParticipant (in recent battles): ${participants.length}`);

  // 4. BattleScoreEvents
  const scoreEvents = await prisma.battleScoreEvent.findMany({
    where: { timestamp: { gte: cutoff } }
  });
  console.log(`BattleScoreEvent (last 3.5h): ${scoreEvents.length}`);

  // 5. ToolGrants
  const grants = await prisma.toolGrant.findMany({
    where: { receivedAt: { gte: cutoff } }
  });
  console.log(`ToolGrant (last 3.5h): ${grants.length}`);

  // 6. ToolConsumptions
  const consumptions = await prisma.toolConsumption.findMany({
    where: { consumedAt: { gte: cutoff } }
  });
  console.log(`ToolConsumption (last 3.5h): ${consumptions.length}`);

  // 7. ToolLedgerMovements
  const ledgerMovements = await prisma.toolLedgerMovement.findMany({
    where: { createdAt: { gte: cutoff } }
  });
  console.log(`ToolLedgerMovement (last 3.5h): ${ledgerMovements.length}`);

  // 8. RawEvents
  const rawEvents = await prisma.rawEvent.findMany({
    where: { receivedAt: { gte: cutoff } }
  });
  console.log(`RawEvent (last 3.5h): ${rawEvents.length}`);

  // 9. StreamHealthLog
  const healthLogs = await prisma.streamHealthLog.findMany({
    where: { timestamp: { gte: cutoff } }
  });
  console.log(`StreamHealthLog (last 3.5h): ${healthLogs.length}`);

  // 10. AuditLog
  const auditLogs = await prisma.auditLog.findMany({
    where: { createdAt: { gte: cutoff } }
  });
  console.log(`AuditLog (last 3.5h): ${auditLogs.length}`);

  // 11. EnigmaReview
  const enigmaReviews = await prisma.enigmaReview.findMany({
    where: {
      OR: [
        { reviewedAt: { gte: cutoff } },
        { tenantId: 'test-upgrade-tenant' }
      ]
    }
  });
  console.log(`EnigmaReview (recent/test): ${enigmaReviews.length}`);

  // 12. TelegramNotificationLog
  const telegramLogs = await prisma.telegramNotificationLog.findMany({
    where: { createdAt: { gte: cutoff } }
  });
  console.log(`TelegramNotificationLog (last 3.5h): ${telegramLogs.length}`);

  // 13. Test Tenant
  const testTenant = await prisma.tenant.findMany({
    where: { id: { in: ['test-upgrade-tenant', 'test-inventory-tenant'] } }
  });
  console.log(`Test Tenants: ${testTenant.map(t => t.id).join(', ')}`);
}

fullAudit().finally(() => prisma.$disconnect());
