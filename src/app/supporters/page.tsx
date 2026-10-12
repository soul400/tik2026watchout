import { prisma } from "@/lib/prisma";
import { StreamerHudHeader } from "@/components/StreamerHudHeader";
import { LiveSupportersView } from "@/components/LiveSupportersView";

export const dynamic = "force-dynamic";

export default async function SupportersPage() {
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

  // 1. Fetch ONLY supporters with > 10,000 diamonds (Financial Tier)
  const supportersBySupport = await prisma.supporter.findMany({
    where: {
      tenantId,
      totalDiamonds: { gt: 10000 },
    },
    orderBy: { totalDiamonds: "desc" },
  });

  // 2. Compute presence duration for each supporter
  const supportersWithPresence = supportersBySupport.map((s) => {
    const presenceMinutes = Math.max(
      15,
      Math.round((s.lastObservedAt.getTime() - s.firstObservedAt.getTime()) / (1000 * 60))
    );
    const presenceHours = (presenceMinutes / 60).toFixed(1);

    return {
      ...s,
      firstObservedAt: s.firstObservedAt.toISOString(),
      lastObservedAt: s.lastObservedAt.toISOString(),
      presenceMinutes,
      presenceHours,
    };
  });

  // 3. Sort by Presence (For Attendance Leaderboard)
  const supportersByPresence = [...supportersWithPresence].sort(
    (a, b) => b.presenceMinutes - a.presenceMinutes
  );

  const totalDiamonds = supportersBySupport.reduce((acc, s) => acc + s.totalDiamonds, 0);
  const totalPresenceHours = supportersWithPresence.reduce(
    (acc, s) => acc + parseFloat(s.presenceHours),
    0
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* 1. TOP STREAMER HUD HEADER */}
      <StreamerHudHeader streamer={streamer} isLive={isCurrentlyLive} />

      {/* 2. REAL-TIME AUTO-UPDATING SUPPORTERS VIEW */}
      <LiveSupportersView
        initialSupportersBySupport={supportersWithPresence as any}
        initialSupportersByPresence={supportersByPresence as any}
        initialTotalDiamonds={totalDiamonds}
        initialTotalPresenceHours={totalPresenceHours}
      />
    </div>
  );
}
