import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma";
import { SmartInventoryService } from "../src/lib/smart-inventory";
import { StreamHealthService } from "../src/lib/stream-health";

describe("Tenant Bootstrap & Smart Inventory Reliability Regression Tests", () => {
  const TEST_TENANT_A = "test-tenant-reg-a";
  const TEST_TENANT_B = "test-tenant-reg-b";

  beforeAll(async () => {
    // Clean up any leftovers from previous test runs
    await prisma.toolLedgerMovement.deleteMany({
      where: { tenantId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    await prisma.toolConsumption.deleteMany({
      where: { tenantId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    await prisma.externalActivation.deleteMany({
      where: { tenantId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    await prisma.toolGrant.deleteMany({
      where: { tenantId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    await prisma.toolDefinition.deleteMany({
      where: { tenantId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    await prisma.telegramConfig.deleteMany({
      where: { tenantId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });

    // Create Tenant A only; Tenant B is not created yet
    await prisma.tenant.create({
      data: {
        id: TEST_TENANT_A,
        slug: "reg-tenant-a",
        name: "Regression Tenant A",
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.toolLedgerMovement.deleteMany({
      where: { tenantId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    await prisma.toolConsumption.deleteMany({
      where: { tenantId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    await prisma.externalActivation.deleteMany({
      where: { tenantId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    await prisma.toolGrant.deleteMany({
      where: { tenantId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    await prisma.toolDefinition.deleteMany({
      where: { tenantId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    await prisma.telegramConfig.deleteMany({
      where: { tenantId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
  });

  // 1. ensureCanonicalDefinitions receives an empty tenant ID: no invalid write occurs
  it("Requirement 1: ensureCanonicalDefinitions with empty tenant ID returns false without throwing or writing", async () => {
    const countBefore = await prisma.toolDefinition.count();
    const resultEmpty = await SmartInventoryService.ensureCanonicalDefinitions("");
    const resultWhitespace = await SmartInventoryService.ensureCanonicalDefinitions("   ");
    const countAfter = await prisma.toolDefinition.count();

    expect(resultEmpty).toBe(false);
    expect(resultWhitespace).toBe(false);
    expect(countAfter).toBe(countBefore);
  });

  // 2. A nonexistent tenant ID: no foreign-key violation is triggered by an attempted invalid write
  it("Requirement 2: ensureCanonicalDefinitions with nonexistent tenant ID returns false without throwing P2003", async () => {
    const countBefore = await prisma.toolDefinition.count();
    const result = await SmartInventoryService.ensureCanonicalDefinitions("nonexistent-tenant-9999");
    const countAfter = await prisma.toolDefinition.count();

    expect(result).toBe(false);
    expect(countAfter).toBe(countBefore);
  });

  // 3. A valid, provisioned tenant: canonical definitions are created successfully
  it("Requirement 3: ensureCanonicalDefinitions with valid provisioned tenant creates canonical definitions", async () => {
    const result = await SmartInventoryService.ensureCanonicalDefinitions(TEST_TENANT_A);
    expect(result).toBe(true);

    const definitions = await prisma.toolDefinition.findMany({
      where: { tenantId: TEST_TENANT_A },
    });
    expect(definitions.length).toBe(7);

    const keys = definitions.map((d) => d.key).sort();
    expect(keys).toEqual([
      "BOOST_FOG",
      "GLOVE",
      "HAMMER",
      "SHIELD_DEFENSE",
      "SONG_SURGE",
      "SPEED_BOOSTER",
      "TIME_EXTENDER",
    ]);
  });

  // 4. Repeated initialization: no duplicate canonical definitions are created
  it("Requirement 4: Repeated initialization is idempotent and creates no duplicate definitions", async () => {
    const resultRepeat = await SmartInventoryService.ensureCanonicalDefinitions(TEST_TENANT_A);
    expect(resultRepeat).toBe(true);

    const definitions = await prisma.toolDefinition.findMany({
      where: { tenantId: TEST_TENANT_A },
    });
    expect(definitions.length).toBe(7);
  });

  // 5. getInventoryCounters behaves correctly when tenant is absent or empty
  it("Requirement 5: getInventoryCounters returns safe canonical zero counters when tenant is absent or empty", async () => {
    const emptyCounters = await SmartInventoryService.getInventoryCounters("");
    expect(emptyCounters.length).toBe(7);
    for (const c of emptyCounters) {
      expect(c.totalAvailable).toBe(0);
      expect(c.totalReceived).toBe(0);
      expect(c.totalConsumed).toBe(0);
      expect(c.totalExpiringSoon).toBe(0);
      expect(c.totalExpired).toBe(0);
    }

    const nonexistentCounters = await SmartInventoryService.getInventoryCounters("nonexistent-tenant-xyz");
    expect(nonexistentCounters.length).toBe(7);
    for (const c of nonexistentCounters) {
      expect(c.totalAvailable).toBe(0);
      expect(c.totalReceived).toBe(0);
      expect(c.totalConsumed).toBe(0);
    }
  });

  // 6. Dashboard page logic regression: / handles missing tenant without throwing
  it("Requirement 6: Dashboard page tenant resolution and counter retrieval handles missing tenant without throwing", async () => {
    // Simulate what page.tsx does when tenant is missing:
    const tenant = await prisma.tenant.findUnique({
      where: { slug: "completely-nonexistent-slug-dashboard" },
    });
    const tenantId = tenant?.id || "";

    // The call that previously crashed with P2003 on /:
    const counters = await SmartInventoryService.getInventoryCounters(tenantId);
    expect(counters.length).toBe(7);

    const recon = await SmartInventoryService.reconcileInventory(tenantId);
    expect(recon.isReconciled).toBe(true);
    expect(recon.totalGrantsProjected).toBe(0);

    const availableCount = counters.reduce((acc, c) => acc + c.totalAvailable, 0);
    expect(availableCount).toBe(0);
  });

  // 7. Inventory page logic regression: /inventory handles missing tenant without throwing
  it("Requirement 7: Inventory page tenant resolution and grant retrieval handles missing tenant without throwing", async () => {
    // Simulate what inventory/page.tsx does when tenant is missing:
    const tenant = await prisma.tenant.findUnique({
      where: { slug: "completely-nonexistent-slug-inventory" },
    });
    const tenantId = tenant?.id || "";

    // The call that previously crashed with P2003 on /inventory:
    const counters = await SmartInventoryService.getInventoryCounters(tenantId);
    expect(counters.length).toBe(7);

    const grants = await prisma.toolGrant.findMany({
      where: { tenantId },
      include: { toolDefinition: true, supporter: true },
    });
    expect(grants.length).toBe(0);
  });

  // 8. Tenant isolation: one tenant cannot read or initialize another tenant's inventory
  it("Requirement 8: Strict tenant isolation - definitions for Tenant A do not bleed into Tenant B", async () => {
    // Create Tenant B
    await prisma.tenant.create({
      data: {
        id: TEST_TENANT_B,
        slug: "reg-tenant-b",
        name: "Regression Tenant B",
      },
    });

    // Before B initializes, B has 0 definitions in DB
    const defsBBefore = await prisma.toolDefinition.findMany({
      where: { tenantId: TEST_TENANT_B },
    });
    expect(defsBBefore.length).toBe(0);

    // Initializing B creates B's own definitions
    await SmartInventoryService.ensureCanonicalDefinitions(TEST_TENANT_B);

    const defsBAfter = await prisma.toolDefinition.findMany({
      where: { tenantId: TEST_TENANT_B },
    });
    expect(defsBAfter.length).toBe(7);

    // Definitions for A and B remain strictly separated
    const allDefs = await prisma.toolDefinition.findMany({
      where: { tenantId: { in: [TEST_TENANT_A, TEST_TENANT_B] } },
    });
    expect(allDefs.length).toBe(14);
    expect(allDefs.filter((d) => d.tenantId === TEST_TENANT_A).length).toBe(7);
    expect(allDefs.filter((d) => d.tenantId === TEST_TENANT_B).length).toBe(7);
  });

  // 9. grantTool and consumeTool tenant boundary enforcement
  it("Requirement 9: grantTool and consumeTool reject empty or nonexistent tenant ID", async () => {
    const grantResultEmpty = await SmartInventoryService.grantTool({
      tenantId: "",
      supporterId: "sup-1",
      toolKey: "GLOVE",
      quantity: 1,
      sourceEventId: "evt-empty-tenant",
    });
    expect(grantResultEmpty.success).toBe(false);
    expect(grantResultEmpty.reason).toBe("INVALID_TENANT_ID");

    const grantResultNonexistent = await SmartInventoryService.grantTool({
      tenantId: "nonexistent-tenant-id",
      supporterId: "sup-1",
      toolKey: "GLOVE",
      quantity: 1,
      sourceEventId: "evt-nonexistent-tenant",
    });
    expect(grantResultNonexistent.success).toBe(false);
    expect(grantResultNonexistent.reason).toBe("TENANT_NOT_FOUND");

    const consumeResultEmpty = await SmartInventoryService.consumeTool({
      tenantId: "",
      supporterId: "sup-1",
      toolKey: "GLOVE",
    });
    expect(consumeResultEmpty.success).toBe(false);
    expect(consumeResultEmpty.reason).toBe("INVALID_TENANT_ID");

    const consumeResultNonexistent = await SmartInventoryService.consumeTool({
      tenantId: "nonexistent-tenant-id",
      supporterId: "sup-1",
      toolKey: "GLOVE",
    });
    expect(consumeResultNonexistent.success).toBe(false);
    expect(consumeResultNonexistent.reason).toBe("TENANT_NOT_FOUND");
  });

  // 10. Telegram Health Reporting Tests
  it("Requirement 10: Telegram health reporting accurately reflects missing configuration", async () => {
    // Preserve process.env
    const origToken = process.env.TELEGRAM_BOT_TOKEN;
    const origChat = process.env.TELEGRAM_CHAT_ID;

    try {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;

      // Without tenantId, missing env vars -> DEGRADED
      const healthNoTenant = await StreamHealthService.getHealthTelemetry();
      expect(healthNoTenant.components.telegramAlerts.status).toBe("DEGRADED");
      expect(healthNoTenant.components.telegramAlerts.message).toContain("غير مهيأة");

      // With tenantId (Tenant A has no TelegramConfig in DB, and env vars are missing) -> DEGRADED
      const healthTenantA = await StreamHealthService.getHealthTelemetry(TEST_TENANT_A);
      expect(healthTenantA.components.telegramAlerts.status).toBe("DEGRADED");
      expect(healthTenantA.components.telegramAlerts.message).toContain("غير مهيأة");

      // Configure Telegram for Tenant A but disabled -> DEGRADED
      await prisma.telegramConfig.upsert({
        where: { tenantId: TEST_TENANT_A },
        update: {
          botToken: "test_bot_token",
          chatId: "-1001234567890",
          isEnabled: false,
        },
        create: {
          tenantId: TEST_TENANT_A,
          botToken: "test_bot_token",
          chatId: "-1001234567890",
          isEnabled: false,
        },
      });

      const healthTenantADisabled = await StreamHealthService.getHealthTelemetry(TEST_TENANT_A);
      expect(healthTenantADisabled.components.telegramAlerts.status).toBe("DEGRADED");
      expect(healthTenantADisabled.components.telegramAlerts.message).toContain("معطلة");

      // Enable Telegram for Tenant A with valid config -> HEALTHY
      await prisma.telegramConfig.update({
        where: { tenantId: TEST_TENANT_A },
        data: { isEnabled: true },
      });

      const healthTenantAEnabled = await StreamHealthService.getHealthTelemetry(TEST_TENANT_A);
      expect(healthTenantAEnabled.components.telegramAlerts.status).toBe("HEALTHY");
      expect(healthTenantAEnabled.components.telegramAlerts.message).toContain("معدة وجاهزة");

    } finally {
      // Restore process.env
      if (origToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = origToken;
      else delete process.env.TELEGRAM_BOT_TOKEN;

      if (origChat !== undefined) process.env.TELEGRAM_CHAT_ID = origChat;
      else delete process.env.TELEGRAM_CHAT_ID;
    }
  });
});
