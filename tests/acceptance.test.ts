import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma";
import { SmartInventoryService } from "../src/lib/smart-inventory";
import { BattleEngine } from "../src/lib/battle-engine";
import { ChampionsEngine } from "../src/lib/champions-engine";

describe("LIVEPULSE INTELLIGENCE — Acceptance Test Suite", () => {
  const TEST_TENANT = "test-acceptance-tenant";
  let tenantId = TEST_TENANT;
  let supporterId: string;

  beforeEach(async () => {
    // Isolated acceptance test tenant
    const tenant = await prisma.tenant.upsert({
      where: { id: TEST_TENANT },
      update: {},
      create: {
        id: TEST_TENANT,
        slug: "test-acceptance-tenant",
        name: "Test Acceptance Tenant",
      },
    });
    tenantId = tenant.id;

    await SmartInventoryService.ensureCanonicalDefinitions(tenantId);

    let streamer = await prisma.streamerAccount.findFirst({ where: { tenantId } });
    if (!streamer) {
      await prisma.streamerAccount.create({
        data: {
          tenantId,
          platformUserId: "test_acceptance_streamer",
          username: "test.streamer",
          displayName: "مضيف تجريبي",
        },
      });
    }

    let supporter = await prisma.supporter.findFirst({ where: { tenantId } });
    if (!supporter) {
      supporter = await prisma.supporter.create({
        data: {
          tenantId,
          platformUserId: "test_supporter_id",
          username: "test_supporter",
          displayName: "داعم تجريبي",
        },
      });
    }
    supporterId = supporter.id;
  });

  // TEST 1: Tool Separation & No Mixing
  it("TEST 1: Grants Glove and Fog distinctly without cross-mixing or type confusion", async () => {
    const resGlove = await SmartInventoryService.grantTool({
      tenantId,
      supporterId,
      toolKey: "GLOVE",
      quantity: 1,
      sourceEventId: `test_evt_glove_${Date.now()}`,
    });

    const resFog = await SmartInventoryService.grantTool({
      tenantId,
      supporterId,
      toolKey: "BOOST_FOG",
      quantity: 1,
      sourceEventId: `test_evt_fog_${Date.now()}`,
    });

    expect(resGlove.success).toBe(true);
    expect(resFog.success).toBe(true);
    expect(resGlove.grant?.toolDefinition.key).toBe("GLOVE");
    expect(resFog.grant?.toolDefinition.key).toBe("BOOST_FOG");
    expect(resGlove.grant?.toolDefinitionId).not.toBe(resFog.grant?.toolDefinitionId);
  });

  // TEST 2: Idempotency (Prevent Duplicate Grant)
  it("TEST 2: Prevents duplicate grants when receiving identical sourceEventId", async () => {
    const fixedEventId = `idempotent_event_${Date.now()}`;

    const firstGrant = await SmartInventoryService.grantTool({
      tenantId,
      supporterId,
      toolKey: "GLOVE",
      quantity: 1,
      sourceEventId: fixedEventId,
    });
    expect(firstGrant.success).toBe(true);

    const duplicateGrant = await SmartInventoryService.grantTool({
      tenantId,
      supporterId,
      toolKey: "GLOVE",
      quantity: 1,
      sourceEventId: fixedEventId,
    });
    expect(duplicateGrant.success).toBe(false);
    expect(duplicateGrant.reason).toBe("ALREADY_GRANTED");
  });

  // TEST 3: Exact 5-Day (120 Hours) Expiration
  it("TEST 3: Calculates exact 5-day expiration on the server", async () => {
    const res = await SmartInventoryService.grantTool({
      tenantId,
      supporterId,
      toolKey: "GLOVE",
      quantity: 1,
      sourceEventId: `test_exp_${Date.now()}`,
    });

    expect(res.success).toBe(true);
    const received = new Date(res.grant!.receivedAt).getTime();
    const expires = new Date(res.grant!.expiresAt).getTime();
    const diffHours = (expires - received) / (1000 * 60 * 60);

    expect(Math.round(diffHours)).toBe(120); // 5 days exactly
  });

  // TEST 4: Atomic Consumption & Prevent Double Spend
  it("TEST 4: Prevents overdraw and double consumption of tools", async () => {
    const res = await SmartInventoryService.grantTool({
      tenantId,
      supporterId,
      toolKey: "GLOVE",
      quantity: 1,
      sourceEventId: `test_consume_${Date.now()}`,
    });

    const grantId = res.grant!.id;

    // Consume 1 (valid)
    const consume1 = await SmartInventoryService.consumeTool({
      tenantId,
      grantId,
      supporterId,
      quantity: 1,
    });
    expect(consume1.updatedGrant.status).toBe("FULLY_USED");

    // Attempt second consume (invalid - insufficient balance)
    await expect(
      SmartInventoryService.consumeTool({
        tenantId,
        grantId,
        supporterId,
        quantity: 1,
      })
    ).rejects.toThrow(/Insufficient quantity/);
  });

  // TEST 5: Battle Engine Team Integrity under Inverted Order
  it("TEST 5: Maintains strict team attribution regardless of participant arrival order", async () => {
    const session = await prisma.liveSession.create({
      data: {
        tenantId,
        streamerAccountId: (await prisma.streamerAccount.findFirst({ where: { tenantId } }))!.id,
      },
    });

    // Inverted participants arrival: Player 2 arrives first in list
    const battle = await BattleEngine.createOrSyncBattle({
      tenantId,
      liveSessionId: session.id,
      battleType: "1V1",
      participants: [
        {
          teamNumber: 2,
          platformUserId: "opponent_user_777",
          username: "challenger_boss",
          displayName: "المنافس الشرس",
        },
        {
          teamNumber: 1,
          platformUserId: "mohra_official",
          username: "mohra.2000",
          displayName: "مهـرة",
        },
      ],
    });

    expect(battle.participants).toHaveLength(2);
    const mohraPart = battle.participants.find((p) => p.platformUserId === "mohra_official");
    const oppPart = battle.participants.find((p) => p.platformUserId === "opponent_user_777");

    expect(mohraPart?.teamNumber).toBe(1);
    expect(oppPart?.teamNumber).toBe(2);

    // Record score for Team 1
    await BattleEngine.recordScoreEvent({
      battleId: battle.id,
      supporterId,
      teamNumber: 1,
      points: 5000,
    });

    // Conclude battle
    const finished = await BattleEngine.finishBattle(battle.id);
    expect(finished.team1Score).toBe(5000);
    expect(finished.team2Score).toBe(0);
    expect(finished.winningTeam).toBe(1);
  });

  // TEST 6: Champions Multi-dimensional Scoring
  it("TEST 6: Computes champions scores using weighted dimensions rather than gifts alone", async () => {
    const now = new Date();
    const pastHour = new Date(now.getTime() - 3600 * 1000);
    const nextHour = new Date(now.getTime() + 3600 * 1000);

    // Update test supporter with organic community engagement
    await prisma.supporter.update({
      where: { id: supporterId },
      data: {
        lastObservedAt: now,
        totalComments: 10,
        totalLikes: 25,
      },
    });

    const champions = await ChampionsEngine.computePeriodChampions({
      tenantId,
      periodType: "DAILY",
      startDate: pastHour,
      endDate: nextHour,
    });

    expect(champions.length).toBeGreaterThan(0);
    const top = champions[0];
    expect(top.rank).toBe(1);
    expect(top.finalScore).toBeGreaterThan(0);
    expect(top.qualificationReason).toBeDefined();
  });

  afterAll(async () => {
    // Purge test tenant completely
    await prisma.toolLedgerMovement.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.toolConsumption.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.toolGrant.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.toolDefinition.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.battleScoreEvent.deleteMany({ where: { battle: { tenantId: TEST_TENANT } } });
    await prisma.battleParticipant.deleteMany({ where: { battle: { tenantId: TEST_TENANT } } });
    await prisma.battle.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.supporter.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.liveSession.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.streamerAccount.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.tenant.deleteMany({ where: { id: TEST_TENANT } });
  });
});
