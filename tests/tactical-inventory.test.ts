import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma";
import { SmartInventoryService } from "../src/lib/smart-inventory";
import { LiveEventPipeline } from "../src/lib/event-pipeline";
import { StreamHealthService } from "../src/lib/stream-health";

describe("Tactical Inventory & Multi-Tool Tracking Tests", () => {
  const TEST_TENANT_ID = "test-inventory-tenant";
  const TEST_SUPPORTER_UID = "supporter_inv_test_99";
  const OPPONENT_SUPPORTER_UID = "supporter_opponent_test_88";
  const mockAdapter = {
    on: () => {},
  } as any;

  let testSessionId = "session_test";

  beforeAll(async () => {
    // Clean before tests
    await prisma.toolLedgerMovement.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.toolConsumption.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.externalActivation.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.toolGrant.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.toolDefinition.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.battleScoreEvent.deleteMany({ where: { battle: { tenantId: TEST_TENANT_ID } } });
    await prisma.battleParticipant.deleteMany({ where: { battle: { tenantId: TEST_TENANT_ID } } });
    await prisma.battle.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.supporter.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.rawEvent.deleteMany({ where: { liveSession: { tenantId: TEST_TENANT_ID } } });
    await prisma.liveSession.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.streamerAccount.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.tenant.deleteMany({ where: { id: TEST_TENANT_ID } });

    await prisma.tenant.create({
      data: {
        id: TEST_TENANT_ID,
        slug: "inventory-test-tenant",
        name: "Inventory Test Tenant",
      },
    });

    await SmartInventoryService.ensureCanonicalDefinitions(TEST_TENANT_ID);

    const streamer = await prisma.streamerAccount.create({
      data: {
        tenantId: TEST_TENANT_ID,
        username: "test_streamer",
        displayName: "مضيف تجريبي",
      },
    });

    const session = await prisma.liveSession.create({
      data: {
        tenantId: TEST_TENANT_ID,
        streamerAccountId: streamer.id,
        status: "LIVE",
      },
    });
    testSessionId = session.id;

    const battle = await prisma.battle.create({
      data: {
        id: "battle_test_101",
        tenantId: TEST_TENANT_ID,
        liveSessionId: session.id,
        battleType: "1V1",
        status: "IN_PROGRESS",
        participants: {
          create: [
            {
              teamNumber: 1,
              platformUserId: "test_anchor_p1",
              username: "anchor1",
              displayName: "مضيف التحدي",
            },
            {
              teamNumber: 2,
              platformUserId: "test_anchor_p2",
              username: "anchor2",
              displayName: "الخصم",
            },
          ],
        },
      },
    });

    // Create an opponent supporter who scored on Team 2
    const opponentSupporter = await prisma.supporter.create({
      data: {
        tenantId: TEST_TENANT_ID,
        platformUserId: OPPONENT_SUPPORTER_UID,
        username: "opponent_fan",
        displayName: "مشجع الخصم",
      },
    });

    await prisma.battleScoreEvent.create({
      data: {
        battleId: battle.id,
        supporterId: opponentSupporter.id,
        teamNumber: 2,
        points: 500,
        giftName: "Rose",
      },
    });
  });

  afterAll(async () => {
    // Teardown hook to guarantee ZERO mock test contamination in live db
    await prisma.toolLedgerMovement.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.toolConsumption.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.externalActivation.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.toolGrant.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.toolDefinition.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.battleScoreEvent.deleteMany({ where: { battle: { tenantId: TEST_TENANT_ID } } });
    await prisma.battleParticipant.deleteMany({ where: { battle: { tenantId: TEST_TENANT_ID } } });
    await prisma.battle.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.supporter.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.rawEvent.deleteMany({ where: { liveSession: { tenantId: TEST_TENANT_ID } } });
    await prisma.liveSession.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.streamerAccount.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.tenant.deleteMany({ where: { id: TEST_TENANT_ID } });
  });

  it("provisions SONG_SURGE and standard tools correctly", async () => {
    const supporter = await prisma.supporter.create({
      data: {
        tenantId: TEST_TENANT_ID,
        platformUserId: TEST_SUPPORTER_UID,
        username: "super_supporter",
        displayName: "سوبر داعم",
        dataConfidence: "VERIFIED",
      },
    });

    const grantRes = await SmartInventoryService.grantTool({
      tenantId: TEST_TENANT_ID,
      supporterId: supporter.id,
      toolKey: "SONG_SURGE",
      quantity: 1,
      sourceEventId: "evt_song_surge_01",
    });

    expect(grantRes.success).toBe(true);
    expect(grantRes.grant?.toolDefinition.key).toBe("SONG_SURGE");
    expect(grantRes.grant?.toolDefinition.name).toContain("Song Surge");
    expect(grantRes.grant?.quantityGranted).toBe(1);
    expect(grantRes.grant?.quantityConsumed).toBe(0);
  });

  it("accurately handles a supporter receiving multiple different tools after a round", async () => {
    const pipeline = new LiveEventPipeline(TEST_TENANT_ID, testSessionId, mockAdapter);

    // Supporter receives Glove AND Song Surge in the same round notice
    const mockMultiAwardNotice = {
      battleId: "battle_test_101",
      awardCardNotice: {
        noticeId: "notice_round_settle_88",
        awardedUsers: [
          {
            user: { userId: TEST_SUPPORTER_UID, displayId: "super_supporter", nickName: "سوبر داعم" },
            teamNumber: 1,
            cardType: "glove",
            count: 1,
          },
          {
            user: { userId: TEST_SUPPORTER_UID, displayId: "super_supporter", nickName: "سوبر داعم" },
            teamNumber: 1,
            cardType: "wave", // Song Surge
            count: 1,
          },
        ],
      },
    };

    await pipeline.handleBattleItemCard(mockMultiAwardNotice);

    const supporter = await prisma.supporter.findUnique({
      where: {
        tenantId_platformUserId: {
          tenantId: TEST_TENANT_ID,
          platformUserId: TEST_SUPPORTER_UID,
        },
      },
    });

    const grants = await prisma.toolGrant.findMany({
      where: {
        tenantId: TEST_TENANT_ID,
        supporterId: supporter!.id,
      },
      include: { toolDefinition: true },
    });

    const gloveGrant = grants.find((g) => g.toolDefinition.key === "GLOVE");
    const songGrant = grants.find((g) => g.toolDefinition.key === "SONG_SURGE");

    expect(gloveGrant).toBeDefined();
    expect(songGrant).toBeDefined();
  });

  it("handles live tool consumption of Song Surge and Hammer", async () => {
    const pipeline = new LiveEventPipeline(TEST_TENANT_ID, testSessionId, mockAdapter);

    const mockWaveUse = {
      battleId: "battle_test_101",
      useWaveCard: {
        cardInfo: {
          noticeId: "wave_use_notice_99",
          sendUser: {
            user: { userId: TEST_SUPPORTER_UID },
          },
        },
      },
    };

    await pipeline.handleBattleItemCard(mockWaveUse);

    const supporter = await prisma.supporter.findUnique({
      where: {
        tenantId_platformUserId: {
          tenantId: TEST_TENANT_ID,
          platformUserId: TEST_SUPPORTER_UID,
        },
      },
    });

    const updatedSongGrant = await prisma.toolGrant.findFirst({
      where: {
        tenantId: TEST_TENANT_ID,
        supporterId: supporter!.id,
        toolDefinition: { key: "SONG_SURGE" },
        quantityConsumed: { gt: 0 },
      },
    });

    expect(updatedSongGrant).toBeDefined();
    expect(updatedSongGrant!.quantityConsumed).toBe(1);
  });

  it("P0: rejects unknown tool classification and prevents it from becoming GLOVE", async () => {
    const pipeline = new LiveEventPipeline(TEST_TENANT_ID, testSessionId, mockAdapter);

    const initialGloveCount = await prisma.toolGrant.count({
      where: {
        tenantId: TEST_TENANT_ID,
        toolDefinition: { key: "GLOVE" },
      },
    });

    // Event with completely unknown card type and custom unknown strings
    const mockUnknownCardNotice = {
      battleId: "battle_test_101",
      msgType: 99,
      awardCardNotice: {
        noticeId: "notice_unknown_test_99",
        cardType: "quantum_portal_card",
        cardName: "بطاقة بوابة كوانتوم المجهولة",
        toolKey: "UNKNOWN_QUANTUM_CARD",
        awardedUsers: [
          {
            user: { userId: TEST_SUPPORTER_UID, displayId: "super_supporter" },
            cardType: "mystery_orb_99",
            count: 2,
          },
        ],
      },
    };

    await pipeline.handleBattleItemCard(mockUnknownCardNotice);

    const afterGloveCount = await prisma.toolGrant.count({
      where: {
        tenantId: TEST_TENANT_ID,
        toolDefinition: { key: "GLOVE" },
      },
    });

    // Unknown tool must NEVER become GLOVE
    expect(afterGloveCount).toBe(initialGloveCount);

    // Direct SmartInventoryService rejection test
    const supporter = await prisma.supporter.findUnique({
      where: { tenantId_platformUserId: { tenantId: TEST_TENANT_ID, platformUserId: TEST_SUPPORTER_UID } },
    });

    const directGrant = await SmartInventoryService.grantTool({
      tenantId: TEST_TENANT_ID,
      supporterId: supporter!.id,
      toolKey: "UNKNOWN_MYSTERY_ITEM",
      quantity: 1,
      sourceEventId: "evt_unknown_direct_reject",
    });

    expect(directGrant.success).toBe(false);
    expect(directGrant.reason).toBe("INVALID_TOOL_KEY");
  });

  it("P0: ensures ordinary gifts containing 'glove' or 'قفاز' do NOT grant tactical tools", async () => {
    const pipeline = new LiveEventPipeline(TEST_TENANT_ID, testSessionId, mockAdapter);

    const supporter = await prisma.supporter.findUnique({
      where: { tenantId_platformUserId: { tenantId: TEST_TENANT_ID, platformUserId: TEST_SUPPORTER_UID } },
    });

    const grantsBefore = await prisma.toolGrant.count({
      where: { tenantId: TEST_TENANT_ID, supporterId: supporter!.id },
    });

    // Gift named "Boxing Glove" / "قفاز الملاكمة"
    const mockGiftEvent = {
      giftId: 1055,
      giftName: "Boxing Glove قفاز الملاكمة",
      diamondCount: 100,
      repeatCount: 5,
      user: {
        id: TEST_SUPPORTER_UID,
        uniqueId: "super_supporter",
        nickname: "سوبر داعم",
      },
    };

    await pipeline.handleGift(mockGiftEvent);

    const grantsAfter = await prisma.toolGrant.count({
      where: { tenantId: TEST_TENANT_ID, supporterId: supporter!.id },
    });

    // Tactical inventory grants count must NOT increase from ordinary gifts!
    expect(grantsAfter).toBe(grantsBefore);
  });

  it("P0: enforces database-level idempotency on grants and consumptions with stable sourceEventId", async () => {
    const supporter = await prisma.supporter.findUnique({
      where: { tenantId_platformUserId: { tenantId: TEST_TENANT_ID, platformUserId: TEST_SUPPORTER_UID } },
    });

    const stableEventId = "evt_idempotency_grant_test_42";

    // 1. First grant succeeds
    const grant1 = await SmartInventoryService.grantTool({
      tenantId: TEST_TENANT_ID,
      supporterId: supporter!.id,
      toolKey: "HAMMER",
      quantity: 1,
      sourceEventId: stableEventId,
    });
    expect(grant1.success).toBe(true);

    // 2. Second grant with identical sourceEventId is safely deduplicated
    const grant2 = await SmartInventoryService.grantTool({
      tenantId: TEST_TENANT_ID,
      supporterId: supporter!.id,
      toolKey: "HAMMER",
      quantity: 1,
      sourceEventId: stableEventId,
    });
    expect(grant2.success).toBe(false);
    expect(grant2.reason).toBe("ALREADY_GRANTED");

    // Verify only 1 grant row exists for this sourceEventId
    const count = await prisma.toolGrant.count({ where: { sourceEventId: stableEventId } });
    expect(count).toBe(1);

    // 3. Test consumption idempotency
    const stableConsumeEventId = "evt_idempotency_consume_test_77";
    const consume1 = await SmartInventoryService.consumeTool({
      tenantId: TEST_TENANT_ID,
      supporterId: supporter!.id,
      toolKey: "HAMMER",
      quantity: 1,
      sourceEventId: stableConsumeEventId,
    });
    expect(consume1.success).toBe(true);
    expect(consume1.duplicate).toBeUndefined();

    // 4. Second consumption with identical sourceEventId does NOT double-spend
    const consume2 = await SmartInventoryService.consumeTool({
      tenantId: TEST_TENANT_ID,
      supporterId: supporter!.id,
      toolKey: "HAMMER",
      quantity: 1,
      sourceEventId: stableConsumeEventId,
    });
    expect(consume2.success).toBe(true);
    expect(consume2.duplicate).toBe(true);

    // Verify only 1 ToolConsumption record exists
    const consumeCount = await prisma.toolConsumption.count({ where: { sourceEventId: stableConsumeEventId } });
    expect(consumeCount).toBe(1);
  });

  it("P1: prioritizes earliest-expiring grants (FEFO) and excludes expired grants", async () => {
    const supporter = await prisma.supporter.findUnique({
      where: { tenantId_platformUserId: { tenantId: TEST_TENANT_ID, platformUserId: TEST_SUPPORTER_UID } },
    });

    const now = new Date();
    // Grant A: expires in 2 hours
    const grantA = await prisma.toolGrant.create({
      data: {
        tenantId: TEST_TENANT_ID,
        supporterId: supporter!.id,
        toolDefinitionId: (await prisma.toolDefinition.findFirst({ where: { tenantId: TEST_TENANT_ID, key: "BOOST_FOG" } }))!.id,
        sourceEventId: "grant_fefo_a_2h",
        quantityGranted: 1,
        quantityConsumed: 0,
        receivedAt: now,
        expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2h from now
        status: "AVAILABLE",
      },
    });

    // Grant B: expires in 5 days
    const grantB = await prisma.toolGrant.create({
      data: {
        tenantId: TEST_TENANT_ID,
        supporterId: supporter!.id,
        toolDefinitionId: grantA.toolDefinitionId,
        sourceEventId: "grant_fefo_b_5d",
        quantityGranted: 1,
        quantityConsumed: 0,
        receivedAt: now,
        expiresAt: new Date(now.getTime() + 120 * 60 * 60 * 1000), // 5 days from now
        status: "AVAILABLE",
      },
    });

    // Grant C: expired 1 hour ago
    await prisma.toolGrant.create({
      data: {
        tenantId: TEST_TENANT_ID,
        supporterId: supporter!.id,
        toolDefinitionId: grantA.toolDefinitionId,
        sourceEventId: "grant_fefo_c_expired",
        quantityGranted: 1,
        quantityConsumed: 0,
        receivedAt: new Date(now.getTime() - 200 * 60 * 60 * 1000),
        expiresAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1h in the past
        status: "AVAILABLE",
      },
    });

    // Consume 1 BOOST_FOG without specifying grantId -> must pick Grant A (earliest unexpired)
    const consumeRes = await SmartInventoryService.consumeTool({
      tenantId: TEST_TENANT_ID,
      supporterId: supporter!.id,
      toolKey: "BOOST_FOG",
      quantity: 1,
      sourceEventId: "evt_consume_fefo_01",
    });

    expect(consumeRes.success).toBe(true);
    expect(consumeRes.updatedGrant.id).toBe(grantA.id);
    expect(consumeRes.updatedGrant.status).toBe("FULLY_USED");

    // Check that Grant B is still untouched
    const freshGrantB = await prisma.toolGrant.findUnique({ where: { id: grantB.id } });
    expect(freshGrantB!.quantityConsumed).toBe(0);
    expect(freshGrantB!.status).toBe("AVAILABLE");
  });

  it("P0: guarantees atomic rollback when consumption quantity exceeds available balance", async () => {
    const supporter = await prisma.supporter.findUnique({
      where: { tenantId_platformUserId: { tenantId: TEST_TENANT_ID, platformUserId: TEST_SUPPORTER_UID } },
    });

    const grant = await SmartInventoryService.grantTool({
      tenantId: TEST_TENANT_ID,
      supporterId: supporter!.id,
      toolKey: "TIME_EXTENDER",
      quantity: 1,
      sourceEventId: "evt_rollback_grant_01",
    });

    // Attempt to consume quantity 5 when only 1 is available
    await expect(
      SmartInventoryService.consumeTool({
        tenantId: TEST_TENANT_ID,
        supporterId: supporter!.id,
        grantId: grant.grant!.id,
        quantity: 5,
        sourceEventId: "evt_rollback_consume_fail",
      })
    ).rejects.toThrow(/Insufficient quantity/);

    // Verify grant balance was NOT changed
    const freshGrant = await prisma.toolGrant.findUnique({ where: { id: grant.grant!.id } });
    expect(freshGrant!.quantityConsumed).toBe(0);
    expect(freshGrant!.status).toBe("AVAILABLE");
  });

  it("P1: rejects card grants for opponent team (Team 2) supporters during battle", async () => {
    const pipeline = new LiveEventPipeline(TEST_TENANT_ID, testSessionId, mockAdapter);

    // Award notice where awardedUser is the opponent supporter (Team 2)
    const mockOpponentAward = {
      battleId: "battle_test_101",
      awardCardNotice: {
        noticeId: "notice_opponent_award_999",
        cardType: "glove",
        awardedUsers: [
          {
            user: { userId: OPPONENT_SUPPORTER_UID, displayId: "opponent_fan" },
            teamNumber: 2, // Opponent team
            cardType: "glove",
            count: 1,
          },
        ],
      },
    };

    await pipeline.handleBattleItemCard(mockOpponentAward);

    // Verify opponent supporter has 0 grants in this tenant
    const opponentGrant = await prisma.toolGrant.findFirst({
      where: {
        tenantId: TEST_TENANT_ID,
        supporter: { platformUserId: OPPONENT_SUPPORTER_UID },
      },
    });

    expect(opponentGrant).toBeNull();
  });

  it("P1: records ExternalActivation when an unmonitored or external card is activated", async () => {
    const externalUserId = "external_live_user_555";

    const pipeline = new LiveEventPipeline(TEST_TENANT_ID, testSessionId, mockAdapter);

    const mockExternalUse = {
      battleId: "battle_test_101",
      useSmokeCard: {
        cardInfo: {
          noticeId: "smoke_activation_ext_88",
          sendUser: {
            user: { userId: externalUserId, displayId: "external_star" },
          },
        },
      },
    };

    await pipeline.handleBattleItemCard(mockExternalUse);

    // Verify an ExternalActivation was recorded without fabricating any fake ToolGrant
    const extRecord = await prisma.externalActivation.findFirst({
      where: {
        tenantId: TEST_TENANT_ID,
        toolKey: "BOOST_FOG",
      },
    });

    expect(extRecord).toBeDefined();
    expect(extRecord!.sourceEventId).toContain("smoke_activation_ext_88");

    // Confirm that NO local ToolGrant was fabricated
    const fakeGrant = await prisma.toolGrant.findFirst({
      where: {
        tenantId: TEST_TENANT_ID,
        supporter: { platformUserId: externalUserId },
      },
    });
    expect(fakeGrant).toBeNull();
  });

  it("P1: auto-provisions canonical tool definitions ensuring 0-inventory tools are visible", async () => {
    const overview = await SmartInventoryService.getInventoryCounters(TEST_TENANT_ID);

    const keys = overview.map((o) => o.toolKey);
    expect(keys).toContain("GLOVE");
    expect(keys).toContain("BOOST_FOG");
    expect(keys).toContain("SONG_SURGE");
    expect(keys).toContain("TIME_EXTENDER");
    expect(keys).toContain("SPEED_BOOSTER");
    expect(keys).toContain("HAMMER");
    expect(keys).toContain("SHIELD_DEFENSE");

    const shield = overview.find((o) => o.toolKey === "SHIELD_DEFENSE");
    expect(shield).toBeDefined();
    expect(shield!.toolName).toContain("درع الصمود");
    expect(shield!.icon).toBe("Shield");
  });

  describe("Final Production Gate: Authoritative Team Ownership & Isolation", () => {
    it("GATE 1: Confirmed host-team supporter (teamNumber: 1) successfully receives grant", async () => {
      const pipeline = new LiveEventPipeline(TEST_TENANT_ID, testSessionId, mockAdapter);
      const hostSupporterUid = "host_supporter_gate_1";

      const hostAward = {
        battleId: "battle_test_101",
        awardCardNotice: {
          noticeId: "notice_host_gate_101",
          awardedUsers: [
            {
              user: { userId: hostSupporterUid, displayId: "host_fan_101" },
              teamNumber: 1,
              cardType: "glove",
              count: 1,
            },
          ],
        },
      };

      await pipeline.handleBattleItemCard(hostAward);

      const grant = await prisma.toolGrant.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          supporter: { platformUserId: hostSupporterUid },
          toolDefinition: { key: "GLOVE" },
        },
      });

      expect(grant).toBeDefined();
      expect(grant!.quantityGranted).toBe(1);
    });

    it("GATE 2: Missing team membership / insufficient evidence is rejected", async () => {
      const pipeline = new LiveEventPipeline(TEST_TENANT_ID, testSessionId, mockAdapter);
      const unknownSupporterUid = "unknown_supporter_gate_2";

      const noTeamAward = {
        battleId: "battle_test_101",
        awardCardNotice: {
          noticeId: "notice_no_team_102",
          awardedUsers: [
            {
              user: { userId: unknownSupporterUid, displayId: "unknown_fan_102" },
              cardType: "glove",
              count: 1,
            },
          ],
        },
      };

      await pipeline.handleBattleItemCard(noTeamAward);

      const grant = await prisma.toolGrant.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          supporter: { platformUserId: unknownSupporterUid },
        },
      });

      expect(grant).toBeNull();
    });

    it("GATE 3: Conflicting team indicators are safely rejected", async () => {
      const pipeline = new LiveEventPipeline(TEST_TENANT_ID, testSessionId, mockAdapter);
      const conflictingUid = "conflicting_supporter_gate_3";

      // Opponent anchor in battle_test_101 is test_anchor_p2 (teamNumber: 2)
      // If event claims explicit teamNumber: 1 for test_anchor_p2, that's a conflict!
      const conflictingAward = {
        battleId: "battle_test_101",
        awardCardNotice: {
          noticeId: "notice_conflict_103",
          awardedUsers: [
            {
              user: { userId: "test_anchor_p2", displayId: "anchor2" },
              teamNumber: 1, // Conflicts with anchor2's real participant team (2)
              cardType: "glove",
              count: 1,
            },
          ],
        },
      };

      await pipeline.handleBattleItemCard(conflictingAward);

      const grant = await prisma.toolGrant.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          supporter: { platformUserId: "test_anchor_p2" },
        },
      });

      expect(grant).toBeNull();
    });

    it("GATE 4: Cross-tenant battle references are rejected", async () => {
      const OTHER_TENANT = "foreign_tenant_xyz";
      await prisma.tenant.upsert({
        where: { id: OTHER_TENANT },
        create: { id: OTHER_TENANT, slug: "foreign-tenant", name: "Foreign" },
        update: {},
      });

      const foreignStreamer = await prisma.streamerAccount.create({
        data: {
          tenantId: OTHER_TENANT,
          username: "foreign_streamer",
          displayName: "مضيف أجنبي",
        },
      });

      const foreignSession = await prisma.liveSession.create({
        data: {
          tenantId: OTHER_TENANT,
          streamerAccountId: foreignStreamer.id,
          status: "LIVE",
        },
      });

      const foreignBattle = await prisma.battle.create({
        data: {
          id: "battle_foreign_999",
          tenant: { connect: { id: OTHER_TENANT } },
          liveSession: { connect: { id: foreignSession.id } },
          battleType: "1V1",
          status: "IN_PROGRESS",
        },
      });

      const pipeline = new LiveEventPipeline(TEST_TENANT_ID, testSessionId, mockAdapter);

      const crossTenantAward = {
        battleId: foreignBattle.id, // Belonging to foreign tenant
        awardCardNotice: {
          noticeId: "notice_cross_tenant_104",
          awardedUsers: [
            {
              user: { userId: "cross_tenant_user_1", displayId: "cross_user" },
              teamNumber: 1,
              cardType: "glove",
              count: 1,
            },
          ],
        },
      };

      await pipeline.handleBattleItemCard(crossTenantAward);

      const grant = await prisma.toolGrant.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          supporter: { platformUserId: "cross_tenant_user_1" },
        },
      });
      expect(grant).toBeNull();

      // Clean up foreign tenant
      await prisma.battle.delete({ where: { id: foreignBattle.id } });
      await prisma.liveSession.delete({ where: { id: foreignSession.id } });
      await prisma.streamerAccount.delete({ where: { id: foreignStreamer.id } });
      await prisma.tenant.delete({ where: { id: OTHER_TENANT } });
    });
  });

  describe("Final Production Gate: Concurrency, Idempotency & Quarantine", () => {
    it("GATE 5: Real concurrent consumption race condition - exactly 1 wins, 1 duplicate, grant decremented once", async () => {
      const supporter = await prisma.supporter.create({
        data: {
          tenantId: TEST_TENANT_ID,
          platformUserId: "concurrency_supporter_gate_5",
          username: "race_user",
          displayName: "متسابق التزامن",
        },
      });

      const grantRes = await SmartInventoryService.grantTool({
        tenantId: TEST_TENANT_ID,
        supporterId: supporter.id,
        toolKey: "SPEED_BOOSTER",
        quantity: 1,
        sourceEventId: "evt_concurrency_grant_55",
      });

      expect(grantRes.success).toBe(true);
      const grantId = grantRes.grant!.id;
      const stableEventId = "livepulse:test-tenant:battle_test_101:race_user:SPEED_BOOSTER:stable_evt_55";

      // Fire 2 concurrent consumption attempts simultaneously with the same sourceEventId
      const [resA, resB] = await Promise.all([
        SmartInventoryService.consumeTool({
          tenantId: TEST_TENANT_ID,
          supporterId: supporter.id,
          grantId,
          quantity: 1,
          sourceEventId: stableEventId,
        }),
        SmartInventoryService.consumeTool({
          tenantId: TEST_TENANT_ID,
          supporterId: supporter.id,
          grantId,
          quantity: 1,
          sourceEventId: stableEventId,
        }),
      ]);

      // Exactly one must be fresh success, exactly one must be duplicate
      const freshSuccesses = [resA, resB].filter((r) => r.success && !r.duplicate);
      const duplicates = [resA, resB].filter((r) => r.duplicate);

      expect(freshSuccesses.length).toBe(1);
      expect(duplicates.length).toBe(1);

      // Verify DB state
      const consumptions = await prisma.toolConsumption.findMany({
        where: { sourceEventId: stableEventId },
      });
      expect(consumptions.length).toBe(1);

      const grantInDb = await prisma.toolGrant.findUnique({ where: { id: grantId } });
      expect(grantInDb!.quantityConsumed).toBe(1);
      expect(grantInDb!.status).toBe("FULLY_USED");
    });

    it("GATE 6: Subsequent retry remains idempotent and returns duplicate=true without re-decrementing", async () => {
      const supporter = await prisma.supporter.findFirst({
        where: { tenantId: TEST_TENANT_ID, platformUserId: "concurrency_supporter_gate_5" },
      });

      const stableEventId = "livepulse:test-tenant:battle_test_101:race_user:SPEED_BOOSTER:stable_evt_55";

      // A 3rd attempt simulating a retry after the fact
      const retryRes = await SmartInventoryService.consumeTool({
        tenantId: TEST_TENANT_ID,
        supporterId: supporter!.id,
        toolKey: "SPEED_BOOSTER",
        quantity: 1,
        sourceEventId: stableEventId,
      });

      expect(retryRes.success).toBe(true);
      expect(retryRes.duplicate).toBe(true);

      // Verify no extra consumption records
      const totalConsumptions = await prisma.toolConsumption.count({
        where: { sourceEventId: stableEventId },
      });
      expect(totalConsumptions).toBe(1);
    });

    it("GATE 7: Quarantine of events lacking reliable upstream ID without mutating balances", async () => {
      const supporter = await prisma.supporter.create({
        data: {
          tenantId: TEST_TENANT_ID,
          platformUserId: "quarantine_supporter_gate_7",
          username: "quarantine_user",
          displayName: "مستخدم الحجر",
        },
      });

      const grantRes = await SmartInventoryService.grantTool({
        tenantId: TEST_TENANT_ID,
        supporterId: supporter.id,
        toolKey: "HAMMER",
        quantity: 2,
        sourceEventId: "evt_quarantine_grant_77",
      });

      // Attempt consumption with quarantine flags set (e.g. from pipeline missing upstream ID)
      const quarantineRes = await SmartInventoryService.consumeTool({
        tenantId: TEST_TENANT_ID,
        supporterId: supporter.id,
        grantId: grantRes.grant!.id,
        quantity: 1,
        isQuarantined: true,
        quarantineReason: "UNIDENTIFIED_UPSTREAM_EVENT",
      });

      expect(quarantineRes.success).toBe(false);
      expect(quarantineRes.quarantined).toBe(true);

      // Balance MUST NOT be touched
      const grantInDb = await prisma.toolGrant.findUnique({ where: { id: grantRes.grant!.id } });
      expect(grantInDb!.quantityConsumed).toBe(0);
      expect(grantInDb!.status).toBe("AVAILABLE");

      // Verify ExternalActivation was recorded in quarantined state
      const extRecord = await prisma.externalActivation.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          platformUserId: supporter.platformUserId,
        },
      });
      expect(extRecord).toBeDefined();
      const details = JSON.parse(extRecord!.detailsJson || "{}");
      expect(details.isQuarantined).toBe(true);
      expect(details.quarantineReason).toBe("UNIDENTIFIED_UPSTREAM_EVENT");
    });

    it("GATE 8: ExternalActivation is strictly idempotent on repeated delivery", async () => {
      const stableSourceId = "livepulse:test-tenant:session_test:ext_user_88:BOOST_FOG:stable_notice_88";

      const [res1, res2] = await Promise.all([
        prisma.externalActivation.upsert({
          where: { sourceEventId: stableSourceId },
          create: {
            tenantId: TEST_TENANT_ID,
            toolKey: "BOOST_FOG",
            platformUserId: "ext_user_88",
            sourceEventId: stableSourceId,
          },
          update: {},
        }),
        prisma.externalActivation.upsert({
          where: { sourceEventId: stableSourceId },
          create: {
            tenantId: TEST_TENANT_ID,
            toolKey: "BOOST_FOG",
            platformUserId: "ext_user_88",
            sourceEventId: stableSourceId,
          },
          update: {},
        }),
      ]);

      const records = await prisma.externalActivation.findMany({
        where: { sourceEventId: stableSourceId },
      });
      expect(records.length).toBe(1);
    });
  });

  describe("Milestone 1 (P0): Tactical Inventory 2.0 Movement Ledger & Reconciliation", () => {
    it("LEDGER 1: records ACQUISITION in ToolLedgerMovement when a grant is issued", async () => {
      const supporter = await prisma.supporter.create({
        data: {
          tenantId: TEST_TENANT_ID,
          platformUserId: "supporter_ledger_01",
          username: "ledger_fan_1",
          displayName: "داعم دفتر الأستاذ 1",
        },
      });

      const grantRes = await SmartInventoryService.grantTool({
        tenantId: TEST_TENANT_ID,
        supporterId: supporter.id,
        toolKey: "GLOVE",
        quantity: 2,
        sourceEventId: "evt_ledger_grant_01",
      });

      expect(grantRes.success).toBe(true);

      const movement = await prisma.toolLedgerMovement.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          toolGrantId: grantRes.grant!.id,
          movementType: "ACQUISITION",
        },
      });

      expect(movement).toBeDefined();
      expect(movement!.quantity).toBe(2);
      expect(movement!.resultingBalance).toBe(2);
    });

    it("LEDGER 2: records USAGE in ToolLedgerMovement with negative quantity when tool is consumed", async () => {
      const supporter = await prisma.supporter.findFirst({
        where: { tenantId: TEST_TENANT_ID, platformUserId: "supporter_ledger_01" },
      });

      const grant = await prisma.toolGrant.findFirst({
        where: { tenantId: TEST_TENANT_ID, supporterId: supporter!.id, toolDefinition: { key: "GLOVE" } },
      });

      const consumeRes = await SmartInventoryService.consumeTool({
        tenantId: TEST_TENANT_ID,
        supporterId: supporter!.id,
        grantId: grant!.id,
        quantity: 1,
        sourceEventId: "evt_ledger_consume_01",
      });

      expect(consumeRes.success).toBe(true);

      const usageMovement = await prisma.toolLedgerMovement.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          toolGrantId: grant!.id,
          movementType: "USAGE",
        },
      });

      expect(usageMovement).toBeDefined();
      expect(usageMovement!.quantity).toBe(-1);
      expect(usageMovement!.resultingBalance).toBe(1);
    });

    it("LEDGER 3: records DEDUCTION and EXPIRATION in ToolLedgerMovement", async () => {
      const supporter = await prisma.supporter.findFirst({
        where: { tenantId: TEST_TENANT_ID, platformUserId: "supporter_ledger_01" },
      });

      const grant = await prisma.toolGrant.findFirst({
        where: { tenantId: TEST_TENANT_ID, supporterId: supporter!.id, toolDefinition: { key: "GLOVE" } },
      });

      // Deduct 1 tool
      const deductRes = await SmartInventoryService.recordDeduction({
        tenantId: TEST_TENANT_ID,
        grantId: grant!.id,
        quantity: 1,
        reason: "ADMIN_PENALTY_TEST",
      });

      expect(deductRes.success).toBe(true);
      expect(deductRes.movement.movementType).toBe("DEDUCTION");
      expect(deductRes.movement.quantity).toBe(-1);

      // Now grant is fully consumed; expire it
      const expireRes = await SmartInventoryService.recordExpiration({
        tenantId: TEST_TENANT_ID,
        grantId: grant!.id,
      });

      expect(expireRes.success).toBe(true);
    });

    it("LEDGER 4: records REVERSAL and restores balance", async () => {
      const supporter = await prisma.supporter.findFirst({
        where: { tenantId: TEST_TENANT_ID, platformUserId: "supporter_ledger_01" },
      });

      const consumption = await prisma.toolConsumption.findFirst({
        where: { tenantId: TEST_TENANT_ID, supporterId: supporter!.id },
      });

      const reversalRes = await SmartInventoryService.recordReversal({
        tenantId: TEST_TENANT_ID,
        consumptionId: consumption!.id,
        reason: "BATTLE_DISPUTE_REVERSAL",
      });

      expect(reversalRes.success).toBe(true);
      expect(reversalRes.movement.movementType).toBe("REVERSAL");
      expect(reversalRes.movement.quantity).toBe(1);
    });

    it("LEDGER 5: reconcileInventory computes projection vs ledger and reports status", async () => {
      const report = await SmartInventoryService.reconcileInventory(TEST_TENANT_ID);

      expect(report).toBeDefined();
      expect(report.tenantId).toBe(TEST_TENANT_ID);
      expect(report.movementsCount).toBeGreaterThan(0);
      expect(typeof report.isReconciled).toBe("boolean");
    });
  });

  describe("Milestone 1 (P0): Stream Health Monitor & Telemetry", () => {
    it("HEALTH 1: records heartbeats, events, and reports healthy telemetry", async () => {
      StreamHealthService.setConnectionState("CONNECTED");
      StreamHealthService.recordHeartbeat();
      StreamHealthService.recordEventReceived(15, true);

      const health = await StreamHealthService.getHealthTelemetry(TEST_TENANT_ID);

      expect(health.status).toBe("CONNECTED");
      expect(health.components.worker.status).toBe("HEALTHY");
      expect(health.components.database.status).toBe("HEALTHY");
      expect(health.totalEventsReceived).toBeGreaterThan(0);
      expect(health.isStreamActive).toBe(true);
    });

    it("HEALTH 2: transitions to DEGRADED on error and records recent errors", async () => {
      StreamHealthService.recordError("Test simulated connection timeout");

      const health = await StreamHealthService.getHealthTelemetry(TEST_TENANT_ID);

      expect(health.status).toBe("DEGRADED");
      expect(health.totalErrors).toBeGreaterThan(0);
      expect(health.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe("Architectural Remediation Tests (Protocol & Ingestion Upgrades)", () => {
    it("REMED 1: parses varied field quantities like cardAmount, awardCount accurately", async () => {
      const pipeline = new LiveEventPipeline(TEST_TENANT_ID, testSessionId, mockAdapter);

      await pipeline.handleBattleItemCard({
        msgType: 2,
        battleId: "battle_test_101",
        awardCardNotice: {
          noticeId: "notice_remed_qty_1",
          cardType: "glove",
          awardedUsers: [
            {
              userId: TEST_SUPPORTER_UID,
              displayId: "super_supporter",
              cardAmount: 3, // alternate field variant
              teamNumber: 1,
            },
          ],
        },
      });

      const grant = await prisma.toolGrant.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          sourceEventId: { contains: "notice_remed_qty_1" },
        },
      });

      expect(grant).toBeDefined();
      expect(grant?.quantityGranted).toBe(3);
    });

    it("REMED 2: parses Arabic duals and multiplier text (e.g. بطاقتين, x3)", async () => {
      const pipeline = new LiveEventPipeline(TEST_TENANT_ID, testSessionId, mockAdapter);

      await pipeline.handleBattleItemCard({
        msgType: 2,
        battleId: "battle_test_101",
        awardCardNotice: {
          noticeId: "notice_remed_text_dual",
          cardType: "glove",
          describe: "تهانينا حصلت على بطاقتين قفاز",
          awardedUsers: [
            {
              userId: TEST_SUPPORTER_UID,
              displayId: "super_supporter",
              count: 0, // 0 in field, but text clearly states 2!
              teamNumber: 1,
            },
          ],
        },
      });

      const grant = await prisma.toolGrant.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          sourceEventId: { contains: "notice_remed_text_dual" },
        },
      });

      expect(grant).toBeDefined();
      expect(grant?.quantityGranted).toBe(2);
    });

    it("REMED 3: msgType 10 & 11 and useTop2Card are recognized as SPEED_BOOSTER", async () => {
      const pipeline = new LiveEventPipeline(TEST_TENANT_ID, testSessionId, mockAdapter);

      // Award Speed Booster via msgType 10 (USE_TOP_2_CARD)
      await pipeline.handleBattleItemCard({
        msgType: 10,
        battleId: "battle_test_101",
        awardCardNotice: {
          noticeId: "notice_remed_boost_top2",
          cardType: "top2",
          awardedUsers: [
            {
              userId: TEST_SUPPORTER_UID,
              displayId: "super_supporter",
              count: 1,
              teamNumber: 1,
            },
          ],
        },
      });

      const grant = await prisma.toolGrant.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          sourceEventId: { contains: "notice_remed_boost_top2" },
        },
        include: { toolDefinition: true },
      });

      expect(grant).toBeDefined();
      expect(grant?.toolDefinition.key).toBe("SPEED_BOOSTER");

      // Now consume via useTop2Card
      await pipeline.handleBattleItemCard({
        battleId: "battle_test_101",
        useTop2Card: {
          noticeId: "notice_use_top2_card_1",
          cardInfo: {
            sendUser: {
              userId: TEST_SUPPORTER_UID,
              displayId: "super_supporter",
            },
          },
        },
      });

      const updatedGrant = await prisma.toolGrant.findUnique({
        where: { id: grant!.id },
      });

      expect(updatedGrant?.quantityConsumed).toBe(1);
    });

    it("REMED 4: sweepExpiredGrants marks expired grants and creates EXPIRATION movements in ledger", async () => {
      // Create a test grant that already expired
      const supporter = await prisma.supporter.findFirst({
        where: { tenantId: TEST_TENANT_ID, platformUserId: TEST_SUPPORTER_UID },
      });
      const toolDef = await prisma.toolDefinition.findFirst({
        where: { tenantId: TEST_TENANT_ID, key: "GLOVE" },
      });

      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      const expiredGrant = await prisma.toolGrant.create({
        data: {
          tenantId: TEST_TENANT_ID,
          supporterId: supporter!.id,
          toolDefinitionId: toolDef!.id,
          sourceEventId: "test_sweep_expired_event_1",
          quantityGranted: 2,
          quantityConsumed: 0,
          receivedAt: new Date(Date.now() - 121 * 3600000),
          expiresAt: pastDate,
          status: "AVAILABLE",
        },
      });

      const sweepResult = await SmartInventoryService.sweepExpiredGrants(TEST_TENANT_ID);

      expect(sweepResult.expiredCount).toBeGreaterThan(0);
      expect(sweepResult.movementsLogged).toBeGreaterThan(0);

      const refreshedGrant = await prisma.toolGrant.findUnique({
        where: { id: expiredGrant.id },
      });
      expect(refreshedGrant?.status).toBe("EXPIRED");

      const expMovement = await prisma.toolLedgerMovement.findFirst({
        where: {
          toolGrantId: expiredGrant.id,
          movementType: "EXPIRATION",
        },
      });

      expect(expMovement).toBeDefined();
      expect(expMovement?.quantity).toBe(-2);
      expect(expMovement?.resultingBalance).toBe(0);
      expect(expMovement?.reason).toBe("120H_TTL_EXPIRED");
    });

    it("REMED 5: parses TikTok Match Guide Power-Ups (pm_mt_match_guide_gotPowerUps) with multi-tool awards to top contributors", async () => {
      const pipeline = new LiveEventPipeline(TEST_TENANT_ID, testSessionId, mockAdapter);

      // Create 3 supporters on the host team
      const rank1Uid = "powerup_user_mvp_1";
      const rank2Uid = "powerup_user_rank_2";
      const rank3Uid = "powerup_user_rank_3";

      // Seed them in supporter table with distinct diamond counts to test ranking
      await prisma.supporter.upsert({
        where: { tenantId_platformUserId: { tenantId: TEST_TENANT_ID, platformUserId: rank1Uid } },
        create: { tenantId: TEST_TENANT_ID, platformUserId: rank1Uid, username: "mvp_supporter", displayName: "الداعم الأول", totalDiamonds: 7000 },
        update: { totalDiamonds: 7000 },
      });
      await prisma.supporter.upsert({
        where: { tenantId_platformUserId: { tenantId: TEST_TENANT_ID, platformUserId: rank2Uid } },
        create: { tenantId: TEST_TENANT_ID, platformUserId: rank2Uid, username: "second_supporter", displayName: "الداعم الثاني", totalDiamonds: 2300 },
        update: { totalDiamonds: 2300 },
      });
      await prisma.supporter.upsert({
        where: { tenantId_platformUserId: { tenantId: TEST_TENANT_ID, platformUserId: rank3Uid } },
        create: { tenantId: TEST_TENANT_ID, platformUserId: rank3Uid, username: "third_supporter", displayName: "الداعم الثالث", totalDiamonds: 1900 },
        update: { totalDiamonds: 1900 },
      });

      // Emulate the exact live TikTok msgType 4 payload from live logs
      const matchGuideNoticePayload = {
        msgType: 4,
        battleId: "battle_test_101",
        awardCardNotice: {
          noticeId: "notice_live_match_guide_777",
          displayContent: {
            key: "pm_mt_match_guide_gotPowerUps",
            defaultPattern: "Contributors got match power-ups.",
            pieces: [],
          },
          awardedUsers: [
            { userId: rank3Uid, displayId: "third_supporter", teamNumber: 1 },
            { userId: rank1Uid, displayId: "mvp_supporter", teamNumber: 1 },
            { userId: rank2Uid, displayId: "second_supporter", teamNumber: 1 },
          ],
        },
      };

      await pipeline.handleBattleItemCard(matchGuideNoticePayload);

      // Check Rank 1 (MVP) grants: SPEED_BOOSTER + GLOVE
      const r1Booster = await prisma.toolGrant.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          supporter: { platformUserId: rank1Uid },
          toolDefinition: { key: "SPEED_BOOSTER" },
        },
      });
      const r1Glove = await prisma.toolGrant.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          supporter: { platformUserId: rank1Uid },
          toolDefinition: { key: "GLOVE" },
        },
      });
      expect(r1Booster).toBeDefined();
      expect(r1Booster?.quantityGranted).toBe(1);
      expect(r1Glove).toBeDefined();
      expect(r1Glove?.quantityGranted).toBe(1);

      // Check Rank 2 grants: GLOVE + HAMMER
      const r2Glove = await prisma.toolGrant.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          supporter: { platformUserId: rank2Uid },
          toolDefinition: { key: "GLOVE" },
        },
      });
      const r2Hammer = await prisma.toolGrant.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          supporter: { platformUserId: rank2Uid },
          toolDefinition: { key: "HAMMER" },
        },
      });
      expect(r2Glove).toBeDefined();
      expect(r2Glove?.quantityGranted).toBe(1);
      expect(r2Hammer).toBeDefined();
      expect(r2Hammer?.quantityGranted).toBe(1);

      // Check Rank 3 grants: GLOVE + HAMMER
      const r3Glove = await prisma.toolGrant.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          supporter: { platformUserId: rank3Uid },
          toolDefinition: { key: "GLOVE" },
        },
      });
      const r3Hammer = await prisma.toolGrant.findFirst({
        where: {
          tenantId: TEST_TENANT_ID,
          supporter: { platformUserId: rank3Uid },
          toolDefinition: { key: "HAMMER" },
        },
      });
      expect(r3Glove).toBeDefined();
      expect(r3Glove?.quantityGranted).toBe(1);
      expect(r3Hammer).toBeDefined();
      expect(r3Hammer?.quantityGranted).toBe(1);
    });
  });
});

