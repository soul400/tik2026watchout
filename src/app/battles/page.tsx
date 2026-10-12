import { prisma } from "@/lib/prisma";
import { StreamerHudHeader } from "@/components/StreamerHudHeader";
import { ActiveBattleArena } from "@/components/ActiveBattleArena";

export const dynamic = "force-dynamic";

export default async function BattlesPage() {
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

  // Fetch current in-progress battle or the latest one
  const activeBattle = await prisma.battle.findFirst({
    where: { tenantId },
    include: {
      participants: true,
    },
    orderBy: { startedAt: "desc" },
  });

  const serializedBattle = activeBattle
    ? {
        ...activeBattle,
        startedAt: activeBattle.startedAt.toISOString(),
      }
    : null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 1. TOP STREAMER HUD HEADER */}
      <StreamerHudHeader streamer={streamer} isLive={isCurrentlyLive} />

      {/* 2. SINGLE ACTIVE BATTLE ARENA */}
      <ActiveBattleArena
        initialBattle={serializedBattle as any}
        streamer={streamer}
        isLive={isCurrentlyLive}
      />
    </div>
  );
}
