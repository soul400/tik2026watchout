const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPeriods() {
  const t = await prisma.tenant.findUnique({ where: { slug: 'mohra-live' } });
  console.log('Testing weekly & monthly for tenant:', t.id);

  const supportersInOct = await prisma.supporter.count({
    where: {
      tenantId: t.id,
      lastObservedAt: {
        gte: new Date('2026-10-01T00:00:00Z'),
        lte: new Date('2026-10-31T23:59:59Z'),
      }
    }
  });
  console.log('Supporters active in October 2026:', supportersInOct);

  const supportersInCurrentWeek = await prisma.supporter.count({
    where: {
      tenantId: t.id,
      lastObservedAt: {
        gte: new Date('2026-10-10T00:00:00Z'),
        lte: new Date('2026-10-16T23:59:59Z'),
      }
    }
  });
  console.log('Supporters active in Current Week (10-16 Oct 2026):', supportersInCurrentWeek);
}

testPeriods().finally(() => prisma.$disconnect());
