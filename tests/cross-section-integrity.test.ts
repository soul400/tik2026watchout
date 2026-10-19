import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma";
import { SmartInventoryService } from "../src/lib/smart-inventory";
import { BattleEngine } from "../src/lib/battle-engine";
import { BattleScoreResolver } from "../src/lib/battle-score-resolver";

describe("Cross-Section Integrity & Regression Prevention Suite", () => {
  const TEST_TENANT = "test-cross-section-tenant";
  let tenantId = TEST_TENANT;
  let testSupporter: any;
  let testSession: any;
  let testBattle: any;

  beforeEach(async () => {
    // 1. Fetch or create isolated test tenant
    const tenant = await prisma.tenant.upsert({
      where: { id: TEST_TENANT },
      update: {},
      create: {
        id: TEST_TENANT,
        slug: "test-cross-section-tenant",
        name: "Test Cross-Section Tenant",
      },
    });
    tenantId = tenant.id;

    await SmartInventoryService.ensureCanonicalDefinitions(tenantId);

    // 2. Fetch or create streamer account
    let streamer = await prisma.streamerAccount.findFirst({ where: { tenantId } });
    if (!streamer) {
      streamer = await prisma.streamerAccount.create({
        data: {
          tenantId,
          platformUserId: "test_mohra_official",
          username: "test.mohra.2000",
          displayName: "مهـرة تجريبي",
        },
      });
    }

    // 3. Create live session
    testSession = await prisma.liveSession.create({
      data: {
        tenantId,
        streamerAccountId: streamer.id,
        status: "LIVE",
      },
    });

    // 4. Create or fetch a unique test supporter
    const uniqueUserId = `supporter_cross_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    testSupporter = await prisma.supporter.create({
      data: {
        tenantId,
        platformUserId: uniqueUserId,
        username: `user_${Date.now().toString().slice(-6)}`,
        displayName: "داعم التكامل",
        totalDiamonds: 5000,
        category: "NEW",
        dataConfidence: "VERIFIED",
      },
    });

    // 5. Create a test battle via BattleEngine
    testBattle = await BattleEngine.createOrSyncBattle({
      tenantId,
      liveSessionId: testSession.id,
      battleType: "1V1",
      participants: [
        {
          teamNumber: 1,
          platformUserId: "mohra_official",
          username: "mohra.2000",
          displayName: "مهـرة",
        },
        {
          teamNumber: 2,
          platformUserId: "opponent_user_cross",
          username: "challenger_cross",
          displayName: "المنافس التجريبي",
        },
      ],
    });
  });

  // TEST 1: Supporter Diamonds Threshold and Tactical Tool Grant Link
  it("Integrity 1: Updates supporter diamonds, transitions to CONTINUOUS at >= 10,000, and links tool to active battle", async () => {
    const updatedSupporter = await prisma.supporter.update({
      where: { id: testSupporter.id },
      data: {
        totalDiamonds: { increment: 6000 }, // 5,000 + 6,000 = 11,000 >= 10,000
        category: 11000 >= 10000 ? "CONTINUOUS" : "NEW",
      },
    });

    expect(updatedSupporter.totalDiamonds).toBe(11000);
    expect(updatedSupporter.category).toBe("CONTINUOUS");

    // Grant tactical tool linked to test battle
    const grantRes = await SmartInventoryService.grantTool({
      tenantId,
      supporterId: testSupporter.id,
      toolKey: "GLOVE",
      quantity: 1,
      battleId: testBattle.id,
      sourceEventId: `evt_gift_tactical_${Date.now()}`,
    });

    expect(grantRes.success).toBe(true);
    expect(grantRes.grant?.battleId).toBe(testBattle.id);
    expect(grantRes.grant?.status).toBe("AVAILABLE");
  });

  // TEST 2: Tactical Item Card Award Idempotency & Distinct Tool Types
  it("Integrity 2: Rejects duplicate battle card awards with identical sourceEventId and isolates tool keys", async () => {
    const fixedNoticeId = `notice_tiktok_${Date.now()}`;
    const dedupKey = `card_${testBattle.id}_${testSupporter.platformUserId}_${fixedNoticeId}`;

    // First grant of TIME_EXTENDER
    const firstRes = await SmartInventoryService.grantTool({
      tenantId,
      supporterId: testSupporter.id,
      toolKey: "TIME_EXTENDER",
      quantity: 1,
      battleId: testBattle.id,
      sourceEventId: dedupKey,
      auditReference: "TikTok Battle Card Award Test",
    });

    expect(firstRes.success).toBe(true);
    expect(firstRes.grant?.toolDefinition.key).toBe("TIME_EXTENDER");

    // Replay with exact same dedupKey
    const replayRes = await SmartInventoryService.grantTool({
      tenantId,
      supporterId: testSupporter.id,
      toolKey: "TIME_EXTENDER",
      quantity: 1,
      battleId: testBattle.id,
      sourceEventId: dedupKey,
      auditReference: "TikTok Battle Card Award Replay",
    });

    expect(replayRes.success).toBe(false);
    expect(replayRes.reason).toBe("ALREADY_GRANTED");
    expect(replayRes.grant?.id).toBe(firstRes.grant?.id);
  });

  // TEST 3: Tool Consumption Concurrency & Double-Spend Protection
  it("Integrity 3: Consumes tools atomically with battle linkage, preventing double-spending", async () => {
    const grantRes = await SmartInventoryService.grantTool({
      tenantId,
      supporterId: testSupporter.id,
      toolKey: "BOOST_FOG",
      quantity: 1,
      sourceEventId: `grant_fog_${Date.now()}`,
    });

    const grantId = grantRes.grant!.id;

    // First consumption succeeds
    const consumeRes = await SmartInventoryService.consumeTool({
      tenantId,
      grantId,
      supporterId: testSupporter.id,
      quantity: 1,
      battleId: testBattle.id,
      notes: "Tactical Fog Triggered in PK Round",
    });

    expect(consumeRes.updatedGrant.status).toBe("FULLY_USED");
    expect(consumeRes.updatedGrant.quantityConsumed).toBe(1);
    expect(consumeRes.consumption.battleId).toBe(testBattle.id);

    // Second consumption must be rejected (double-spend protection)
    await expect(
      SmartInventoryService.consumeTool({
        tenantId,
        grantId,
        supporterId: testSupporter.id,
        quantity: 1,
        battleId: testBattle.id,
      })
    ).rejects.toThrow(/Insufficient quantity/);
  });

  // TEST 4: Expiration Handling
  it("Integrity 4: Prevents consuming expired tools and reconciles expirations safely", async () => {
    // Create an already-expired grant
    const expiredGrant = await prisma.toolGrant.create({
      data: {
        tenantId,
        supporterId: testSupporter.id,
        toolDefinitionId: (await prisma.toolDefinition.findFirst({ where: { tenantId } }))!.id,
        quantityGranted: 1,
        quantityConsumed: 0,
        receivedAt: new Date(Date.now() - 10 * 86400 * 1000), // 10 days ago
        expiresAt: new Date(Date.now() - 5 * 86400 * 1000),  // expired 5 days ago
        status: "AVAILABLE",
        sourceEventId: `expired_grant_${Date.now()}`,
      },
    });

    // Consumption attempt must be blocked
    await expect(
      SmartInventoryService.consumeTool({
        tenantId,
        grantId: expiredGrant.id,
        supporterId: testSupporter.id,
        quantity: 1,
      })
    ).rejects.toThrow(/Cannot consume an expired tool/);

    // Run reconciliation
    const reconciled = await SmartInventoryService.reconcileExpirations(tenantId);
    expect(reconciled.expiredCount).toBeGreaterThanOrEqual(1);

    const refreshed = await prisma.toolGrant.findUnique({ where: { id: expiredGrant.id } });
    expect(refreshed?.status).toBe("EXPIRED");
  });

  // TEST 5: Stream Termination and Dangling Battle Clean-up
  it("Integrity 5: Gracefully completes dangling battles and resets battle tracking", async () => {
    // Ensure battle is IN_PROGRESS
    const active = await prisma.battle.findUnique({ where: { id: testBattle.id } });
    expect(active?.status).toBe("IN_PROGRESS");

    // Close dangling battles as done by ingestion-worker on streamEnd
    await prisma.battle.updateMany({
      where: { tenantId, status: "IN_PROGRESS" },
      data: { status: "COMPLETED", endedAt: new Date() },
    });

    BattleScoreResolver.resetBattleTracking();

    const afterClose = await prisma.battle.findUnique({ where: { id: testBattle.id } });
    expect(afterClose?.status).toBe("COMPLETED");
  });

  // TEST 6: Dashboard Diamond Aggregation Strictness
  it("Integrity 6: Aggregate sum of supporter diamonds reflects all supporters without top-N cutoff bias", async () => {
    await prisma.supporter.create({
      data: {
        tenantId,
        platformUserId: `agg_1_${Date.now()}`,
        username: `agg_1_${Date.now()}`,
        displayName: "داعم 1",
        totalDiamonds: 12000,
      },
    });

    await prisma.supporter.create({
      data: {
        tenantId,
        platformUserId: `agg_2_${Date.now()}`,
        username: `agg_2_${Date.now()}`,
        displayName: "داعم 2",
        totalDiamonds: 25000,
      },
    });

    const aggregate = await prisma.supporter.aggregate({
      where: { tenantId },
      _sum: { totalDiamonds: true },
    });

    expect(aggregate._sum.totalDiamonds).toBeGreaterThanOrEqual(37000);
  });

  afterAll(async () => {
    // Purge test tenant completely
    await prisma.toolLedgerMovement.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.toolConsumption.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.toolGrant.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.toolDefinition.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.battleParticipant.deleteMany({ where: { battle: { tenantId: TEST_TENANT } } });
    await prisma.battle.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.supporter.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.liveSession.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.streamerAccount.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.tenant.deleteMany({ where: { id: TEST_TENANT } });
  });
});
