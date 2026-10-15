import { prisma } from "@/lib/prisma";
import { STQIEngine } from "@/lib/stqi-engine";
import { AnalyticsClient } from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
  const tenantId = tenant?.id || "";

  let hourlyData = await prisma.hourlyAnalytics.findMany({
    where: { tenantId, dayOfWeek: -1 },
    orderBy: { riyadhHour: "asc" },
  });

  // If table is empty, auto-sync from existing live sessions
  if (hourlyData.length === 0 && tenantId) {
    await STQIEngine.syncHourlyAnalytics(tenantId);
    hourlyData = await prisma.hourlyAnalytics.findMany({
      where: { tenantId, dayOfWeek: -1 },
      orderBy: { riyadhHour: "asc" },
    });
  }

  const bestWindow = tenantId ? await STQIEngine.getBestStreamWindow(tenantId) : null;
  const smartOverview = tenantId ? await STQIEngine.getSmartAnalyticsOverview(tenantId) : null;

  return (
    <AnalyticsClient
      initialHourly={hourlyData.map((h) => ({
        id: h.id,
        riyadhHour: h.riyadhHour,
        dayOfWeek: h.dayOfWeek,
        sampleSessions: h.sampleSessions,
        avgDiamonds: h.avgDiamonds,
        avgLikes: h.avgLikes,
        avgComments: h.avgComments,
        avgViewers: h.avgViewers,
        stqiScore: h.stqiScore,
        consistencyScore: h.consistencyScore,
        confidenceState: h.confidenceState,
      }))}
      initialBestWindow={bestWindow}
      initialSmartOverview={smartOverview}
    />
  );
}
