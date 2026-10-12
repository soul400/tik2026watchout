import { prisma } from "@/lib/prisma";
import { SmartInventoryService } from "@/lib/smart-inventory";
import { StreamerHudHeader } from "@/components/StreamerHudHeader";
import { LiveInventoryView } from "@/components/LiveInventoryView";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: "mohra-live" },
    include: { streamers: true },
  });
  const tenantId = tenant?.id || "";
  const streamer = tenant?.streamers[0];

  const activeLiveSession = await prisma.liveSession.findFirst({
    where: { tenantId, status: "LIVE" },
    orderBy: { startedAt: "desc" },
  });
  const isCurrentlyLive = !!activeLiveSession;

  const counters = await SmartInventoryService.getInventoryCounters(tenantId);
  const grants = await prisma.toolGrant.findMany({
    where: { tenantId },
    include: {
      toolDefinition: true,
      supporter: true,
    },
    orderBy: { receivedAt: "desc" },
  });

  const serializedGrants = grants.map((g) => ({
    ...g,
    receivedAt: g.receivedAt.toISOString(),
    expiresAt: g.expiresAt.toISOString(),
  }));

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 1. TOP STREAMER HUD HEADER */}
      <StreamerHudHeader streamer={streamer} isLive={isCurrentlyLive} />

      {/* 2. REAL-TIME AUTO-UPDATING SMART INVENTORY VIEW */}
      <LiveInventoryView
        initialCounters={counters as any}
        initialGrants={serializedGrants as any}
      />
    </div>
  );
}
