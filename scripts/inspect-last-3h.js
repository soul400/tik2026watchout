const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectRecentData() {
  const cutoff = new Date(Date.now() - 3.5 * 60 * 60 * 1000); // 3.5 hours ago (~09:30 UTC / 12:30 Riyadh)
  console.log('Inspecting data created after:', cutoff.toISOString(), 'Local:', cutoff.toLocaleString('ar-SA'));

  const tenants = await prisma.tenant.findMany();
  console.log('\nTenants:', tenants.map(t => ({ id: t.id, slug: t.slug, name: t.name })));

  const liveSessionsRecent = await prisma.liveSession.findMany({
    where: { startedAt: { gte: cutoff } },
    select: { id: true, tenantId: true, startedAt: true, totalDiamonds: true, totalComments: true, status: true }
  });
  console.log('\nLiveSessions in last 3.5h count:', liveSessionsRecent.length);
  if (liveSessionsRecent.length > 0) {
    console.log('Sample LiveSessions:', liveSessionsRecent.slice(0, 5));
  }

  const battlesRecent = await prisma.battle.findMany({
    where: { startedAt: { gte: cutoff } },
    select: { id: true, tenantId: true, battleType: true, startedAt: true, team1Score: true, team2Score: true }
  });
  console.log('\nBattles in last 3.5h count:', battlesRecent.length);
  if (battlesRecent.length > 0) {
    console.log('Sample Battles:', battlesRecent.slice(0, 5));
  }

  const toolGrantsRecent = await prisma.toolGrant.findMany({
    where: { receivedAt: { gte: cutoff } },
    select: { id: true, tenantId: true, supporterId: true, toolDefinitionId: true, quantityGranted: true, auditReference: true, sourceEventId: true }
  });
  console.log('\nToolGrants in last 3.5h count:', toolGrantsRecent.length);

  const toolConsumptionsRecent = await prisma.toolConsumption.findMany({
    where: { consumedAt: { gte: cutoff } },
    select: { id: true, tenantId: true, quantity: true, battleId: true, sourceEventId: true }
  });
  console.log('\nToolConsumptions in last 3.5h count:', toolConsumptionsRecent.length);

  const ledgerMovementsRecent = await prisma.toolLedgerMovement.findMany({
    where: { createdAt: { gte: cutoff } },
    select: { id: true, tenantId: true, movementType: true, toolKey: true, quantity: true, sourceEventId: true, reason: true }
  });
  console.log('\nLedgerMovements in last 3.5h count:', ledgerMovementsRecent.length);
  if (ledgerMovementsRecent.length > 0) {
    console.log('Sample LedgerMovements:', ledgerMovementsRecent);
  }

  const supportersRecent = await prisma.supporter.findMany({
    where: { firstObservedAt: { gte: cutoff } },
    select: { id: true, tenantId: true, username: true, displayName: true, platformUserId: true, totalDiamonds: true }
  });
  console.log('\nSupporters first observed in last 3.5h count:', supportersRecent.length);
  if (supportersRecent.length > 0) {
    console.log('Supporters:', supportersRecent);
  }

  const healthLogsRecent = await prisma.streamHealthLog.findMany({
    where: { timestamp: { gte: cutoff } }
  });
  console.log('\nStreamHealthLogs in last 3.5h count:', healthLogsRecent.length);

  const testTenantRecords = {
    enigmaReviews: await prisma.enigmaReview.count({ where: { tenantId: 'test-upgrade-tenant' } }),
    auditLogs: await prisma.auditLog.count({ where: { tenantId: 'test-upgrade-tenant' } }),
    tenants: await prisma.tenant.count({ where: { id: 'test-upgrade-tenant' } }),
  };
  console.log('\nTest Tenant (test-upgrade-tenant) records:', testTenantRecords);

  const rawEventsRecent = await prisma.rawEvent.count({
    where: { receivedAt: { gte: cutoff } }
  });
  console.log('\nRawEvents in last 3.5h count:', rawEventsRecent);
}

inspectRecentData().finally(() => prisma.$disconnect());
