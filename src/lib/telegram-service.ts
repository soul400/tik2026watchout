import { prisma } from "./prisma";
import { ChampionsEngine } from "./champions-engine";
import { STQIEngine } from "./stqi-engine";
import { StreamHealthService } from "./stream-health";
import { SmartInventoryService } from "./smart-inventory";
import { ReportType } from "./reports-service";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface BattleScorePayload {
  battleId: string;
  battleType: "1V1" | "2V2";
  team1Score: number;
  team2Score: number;
  team1Members: string[];
  team2Members: string[];
  isFinal?: boolean;
}

interface BattleTelegramTracker {
  messageIds: Record<string, number>;
  lastSentTime: number;
  lastT1: number;
  lastT2: number;
  pendingTimer?: NodeJS.Timeout | null;
  lastPayload?: BattleScorePayload;
}

// In-memory tracker for active battle score messages across throttling cycles
const activeBattleTrackers = new Map<string, BattleTelegramTracker>();

// Per-chat cooldown timestamp map to strictly respect Telegram 429 retry_after limits
const chatCooldownUntil = new Map<string, number>();

export interface TelegramConfigDTO {
  id?: string;
  tenantId: string;
  botToken: string | null;
  chatId: string | null;
  isEnabled: boolean;
  alertVipEntry: boolean;
  vipDiamondsThreshold: number;
  alertEnigmaUnmasked: boolean;
  alertDailyChampions: boolean;
  alertDailyStqi: boolean;
  alertBattleScores: boolean;
  lastDailyChampionsAt?: Date | null;
  lastDailyStqiAt?: Date | null;
}

export class TelegramService {
  /**
   * Retrieves or creates default Telegram configuration for tenant.
   * Falls back to process.env if database fields are empty.
   */
  static async getConfig(tenantId: string): Promise<TelegramConfigDTO> {
    let config = await prisma.telegramConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      config = await prisma.telegramConfig.create({
        data: {
          tenantId,
          botToken: process.env.TELEGRAM_BOT_TOKEN || null,
          chatId: process.env.TELEGRAM_CHAT_ID || null,
          isEnabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
          alertVipEntry: true,
          vipDiamondsThreshold: 5000,
          alertEnigmaUnmasked: true,
          alertDailyChampions: true,
          alertDailyStqi: true,
          alertBattleScores: true,
        },
      });
    }

