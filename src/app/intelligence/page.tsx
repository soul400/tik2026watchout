import { prisma } from "@/lib/prisma";
import { IntelligenceLabService } from "@/lib/intelligence-lab-service";
import { IntelligenceLabClient } from "./IntelligenceLabClient";

export const dynamic = "force-dynamic";

export default async function IntelligencePage() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: "mohra-live" },
  });
  const tenantId = tenant?.id || "";

  let overview: any = null;
  let settings: any = null;
  let watchlist: any[] = [];
  let aliasHistories: any[] = [];
  let initialAccounts: any[] = [];

  if (tenantId) {
    try {
      const existingCount = await prisma.intelligenceWatchlist.count({ where: { tenantId } });
      if (existingCount === 0) {
        await IntelligenceLabService.syncHistoricalIntelligenceData(tenantId);
      }

      [overview, settings, watchlist, aliasHistories, initialAccounts] = await Promise.all([
        IntelligenceLabService.getCommandCenterOverview(tenantId),
        IntelligenceLabService.getSettings(tenantId),
        IntelligenceLabService.getWatchlist(tenantId),
        IntelligenceLabService.getAliasHistory({ tenantId, limit: 100 }),
        IntelligenceLabService.searchAccounts(tenantId, "", 100),
      ]);
    } catch (err) {
      console.error("[INTELLIGENCE_PAGE] Initialization error:", err);
    }
  }

  return (
    <IntelligenceLabClient
      tenantId={tenantId}
      initialOverview={overview}
      initialSettings={settings}
      initialWatchlist={watchlist}
      initialAliasHistories={aliasHistories}
      initialAccounts={initialAccounts}
    />
  );
}
