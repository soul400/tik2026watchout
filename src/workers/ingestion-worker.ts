import { RealTikTokConnectorAdapter } from "../lib/tiktok-adapter";
import { LiveEventPipeline } from "../lib/event-pipeline";
import { prisma } from "../lib/prisma";

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
    console.log(`[LIVE TACTICAL TOOL] ⚡ Tactical Battle Item Card Event Received`);
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
  });

  adapter.on("disconnected", () => {
    console.log("[Worker] 🔌 Connection closed.");
  });

  adapter.on("error", (err: any) => {
    console.warn(`[Worker] Connection notice: ${err?.message || err}`);
  });

  // Main supervision loop
  console.log(`[Worker] Starting live monitor for @${targetUsername}...`);

  while (true) {
    try {
      const isLive = await adapter.checkIsLive(targetUsername);

      if (isLive) {
        console.log(`[Worker] 📡 Streamer @${targetUsername} is LIVE! Establishing connection...`);
        const connected = await adapter.connect(targetUsername);
        if (connected) {
          // Wait while connected
          while (adapter.isConnected()) {
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
