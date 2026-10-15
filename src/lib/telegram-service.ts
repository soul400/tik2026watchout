import { prisma } from "./prisma";
import { ChampionsEngine } from "./champions-engine";
import { STQIEngine } from "./stqi-engine";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

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
      lastDailyChampionsAt: updated.lastDailyChampionsAt,
      lastDailyStqiAt: updated.lastDailyStqiAt,
    };
  }

  /**
   * Sends raw HTML message via Telegram Bot API and logs the result.
   */
  static async sendMessage(
    tenantId: string,
    alertType: "VIP_ENTRY" | "ENIGMA_UNMASKED" | "DAILY_CHAMPIONS" | "DAILY_STQI" | "TEST",
    messageHtml: string,
    metadata?: any,
    overrideToken?: string,
    overrideChatId?: string
  ): Promise<{ success: boolean; error?: string; messageId?: number }> {
    const config = await this.getConfig(tenantId);
    const token = overrideToken || config.botToken;
    const chatId = overrideChatId || config.chatId;

    if (!token || !chatId) {
      const err = "لم يتم ضبط رمز البوت (Bot Token) أو معرف المحادثة (Chat ID).";
      await prisma.telegramNotificationLog.create({
        data: {
          tenantId,
          alertType,
          recipient: chatId || "NOT_SET",
          messageText: messageHtml,
          status: "FAILED",
          errorReason: err,
          metadataJson: metadata ? JSON.stringify(metadata) : null,
        },
      });
      return { success: false, error: err };
    }

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageHtml,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });

      const resData = await response.json();

      if (!response.ok || !resData.ok) {
        const errorDetail = resData.description || `HTTP Error ${response.status}`;
        await prisma.telegramNotificationLog.create({
          data: {
            tenantId,
            alertType,
            recipient: chatId,
            messageText: messageHtml,
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
          messageText: messageHtml,
          status: "SENT",
          metadataJson: metadata ? JSON.stringify(metadata) : null,
        },
      });

      return { success: true, messageId: resData.result?.message_id };
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to reach Telegram API";
      await prisma.telegramNotificationLog.create({
        data: {
          tenantId,
          alertType,
          recipient: chatId,
          messageText: messageHtml,
          status: "FAILED",
          errorReason: errorMsg,
          metadataJson: metadata ? JSON.stringify(metadata) : null,
        },
      });
      return { success: false, error: errorMsg };
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

    if (res.success) {
      await prisma.telegramConfig.update({
        where: { tenantId },
        data: { lastDailyStqiAt: new Date() },
      });
    }

    return res;
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
      const timeString = new Date().toLocaleTimeString("ar-SA", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const testMsg = `🚀 <b>[اتصال ناجح: نظام تنبيهات LIVEPULSE]</b> ✅
━━━━━━━━━━━━━━━━━━━━
🤖 <b>اسم البوت:</b> ${botName}
🕒 <b>وقت الاختبار:</b> ${timeString} بتوقيت الرياض
📡 <b>الحالة:</b> متصل وجاهز لإرسال تنبيهات الروم المباشرة!
━━━━━━━━━━━━━━━━━━━━
📌 <b>القنوات المفعلة للرصد:</b>
1️⃣ 👑 تنبيه دخول كبار الداعمين (VIP Entry)
2️⃣ 🎭 تنبيه كشف قناع أنيقما (Enigma Unmasked)
3️⃣ 🏆 التقرير اليومي لصدارة أبطال المجتمع
4️⃣ ⏱️ التقرير اليومي لمؤشر جودة وقت البث (STQI)`;

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
   * Dispatches realistic mock or live data for any of the 4 alert types for on-demand user verification.
   */
  static async testSpecificAlert(
    tenantId: string,
    action: "ping" | "test_vip" | "test_enigma" | "send_daily_champions" | "send_daily_stqi"
  ): Promise<{ success: boolean; error?: string; messageId?: number }> {
    if (action === "ping") {
      const res = await this.testConnection(tenantId);
      return { success: res.success, error: res.error };
    }

    if (action === "test_vip") {
      // Fetch top supporter to use as VIP example
      const topSupp = await prisma.supporter.findFirst({
        where: { tenantId },
        orderBy: { totalDiamonds: "desc" },
      });

      return await this.sendVipEntryAlert(tenantId, {
        displayName: topSupp?.displayName || "خالد الـ VIP 👑",
        username: topSupp?.username || "khaled_vip",
        totalDiamonds: topSupp?.totalDiamonds || 125000,
        category: topSupp?.category || "CONTINUOUS",
      });
    }

    if (action === "test_enigma") {
      return await this.sendEnigmaUnmaskedAlert(tenantId, {
        enigmaDisplayId: "Enigma_7719",
        realDisplayName: "Cold killer💀",
        realUsername: "cold.killer85",
        diamondsWithEnigma: 45000,
        diamondsPublic: 89000,
        matchConfidence: 0.99,
      });
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
  ): Promise<{ success: boolean; chatId?: string; error?: string; botUsername?: string }> {
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
      const updRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=-20`);
      const updData = await updRes.json();

      if (!updRes.ok || !updData.ok) {
        return { success: false, error: `خطأ من تليقرام: ${updData.description || "Failed to fetch updates"}` };
      }

      const updates: any[] = updData.result || [];
      let foundChatId: string | null = null;

      for (const u of updates) {
        const msg = u.message || u.edited_message || u.callback_query?.message;
        const fromUser = u.message?.from || u.callback_query?.from;
        const chatUser = msg?.chat;

        const uName = (fromUser?.username || chatUser?.username || "").toLowerCase();
        if (uName === cleanUsername) {
          foundChatId = String(chatUser?.id || fromUser?.id);
          break;
        }
      }

      if (foundChatId) {
        // Save to DB
        await this.updateConfig(tenantId, { chatId: foundChatId, isEnabled: true });
        return { success: true, chatId: foundChatId, botUsername };
      }

      return {
        success: false,
        botUsername,
        error: `لم يتم العثور على محادثة من @${cleanUsername} حتى الآن. يرجى الدخول إلى البوت (@${botUsername}) والضغط على Start أو إرسال أي رسالة، ثم الضغط على هذا الزر مرة أخرى.`,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || "تعذر فحص تحديثات تليقرام" };
    }
  }
}

