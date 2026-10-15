import { prisma } from "../src/lib/prisma";
import { STQIEngine } from "../src/lib/stqi-engine";

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
  if (!tenant) {
    console.error("Tenant not found!");
    return;
  }

  console.log(`Syncing STQI for tenant ${tenant.name} (${tenant.id})...`);
  const synced = await STQIEngine.syncHourlyAnalytics(tenant.id);
  console.log(`Successfully synced ${synced} hourly records.`);

  const best = await STQIEngine.getBestStreamWindow(tenant.id);
  console.log("Best window dynamic:", best);

  const allRecords = await prisma.hourlyAnalytics.findMany({
    where: { tenantId: tenant.id, dayOfWeek: -1 },
    orderBy: { riyadhHour: "asc" },
  });
  console.log(`Saved ${allRecords.length} aggregate hourly records:`);
  for (const r of allRecords) {
    console.log(
      `Hour ${r.riyadhHour.toString().padStart(2, '0')}:00 | STQI: ${r.stqiScore} | Sessions: ${r.sampleSessions} | Diamonds: ${Math.round(r.avgDiamonds).toLocaleString()} | Consistency: ${Math.round(r.consistencyScore * 100)}% | State: ${r.confidenceState}`
    );
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