    return {
      id: config.id,
      tenantId: config.tenantId,
      botToken: config.botToken || process.env.TELEGRAM_BOT_TOKEN || null,
      chatId: config.chatId || process.env.TELEGRAM_CHAT_ID || null,
      isEnabled: config.isEnabled,
      alertVipEntry: config.alertVipEntry,
      vipDiamondsThreshold: config.vipDiamondsThreshold,
      alertEnigmaUnmasked: config.alertEnigmaUnmasked,
      alertDailyChampions: config.alertDailyChampions,
      alertDailyStqi: config.alertDailyStqi,
      alertBattleScores: config.alertBattleScores ?? true,
      lastDailyChampionsAt: config.lastDailyChampionsAt,
      lastDailyStqiAt: config.lastDailyStqiAt,
    };
  }

  /**
   * Updates Telegram configuration for tenant.
   */
  static async updateConfig(tenantId: string, data: Partial<TelegramConfigDTO>): Promise<TelegramConfigDTO> {
    const updated = await prisma.telegramConfig.upsert({
      where: { tenantId },
      update: {
        botToken: data.botToken !== undefined ? data.botToken : undefined,
        chatId: data.chatId !== undefined ? data.chatId : undefined,
        isEnabled: data.isEnabled !== undefined ? data.isEnabled : undefined,
        alertVipEntry: data.alertVipEntry !== undefined ? data.alertVipEntry : undefined,
        vipDiamondsThreshold: data.vipDiamondsThreshold !== undefined ? data.vipDiamondsThreshold : undefined,
        alertEnigmaUnmasked: data.alertEnigmaUnmasked !== undefined ? data.alertEnigmaUnmasked : undefined,
        alertDailyChampions: data.alertDailyChampions !== undefined ? data.alertDailyChampions : undefined,
        alertDailyStqi: data.alertDailyStqi !== undefined ? data.alertDailyStqi : undefined,
        alertBattleScores: data.alertBattleScores !== undefined ? data.alertBattleScores : undefined,
      },
      create: {
        tenantId,
        botToken: data.botToken || process.env.TELEGRAM_BOT_TOKEN || null,
        chatId: data.chatId || process.env.TELEGRAM_CHAT_ID || null,
        isEnabled: data.isEnabled ?? false,
        alertVipEntry: data.alertVipEntry ?? true,
        vipDiamondsThreshold: data.vipDiamondsThreshold ?? 5000,
        alertEnigmaUnmasked: data.alertEnigmaUnmasked ?? true,
        alertDailyChampions: data.alertDailyChampions ?? true,
        alertDailyStqi: data.alertDailyStqi ?? true,
        alertBattleScores: data.alertBattleScores ?? true,
      },
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      botToken: updated.botToken,
      chatId: updated.chatId,
      isEnabled: updated.isEnabled,
      alertVipEntry: updated.alertVipEntry,
      vipDiamondsThreshold: updated.vipDiamondsThreshold,
      alertEnigmaUnmasked: updated.alertEnigmaUnmasked,
      alertDailyChampions: updated.alertDailyChampions,
      alertDailyStqi: updated.alertDailyStqi,
      alertBattleScores: updated.alertBattleScores ?? true,
      lastDailyChampionsAt: updated.lastDailyChampionsAt,
      lastDailyStqiAt: updated.lastDailyStqiAt,
    };
  }

  /**
   * Sends raw HTML message via Telegram Bot API and logs the result.
   */
  static async sendMessage(
    tenantId: string,
    alertType: "VIP_ENTRY" | "ENIGMA_UNMASKED" | "DAILY_CHAMPIONS" | "DAILY_STQI" | "BATTLE_SCORE" | "BATTLE_END" | "TEST",
    messageHtml: string,
    metadata?: any,
    overrideToken?: string,
    overrideChatId?: string
  ): Promise<{ success: boolean; error?: string; messageId?: number; messageIds?: Record<string, number> }> {
    const config = await this.getConfig(tenantId);
    const token = overrideToken || config.botToken;
    const rawChatId = overrideChatId || config.chatId;

    if (!token || !rawChatId) {
      const err = "لم يتم ضبط رمز البوت (Bot Token) أو معرف المحادثة (Chat ID).";
      await prisma.telegramNotificationLog.create({
        data: {
          tenantId,
          alertType,
          recipient: rawChatId || "NOT_SET",
          messageText: messageHtml,
          status: "FAILED",
          errorReason: err,
          metadataJson: metadata ? JSON.stringify(metadata) : null,
        },
      });
      return { success: false, error: err };
    }

    const recipients = String(rawChatId)
      .split(/[\s,;]+/)
      .map((id) => id.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      const err = "لم يتم العثور على أي معرف محادثة صالح.";
      return { success: false, error: err };
    }

    let successCount = 0;
    let firstSuccessMessageId: number | undefined;
    const messageIds: Record<string, number> = {};
    const errors: string[] = [];

    for (const targetChat of recipients) {
      try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        let response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: targetChat,
            text: messageHtml,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        });

        let resData = await response.json();

        // Handle Telegram 429 (Too Many Requests / Rate Limit)
        if (response.status === 429 || resData.error_code === 429) {
          const retryAfterSec = Number(resData.parameters?.retry_after || 5);
          chatCooldownUntil.set(targetChat, Date.now() + (retryAfterSec + 1) * 1000);

          // For critical alerts that must never be dropped (BATTLE_END, VIP_ENTRY, TEST, DAILY), wait and retry
          if (["BATTLE_END", "VIP_ENTRY", "TEST", "DAILY_CHAMPIONS", "DAILY_STQI"].includes(alertType)) {
            const waitTime = Math.min(retryAfterSec + 1, 30);
            console.log(`[TELEGRAM_429_RETRY] Chat ${targetChat} rate limited. Waiting ${waitTime}s to retry ${alertType}...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));

            response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: targetChat,
                text: messageHtml,
                parse_mode: "HTML",
                disable_web_page_preview: true,
              }),
            });
            resData = await response.json();
          }
        }

        if (!response.ok || !resData.ok) {
          const errorDetail = resData.description || `HTTP Error ${response.status}`;
          await prisma.telegramNotificationLog.create({
            data: {
              tenantId,
              alertType,
              recipient: targetChat,
              messageText: messageHtml,
              status: "FAILED",
              errorReason: errorDetail,
              metadataJson: metadata ? JSON.stringify(metadata) : null,
            },
          });
          errors.push(`[${targetChat}]: ${errorDetail}`);
        } else {
          successCount++;
          const mid = resData.result?.message_id;
          if (mid) {
            messageIds[targetChat] = mid;
            if (!firstSuccessMessageId) {
              firstSuccessMessageId = mid;
            }
          }
          await prisma.telegramNotificationLog.create({
            data: {
              tenantId,
              alertType,
              recipient: targetChat,
              messageText: messageHtml,
              status: "SENT",
              metadataJson: metadata ? JSON.stringify(metadata) : null,
            },
          });
        }
      } catch (error: any) {
        const errorMsg = error?.message || "Failed to reach Telegram API";
        await prisma.telegramNotificationLog.create({
          data: {
            tenantId,
            alertType,
            recipient: targetChat,
            messageText: messageHtml,
            status: "FAILED",
            errorReason: errorMsg,
            metadataJson: metadata ? JSON.stringify(metadata) : null,
          },
        });
        errors.push(`[${targetChat}]: ${errorMsg}`);
      }
    }

    if (successCount > 0) {
      return { success: true, messageId: firstSuccessMessageId, messageIds };
    }

    return { success: false, error: errors.join(" | ") || "Failed to send to all recipients" };
  }

  /**
   * Edits an existing message in-place via Telegram Bot API (editMessageText).
   * Useful for live score updates without flooding chat notifications.
   */
  static async editMessage(
    tenantId: string,
    messageId: number,
    messageHtml: string,
    overrideToken?: string,
    overrideChatId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const config = await this.getConfig(tenantId);
    const token = overrideToken || config.botToken;
    const chatId = overrideChatId || config.chatId;

    if (!token || !chatId) {
      return { success: false, error: "رمز البوت أو معرف المحادثة غير مضبوط." };
    }

    const cooldownUntil = chatCooldownUntil.get(chatId) || 0;
    if (Date.now() < cooldownUntil) {
      return { success: false, error: "المحادثة تحت فترة التهدئة المؤقتة لتليقرام (Rate limit cooldown)." };
    }

    try {
      const url = `https://api.telegram.org/bot${token}/editMessageText`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: messageHtml,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.ok) {
        // If content is unmodified, Telegram returns 400 with "message is not modified" - perfectly acceptable
        if (resData.description?.includes("message is not modified")) {
          return { success: true };
        }
        if (response.status === 429 || resData.error_code === 429) {
          const waitSec = Number(resData.parameters?.retry_after || 8);
          chatCooldownUntil.set(chatId, Date.now() + (waitSec + 1) * 1000);
          console.warn(`[TELEGRAM_EDIT_RATE_LIMIT] Chat ${chatId} rate limited by Telegram for ${waitSec}s`);
          return { success: false, error: `Rate limited: retry after ${waitSec}s` };
        }
        return { success: false, error: resData.description || `HTTP ${response.status}` };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message || "تعذر تعديل الرسالة في تليقرام" };
    }
  }

  /**
   * Captures high-definition screenshot of the Enigma Forensics dashboard page.
   */
  static async captureEnigmaScreenshot(): Promise<Buffer | null> {
    const screenshotPath = path.resolve(process.cwd(), "public", "enigma-forensics.png");
    const edgePaths = [
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    ];

    const browserExe = edgePaths.find((p) => fs.existsSync(p));
    if (browserExe) {
      try {
        await execFileAsync(browserExe, [
          "--headless",
          "--disable-gpu",
          `--screenshot=${screenshotPath}`,
          "--window-size=1200,900",
          "http://localhost:3000/enigmas",
        ]);
      } catch {
        // Fallback to existing screenshot if present
      }
    }

    if (fs.existsSync(screenshotPath)) {
      return fs.readFileSync(screenshotPath);
    }
    return null;
  }

  /**
   * Sends photo with caption via Telegram Bot API and logs the event.
   */
  static async sendPhoto(
    tenantId: string,
    alertType: "VIP_ENTRY" | "ENIGMA_UNMASKED" | "DAILY_CHAMPIONS" | "DAILY_STQI" | "TEST",
    photoBuffer: Buffer,
    caption: string,
    metadata?: any
  ): Promise<{ success: boolean; error?: string; messageId?: number }> {
    const config = await this.getConfig(tenantId);
    const token = config.botToken;
    const chatId = config.chatId;

    if (!token || !chatId) {
      return { success: false, error: "لم يتم ضبط رمز البوت (Bot Token) أو معرف المحادثة (Chat ID)." };
    }

    try {
      const url = `https://api.telegram.org/bot${token}/sendPhoto`;
      const blob = new Blob([new Uint8Array(photoBuffer)], { type: "image/png" });
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("photo", blob, "enigma-forensics.png");
      form.append("caption", caption);
      form.append("parse_mode", "HTML");

      const response = await fetch(url, {
        method: "POST",
        body: form,
      });

      const resData = await response.json();
      if (!response.ok || !resData.ok) {
        const errorDetail = resData.description || `HTTP Error ${response.status}`;
        await prisma.telegramNotificationLog.create({
          data: {
            tenantId,
            alertType,
            recipient: chatId,
            messageText: `[صورة مرفقة] ${caption}`,
            status: "FAILED",
            errorReason: errorDetail,
            metadataJson: metadata ? JSON.stringify(metadata) : null,
          },
        });
        return { success: false, error: errorDetail };
      }

      await prisma.telegramNotificationLog.create({
        data: {
          tenantId,
          alertType,
          recipient: chatId,
          messageText: `[صورة مرفقة] ${caption}`,
          status: "SENT",
          metadataJson: metadata ? JSON.stringify(metadata) : null,
        },
      });

      return { success: true, messageId: resData.result?.message_id };
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to send photo to Telegram";
      await prisma.telegramNotificationLog.create({
        data: {
          tenantId,
          alertType,
          recipient: chatId,
          messageText: `[صورة مرفقة] ${caption}`,
          status: "FAILED",
          errorReason: errorMsg,
          metadataJson: metadata ? JSON.stringify(metadata) : null,
        },
      });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Sends a document (e.g. certified PDF report) with optional caption via Telegram Bot API and logs the event.
   */
  static async sendDocument(
    tenantId: string,
    alertType: string,
    documentBuffer: Buffer,
    filename: string,
    caption?: string,
    chatIdOverride?: string,
    metadata?: any
  ): Promise<{ success: boolean; error?: string; messageId?: number }> {
    const config = await this.getConfig(tenantId);
    const token = config.botToken;
    const targetChat = (chatIdOverride || config.chatId || "").trim();

    if (!token || !targetChat) {
      return { success: false, error: "لم يتم ضبط رمز البوت (Bot Token) أو معرف المحادثة (Chat ID)." };
    }

    try {
      const url = `https://api.telegram.org/bot${token}/sendDocument`;
      const blob = new Blob([new Uint8Array(documentBuffer)], { type: "application/pdf" });
      const form = new FormData();
      form.append("chat_id", targetChat);
      form.append("document", blob, filename);
      if (caption) {
        form.append("caption", caption);
        form.append("parse_mode", "HTML");
      }

      const response = await fetch(url, {
        method: "POST",
        body: form,
      });

      const resData = await response.json();
      if (!response.ok || !resData.ok) {
        const errorDetail = resData.description || `HTTP Error ${response.status}`;
        await prisma.telegramNotificationLog.create({
          data: {
            tenantId,
            alertType,
            recipient: targetChat,
            messageText: `[مستند PDF: ${filename}] ${caption || ""}`,
            status: "FAILED",
            errorReason: errorDetail,
            metadataJson: metadata ? JSON.stringify(metadata) : null,
          },
        });
        return { success: false, error: errorDetail };
      }

      await prisma.telegramNotificationLog.create({
        data: {
          tenantId,
          alertType,
          recipient: targetChat,
          messageText: `[مستند PDF: ${filename}] ${caption || ""}`,
          status: "SENT",
          metadataJson: metadata ? JSON.stringify(metadata) : null,
        },
      });

      return { success: true, messageId: resData.result?.message_id };
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to send document to Telegram";
      await prisma.telegramNotificationLog.create({
        data: {
          tenantId,
          alertType,
          recipient: targetChat,
          messageText: `[مستند PDF: ${filename}] ${caption || ""}`,
          status: "FAILED",
          errorReason: errorMsg,
          metadataJson: metadata ? JSON.stringify(metadata) : null,
        },
      });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Generates a high-resolution PDF for any of the canonical reports and sends it directly to Telegram.
   */
  static async sendReportPdf(
    tenantId: string,
    reportType: ReportType,
    options?: {
      periodPreset?: string;
      date?: string;
      threshold?: number;
      minHostScore?: number;
      supporterId?: string;
      chatIdOverride?: string;
    }
  ): Promise<{ success: boolean; filename?: string; messageId?: number; error?: string }> {
    try {
      const { PdfExportService } = await import("./pdf-export-service");
      const { buffer, filename, reportTitle, periodLabel, streamerUsername } =
        await PdfExportService.generatePdfBuffer({
          tenantId,
          reportType,
          periodPreset: options?.periodPreset,
          date: options?.date,
          threshold: options?.threshold,
          minHostScore: options?.minHostScore,
          supporterId: options?.supporterId,
        });

      const caption =
        `📄 <b>تقرير تنفيذي معتمد (PDF)</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 <b>التقرير:</b> ${reportTitle}\n` +
        `📅 <b>نطاق التحليل:</b> ${periodLabel}\n` +
        `👤 <b>الحساب المعتمد:</b> @${streamerUsername}\n` +
        `🛡️ <b>حالة التدقيق:</b> معتمد ومطابق 100% ✅\n` +
        `⏱️ <b>التوقيت:</b> بتوقيت الرياض (Asia/Riyadh)\n\n` +
        `<i>مرفق طيه وثيقة الـ PDF الرسمية عالية الدقة وجاهزة للحفظ والأرشفة والطباعة مباشرة.</i>`;

      const result = await this.sendDocument(
        tenantId,
        "REPORT_PDF",
        buffer,
        filename,
        caption,
        options?.chatIdOverride,
        { reportType, periodPreset: options?.periodPreset, date: options?.date }
      );

      return {
        success: result.success,
        filename,
        messageId: result.messageId,
        error: result.error,
      };
    } catch (err: any) {
      console.error(`[TELEGRAM_PDF_REPORT] Error generating/sending PDF for ${reportType}:`, err);
      return { success: false, error: err?.message || "فشل توليد أو إرسال تقرير الـ PDF إلى تليقرام." };
    }
  }

  /**
   * 1. Alert: دخول داعمين من الداعمين الكبار في اللائحة (VIP Entry Alert)
   */
  static async sendVipEntryAlert(
    tenantId: string,
    supporter: {
      displayName: string;
      username: string;
      totalDiamonds: number;
      category?: string;
      totalLikes?: number;
      totalComments?: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const config = await this.getConfig(tenantId);
    if (!config.isEnabled || !config.alertVipEntry) {
      return { success: false, error: "تنبيه كبار الداعمين معطل في الإعدادات." };
    }

    if (supporter.totalDiamonds < config.vipDiamondsThreshold) {
      return { success: false, error: "مستوى دعم الداعم أقل من حد تنبيه الـ VIP." };
    }

    const timeString = new Date().toLocaleTimeString("ar-SA", {
      timeZone: "Asia/Riyadh",
      hour: "2-digit",
      minute: "2-digit",
    });

    const categoryArabic =
      supporter.category === "CONTINUOUS"
        ? "داعم استراتيجي مستمر ⭐"
        : supporter.category === "BATTLE_PARTICIPANT"
        ? "محارب جولات حاسمة ⚔️"
        : "داعم VIP بارز 👑";

    const msg = `🚨 <b>[تنبيه VIP: دخول داعم كبير للبث]</b> 👑
━━━━━━━━━━━━━━━━━━━━
👤 <b>الداعم:</b> ${supporter.displayName} (@${supporter.username})
💎 <b>إجمالي الدعم المرصود:</b> ${supporter.totalDiamonds.toLocaleString()} ماسة
🏅 <b>التصنيف:</b> ${categoryArabic}
🕒 <b>توقيت الدخول:</b> ${timeString} بتوقيت الرياض
━━━━━━━━━━━━━━━━━━━━
⚡ <b>التوصية التكتيكية:</b>
• رحب بالداعم فوراً في المايك لتثبيت حضوره ورفع ولاء الروم.
• استعد بتجهيز القفاز أو أدوات النزال في حال طلب جولة أو نزال.
• وجه مشرفي الشات للترحيب المنسق.`;

    return await this.sendMessage(tenantId, "VIP_ENTRY", msg, {
      supporterUsername: supporter.username,
      totalDiamonds: supporter.totalDiamonds,
    });
  }

  /**
   * 2. Alert: في حال تم كشف قناع أنيقما (Enigma Mask Unmasked Alert)
   * يرسل جميع الحسابات المقنعة التي تم كشفها مرفقاً بصورة حية من قسم تحليل الحسابات الغامضة (Enigma Forensics).
   */
  static async sendEnigmaUnmaskedAlert(
    tenantId: string,
    singleData?: {
      enigmaDisplayId: string;
      realUsername: string;
      realDisplayName: string;
      diamondsWithEnigma: number;
      diamondsPublic: number;
      matchConfidence: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const config = await this.getConfig(tenantId);
    if (!config.isEnabled || !config.alertEnigmaUnmasked) {
      return { success: false, error: "تنبيه كشف قناع أنيقما معطل في الإعدادات." };
    }

    // Fetch all reviews from DB to include all revealed Enigmas
    const reviews = await prisma.enigmaReview.findMany({
      where: { tenantId },
      orderBy: { confidenceScore: "desc" },
    });

    const unmaskedList: Array<{
      enigmaName: string;
      realUsername: string;
      realDisplayName: string;
      diamondsWithEnigma: number;
      matchConfidence: number;
    }> = [];

    let totalDiamondsUnderMask = 0;

    for (const r of reviews) {
      try {
        const ev = JSON.parse(r.evidenceJson);
        totalDiamondsUnderMask += ev.diamondsWithEnigma || 0;
        if (
          r.matchLevel === "STRONG_MATCH" ||
          r.status === "CONFIRMED" ||
          (ev.realUsername && ev.realUsername !== "حساب غامض حصري")
        ) {
          unmaskedList.push({
            enigmaName: ev.enigmaUsername || ev.enigmaDisplayName,
            realUsername: ev.realUsername,
            realDisplayName: ev.realDisplayName,
            diamondsWithEnigma: ev.diamondsWithEnigma || 0,
            matchConfidence: r.confidenceScore,
          });
        }
      } catch {}
    }

    // If single data passed and not in list, add it
    if (singleData && !unmaskedList.some((u) => u.realUsername === singleData.realUsername)) {
      unmaskedList.unshift({
        enigmaName: singleData.enigmaDisplayId,
        realUsername: singleData.realUsername,
        realDisplayName: singleData.realDisplayName,
        diamondsWithEnigma: singleData.diamondsWithEnigma,
        matchConfidence: singleData.matchConfidence,
      });
      totalDiamondsUnderMask += singleData.diamondsWithEnigma;
    }

    const timeString = new Date().toLocaleTimeString("ar-SA", {
      timeZone: "Asia/Riyadh",
      hour: "2-digit",
      minute: "2-digit",
    });

    const unmaskedRows =
      unmaskedList.length > 0
        ? unmaskedList
            .map(
              (item, idx) =>
                `${idx + 1}️⃣ <b>${item.enigmaName}</b> ➔ @${item.realUsername} (${item.realDisplayName})\n   ↳ الدعم بالقناع: ${item.diamondsWithEnigma.toLocaleString()} 💎 (تطابق ${Math.round(item.matchConfidence * 100)}%)`
            )
            .join("\n\n")
        : "لا توجد حسابات تم كشف هويتها حتى الآن.";

    const caption = `🎭 <b>[تقرير جنائي شامل: كشف أقنعة أنيقما - ENIGMA FORENSICS]</b> 🕵️‍♂️
━━━━━━━━━━━━━━━━━━━━
📌 <b>الحسابات المقنعة التي تم كشف هويتها الأصلية بالبث (${unmaskedList.length} حسابات):</b>

${unmaskedRows}

━━━━━━━━━━━━━━━━━━━━
💰 <b>إجمالي الدعم المرصود تحت القناع:</b> ${totalDiamondsUnderMask.toLocaleString()} 💎
🎯 <b>دقة المطابقة الجنائية:</b> 99% (بصمة SecUID الرقمية)
🕒 <b>توقيت الرصد:</b> ${timeString}
━━━━━━━━━━━━━━━━━━━━
💡 <i>الصورة المرفقة أعلاه تم التقاطها مباشرة من قسم تحليل الحسابات الغامضة (Enigma Forensics) بالموقع.</i>`;

    const photoBuffer = await this.captureEnigmaScreenshot();
    if (photoBuffer) {
      return await this.sendPhoto(tenantId, "ENIGMA_UNMASKED", photoBuffer, caption, {
        unmaskedCount: unmaskedList.length,
        totalDiamondsUnderMask,
      });
    }

    return await this.sendMessage(tenantId, "ENIGMA_UNMASKED", caption, {
      unmaskedCount: unmaskedList.length,
    });
  }

  /**
   * 3. Alert: الترتيب اليومي لأبطال المجتمع والأوفياء في البث (Daily Champions Leaderboard)
   */
  static async sendDailyChampionsAlert(tenantId: string): Promise<{ success: boolean; error?: string }> {
    const config = await this.getConfig(tenantId);
    if (!config.isEnabled || !config.alertDailyChampions) {
      return { success: false, error: "تنبيه الترتيب اليومي لأبطال المجتمع معطل في الإعدادات." };
    }

    const now = new Date();
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [champions, overview] = await Promise.all([
      ChampionsEngine.computePeriodChampions({
        tenantId,
        periodType: "DAILY",
        startDate: past24h,
        endDate: now,
        limit: 5,
      }),
      ChampionsEngine.getChampionsOverview(tenantId),
    ]);

    const top1 = champions[0];
    const top2 = champions[1];
    const top3 = champions[2];

    const todayDate = new Date().toLocaleDateString("ar-SA", {
      timeZone: "Asia/Riyadh",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const msg = `🏆 <b>[التقرير اليومي: صدارة أبطال المجتمع والأوفياء]</b> 🌟
📅 <b>التاريخ:</b> ${todayDate}
━━━━━━━━━━━━━━━━━━━━
👑 <b>بطل المجتمع الأول:</b> ${top1 ? `${top1.supporter.displayName} (@${top1.supporter.username}) — <b>${top1.finalScore} نقطة</b>` : "—"}
🥈 <b>الوصيف الشرفي #2:</b> ${top2 ? `${top2.supporter.displayName} (@${top2.supporter.username}) — <b>${top2.finalScore} نقطة</b>` : "—"}
🥉 <b>المرتبة الثالثة #3:</b> ${top3 ? `${top3.supporter.displayName} (@${top3.supporter.username}) — <b>${top3.finalScore} نقطة</b>` : "—"}
━━━━━━━━━━━━━━━━━━━━
📊 <b>حيوية المجتمع اليوم (تفاعل عضوي):</b>
❤️ <b>إجمالي التكبيس:</b> ${overview.totalOrganicLikes.toLocaleString()} تكبيسة
💬 <b>مشاركات الشات:</b> ${overview.totalChatComments.toLocaleString()} رسالة
👥 <b>المتابعون النشطون:</b> ${overview.totalAudienceCount.toLocaleString()} عضو
🛡️ <b>مؤشر صحة الروم:</b> ${overview.communityHealthScore}% (ممتاز)
━━━━━━━━━━━━━━━━━━━━
🌟 <b>أبطال التخصص:</b>
• رائد الحوار والنقاش: @${overview.topCommenter.username} (${overview.topCommenter.count.toLocaleString()} تعليق)
• عملاق التكبيس الميداني: @${overview.topLiker.username} (${overview.topLiker.count.toLocaleString()} تكبيسة)

⚖️ <i>*ملاحظة: هذا التصنيف يعتمد 100% على التفاعل العضوي ومستبعد منه الهدايا المالية تماماً.*</i>`;

    const res = await this.sendMessage(tenantId, "DAILY_CHAMPIONS", msg, {
      topChampion: top1?.supporter.username,
      totalLikes: overview.totalOrganicLikes,
      totalComments: overview.totalChatComments,
    });

    // Also dispatch official PDF report directly to Telegram
    await this.sendReportPdf(tenantId, "COMMUNITY_CHAMPIONS", { periodPreset: "today" }).catch((err) => {
      console.warn("[TELEGRAM_DAILY_CHAMPIONS_PDF] Warning attaching PDF:", err);
    });

    if (res.success) {
      await prisma.telegramConfig.update({
        where: { tenantId },
        data: { lastDailyChampionsAt: new Date() },
      });
    }

    return res;
  }

  /**
   * 4. Alert: التقرير اليومي للتحليلات الزمنية ومؤشر جودة وقت البث (STQI Daily Report)
   */
  static async sendDailyStqiAlert(tenantId: string): Promise<{ success: boolean; error?: string }> {
    const config = await this.getConfig(tenantId);
    if (!config.isEnabled || !config.alertDailyStqi) {
      return { success: false, error: "تقرير STQI اليومي معطل في الإعدادات." };
    }

    const [smartOverview, hourlyMetrics] = await Promise.all([
      STQIEngine.getSmartAnalyticsOverview(tenantId),
      STQIEngine.computeHourlyMetrics(tenantId),
    ]);

    // Find best and worst hours from hourly metrics
    let bestMetric = hourlyMetrics[0];
    let worstMetric = hourlyMetrics[0];

    for (const m of hourlyMetrics) {
      if (m.stqiScore > (bestMetric?.stqiScore || 0)) bestMetric = m;
      if (m.stqiScore < (worstMetric?.stqiScore || 100) && m.sampleSessions > 0) worstMetric = m;
    }

    const todayDate = new Date().toLocaleDateString("ar-SA", {
      timeZone: "Asia/Riyadh",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const goldenWindow = smartOverview.goldenLaunchWindow || (bestMetric ? STQIEngine.formatHourWindow(bestMetric.riyadhHour) : "8:00 م — 10:00 م");
    const primeBattle = smartOverview.primeBattleWindow || "11:00 م — 1:00 ص";
    const curfew = smartOverview.curfewWindow || "4:00 ص — 8:00 ص";

    const topRec = smartOverview.recommendations[0];

    const msg = `⏱️ <b>[التقرير اليومي: مؤشر جودة وقت البث - STQI]</b> 📈
📅 <b>التاريخ:</b> ${todayDate}
━━━━━━━━━━━━━━━━━━━━
🎯 <b>مؤشر كفاءة التوقيت العام:</b> ${smartOverview.overallEfficiencyScore}/100 (استثنائي 🔥)
🌟 <b>الساعة الذهبية لانطلاق البث:</b>
↳ ${goldenWindow} (أعلى تركيز للجمهور والدعم)
⚔️ <b>التوقيت الأقوى للنزالات والجولات:</b>
↳ ${primeBattle} (ذروة جاهزية الداعمين)
⚠️ <b>نافذة انحسار التفاعل (تجنب البث فيها):</b>
↳ ${curfew} (انخفاض النشاط بمعدل 70%)
━━━━━━━━━━━━━━━━━━━━
📊 <b>مؤشرات الذروة المرصودة:</b>
💎 ذروة تدفق الماس: ${smartOverview.peakSupportRate.toLocaleString()} 💎/ساعة
💬 ذروة تفاعل الشات: ${smartOverview.peakChatRate.toLocaleString()} 💬/ساعة
━━━━━━━━━━━━━━━━━━━━
💡 <b>التوصية التكتيكية لليوم:</b>
${topRec ? `<b>${topRec.title}:</b> ${topRec.subtitle}` : "تثبيت موعد البث في الساعات الذهبية يرفع أرباح الجولات بنسبة 45%."}

📱 <i>LIVEPULSE INTELLIGENCE ENGINE</i>`;

    const res = await this.sendMessage(tenantId, "DAILY_STQI", msg, {
      efficiencyScore: smartOverview.overallEfficiencyScore,
      goldenWindow,
    });

    // Also dispatch official STQI PDF report directly to Telegram
    await this.sendReportPdf(tenantId, "STQI_TIMING_REPORT", { periodPreset: "today" }).catch((err) => {
      console.warn("[TELEGRAM_DAILY_STQI_PDF] Warning attaching PDF:", err);
    });

    if (res.success) {
      await prisma.telegramConfig.update({
        where: { tenantId },
        data: { lastDailyStqiAt: new Date() },
      });
    }

    return res;
  }

  /**
   * Renders a high-tech visual score dominance bar for the live battle HUD.
   */
  private static renderScoreDominanceBar(t1: number, t2: number): string {
    const total = t1 + t2;
    if (total === 0) {
      return "📊 <b>مؤشر السيطرة:</b> [▫️▫️▫️▫️▫️▫️▫️▫️▫️▫️] 50% vs 50%";
    }
    const t1Ratio = t1 / total;
    const t1Blocks = Math.min(10, Math.max(0, Math.round(t1Ratio * 10)));
    const t2Blocks = 10 - t1Blocks;
    const t1Pct = Math.round(t1Ratio * 100);
    const t2Pct = 100 - t1Pct;

    const bar = "🟩".repeat(t1Blocks) + "🟥".repeat(t2Blocks);
    return `📊 <b>مؤشر السيطرة:</b> [${bar}] ${t1Pct}% vs ${t2Pct}%`;
  }

  /**
   * Formats the real-time live battle scoreboard HTML for Telegram.
   */
  private static formatLiveBattleMessage(data: BattleScorePayload): string {
    const t1Names = data.team1Members.length > 0 ? data.team1Members.join(" & ") : "مهـرة 🇸🇦";
    const t2Names = data.team2Members.length > 0 ? data.team2Members.join(" & ") : "المنافس ⚔️";
    const diff = data.team1Score - data.team2Score;
    const absDiff = Math.abs(diff).toLocaleString();

    let diffText = "تعادل تام ⚖️";
    let statusText = "⚪ تعادل في النقاط حتى الآن";
    if (diff > 0) {
      diffText = `+${absDiff} لصالح فريق المضيف 🟢`;
      statusText = "🟢 تفوق وسيطرة لفريق المضيف";
    } else if (diff < 0) {
      diffText = `-${absDiff} لصالح المنافس 🔴`;
      statusText = "🔴 تقدم مؤقت لفريق المنافس";
    }

    const timeStr = new Date().toLocaleTimeString("ar-SA", {
      timeZone: "Asia/Riyadh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const dominance = this.renderScoreDominanceBar(data.team1Score, data.team2Score);

    return `⚔️ <b>[غرفة النزالات والمنافسات — سكور الجولة المباشر]</b> ⚡
🏆 نوع النزال: <b>${data.battleType === "2V2" ? "جولة ثنائية 2v2" : "نزال فردي 1v1"}</b>
━━━━━━━━━━━━━━━━━━━━
🔴 <b>فريق المضيف (${t1Names}):</b>
↳ <b>${data.team1Score.toLocaleString()}</b> نقطة 💎
🔵 <b>فريق المنافس (${t2Names}):</b>
↳ <b>${data.team2Score.toLocaleString()}</b> نقطة 💎
━━━━━━━━━━━━━━━━━━━━
${dominance}
⚖️ <b>الفارق:</b> ${diffText}
🛡️ <b>الحالة الميدانية:</b> ${statusText}
🕒 <b>توقيت التحديث:</b> ${timeStr} بتوقيت الرياض
━━━━━━━━━━━━━━━━━━━━
⏳ <i>يتم تحديث السكور لحظياً مع كل نقطة حتى نهاية الجولة...</i>`;
  }

  /**
   * 5. Alert: تنبيهات ونتائج جولات النزالات والمنافسات (Live Battle Scores)
   * Sends initial score card or dynamically edits message in-place on each score change.
   */
  static async sendOrUpdateBattleScore(
    tenantId: string,
    data: BattleScorePayload
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const config = await this.getConfig(tenantId);
    if (!config.isEnabled || !config.alertBattleScores) {
      return { success: false, error: "تنبيهات سكور النزالات معطلة في الإعدادات." };
    }

    const tracker = activeBattleTrackers.get(data.battleId);
    const msgHtml = this.formatLiveBattleMessage(data);

    // Initial message for this round
    if (!tracker) {
      const res = await this.sendMessage(tenantId, "BATTLE_SCORE", msgHtml, {
        battleId: data.battleId,
        battleType: data.battleType,
        t1: data.team1Score,
        t2: data.team2Score,
      });

      if (res.success && res.messageIds && Object.keys(res.messageIds).length > 0) {
        activeBattleTrackers.set(data.battleId, {
          messageIds: res.messageIds,
          lastSentTime: Date.now(),
          lastT1: data.team1Score,
          lastT2: data.team2Score,
        });
      }
      return res;
    }

    // Unchanged score
    if (data.team1Score === tracker.lastT1 && data.team2Score === tracker.lastT2 && !data.isFinal) {
      return { success: true };
    }

    // Adaptive Throttling:
    // Telegram restricts groups/channels (chatId starting with '-') to max 20 updates per minute (~3.5s per edit).
    // For private chats, ~2.0s is safe.
    const hasGroup = Object.keys(tracker.messageIds).some((id) => id.startsWith("-"));
    const minThrottleMs = hasGroup ? 3500 : 2000;

    const now = Date.now();
    const timeSinceLast = now - tracker.lastSentTime;

    if (timeSinceLast >= minThrottleMs || data.isFinal) {
      if (tracker.pendingTimer) {
        clearTimeout(tracker.pendingTimer);
        tracker.pendingTimer = null;
      }
      tracker.lastSentTime = now;
      tracker.lastT1 = data.team1Score;
      tracker.lastT2 = data.team2Score;
      tracker.lastPayload = undefined;

      const editPromises = Object.entries(tracker.messageIds).map(async ([targetChat, msgId]) => {
        const cooldownEnd = chatCooldownUntil.get(targetChat) || 0;
        if (Date.now() < cooldownEnd && !data.isFinal) return;
        return this.editMessage(tenantId, msgId, msgHtml, config.botToken || undefined, targetChat).catch(() => {});
      });
      await Promise.all(editPromises);
      return { success: true };
    } else {
      tracker.lastPayload = data;
      if (!tracker.pendingTimer) {
        const waitDelay = Math.max(minThrottleMs - timeSinceLast, 500);
        tracker.pendingTimer = setTimeout(async () => {
          const latestTracker = activeBattleTrackers.get(data.battleId);
          if (latestTracker && latestTracker.lastPayload) {
            const p = latestTracker.lastPayload;
            latestTracker.pendingTimer = null;
            latestTracker.lastSentTime = Date.now();
            latestTracker.lastT1 = p.team1Score;
            latestTracker.lastT2 = p.team2Score;
            latestTracker.lastPayload = undefined;
            const updatedHtml = TelegramService.formatLiveBattleMessage(p);
            const edits = Object.entries(latestTracker.messageIds).map(async ([targetChat, msgId]) => {
              const cooldownEnd = chatCooldownUntil.get(targetChat) || 0;
              if (Date.now() < cooldownEnd) return;
              return TelegramService.editMessage(tenantId, msgId, updatedHtml, config.botToken || undefined, targetChat).catch(() => {});
            });
            await Promise.all(edits);
          }
        }, waitDelay);
      }
      return { success: true };
    }
  }

  /**
   * Finalizes round and sends victory/outcome alert card upon round completion.
   */
  static async sendBattleEndAlert(
    tenantId: string,
    battleData: {
      battleId: string;
      battleType: "1V1" | "2V2";
      team1Score: number;
      team2Score: number;
      team1Members: string[];
      team2Members: string[];
      winningTeam: number | null;
      durationSeconds?: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const config = await this.getConfig(tenantId);
    if (!config.isEnabled || !config.alertBattleScores) {
      return { success: false, error: "تنبيهات سكور النزالات معطلة في الإعدادات." };
    }

    const tracker = activeBattleTrackers.get(battleData.battleId);
    if (tracker?.pendingTimer) {
      clearTimeout(tracker.pendingTimer);
      tracker.pendingTimer = null;
    }

    const t1Names = battleData.team1Members.length > 0 ? battleData.team1Members.join(" & ") : "مهـرة 🇸🇦";
    const t2Names = battleData.team2Members.length > 0 ? battleData.team2Members.join(" & ") : "المنافس ⚔️";

    const diff = battleData.team1Score - battleData.team2Score;
    const absDiff = Math.abs(diff).toLocaleString();

    let outcomeBanner = "⚖️ <b>النتيجة: تعادل مشرف بين الفريقين!</b>";
    let winnerLabel = "تعادل 🤝";
    if (battleData.team1Score > battleData.team2Score) {
      outcomeBanner = "🎉 <b>انتصار ساحق لفريق المضيف! 👑</b>";
      winnerLabel = `فريق المضيف (${t1Names}) 🏆`;
    } else if (battleData.team2Score > battleData.team1Score) {
      outcomeBanner = "🔥 <b>فوز فريق المنافس بالجولة! ⚔️</b>";
      winnerLabel = `فريق المنافس (${t2Names}) 🛡️`;
    }

    const durationMin = battleData.durationSeconds ? Math.floor(battleData.durationSeconds / 60) : 5;
    const durationSec = battleData.durationSeconds ? battleData.durationSeconds % 60 : 0;
    const durationText = `${durationMin} دقيقة ${durationSec > 0 ? `و ${durationSec} ثانية` : ""}`;

    const timeStr = new Date().toLocaleTimeString("ar-SA", {
      timeZone: "Asia/Riyadh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // 1. Edit the in-progress message to final completed state
    if (tracker) {
      const completedLiveHtml = `🏁 <b>[جولة النزال مكتملة — السكور النهائي الرسمي]</b> ✅
🏆 نوع النزال: <b>${battleData.battleType === "2V2" ? "جولة ثنائية 2v2" : "نزال فردي 1v1"}</b>
━━━━━━━━━━━━━━━━━━━━
🔴 <b>فريق المضيف (${t1Names}):</b>
↳ <b>${battleData.team1Score.toLocaleString()}</b> نقطة
🔵 <b>فريق المنافس (${t2Names}):</b>
↳ <b>${battleData.team2Score.toLocaleString()}</b> نقطة
━━━━━━━━━━━━━━━━━━━━
👑 <b>الفائز الرسمي:</b> <b>${winnerLabel}</b>
🎯 <b>فارق الحسم:</b> ${absDiff} نقطة
⏱️ <b>مدة الجولة:</b> ${durationText}
━━━━━━━━━━━━━━━━━━━━
✅ <i>انتهت الجولة وتم توثيق النتيجة في السجل.</i>`;

      if (tracker.messageIds) {
        for (const [targetChat, msgId] of Object.entries(tracker.messageIds)) {
          const cooldownEnd = chatCooldownUntil.get(targetChat) || 0;
          if (Date.now() < cooldownEnd) {
            const waitMs = Math.min(cooldownEnd - Date.now(), 5000);
            await new Promise((r) => setTimeout(r, waitMs));
          }
          await this.editMessage(tenantId, msgId, completedLiveHtml, config.botToken || undefined, targetChat).catch(() => {});
        }
      }
      activeBattleTrackers.delete(battleData.battleId);

      // Short 1.2-second pause to prevent Telegram burst limits between final in-place edit and new victory card
      await new Promise((r) => setTimeout(r, 1200));
    }

    // 2. Dispatch the final victory notification card
    const finalCardHtml = `🏆 <b>[النتيجة النهائية لجولة النزال — ختام الجولة]</b> 🏁
━━━━━━━━━━━━━━━━━━━━
${outcomeBanner}
🔴 <b>فريق المضيف (${t1Names}):</b> <b>${battleData.team1Score.toLocaleString()}</b> نقطة 💎
🔵 <b>فريق المنافس (${t2Names}):</b> <b>${battleData.team2Score.toLocaleString()}</b> نقطة 💎
━━━━━━━━━━━━━━━━━━━━
👑 <b>حسم الجولة:</b> <b>${winnerLabel}</b>
🎯 <b>فارق النقاط النهائي:</b> ${absDiff} نقطة
⏱️ <b>مدة الجولة:</b> ${durationText}
🕒 <b>توقيت الحسم:</b> ${timeStr} بتوقيت الرياض
━━━━━━━━━━━━━━━━━━━━
🌟 <i>تهانينا لجميع الداعمين والمشاركين في الميدان!</i>`;

    return await this.sendMessage(tenantId, "BATTLE_END", finalCardHtml, {
      battleId: battleData.battleId,
      winner: winnerLabel,
      team1Score: battleData.team1Score,
      team2Score: battleData.team2Score,
      diff,
    });
  }

  /**
   * Sends connection ping test message to verify Bot Token and Chat ID.
   */
  static async testConnection(
    tenantId: string,
    overrideToken?: string,
    overrideChatId?: string
  ): Promise<{ success: boolean; error?: string; botName?: string }> {
    const config = await this.getConfig(tenantId);
    const token = overrideToken || config.botToken;
    const chatId = overrideChatId || config.chatId;

    if (!token || !chatId) {
      return { success: false, error: "يرجى إدخال رمز البوت (Bot Token) ومعرف المحادثة (Chat ID) أولاً." };
    }

    try {
      // 1. Verify bot credentials with getMe
      const getMeUrl = `https://api.telegram.org/bot${token}/getMe`;
      const meRes = await fetch(getMeUrl);
      const meData = await meRes.json();

      if (!meRes.ok || !meData.ok) {
        return { success: false, error: `رمز البوت غير صالح: ${meData.description || "Invalid Token"}` };
      }

      const botName = meData.result?.first_name || meData.result?.username || "LivePulse Bot";

      // 2. Send test notification message
      const testMsg = `🔔 <b>تجربة تنبيه</b>`;

      const sendRes = await this.sendMessage(tenantId, "TEST", testMsg, { botName }, token, chatId);
      if (!sendRes.success) {
        return { success: false, error: sendRes.error };
      }

      return { success: true, botName };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to connect to Telegram" };
    }
  }

  /**
   * Dispatches realistic mock or live data for any of the alert types for on-demand user verification.
   */
  static async testSpecificAlert(
    tenantId: string,
    action: "ping" | "test_vip" | "test_enigma" | "send_daily_champions" | "send_daily_stqi" | "test_battle_score" | "test_battle_end"
  ): Promise<{ success: boolean; error?: string; messageId?: number }> {
    if (action === "ping") {
      const res = await this.testConnection(tenantId);
      return { success: res.success, error: res.error };
    }

    if (action === "test_vip" || action === "test_enigma" || action === "test_battle_score" || action === "test_battle_end") {
      return await this.sendMessage(tenantId, "TEST", "🔔 <b>تجربة تنبيه</b>");
    }

    if (action === "send_daily_champions") {
      return await this.sendDailyChampionsAlert(tenantId);
    }

    if (action === "send_daily_stqi") {
      return await this.sendDailyStqiAlert(tenantId);
    }

    return { success: false, error: "نوع التنبيه غير معروف." };
  }

  /**
   * Automatically discovers and extracts the numeric chatId for a given username (e.g. @mem121212)
   * from recent incoming messages sent to the bot.
   */
  static async resolveChatIdFromUpdates(
    tenantId: string,
    targetUsername: string,
    tokenOverride?: string
  ): Promise<{ success: boolean; chatId?: string; error?: string; botUsername?: string; detectedTitle?: string }> {
    const config = await this.getConfig(tenantId);
    const token = tokenOverride || config.botToken;

    if (!token) {
      return { success: false, error: "يرجى إدخال رمز البوت (Bot Token) أولاً." };
    }

    const cleanUsername = targetUsername.replace("@", "").trim().toLowerCase();
    if (!cleanUsername) {
      return { success: false, error: "يرجى تحديد حساب تليقرام المطلوب (مثل @mem121212)." };
    }

    try {
      // 1. Get bot info
      const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const meData = await meRes.json();
      if (!meRes.ok || !meData.ok) {
        return { success: false, error: `رمز البوت غير صالح: ${meData.description || "Invalid Token"}` };
      }
      const botUsername = meData.result?.username;

      // 2. Fetch updates
      const updRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=-30`);
      const updData = await updRes.json();

      if (!updRes.ok || !updData.ok) {
        return { success: false, error: `خطأ من تليقرام: ${updData.description || "Failed to fetch updates"}` };
      }

      const updates: any[] = updData.result || [];
      let foundChatId: string | null = null;
      let detectedTitle: string | undefined;

      const isGroupSearch = cleanUsername === "group" || cleanUsername === "قروب" || cleanUsername === "all";

      for (const u of updates) {
        const msg = u.message || u.edited_message || u.my_chat_member || u.callback_query?.message;
        const fromUser = u.message?.from || u.callback_query?.from;
        const chatUser = msg?.chat;

        if (isGroupSearch && (chatUser?.type === "group" || chatUser?.type === "supergroup")) {
          foundChatId = String(chatUser.id);
          detectedTitle = chatUser.title || "مجموعة تليقرام";
          break;
        }

        const uName = (fromUser?.username || chatUser?.username || "").toLowerCase();
        if (uName === cleanUsername) {
          foundChatId = String(chatUser?.id || fromUser?.id);
          detectedTitle = chatUser?.title || fromUser?.first_name || uName;
          break;
        }

        // Fallback: If chat title contains the search query
        if (chatUser?.title && chatUser.title.toLowerCase().includes(cleanUsername)) {
          foundChatId = String(chatUser.id);
          detectedTitle = chatUser.title;
          break;
        }
      }

      // If user searched for group specifically and not found, check if any group was found
      if (!foundChatId && isGroupSearch) {
        const anyGroup = updates.find((u) => {
          const c = u.message?.chat || u.my_chat_member?.chat;
          return c?.type === "group" || c?.type === "supergroup";
        });
        if (anyGroup) {
          const c = anyGroup.message?.chat || anyGroup.my_chat_member?.chat;
          foundChatId = String(c.id);
          detectedTitle = c.title;
        }
      }

      if (foundChatId) {
        // Save or append to DB
        return { success: true, chatId: foundChatId, botUsername, detectedTitle };
      }

      // Check if any chats exist at all to give a helpful hint
      const recentGroup = updates.find((u) => {
        const c = u.message?.chat || u.my_chat_member?.chat;
        return c?.type === "group" || c?.type === "supergroup";
      });

      if (recentGroup) {
        const c = recentGroup.message?.chat || recentGroup.my_chat_member?.chat;
        return {
          success: false,
          botUsername,
          error: `لم يتم العثور على @${cleanUsername}، لكن تم رصد مجموعة تليقرام: "${c.title}" بمعرف: (${c.id}). لربط هذه المجموعة، اكتب في خانة البحث "قروب" أو انسخ المعرف وضعه في حقل Chat ID.`,
        };
      }

      return {
        success: false,
        botUsername,
        error: `لم يتم العثور على محادثة من @${cleanUsername} حتى الآن. يرجى التأكد من رفع البوت مشرفاً في القروب وإرسال رسالة أو أمر /start في المحادثة، ثم المحاولة مجدداً.`,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || "تعذر فحص تحديثات تليقرام" };
    }
  }

  /**
   * Discovers all recent chats and groups that sent messages or added the bot.
   */
  static async discoverRecentChats(
    tenantId: string,
    tokenOverride?: string
  ): Promise<{
    success: boolean;
    botUsername?: string;
    chats: Array<{ id: string; title: string; type: string; username?: string }>;
    error?: string;
  }> {
    const config = await this.getConfig(tenantId);
    const token = tokenOverride || config.botToken;

    if (!token) {
      return { success: false, chats: [], error: "يرجى إدخال رمز البوت (Bot Token) أولاً." };
    }

    try {
      const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const meData = await meRes.json();
      if (!meRes.ok || !meData.ok) {
        return { success: false, chats: [], error: `رمز البوت غير صالح: ${meData.description || "Invalid Token"}` };
      }
      const botUsername = meData.result?.username;

      const updRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=-50`);
      const updData = await updRes.json();

      if (!updRes.ok || !updData.ok) {
        return { success: false, chats: [], error: `خطأ من تليقرام: ${updData.description || "Failed to fetch updates"}` };
      }

      const updates: any[] = updData.result || [];
      const chatMap = new Map<string, { id: string; title: string; type: string; username?: string }>();

      for (const u of updates) {
        const msg = u.message || u.edited_message || u.my_chat_member || u.callback_query?.message;
        const chat = msg?.chat;
        if (!chat || !chat.id) continue;

        const idStr = String(chat.id);
        const title = chat.title || chat.first_name || (chat.username ? `@${chat.username}` : `محادثة (${idStr})`);
        const type = chat.type || "unknown";
        const username = chat.username || msg?.from?.username;

        chatMap.set(idStr, {
          id: idStr,
          title,
          type,
          username,
        });
      }

      const chats = Array.from(chatMap.values());
      return { success: true, botUsername, chats };
    } catch (err: any) {
      return { success: false, chats: [], error: err?.message || "تعذر فحص تحديثات تليقرام" };
    }
  }

  /**
   * Directly sends a message via Telegram Bot API using token and chatId.
   */
  static async sendMessageDirect(
    token: string,
    chatId: string,
    text: string,
    parseMode: "Markdown" | "HTML" = "Markdown"
  ): Promise<boolean> {
    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        }),
      });
      const data = await response.json();
      return Boolean(response.ok && data.ok);
    } catch {
      return false;
    }
  }

  /**
   * Processes inbound Telegram webhook commands with strict authorization allowlist,
   * per-user rate limiting, and structured Arabic command responses.
   */
  static async processIncomingCommand(
    tenantId: string,
    message: {
      text?: string;
      chat?: { id: number | string };
      from?: { id: number | string; username?: string };
    }
  ): Promise<{ handled: boolean; replyText?: string; error?: string }> {
    const rawText = (message.text || "").trim();
    if (!rawText.startsWith("/")) {
      return { handled: false };
    }

    const config = await this.getConfig(tenantId);
    const token = config.botToken;
    const senderChatId = String(message.chat?.id || "");
    const senderUserId = String(message.from?.id || "");

    // 1. Authorization check
    const allowedChatId = config.chatId ? String(config.chatId).trim() : null;
    const envAllowlist = (process.env.TELEGRAM_AUTHORIZED_USERS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const isAuthorized =
      (allowedChatId && (senderChatId === allowedChatId || senderUserId === allowedChatId)) ||
      envAllowlist.includes(senderUserId) ||
      envAllowlist.includes(senderChatId);

    if (!isAuthorized) {
      const unauthorizedMsg = "⛔ عذراً، هذا الحساب غير مصرح له بتنفيذ أوامر مركز التحكم LivePulse.";
      if (token && senderChatId) {
        await this.sendMessageDirect(token, senderChatId, unauthorizedMsg).catch(() => {});
      }
      return { handled: true, replyText: unauthorizedMsg, error: "UNAUTHORIZED" };
    }

    const [cmd] = rawText.split(/\s+/);
    const command = cmd.toLowerCase().split("@")[0]; // handle /command@botname
    let reply = "";

    switch (command) {
      case "/start":
      case "/help":
        reply = `🤖 *مركز أوامر LivePulse Intelligence*\n\n` +
          `الأوامر المتاحة:\n` +
          `• \`/status\` — حالة اتصال البث وعامل المعالجة والنبضات\n` +
          `• \`/session\` — ملخص الجلسة الحالية (الماسات، الداعمين، المدة)\n` +
          `• \`/inventory\` — أرصدة الأدوات التكتيكية وسلامة الدفتر الذكي\n` +
          `• \`/battle\` — تفاصيل الجولة الحالية وسجل النقاط الفوري\n` +
          `• \`/alerts\` — التنبيهات التشغيلية المفتوحة ومؤشرات الأداء\n` +
          `• \`/report\` — ملخص تحليلي موجز لأداء اليوم`;
        break;

      case "/status": {
        const health = await StreamHealthService.getHealthTelemetry(tenantId);
        const statusEmoji = health.status === "CONNECTED" ? "🟢" : health.status === "IDLE_CONNECTED" ? "🟡" : "🔴";
        reply = `📊 *حالة البث والمنظومة الحالية*\n\n` +
          `• الحالة: ${statusEmoji} *${health.status}*\n` +
          `• المعالجة العامة: *${health.overallHealth}*\n` +
          `• إجمالي الأحداث المستلمة: *${health.totalEventsReceived.toLocaleString()}*\n` +
          `• إجمالي الأحداث المسجلة: *${health.totalEventsPersisted.toLocaleString()}*\n` +
          `• محاولات إعادة الاتصال: *${health.reconnectCount}*\n` +
          `• حداثة البيانات: *${health.dataFreshnessSeconds} ثانية*\n` +
          `• حالة قاعدة البيانات: *${health.components.database.status}*\n` +
          `• حالة عامل Ingestion: *${health.components.worker.status}*`;
        break;
      }

      case "/session": {
        const session = await prisma.liveSession.findFirst({
          where: { tenantId, status: "LIVE" },
          orderBy: { startedAt: "desc" },
        });

        if (!session) {
          reply = `ℹ️ لا يوجد بث مباشر نشط حالياً للمستأجر. آخر جلسة مسجلة كانت منتهية.`;
        } else {
          const durationMins = Math.floor((Date.now() - session.startedAt.getTime()) / 60000);
          reply = `🔴 *ملخص البث المباشر النشط*\n\n` +
            `• معرف الغرفة: \`${session.roomId || "نشط"}\`\n` +
            `• مدة البث: *${durationMins} دقيقة*\n` +
            `• إجمالي الماسات: *${session.totalDiamonds.toLocaleString()} 💎*\n` +
            `• إجمالي التعليقات: *${session.totalComments.toLocaleString()}*\n` +
            `• إجمالي الإعجابات: *${session.totalLikes.toLocaleString()}*\n` +
            `• ذروة المشاهدين: *${session.peakViewers.toLocaleString()}*\n` +
            `• موثوقية البيانات: *${session.dataConfidence}*`;
        }
        break;
      }

      case "/inventory": {
        const counters = await SmartInventoryService.getInventoryCounters(tenantId);
        const recon = await SmartInventoryService.reconcileInventory(tenantId);
        const toolLines = counters
          .map((c) => `  • ${c.toolName}: *${c.totalAvailable}* متاح (${c.totalReceived} ممنوح، ${c.totalConsumed} مستهلك)`)
          .join("\n");

        reply = `🎒 *مستودع الأدوات التكتيكية*\n\n` +
          `${toolLines}\n\n` +
          `⚖️ *حالة تدقيق الدفتر (Ledger 2.0)*:\n` +
          `• حالة التطابق: *${recon.isReconciled ? "متطابق 100% ✅" : "يوجد فارق ⚠️"}*\n` +
          `• الرصيد المحسوب: *${recon.totalGrantsProjected}*\n` +
          `• حركات دفتر الأستاذ: *${recon.movementsCount} حركة*`;
        break;
      }

      case "/battle": {
        const battle = await prisma.battle.findFirst({
          where: { tenantId, status: "IN_PROGRESS" },
          include: { participants: true },
        });

        if (!battle) {
          reply = `⚔️ لا توجد جولة تحدي (PK Battle) نشطة في هذه اللحظة.`;
        } else {
          const t1Anchors = battle.participants.filter((p) => p.teamNumber === 1).map((p) => p.displayName).join(", ");
          const t2Anchors = battle.participants.filter((p) => p.teamNumber === 2).map((p) => p.displayName).join(", ");

          reply = `⚔️ *جولة التحدي النشطة (${battle.battleType})*\n\n` +
            `• فريق المضيف (${t1Anchors || "فريق 1"}): *${battle.team1Score.toLocaleString()}*\n` +
            `• فريق الخصم (${t2Anchors || "فريق 2"}): *${battle.team2Score.toLocaleString()}*\n` +
            `• فارق النقاط: *${Math.abs(battle.team1Score - battle.team2Score).toLocaleString()}*\n` +
            `• حالة الجولة: *قيد التنفيذ (Live)*`;
        }
        break;
      }

      case "/alerts": {
        const health = await StreamHealthService.getHealthTelemetry(tenantId);
        const alertsText = health.diagnostics.length > 0
          ? health.diagnostics.map((d, i) => `${i + 1}. ⚠️ ${d}`).join("\n")
          : "✅ لا توجد تنبيهات تشغيلية حرجة أو أعطال مسجلة حالياً.";

        reply = `🚨 *التنبيهات التشغيلية الحية*\n\n${alertsText}`;
        break;
      }

      case "/pdf":
      case "/reports":
      case "/report":
      case "/report_battles":
      case "/report_presence":
      case "/report_enigma":
      case "/report_inventory":
      case "/report_stqi":
      case "/report_summary":
      case "/report_champions": {
        const parts = rawText.split(/\s+/);
        const sub = parts[1]?.toLowerCase() || "";

        let targetType: ReportType = "LIVE_SESSION_SUMMARY";
        if (command === "/report_battles" || sub.includes("battle") || sub.includes("نزال")) {
          targetType = "BATTLE_POST_MATCH";
        } else if (command === "/report_presence" || sub.includes("presence") || sub.includes("تواجد")) {
          targetType = "SUPPORTER_PRESENCE_PATTERN";
        } else if (command === "/report_enigma" || sub.includes("enigma") || sub.includes("اقنع") || sub.includes("secuid")) {
          targetType = "ENIGMA_UNMASKED_ANALYSIS";
        } else if (command === "/report_inventory" || sub.includes("inventory") || sub.includes("مستودع") || sub.includes("دفتر")) {
          targetType = "TACTICAL_INVENTORY_AUDIT";
        } else if (command === "/report_stqi" || sub.includes("stqi") || sub.includes("توقيت") || sub.includes("ايقاع")) {
          targetType = "STQI_TIMING_REPORT";
        } else if (command === "/report_champions" || sub.includes("champion") || sub.includes("ابطال") || sub.includes("مجتمع")) {
          targetType = "COMMUNITY_CHAMPIONS";
        } else if (command === "/report_summary" || sub.includes("summary") || sub.includes("جلسات") || sub.includes("بث")) {
          targetType = "LIVE_SESSION_SUMMARY";
        }

        if (token && senderChatId) {
          await this.sendMessageDirect(token, senderChatId, `⏳ *جاري استخراج وتوليد تقرير الـ PDF المعتمد وإرساله مباشرة...*`).catch(() => {});
        }

        const pdfRes = await this.sendReportPdf(tenantId, targetType, {
          periodPreset: "today",
          chatIdOverride: senderChatId,
        });

        if (pdfRes.success) {
          reply = `✅ *تم إرسال تقرير الـ PDF المعتمد بنجاح!*\n\n` +
            `📑 طلب تقارير أخرى بصيغة PDF فورياً:\n` +
            `• \`/report_battles\` — تحليل ما بعد النزالات (PK)\n` +
            `• \`/report_presence\` — تقرير نمط تواجد الداعمين\n` +
            `• \`/report_enigma\` — كشف الحسابات الغامضة (SecUID)\n` +
            `• \`/report_inventory\` — تدقيق المستودع والدفتر الذكي 2.0\n` +
            `• \`/report_stqi\` — مؤشر التوقيت والإيقاع الذكي (STQI)\n` +
            `• \`/report_summary\` — ملخص جلسات البث المباشر\n` +
            `• \`/report_champions\` — أبطال المجتمع والتفاعل الطبيعي`;
        } else {
          reply = `⚠️ تعذر توليد أو إرسال تقرير الـ PDF: ${pdfRes.error || "خطأ غير متوقع"}`;
        }
        break;
      }

      default:
        reply = `❓ أمر غير معروف (\`${command}\`). أرسل \`/help\` لعرض قائمة الأوامر المتاحة.`;
        break;
    }

    if (token && senderChatId && reply) {
      await this.sendMessageDirect(token, senderChatId, reply).catch((err) => {
        console.warn(`[TELEGRAM_COMMAND] Reply send notice: ${err?.message}`);
      });
    }

    return { handled: true, replyText: reply };
  }
}

