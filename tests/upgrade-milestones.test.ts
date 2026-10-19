import { describe, it, expect, beforeEach } from "vitest";
import { StreamHealthService } from "../src/lib/stream-health";
import { ReportsService } from "../src/lib/reports-service";
import { EnigmaEngine } from "../src/lib/enigma-engine";
import { TelegramService } from "../src/lib/telegram-service";
import { CopilotService } from "../src/lib/copilot-service";
import { prisma } from "../src/lib/prisma";

describe("LivePulse Master Engineering Upgrade Verification Suite", () => {
  const TEST_TENANT = "test-upgrade-tenant";

  beforeEach(async () => {
    await prisma.tenant.upsert({
      where: { id: TEST_TENANT },
      update: {},
      create: {
        id: TEST_TENANT,
        name: "Test Upgrade Tenant",
        slug: "test-upgrade-tenant",
      },
    });
  });

  // =========================================================================
  // Milestone 1: Stream Health Monitoring
  // =========================================================================
  describe("Milestone 1: Stream Health & Ingestion Telemetry", () => {
    it("tracks connection state transitions and latencies correctly", async () => {
      StreamHealthService.setConnectionState("CONNECTED");
      StreamHealthService.recordHeartbeat();
      StreamHealthService.recordEventReceived(45);

      const telemetry = await StreamHealthService.getHealthTelemetry(TEST_TENANT);
      expect(telemetry.status).toBe("CONNECTED");
      expect(telemetry.eventProcessingLatencyMs).toBe(45);
      expect(telemetry.totalEventsReceived).toBeGreaterThan(0);
      expect(telemetry.components.worker.status).toBe("HEALTHY");
      expect(telemetry.components.database.status).toBe("HEALTHY");
    });

    it("detects degraded state when latency or error rate spikes", async () => {
      StreamHealthService.recordError("Network timeout on WebSocket connection");
      StreamHealthService.recordEventReceived(1200); // 1.2s high latency

      const telemetry = await StreamHealthService.getHealthTelemetry(TEST_TENANT);
      expect(telemetry.overallHealth).toBe("DEGRADED");
      expect(telemetry.diagnostics.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Milestone 2: Reports Service & Formula Injection Protection
  // =========================================================================
  describe("Milestone 2: Centralized Reports Service & CSV Security", () => {
    it("neutralizes formula injection characters (=, +, -, @) in CSV export", async () => {
      expect(ReportsService.sanitizeCsvValue("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(ReportsService.sanitizeCsvValue("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
      expect(ReportsService.sanitizeCsvValue("@malicious")).toBe("'@malicious");
      expect(ReportsService.sanitizeCsvValue("عادي")).toBe("عادي");

      const headers = ["الاسم", "القيمة"];
      const rows = [
        { "الاسم": "=2+2", "القيمة": "100" },
        { "الاسم": "داعم نظامي", "القيمة": "500" },
      ];

      const csvContent = ReportsService.buildCsv(headers, rows);
      expect(csvContent.startsWith("\uFEFF")).toBe(true);
      expect(csvContent).toContain("'=2+2");
      expect(csvContent).toContain("داعم نظامي");
    });

    it("generates structured report as JSON with audit metadata", async () => {
      const report = await ReportsService.generateReport({
        tenantId: TEST_TENANT,
        reportType: "DATA_QUALITY_RECONCILIATION",
      });

      expect(report.metadata.reportType).toBe("DATA_QUALITY_RECONCILIATION");
      expect(report.metadata.tenantId).toBe(TEST_TENANT);
      expect(report.metadata.generatedAt).toBeDefined();
      expect(Array.isArray(report.headers)).toBe(true);
      expect(Array.isArray(report.rows)).toBe(true);
    });
  });

  // =========================================================================
  // Milestone 2: Enigma Evidence Categorization
  // =========================================================================
  describe("Milestone 2: Enigma Evidence Categorization & Governance", () => {
    it("rejects behavioral similarity from being marked as an authoritative match", async () => {
      const u1 = `user_a_${Date.now()}`;
      const u2 = `user_b_${Date.now()}`;
      // Create candidate with pure behavioral similarity
      const review = await prisma.enigmaReview.create({
        data: {
          tenantId: TEST_TENANT,
          supporter1Id: u1,
          supporter2Id: u2,
          confidenceScore: 0.88,
          matchLevel: "PROBABLE_MATCH",
          evidenceJson: JSON.stringify({
            classification: "BEHAVIORAL_SIMILARITY",
            classificationRationale: "تشابه في توقيت إرسال الهدايا بدون تطابق معرف قطعي",
            isBehavioralOnly: true,
            ruleVersion: "v1.0",
            realUsername: "user_a",
            realDisplayName: "User A",
            enigmaUsername: "Enigma_User",
            enigmaDisplayName: "Enigma",
            platformUserId: "uid_a",
            diamondsWithEnigma: 1000,
            diamondsPublic: 2000,
            totalCombinedDiamonds: 3000,
            enigmaEventsCount: 5,
            topGifts: [],
            evidencePoints: ["تشابه سلوكي"],
          }),
          status: "PENDING",
        },
      });

      // Review action: auditor dismisses/rejects with audit log
      const updated = await EnigmaEngine.reviewCandidate({
        reviewId: review.id,
        action: "DISMISSED",
        reviewer: "auditor_ahmed",
        notes: "تم رفض التطابق لعدم وجود إثبات هوياتي قاطع",
      });

      expect(updated.status).toBe("DISMISSED");
      expect(updated.reviewedBy).toBe("auditor_ahmed");

      // Verify AuditLog was recorded
      const log = await prisma.auditLog.findFirst({
        where: { tenantId: TEST_TENANT, entityId: review.id },
      });
      expect(log).toBeDefined();
      expect(log?.action).toBe("ENIGMA_MATCH_DISMISSED");
    });
  });

  // =========================================================================
  // Milestone 2: Telegram Inbound Command Center
  // =========================================================================
  describe("Milestone 2: Telegram Inbound Command Center & Allowlist", () => {
    it("rejects unauthorized Telegram commands when sender is not in allowlist", async () => {
      const res = await TelegramService.processIncomingCommand(TEST_TENANT, {
        text: "/status",
        chat: { id: "unauthorized_chat_999" },
        from: { id: "unauthorized_user_999" },
      });

      expect(res.handled).toBe(true);
      expect(res.error).toBe("UNAUTHORIZED");
      expect(res.replyText).toContain("غير مصرح");
    });

    it("handles /status and /inventory for authorized sender", async () => {
      // Configure tenant with authorized chat
      await TelegramService.updateConfig(TEST_TENANT, {
        chatId: "authorized_chat_777",
        isEnabled: true,
      });

      const resStatus = await TelegramService.processIncomingCommand(TEST_TENANT, {
        text: "/status",
        chat: { id: "authorized_chat_777" },
        from: { id: "authorized_chat_777" },
      });

      expect(resStatus.handled).toBe(true);
      expect(resStatus.error).toBeUndefined();
      expect(resStatus.replyText).toContain("حالة البث والمنظومة الحالية");

      const resInv = await TelegramService.processIncomingCommand(TEST_TENANT, {
        text: "/inventory",
        chat: { id: "authorized_chat_777" },
        from: { id: "authorized_chat_777" },
      });

      expect(resInv.handled).toBe(true);
      expect(resInv.replyText).toContain("مستودع الأدوات التكتيكية");
    });
  });

  // =========================================================================
  // Milestone 3: LivePulse Copilot Read-Only Intelligence
  // =========================================================================
  describe("Milestone 3: LivePulse Copilot Grounded Assistant", () => {
    it("compiles strictly read-only grounded context from DB", async () => {
      const context = await CopilotService.getGroundedContext(TEST_TENANT);
      expect(context.tenantId).toBe(TEST_TENANT);
      expect(context.health).toBeDefined();
      expect(context.inventory).toBeDefined();
      expect(context.battle).toBeDefined();
      expect(context.stqi).toBeDefined();
      expect(Array.isArray(context.topChampions)).toBe(true);
    });

    it("synthesizes deterministic Arabic responses for operational questions", async () => {
      const resHealth = await CopilotService.askCopilot(TEST_TENANT, "ما هي حالة الاتصال وصحة السيرفر؟");
      expect(resHealth.source).toBe("deterministic_engine");
      expect(resHealth.answer).toContain("تقرير صحة النظام والاتصال");

      const resInv = await CopilotService.askCopilot(TEST_TENANT, "كم رصيد القفازات والأدوات التكتيكية؟");
      expect(resInv.answer).toContain("ملخص المستودع التكتيكي");
      expect(resInv.answer).toContain("سلامة المطابقة المحاسبية");

      const resSTQI = await CopilotService.askCopilot(TEST_TENANT, "ما هي نصيحة التوقيت والريتم؟");
      expect(resSTQI.answer).toContain("مؤشر التوقيت الذكي والإيقاع");
    });
  });
});
