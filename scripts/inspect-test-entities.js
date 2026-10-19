const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkGrantsAndSupporters() {
  const grants = await prisma.toolGrant.findMany({
    where: {
      OR: [
        { auditReference: { contains: 'test' } },
        { auditReference: { contains: 'Test' } },
        { sourceEventId: { contains: 'test' } },
        { sourceEventId: { contains: 'Test' } },
        { supporter: { platformUserId: { contains: 'test' } } }
      ]
    },
    include: { supporter: true, toolDefinition: true }
  });
  console.log('Test tool grants count:', grants.length);
  if (grants.length > 0) {
    console.log('Sample test grants:', grants.map(g => ({
      id: g.id,
      tool: g.toolDefinition?.key,
      supporter: g.supporter?.displayName,
      audit: g.auditReference,
      eventId: g.sourceEventId
    })));
  }

  const testSupporters = await prisma.supporter.findMany({
    where: {
      OR: [
        { platformUserId: { contains: 'test' } },
        { username: { contains: 'test' } },
        { displayName: { contains: 'test' } },
        { displayName: { contains: 'Test' } }
      ]
    }
  });
  console.log('\nTest supporters count:', testSupporters.length);
  if (testSupporters.length > 0) {
    console.log('Test supporters:', testSupporters.map(s => ({
      id: s.id,
      platformUserId: s.platformUserId,
      username: s.username,
      name: s.displayName
    })));
  }

  const testConsumptions = await prisma.toolConsumption.findMany({
    where: {
      OR: [
        { sourceEventId: { contains: 'test' } },
        { notes: { contains: 'Test' } },
        { notes: { contains: 'test' } }
      ]
    }
  });
  console.log('\nTest consumptions count:', testConsumptions.length);
}

checkGrantsAndSupporters().finally(() => prisma.$disconnect());
