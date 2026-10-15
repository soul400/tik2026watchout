import { RealTikTokConnectorAdapter } from "../lib/tiktok-adapter";
import { LiveEventPipeline } from "../lib/event-pipeline";
import { prisma } from "../lib/prisma";
import { SmartInventoryService } from "../lib/smart-inventory";
import { BattleScoreResolver } from "../lib/battle-score-resolver";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWorker() {
  const targetUsername = process.env.DEFAULT_STREAMER_USERNAME || "mohra.2000";

  console.log("==================================================");
  console.log(`[Worker] LIVE Ingestion Worker for @${targetUsername}`);
  console.log(`[Worker] Direct Connection Engine: TikTokLiveConnection v2.5.0 (Active)`);
  console.log(`[Worker] Mode: Zero-Cookie Direct Ingestion`);
  console.log("==================================================");

  const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
  if (!tenant) {
    console.error("[Worker] Tenant 'mohra-live' not found! Run npm run db:seed first.");
    process.exit(1);
  }

  const streamer = await prisma.streamerAccount.findFirst({
    where: { tenantId: tenant.id, username: targetUsername },
  });

  if (!streamer) {
    console.error(`[Worker] Streamer account @${targetUsername} not found.`);
    process.exit(1);
  }

  // Close any previously unclosed sessions
  await prisma.liveSession.updateMany({
    where: { tenantId: tenant.id, status: "LIVE" },
    data: { status: "ENDED", endedAt: new Date() },
  });

  const adapter = new RealTikTokConnectorAdapter({
    enableExtendedGiftInfo: false,
  });

  let activeSessionId: string | null = null;
  let activePipeline: LiveEventPipeline | null = null;

  adapter.on("connected", async (state: any) => {
    const roomId = state?.roomId || "Active";
    console.log(`\n[Worker] 🟢 CONNECTED TO LIVE STREAM! Room ID: ${roomId}`);

    const liveSession = await prisma.liveSession.create({
      data: {
        tenantId: tenant.id,
        streamerAccountId: streamer.id,
        status: "LIVE",
        startedAt: new Date(),
        dataConfidence: "VERIFIED",
      },
    });

    activeSessionId = liveSession.id;
    activePipeline = new LiveEventPipeline(tenant.id, liveSession.id, adapter);
    console.log(`[Worker] Active Session Created: ${liveSession.id}`);
  });

  adapter.on("gift", (data: any) => {
    const actor = data.user?.displayId || data.uniqueId || data.user?.nickname || "supporter";
    const giftName = data.gift?.name || data.giftName || "Gift";
    const repeatCount = Number(data.repeatCount || 1);
    const diamonds = Number(data.diamondCount || data.gift?.diamondCount || 0) * repeatCount;
    console.log(`[LIVE GIFT] 🎁 ${giftName} x${repeatCount} (${diamonds} 💎) from @${actor}`);
  });

  adapter.on("chat", (data: any) => {
    const actor = data.user?.displayId || data.uniqueId || data.user?.nickname || "user";
    const comment = data.content || data.comment || "";
    console.log(`[LIVE CHAT] 💬 @${actor}: ${comment}`);
  });

  adapter.on("like", (data: any) => {
    const actor = data.user?.displayId || data.uniqueId || data.user?.nickname || "user";
    const count = Number(data.likeCount || data.count || 1);
    console.log(`[LIVE LIKE] ❤️ @${actor} sent ${count} likes`);
  });

  adapter.on("linkMicBattle", (data: any) => {
    console.log(`[LIVE BATTLE] ⚔️ Battle Event: ID ${data.battleId || "round"}`);
  });

  adapter.on("linkMicArmies", (data: any) => {
    console.log(`[LIVE ARMIES] 🛡️ Battle Armies Updated`);
  });

  adapter.on("linkMicBattleItemCard", (data: any) => {
    // Log the raw payload so we know what TikTok actually sends
    const topKeys = Object.keys(data || {}).filter((k) => !['common'].includes(k));
    const awardedCount = data?.awardCardNotice?.awardedUsers?.length ?? 0;
    const noticeCardType = data?.awardCardNotice?.cardType ?? 'N/A';
    const noticeCardName = data?.awardCardNotice?.cardName ?? data?.awardCardNotice?.toolKey ?? 'N/A';
    console.log(
      `[LIVE TACTICAL TOOL] ⚡ ItemCard | msgType=${data?.msgType} | battle=${data?.battleId || 'none'} | awardedUsers=${awardedCount} | cardType=${noticeCardType} | cardName=${noticeCardName} | topKeys=[${topKeys.join(',')}]`
    );
  });

  adapter.on("linkMicBattleTask", (data: any) => {
    const topKeys = Object.keys(data || {}).filter((k) => !['common'].includes(k));
    console.log(
      `[LIVE BATTLE TASK] 📋 BattleTask event | msgType=${data?.msgType} | topKeys=[${topKeys.join(',')}]`
    );
  });

  adapter.on("streamEnd", async () => {
    console.log("\n[Worker] 🔴 Stream ended by host.");
    if (activeSessionId) {
      await prisma.liveSession.update({
        where: { id: activeSessionId },
        data: { status: "ENDED", endedAt: new Date() },
      }).catch(() => {});
      activeSessionId = null;
      activePipeline = null;
    }

    // Close any dangling battles and reset score resolver
    await prisma.battle.updateMany({
      where: { tenantId: tenant.id, status: "IN_PROGRESS" },
      data: { status: "COMPLETED", endedAt: new Date() },
    }).catch(() => {});
    BattleScoreResolver.resetBattleTracking();
  });

  adapter.on("disconnected", () => {
    console.log("[Worker] 🔌 Connection closed.");
  });

  adapter.on("error", (err: any) => {
    console.warn(`[Worker] Connection notice: ${err?.message || err}`);
  });

  // Main supervision loop
  console.log(`[Worker] Starting live monitor for @${targetUsername}...`);
  let lastReconcileTime = 0;

  while (true) {
    try {
      // Reconcile tool expirations periodically (every 60s)
      if (Date.now() - lastReconcileTime > 60000) {
        lastReconcileTime = Date.now();
        await SmartInventoryService.reconcileExpirations(tenant.id).catch(() => {});
      }

      const isLive = await adapter.checkIsLive(targetUsername);

      if (isLive) {
        console.log(`[Worker] 📡 Streamer @${targetUsername} is LIVE! Establishing connection...`);
        const connected = await adapter.connect(targetUsername);
        if (connected) {
          // Wait while connected
          while (adapter.isConnected()) {
            if (Date.now() - lastReconcileTime > 60000) {
              lastReconcileTime = Date.now();
              await SmartInventoryService.reconcileExpirations(tenant.id).catch(() => {});
            }
            await sleep(3000);
          }
          console.log(`[Worker] Session finished. Resuming monitor...`);
        }
      } else {
        process.stdout.write(`\r[Worker] ⏳ @${targetUsername} is offline. Checking again in 15s... [${new Date().toLocaleTimeString()}]`);
        await sleep(15000);
      }
    } catch (err: any) {
      console.warn(`\n[Worker] Check loop warning: ${err?.message || err}. Retrying in 10s...`);
      await sleep(10000);
    }
  }
}

runWorker().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});
