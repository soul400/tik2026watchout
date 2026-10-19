import { describe, it, expect, beforeEach, vi } from "vitest";
import { PdfExportService } from "../src/lib/pdf-export-service";
import { TelegramService } from "../src/lib/telegram-service";
import { ReportType } from "../src/lib/reports-service";
import { prisma } from "../src/lib/prisma";

describe("PdfExportService and Telegram PDF Integration Tests", () => {
  const TEST_TENANT = "test-export-tenant";
  const TEST_STREAMER = "streamer-export-test";

  beforeEach(async () => {
    await prisma.tenant.upsert({
      where: { id: TEST_TENANT },
      update: {},
      create: {
        id: TEST_TENANT,
        name: "Mohra Test Studio Export",
        slug: "mohra-test-studio-export",
      },
    });

    await prisma.streamerAccount.upsert({
      where: { id: TEST_STREAMER },
      update: {},
      create: {
        id: TEST_STREAMER,
        tenantId: TEST_TENANT,
        username: "mohra.test",
        displayName: "مهرة تيست",
      },
    });
  });

  const TARGET_7_REPORTS: ReportType[] = [
    "SUPPORTER_PRESENCE_PATTERN",
    "ENIGMA_UNMASKED_ANALYSIS",
    "TACTICAL_INVENTORY_AUDIT",
    "STQI_TIMING_REPORT",
    "LIVE_SESSION_SUMMARY",
    "COMMUNITY_CHAMPIONS",
    "BATTLE_POST_MATCH",
  ];

  it("identifies valid Chrome or Edge browser executable on host", () => {
    const execPath = PdfExportService.getBrowserExecutablePath();
    expect(execPath).toBeTruthy();
    expect(typeof execPath).toBe("string");
  });

  it("generates certified PDF document buffer for LIVE_SESSION_SUMMARY", async () => {
    const result = await PdfExportService.generatePdfBuffer({
      tenantId: TEST_TENANT,
      reportType: "LIVE_SESSION_SUMMARY",
      periodPreset: "today",
    });

    expect(result).toBeDefined();
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(1000); // Valid PDF file size
    expect(result.filename).toMatch(/^LIVE_SESSION_SUMMARY_.*\.pdf$/);
    expect(result.reportTitle).toBeTruthy();

    // PDF Magic Number %PDF-
    const header = result.buffer.subarray(0, 4).toString("ascii");
    expect(header).toBe("%PDF");
  }, 20000);

  it("generates certified PDF document buffer for BATTLE_POST_MATCH with minHostScore filter", async () => {
    const result = await PdfExportService.generatePdfBuffer({
      tenantId: TEST_TENANT,
      reportType: "BATTLE_POST_MATCH",
      minHostScore: 50000,
    });

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(1000);
    expect(result.filename).toMatch(/^BATTLE_POST_MATCH_.*\.pdf$/);
    const header = result.buffer.subarray(0, 4).toString("ascii");
    expect(header).toBe("%PDF");
  }, 20000);

  it("generates certified PDF document buffer for SUPPORTER_PRESENCE_PATTERN with threshold", async () => {
    const result = await PdfExportService.generatePdfBuffer({
      tenantId: TEST_TENANT,
      reportType: "SUPPORTER_PRESENCE_PATTERN",
      threshold: 100000,
    });

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(1000);
    expect(result.filename).toMatch(/^SUPPORTER_PRESENCE_PATTERN_.*\.pdf$/);
    const header = result.buffer.subarray(0, 4).toString("ascii");
    expect(header).toBe("%PDF");
  }, 20000);

  it("verifies all 7 required reports can generate PDF without crashing", async () => {
    for (const reportType of TARGET_7_REPORTS) {
      const result = await PdfExportService.generatePdfBuffer({
        tenantId: TEST_TENANT,
        reportType,
      });
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(500);
      expect(result.filename.startsWith(reportType)).toBe(true);
      expect(result.filename.endsWith(".pdf")).toBe(true);
    }
  }, 60000);

  it("verifies TelegramService.sendReportPdf correctly prepares and sends PDF document", async () => {
    // Ensure telegram config exists for this test tenant
    await prisma.telegramConfig.upsert({
      where: { tenantId: TEST_TENANT },
      update: { botToken: "test_token", chatId: "123456789", isEnabled: true },
      create: {
        tenantId: TEST_TENANT,
        botToken: "test_token",
        chatId: "123456789",
        isEnabled: true,
      },
    });

    const originalFetch = global.fetch;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          message_id: 999888,
          chat: { id: 123456789 },
          document: { file_name: "LIVE_SESSION_SUMMARY.pdf" },
        },
      }),
    });
    global.fetch = mockFetch;

    try {
      const result = await TelegramService.sendReportPdf(
        TEST_TENANT,
        "LIVE_SESSION_SUMMARY",
        { periodPreset: "today", chatIdOverride: "123456789" }
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(999888);
      expect(result.filename).toMatch(/^LIVE_SESSION_SUMMARY_.*\.pdf$/);

      // Verify that sendDocument was called
      expect(mockFetch).toHaveBeenCalled();
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("/sendDocument");
    } finally {
      global.fetch = originalFetch;
    }
  }, 25000);
});
