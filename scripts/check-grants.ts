import { prisma } from '../src/lib/prisma';

async function main() {
  const grants = await prisma.toolGrant.findMany({
    where: { receivedAt: { gte: new Date(Date.now() - 3600000) } },
    orderBy: { receivedAt: 'desc' },
    include: { supporter: true, toolDefinition: true }
  });
  console.log('Recent 1hr grants count:', grants.length);
  for (const g of grants) {
    console.log(`${g.receivedAt.toISOString()} | Supporter: @${g.supporter?.username} | Tool: ${g.toolDefinition.key} (${g.toolDefinition.name}) | Qty: ${g.quantityGranted} | Consumed: ${g.quantityConsumed} | Status: ${g.status} | EventId: ${g.sourceEventId} | Audit: ${g.auditReference}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
