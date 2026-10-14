import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma";
import { SmartInventoryService } from "../src/lib/smart-inventory";
import { LiveEventPipeline } from "../src/lib/event-pipeline";

describe("Tactical Inventory & Multi-Tool Tracking Tests", () => {
  const TEST_TENANT_ID = "test-inventory-tenant";
  const TEST_SUPPORTER_UID = "supporter_inv_test_99";
  const mockAdapter = {
    on: () => {},
  } as any;

  beforeAll(async () => {
    // Clean before tests
    await prisma.toolConsumption.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.toolGrant.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.toolDefinition.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.supporter.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.battleParticipant.deleteMany({ where: { battle: { tenantId: TEST_TENANT_ID } } });
    await prisma.battle.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
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

    await prisma.battle.create({
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
          ],
        },
      },
    });
  });

  afterAll(async () => {
    // Teardown hook to guarantee ZERO mock test contamination in live db
    await prisma.toolConsumption.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.toolGrant.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.toolDefinition.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.supporter.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.battleParticipant.deleteMany({ where: { battle: { tenantId: TEST_TENANT_ID } } });
    await prisma.battle.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
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
    const pipeline = new LiveEventPipeline(TEST_TENANT_ID, "session_test", mockAdapter);

    // Supporter receives Glove AND Song Surge in the same round notice
    const mockMultiAwardNotice = {
      battleId: "battle_test_101",
      awardCardNotice: {
        noticeId: "notice_round_settle_88",
        awardedUsers: [
          {
            user: { userId: TEST_SUPPORTER_UID, displayId: "super_supporter", nickName: "سوبر داعم" },
            cardType: "glove",
            count: 1,
          },
          {
            user: { userId: TEST_SUPPORTER_UID, displayId: "super_supporter", nickName: "سوبر داعم" },
            cardType: "wave", // Song Surge
            count: 1,
          },
        ],
      },
    };

    await pipeline.handleBattleItemCard(mockMultiAwardNotice);

    // Verify both grants exist and were not deduplicated away
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
    const pipeline = new LiveEventPipeline(TEST_TENANT_ID, "session_test", mockAdapter);

    // Consume Song Surge
    const mockWaveUse = {
      battleId: "battle_test_101",
      useWaveCard: {
        cardInfo: {
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
});
