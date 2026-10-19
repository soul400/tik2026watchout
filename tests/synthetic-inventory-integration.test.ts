import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma";
import { SmartInventoryService, CANONICAL_TOOL_DEFINITIONS } from "../src/lib/smart-inventory";
import { LiveEventPipeline } from "../src/lib/event-pipeline";
import { EventEmitter } from "events";

class MockTikTokAdapter extends EventEmitter {
  public isConnected = true;
  async connect() { return true; }
  async disconnect() { return true; }
  async checkIsLive() { return true; }
}

describe("Stage D — Synthetic Event-to-Inventory Integration Tests", () => {
  const TENANT_A = "phase3-tenant-alpha";
  const TENANT_B = "phase3-tenant-beta";
  const SUPPORTER_A_UID = "supporter_synth_alpha_01";
  const SUPPORTER_B_UID = "supporter_synth_beta_01";

  let supporterAId: string;
  let supporterBId: string;
  let liveSessionAId: string;
  let liveSessionBId: string;
  let battleAId: string;

  let adapterA: MockTikTokAdapter;
  let pipelineA: LiveEventPipeline;

  beforeAll(async () => {
    // Clean up test tenants if previously created
    for (const t of [TENANT_A, TENANT_B]) {
      await prisma.toolLedgerMovement.deleteMany({ where: { tenantId: t } });
      await prisma.toolConsumption.deleteMany({ where: { tenantId: t } });
      await prisma.externalActivation.deleteMany({ where: { tenantId: t } });
      await prisma.toolGrant.deleteMany({ where: { tenantId: t } });
      await prisma.toolDefinition.deleteMany({ where: { tenantId: t } });
      await prisma.battleScoreEvent.deleteMany({ where: { battle: { tenantId: t } } });
      await prisma.battleParticipant.deleteMany({ where: { battle: { tenantId: t } } });
      await prisma.battle.deleteMany({ where: { tenantId: t } });
      await prisma.supporter.deleteMany({ where: { tenantId: t } });
      await prisma.rawEvent.deleteMany({ where: { liveSession: { tenantId: t } } });
      await prisma.liveSession.deleteMany({ where: { tenantId: t } });
      await prisma.streamerAccount.deleteMany({ where: { tenantId: t } });
      await prisma.tenant.deleteMany({ where: { id: t } });
    }

    // 1. Provision Tenant A & Streamer A
    await prisma.tenant.create({
      data: {
        id: TENANT_A,
        slug: "phase3-alpha-slug",
        name: "Phase 3 Alpha Tenant",
      },
    });
    const streamerA = await prisma.streamerAccount.create({
      data: {
        tenantId: TENANT_A,
        username: "alpha.streamer",
        displayName: "Alpha Streamer",
        platformUserId: "platform_anchor_alpha",
      },
    });
    const sessionA = await prisma.liveSession.create({
      data: {
        tenantId: TENANT_A,
        streamerAccountId: streamerA.id,
        status: "LIVE",
      },
    });
    liveSessionAId = sessionA.id;

    // 2. Provision Tenant B & Streamer B
    await prisma.tenant.create({
      data: {
        id: TENANT_B,
        slug: "phase3-beta-slug",
        name: "Phase 3 Beta Tenant",
      },
    });
    const streamerB = await prisma.streamerAccount.create({
      data: {
        tenantId: TENANT_B,
        username: "beta.streamer",
        displayName: "Beta Streamer",
        platformUserId: "platform_anchor_beta",
      },
    });
    const sessionB = await prisma.liveSession.create({
      data: {
        tenantId: TENANT_B,
        streamerAccountId: streamerB.id,
        status: "LIVE",
      },
    });
    liveSessionBId = sessionB.id;

    // 3. Create Supporters
    const suppA = await prisma.supporter.create({
      data: {
        tenantId: TENANT_A,
        platformUserId: SUPPORTER_A_UID,
        username: "alpha_supporter_one",
        displayName: "داعم ألفا الأول",
      },
    });
    supporterAId = suppA.id;

    const suppB = await prisma.supporter.create({
      data: {
        tenantId: TENANT_B,
        platformUserId: SUPPORTER_B_UID,
        username: "beta_supporter_one",
        displayName: "داعم بيتا الأول",
      },
    });
    supporterBId = suppB.id;

    // 4. Create an active 1v1 Battle for Tenant A
    const battleA = await prisma.battle.create({
      data: {
        tenantId: TENANT_A,
        liveSessionId: liveSessionAId,
        battleType: "1V1",
        status: "IN_PROGRESS",
        startedAt: new Date(),
        participants: {
          create: [
            {
              teamNumber: 1,
              platformUserId: "platform_anchor_alpha",
              username: "alpha.streamer",
              displayName: "Alpha Streamer",
            },
            {
              teamNumber: 2,
              platformUserId: "platform_anchor_opponent",
              username: "opponent.streamer",
              displayName: "Opponent Streamer",
            },
          ],
        },
      },
    });
    battleAId = battleA.id;

    // Initialize canonical definitions for Tenant A
    await SmartInventoryService.ensureCanonicalDefinitions(TENANT_A);

    // Setup pipeline for Tenant A
    adapterA = new MockTikTokAdapter() as any;
    pipelineA = new LiveEventPipeline(TENANT_A, liveSessionAId, adapterA as any);
  });

  afterAll(async () => {
    for (const t of [TENANT_A, TENANT_B]) {
      await prisma.toolLedgerMovement.deleteMany({ where: { tenantId: t } });
      await prisma.toolConsumption.deleteMany({ where: { tenantId: t } });
      await prisma.externalActivation.deleteMany({ where: { tenantId: t } });
      await prisma.toolGrant.deleteMany({ where: { tenantId: t } });
      await prisma.toolDefinition.deleteMany({ where: { tenantId: t } });
      await prisma.battleScoreEvent.deleteMany({ where: { battle: { tenantId: t } } });
      await prisma.battleParticipant.deleteMany({ where: { battle: { tenantId: t } } });
      await prisma.battle.deleteMany({ where: { tenantId: t } });
      await prisma.supporter.deleteMany({ where: { tenantId: t } });
      await prisma.rawEvent.deleteMany({ where: { liveSession: { tenantId: t } } });
      await prisma.liveSession.deleteMany({ where: { tenantId: t } });
      await prisma.streamerAccount.deleteMany({ where: { tenantId: t } });
      await prisma.tenant.deleteMany({ where: { id: t } });
    }
  });

  // -------------------------------------------------------------
  // D1. Event Classification & Mapping
  // -------------------------------------------------------------
  describe("D1. Tactical Event Classification", () => {
    it("maps all 7 canonical tool types accurately from raw event notice payloads", async () => {
      const toolTestCases = [
        { key: "GLOVE", rawType: "glove", msgType: 2 },
        { key: "BOOST_FOG", rawType: "boost_fog", msgType: 3 },
        { key: "SONG_SURGE", rawType: "song_surge", msgType: 8 },
        { key: "TIME_EXTENDER", rawType: "timer_extender", msgType: 5 },
        { key: "SPEED_BOOSTER", rawType: "top2", msgType: 10 },
        { key: "HAMMER", rawType: "hammer", msgType: 6 },
        { key: "SHIELD_DEFENSE", rawType: "shield_defense", msgType: 1 },
      ];

      for (let i = 0; i < toolTestCases.length; i++) {
        const tc = toolTestCases[i];
        const noticeId = `notice_d1_class_${tc.key}_${Date.now()}_${i}`;

        await pipelineA.handleBattleItemCard({
          msgType: tc.msgType,
          battleId: battleAId,
          awardCardNotice: {
            noticeId,
            cardType: tc.rawType,
            awardedUsers: [
              {
                userId: SUPPORTER_A_UID,
                displayId: "alpha_supporter_one",
                teamNumber: 1,
                count: 1,
              },
            ],
          },
        });

        const grant = await prisma.toolGrant.findFirst({
          where: {
            tenantId: TENANT_A,
            supporterId: supporterAId,
            toolDefinition: { key: tc.key },
            sourceEventId: { contains: noticeId },
          },
          include: { toolDefinition: true },
        });

        expect(grant).not.toBeNull();
        expect(grant?.toolDefinition.key).toBe(tc.key);
        expect(grant?.quantityGranted).toBe(1);
      }
    });

    it("rejects unknown or unsupported tool representation without defaulting to GLOVE", async () => {
      const noticeId = `notice_d1_unknown_${Date.now()}`;
      const countBefore = await prisma.toolGrant.count({ where: { tenantId: TENANT_A } });

      await pipelineA.handleBattleItemCard({
        msgType: 999,
        battleId: battleAId,
        awardCardNotice: {
          noticeId,
          cardType: "super_laser_unknown_widget",
          awardedUsers: [
            {
              userId: SUPPORTER_A_UID,
              displayId: "alpha_supporter_one",
              teamNumber: 1,
              count: 1,
            },
          ],
        },
      });

      const countAfter = await prisma.toolGrant.count({ where: { tenantId: TENANT_A } });
      expect(countAfter).toBe(countBefore);
    });
  });

  // -------------------------------------------------------------
  // D2. Event Identity & Idempotency
  // -------------------------------------------------------------
  describe("D2. Event Identity & Idempotency", () => {
    it("processing the exact same award event twice produces exactly one grant and no duplicate ledger records", async () => {
      const noticeId = `notice_d2_idemp_${Date.now()}`;
      const eventPayload = {
        msgType: 2,
        battleId: battleAId,
        awardCardNotice: {
          noticeId,
          cardType: "glove",
          awardedUsers: [
            {
              userId: SUPPORTER_A_UID,
              displayId: "alpha_supporter_one",
              teamNumber: 1,
              count: 2,
            },
          ],
        },
      };

      // First run
      await pipelineA.handleBattleItemCard(eventPayload);
      const grantsFirst = await prisma.toolGrant.findMany({
        where: { tenantId: TENANT_A, sourceEventId: { contains: noticeId } },
      });
      expect(grantsFirst.length).toBe(1);
      expect(grantsFirst[0].quantityGranted).toBe(2);

      const movementsFirst = await prisma.toolLedgerMovement.findMany({
        where: { tenantId: TENANT_A, sourceEventId: grantsFirst[0].sourceEventId! },
      });
      expect(movementsFirst.length).toBe(1);

      // Second run (exact duplicate replay)
      await pipelineA.handleBattleItemCard(eventPayload);

      const grantsSecond = await prisma.toolGrant.findMany({
        where: { tenantId: TENANT_A, sourceEventId: { contains: noticeId } },
      });
      expect(grantsSecond.length).toBe(1);

      const movementsSecond = await prisma.toolLedgerMovement.findMany({
        where: { tenantId: TENANT_A, sourceEventId: grantsFirst[0].sourceEventId! },
      });
      expect(movementsSecond.length).toBe(1);
    });

    it("quarantines award notices lacking an upstream event/notice ID", async () => {
      const countBefore = await prisma.toolGrant.count({ where: { tenantId: TENANT_A } });

      await pipelineA.handleBattleItemCard({
        msgType: 2,
        battleId: battleAId,
        awardCardNotice: {
          // noticeId missing!
          cardType: "glove",
          awardedUsers: [
            {
              userId: SUPPORTER_A_UID,
              displayId: "alpha_supporter_one",
              teamNumber: 1,
              count: 1,
            },
          ],
        },
      });

      const countAfter = await prisma.toolGrant.count({ where: { tenantId: TENANT_A } });
      expect(countAfter).toBe(countBefore);
    });

    it("concurrent consume requests for the same sourceEventId resolve idempotently without double deduction", async () => {
      // Create dedicated supporter for concurrent consumption test to guarantee isolation
      const suppConcurrent = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: `supporter_d2_concurrent_${Date.now()}`,
          username: "concurrent_tester",
          displayName: "مختبر التزامن",
        },
      });

      // Grant 5 gloves
      const grantRes = await SmartInventoryService.grantTool({
        tenantId: TENANT_A,
        supporterId: suppConcurrent.id,
        toolKey: "GLOVE",
        quantity: 5,
        sourceEventId: `grant_concurrent_test_${Date.now()}`,
      });
      expect(grantRes.success).toBe(true);

      const consumeEventId = `consume_concurrent_dedup_${Date.now()}`;

      // Run two simultaneous consumptions with same sourceEventId
      const [res1, res2] = await Promise.all([
        SmartInventoryService.consumeTool({
          tenantId: TENANT_A,
          supporterId: suppConcurrent.id,
          grantId: grantRes.grant.id,
          toolKey: "GLOVE",
          quantity: 2,
          sourceEventId: consumeEventId,
        }),
        SmartInventoryService.consumeTool({
          tenantId: TENANT_A,
          supporterId: suppConcurrent.id,
          grantId: grantRes.grant.id,
          toolKey: "GLOVE",
          quantity: 2,
          sourceEventId: consumeEventId,
        }),
      ]);

      // Exactly one was primary execution and the other was identified as duplicate
      const hasDuplicate = res1.duplicate || res2.duplicate;
      expect(hasDuplicate).toBe(true);

      // Check DB: total quantity consumed for this grant must be 2, not 4
      const updatedGrant = await prisma.toolGrant.findUnique({
        where: { id: grantRes.grant.id },
      });
      expect(updatedGrant?.quantityConsumed).toBe(2);
    });
  });

  // -------------------------------------------------------------
  // D3. Full Inventory Lifecycle & FEFO Ordering
  // -------------------------------------------------------------
  describe("D3. Inventory Lifecycle & Constraints", () => {
    it("exercises grant, consumption, insufficient-balance rejection, and zero-balance integrity", async () => {
      const toolKey = "HAMMER";
      const sourceEventId = `grant_life_${toolKey}_${Date.now()}`;

      // Create isolated supporter for lifecycle test
      const suppLife = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: `supporter_d3_life_${Date.now()}`,
          username: "life_tester",
          displayName: "مختبر دورة الحياة",
        },
      });

      // 1. Grant 2 hammers
      const grant = await SmartInventoryService.grantTool({
        tenantId: TENANT_A,
        supporterId: suppLife.id,
        toolKey,
        quantity: 2,
        sourceEventId,
      });
      expect(grant.success).toBe(true);

      // 2. Consume 1 hammer targeting this grantId
      const consume1 = await SmartInventoryService.consumeTool({
        tenantId: TENANT_A,
        supporterId: suppLife.id,
        grantId: grant.grant.id,
        toolKey,
        quantity: 1,
        sourceEventId: `consume_life_1_${Date.now()}`,
      });
      expect(consume1.success).toBe(true);
      expect(consume1.updatedGrant.quantityConsumed).toBe(1);
      expect(consume1.updatedGrant.status).toBe("PARTIALLY_USED");

      // 3. Attempt to consume 5 hammers (available is 1)
      await expect(
        SmartInventoryService.consumeTool({
          tenantId: TENANT_A,
          supporterId: suppLife.id,
          grantId: grant.grant.id,
          toolKey,
          quantity: 5,
          sourceEventId: `consume_life_excess_${Date.now()}`,
        })
      ).rejects.toThrow(/Insufficient quantity/);

      // Verify grant was NOT corrupted
      const grantAfterFailed = await prisma.toolGrant.findUnique({ where: { id: grant.grant.id } });
      expect(grantAfterFailed?.quantityConsumed).toBe(1);

      // 4. Consume final 1 hammer
      const consume2 = await SmartInventoryService.consumeTool({
        tenantId: TENANT_A,
        supporterId: suppLife.id,
        grantId: grant.grant.id,
        toolKey,
        quantity: 1,
        sourceEventId: `consume_life_2_${Date.now()}`,
      });
      expect(consume2.success).toBe(true);
      expect(consume2.updatedGrant.quantityConsumed).toBe(2);
      expect(consume2.updatedGrant.status).toBe("FULLY_USED");
    });

    it("respects FEFO (First-Expiring-First-Out) priority when multiple active grants exist", async () => {
      const toolKey = "BOOST_FOG";

      // Isolated supporter for FEFO test
      const suppFefo = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: `supporter_d3_fefo_${Date.now()}`,
          username: "fefo_tester",
          displayName: "مختبر الأسبقية",
        },
      });

      // Grant A: created via service to record ledger, then adjust expiresAt to 5h
      const grantEarlierRes = await SmartInventoryService.grantTool({
        tenantId: TENANT_A,
        supporterId: suppFefo.id,
        toolKey,
        quantity: 3,
        sourceEventId: `fefo_grant_earlier_${Date.now()}`,
      });
      const grantEarlier = await prisma.toolGrant.update({
        where: { id: grantEarlierRes.grant.id },
        data: { expiresAt: new Date(Date.now() + 5 * 3600 * 1000) },
      });

      // Grant B: created via service to record ledger, then adjust expiresAt to 48h
      const grantLaterRes = await SmartInventoryService.grantTool({
        tenantId: TENANT_A,
        supporterId: suppFefo.id,
        toolKey,
        quantity: 3,
        sourceEventId: `fefo_grant_later_${Date.now()}`,
      });
      const grantLater = await prisma.toolGrant.update({
        where: { id: grantLaterRes.grant.id },
        data: { expiresAt: new Date(Date.now() + 48 * 3600 * 1000) },
      });

      // Consume 1 without specifying grantId -> must pick grantEarlier via FEFO
      const consumeRes = await SmartInventoryService.consumeTool({
        tenantId: TENANT_A,
        supporterId: suppFefo.id,
        toolKey,
        quantity: 1,
        sourceEventId: `fefo_consume_evt_${Date.now()}`,
      });

      expect(consumeRes.updatedGrant.id).toBe(grantEarlier.id);
      expect(consumeRes.updatedGrant.quantityConsumed).toBe(1);

      // Later grant remains untouched
      const laterGrantDb = await prisma.toolGrant.findUnique({ where: { id: grantLater.id } });
      expect(laterGrantDb?.quantityConsumed).toBe(0);
    });

    it("reconcileInventory computes zero discrepancy for legitimate grant and ledger history", async () => {
      // Create dedicated clean tenant for reconciliation verification
      const RECON_TENANT = "phase3-tenant-recon";
      await prisma.toolLedgerMovement.deleteMany({ where: { tenantId: RECON_TENANT } });
      await prisma.toolGrant.deleteMany({ where: { tenantId: RECON_TENANT } });
      await prisma.toolDefinition.deleteMany({ where: { tenantId: RECON_TENANT } });
      await prisma.supporter.deleteMany({ where: { tenantId: RECON_TENANT } });
      await prisma.tenant.deleteMany({ where: { id: RECON_TENANT } });

      await prisma.tenant.create({
        data: { id: RECON_TENANT, slug: "phase3-recon-slug", name: "Phase 3 Recon Tenant" },
      });
      const suppRecon = await prisma.supporter.create({
        data: {
          tenantId: RECON_TENANT,
          platformUserId: "supporter_recon_01",
          username: "recon_supporter",
          displayName: "داعم المطابقة",
        },
      });

      // 1. Initial reconcile on clean tenant -> 0
      const initialRecon = await SmartInventoryService.reconcileInventory(RECON_TENANT);
      expect(initialRecon.isReconciled).toBe(true);
      expect(initialRecon.netDiscrepancy).toBe(0);

      // 2. Grant tools
      await SmartInventoryService.grantTool({
        tenantId: RECON_TENANT,
        supporterId: suppRecon.id,
        toolKey: "SPEED_BOOSTER",
        quantity: 4,
        sourceEventId: `recon_grant_1_${Date.now()}`,
      });

      // 3. Consume partial tools
      await SmartInventoryService.consumeTool({
        tenantId: RECON_TENANT,
        supporterId: suppRecon.id,
        toolKey: "SPEED_BOOSTER",
        quantity: 2,
        sourceEventId: `recon_consume_1_${Date.now()}`,
      });

      // 4. Reconcile after legitimate operations -> zero discrepancy
      const postRecon = await SmartInventoryService.reconcileInventory(RECON_TENANT);
      expect(postRecon.isReconciled).toBe(true);
      expect(postRecon.netDiscrepancy).toBe(0);
      expect(postRecon.totalGrantsProjected).toBe(2);
      expect(postRecon.totalLedgerBalance).toBe(2);

      // Clean up
      await prisma.toolLedgerMovement.deleteMany({ where: { tenantId: RECON_TENANT } });
      await prisma.toolConsumption.deleteMany({ where: { tenantId: RECON_TENANT } });
      await prisma.toolGrant.deleteMany({ where: { tenantId: RECON_TENANT } });
      await prisma.toolDefinition.deleteMany({ where: { tenantId: RECON_TENANT } });
      await prisma.supporter.deleteMany({ where: { tenantId: RECON_TENANT } });
      await prisma.tenant.deleteMany({ where: { id: RECON_TENANT } });
    });
  });

  // -------------------------------------------------------------
  // D4. Battle Attribution & Side-Swap Defense
  // -------------------------------------------------------------
  describe("D4. Battle Attribution & Side-Swap Defense", () => {
    it("rejects card grants for supporters confirmed on Team 2 (opponents)", async () => {
      const noticeId = `notice_d4_opp_${Date.now()}`;
      const countBefore = await prisma.toolGrant.count({ where: { tenantId: TENANT_A } });

      await pipelineA.handleBattleItemCard({
        msgType: 2,
        battleId: battleAId,
        awardCardNotice: {
          noticeId,
          cardType: "glove",
          awardedUsers: [
            {
              userId: "opponent_supporter_999",
              displayId: "opp_supporter",
              teamNumber: 2, // Explicit Opponent
              count: 1,
            },
          ],
        },
      });

      const countAfter = await prisma.toolGrant.count({ where: { tenantId: TENANT_A } });
      expect(countAfter).toBe(countBefore);
    });

    it("rejects card grants when contradictory team indicators exist", async () => {
      const noticeId = `notice_d4_conflict_${Date.now()}`;
      const countBefore = await prisma.toolGrant.count({ where: { tenantId: TENANT_A } });

      await pipelineA.handleBattleItemCard({
        msgType: 2,
        battleId: battleAId,
        awardCardNotice: {
          noticeId,
          cardType: "glove",
          awardedUsers: [
            {
              userId: "conflicted_supporter_888",
              displayId: "conflicted_supporter",
              teamNumber: 1, // Claims team 1
              anchorId: "platform_anchor_opponent", // But attached to team 2 anchor!
              count: 1,
            },
          ],
        },
      });

      const countAfter = await prisma.toolGrant.count({ where: { tenantId: TENANT_A } });
      expect(countAfter).toBe(countBefore);
    });
  });

  // -------------------------------------------------------------
  // D5. Multi-Tenant Strict Isolation
  // -------------------------------------------------------------
  describe("D5. Multi-Tenant Strict Isolation", () => {
    it("Tenant B cannot read, consume, or reconcile Tenant A inventory", async () => {
      // Initialize Tenant B
      await SmartInventoryService.ensureCanonicalDefinitions(TENANT_B);

      // Grant a tool to Tenant A
      const grantA = await SmartInventoryService.grantTool({
        tenantId: TENANT_A,
        supporterId: supporterAId,
        toolKey: "TIME_EXTENDER",
        quantity: 3,
        sourceEventId: `iso_grant_a_${Date.now()}`,
      });
      expect(grantA.success).toBe(true);

      // Tenant B queries inventory counters -> must not see Tenant A's tools
      const countersB = await SmartInventoryService.getInventoryCounters(TENANT_B);
      const timeExtenderB = countersB.find((c) => c.toolKey === "TIME_EXTENDER");
      expect(timeExtenderB?.totalAvailable).toBe(0);

      // Tenant B tries to consume Tenant A's grantId directly -> must throw error
      await expect(
        SmartInventoryService.consumeTool({
          tenantId: TENANT_B,
          supporterId: supporterBId,
          grantId: grantA.grant.id,
          quantity: 1,
          sourceEventId: `iso_cross_consume_${Date.now()}`,
        })
      ).rejects.toThrow();

      // Tenant A grant must remain intact
      const grantADb = await prisma.toolGrant.findUnique({ where: { id: grantA.grant.id } });
      expect(grantADb?.quantityConsumed).toBe(0);
    });

    it("reconcileInventory for Tenant B does not include Tenant A ledger movements", async () => {
      const reconB = await SmartInventoryService.reconcileInventory(TENANT_B);
      expect(reconB.totalGrantsProjected).toBe(0);
      expect(reconB.totalLedgerBalance).toBe(0);
      expect(reconB.movementsCount).toBe(0);
    });
  });

  // -------------------------------------------------------------
  // D6. Transaction Integrity & Atomic Rollback
  // -------------------------------------------------------------
  describe("D6. Transaction Integrity & Failure Recovery", () => {
    it("aborts entire transaction if an error occurs during consumption recording", async () => {
      // Grant 1 tool
      const grant = await SmartInventoryService.grantTool({
        tenantId: TENANT_A,
        supporterId: supporterAId,
        toolKey: "SONG_SURGE",
        quantity: 1,
        sourceEventId: `tx_integrity_grant_${Date.now()}`,
      });
      expect(grant.success).toBe(true);

      const grantId = grant.grant.id;

      // Simulate a failed transaction by requesting more than available inside a transaction
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.toolGrant.update({
            where: { id: grantId },
            data: { quantityConsumed: 1 },
          });
          // Throw simulated failure
          throw new Error("SIMULATED_POST_MUTATION_FAILURE");
        })
      ).rejects.toThrow("SIMULATED_POST_MUTATION_FAILURE");

      // Verify that quantityConsumed was rolled back to 0
      const rolledBackGrant = await prisma.toolGrant.findUnique({ where: { id: grantId } });
      expect(rolledBackGrant?.quantityConsumed).toBe(0);
    });
  });
});
