import { prisma } from "./prisma";

export type StreamConnectionStatus =
  | "CONNECTED"
  | "IDLE_CONNECTED"
  | "RECONNECTING"
  | "DISCONNECTED"
  | "DEGRADED";

export interface ComponentHealthStatus {
  status: "HEALTHY" | "DEGRADED" | "CRITICAL" | "OFFLINE";
  message: string;
  lastChecked: Date;
  details?: Record<string, any>;
}

export interface StreamHealthTelemetry {
  status: StreamConnectionStatus;
  overallHealth: "HEALTHY" | "DEGRADED" | "CRITICAL";
  workerHeartbeat: Date | null;
  lastEventAt: Date | null;
  lastPersistedAt: Date | null;
  reconnectCount: number;
  totalEventsReceived: number;
  totalEventsPersisted: number;
  totalErrors: number;
  eventProcessingLatencyMs: number;
  dataFreshnessSeconds: number;
  isStreamActive: boolean;
  components: {
    worker: ComponentHealthStatus;
    tiktokConnector: ComponentHealthStatus;
    database: ComponentHealthStatus;
    telegramAlerts: ComponentHealthStatus;
  };
  diagnostics: string[];
  checkedAt: Date;
}

export class StreamHealthService {
  // In-memory state tracking live worker metrics
  private static status: StreamConnectionStatus = "DISCONNECTED";
  private static workerHeartbeat: Date | null = null;
  private static lastEventAt: Date | null = null;
  private static lastPersistedAt: Date | null = null;
  private static reconnectCount: number = 0;
  private static totalEventsReceived: number = 0;
  private static totalEventsPersisted: number = 0;
  private static totalErrors: number = 0;
  private static lastLatencyMs: number = 0;
  private static recentErrors: Array<{ time: Date; error: string }> = [];

  /**
   * Sets current TikTok connection lifecycle state.
   */
  static setConnectionState(newStatus: StreamConnectionStatus) {
    this.status = newStatus;
    this.workerHeartbeat = new Date();
    if (newStatus === "RECONNECTING") {
      this.reconnectCount++;
    }
  }

  /**
   * Records a worker liveness heartbeat.
   */
  static recordHeartbeat() {
    this.workerHeartbeat = new Date();
    if (this.status === "DISCONNECTED") {
      this.status = "CONNECTED";
    }
  }

  /**
   * Records an ingested event with processing latency.
   */
  static recordEventReceived(latencyMs: number = 0, isPersisted: boolean = true) {
    const now = new Date();
    this.lastEventAt = now;
    this.totalEventsReceived++;
    this.lastLatencyMs = latencyMs;
    this.workerHeartbeat = now;

    if (isPersisted) {
      this.lastPersistedAt = now;
      this.totalEventsPersisted++;
    }

    if (this.status === "IDLE_CONNECTED" || this.status === "DISCONNECTED") {
      this.status = "CONNECTED";
    }
  }

  /**
   * Records an operational processing or connection failure.
   */
  static recordError(errMessage: string) {
    this.totalErrors++;
    this.recentErrors.unshift({ time: new Date(), error: errMessage });
    if (this.recentErrors.length > 20) {
      this.recentErrors.pop();
    }
    this.status = "DEGRADED";
  }

  /**
   * Persists a periodic health snapshot into the database.
   */
  static async persistSnapshot(tenantId: string) {
    try {
      await prisma.streamHealthLog.create({
        data: {
          tenantId,
          status: this.status,
          eventProcessingLatencyMs: this.lastLatencyMs,
          eventsReceived: this.totalEventsReceived,
          eventsPersisted: this.totalEventsPersisted,
          errorCount: this.totalErrors,
          reconnectCount: this.reconnectCount,
          lastEventAt: this.lastEventAt,
          lastPersistedAt: this.lastPersistedAt,
          detailsJson: JSON.stringify({
            recentErrors: this.recentErrors.slice(0, 5),
          }),
        },
      });
    } catch (e: any) {
      console.warn(`[HEALTH_MONITOR] Snapshot persistence notice: ${e?.message}`);
    }
  }

  /**
   * Gathers live health telemetry, component statuses, and actionable diagnostics.
   */
  static async getHealthTelemetry(tenantId?: string): Promise<StreamHealthTelemetry> {
    const now = new Date();

    // Check DB for cross-process snapshot if in-memory heartbeat is null (e.g., API server process)
    let dbHeartbeat = this.workerHeartbeat;
    let dbStatusSnapshot = this.status;
    let dbEventsReceived = this.totalEventsReceived;
    let dbEventsPersisted = this.totalEventsPersisted;
    let dbLatencyMs = this.lastLatencyMs;

    if (!dbHeartbeat) {
      try {
        const latestLog = await prisma.streamHealthLog.findFirst({
          where: tenantId ? { tenantId } : undefined,
          orderBy: { timestamp: "desc" },
        });
        if (latestLog) {
          dbHeartbeat = latestLog.timestamp;
          dbStatusSnapshot = latestLog.status as any;
          dbEventsReceived = latestLog.eventsReceived;
          dbEventsPersisted = latestLog.eventsPersisted;
          dbLatencyMs = latestLog.eventProcessingLatencyMs;
        }
      } catch {}
    }

    const heartbeatAgeSec = dbHeartbeat
      ? Math.floor((now.getTime() - dbHeartbeat.getTime()) / 1000)
      : 999999;

    const eventAgeSec = this.lastEventAt
      ? Math.floor((now.getTime() - this.lastEventAt.getTime()) / 1000)
      : 999999;

    // Check if connected but quiet (idle period)
    let currentStatus = dbStatusSnapshot;
    if (currentStatus === "CONNECTED" && eventAgeSec > 60) {
      currentStatus = "IDLE_CONNECTED";
    }
    if (heartbeatAgeSec > 180 && currentStatus !== "DISCONNECTED") {
      currentStatus = "DEGRADED";
    }

    // Database liveness probe
    let dbStatus: ComponentHealthStatus = {
      status: "HEALTHY",
      message: "قاعدة البيانات SQLite WAL متصلة وسريعة الاستجابة",
      lastChecked: now,
    };

    try {
      const probeStart = Date.now();
      await prisma.$queryRawUnsafe("SELECT 1;");
      const dbLatency = Date.now() - probeStart;
      dbStatus.details = { latencyMs: dbLatency };
    } catch (e: any) {
      dbStatus = {
        status: "CRITICAL",
        message: `خطأ في اتصال قاعدة البيانات: ${e?.message}`,
        lastChecked: now,
      };
    }

    // Ingestion Worker status
    const workerStatus: ComponentHealthStatus = {
      status: heartbeatAgeSec < 60 ? "HEALTHY" : heartbeatAgeSec < 180 ? "DEGRADED" : "OFFLINE",
      message:
        heartbeatAgeSec < 60
          ? `عامل المعالجة نشط (آخر نبضة قبل ${heartbeatAgeSec} ثانية)`
          : `عامل المعالجة غير نشط أو متوقف (آخر نبضة قبل ${heartbeatAgeSec} ثانية)`,
      lastChecked: now,
      details: { heartbeatAgeSec },
    };

    // TikTok Connector status
    const connectorStatus: ComponentHealthStatus = {
      status: currentStatus === "CONNECTED" || currentStatus === "IDLE_CONNECTED"
        ? "HEALTHY"
        : currentStatus === "RECONNECTING"
        ? "DEGRADED"
        : "OFFLINE",
      message:
        currentStatus === "CONNECTED"
          ? "متصل مباشرة بغرفة البث عبر WebSocket"
          : currentStatus === "IDLE_CONNECTED"
          ? "متصل بالبث (فترة هدوء في الأحداث)"
          : currentStatus === "RECONNECTING"
          ? "جاري إعادة الاتصال بالبث"
          : "الاتصال مقطوع",
      lastChecked: now,
      details: { reconnectCount: this.reconnectCount, lastEventAgeSec: eventAgeSec },
    };

    // Telegram Alerts status
    let telegramStatus: ComponentHealthStatus;
    const envBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const envChatId = process.env.TELEGRAM_CHAT_ID;

    if (tenantId) {
      const tgConfig = await prisma.telegramConfig.findUnique({ where: { tenantId } });
      const hasToken = !!(tgConfig?.botToken || envBotToken);
      const hasChat = !!(tgConfig?.chatId || envChatId);
      const isEnabled = tgConfig ? tgConfig.isEnabled : !!(hasToken && hasChat);

      if (!hasToken || !hasChat) {
        telegramStatus = {
          status: "DEGRADED",
          message: "تنبيهات تيليجرام غير مهيأة (رمز البوت أو معرف القناة مفقود)",
          lastChecked: now,
          details: { hasToken, hasChat, isEnabled },
        };
      } else if (!isEnabled) {
        telegramStatus = {
          status: "DEGRADED",
          message: "تنبيهات تيليجرام مهيأة ولكنها معطلة",
          lastChecked: now,
          details: { hasToken, hasChat, isEnabled: false },
        };
      } else {
        telegramStatus = {
          status: "HEALTHY",
          message: "قناة التنبيهات معدة وجاهزة للإرسال",
          lastChecked: now,
          details: { hasToken: true, hasChat: true, isEnabled: true },
        };
      }
    } else {
      const hasToken = !!envBotToken;
      const hasChat = !!envChatId;
      if (!hasToken || !hasChat) {
        telegramStatus = {
          status: "DEGRADED",
          message: "تنبيهات تيليجرام غير مهيأة (رمز البوت أو معرف القناة مفقود)",
          lastChecked: now,
          details: { hasToken, hasChat, isEnabled: false },
        };
      } else {
        telegramStatus = {
          status: "HEALTHY",
          message: "قناة التنبيهات معدة وجاهزة للإرسال",
          lastChecked: now,
          details: { hasToken: true, hasChat: true, isEnabled: true },
        };
      }
    }

    // Diagnostics generation
    const diagnostics: string[] = [];
    if (heartbeatAgeSec > 120) {
      diagnostics.push("عامل المعالجة Ingestion Worker متوقف عن إرسال النبضات. يرجى تشغيل npm run worker.");
    }
    if (this.reconnectCount > 3) {
      diagnostics.push(`حدثت ${this.reconnectCount} محاولات إعادة اتصال بالبث. يرجى مراجعة ثبات اتصال الإنترنت.`);
    }
    if (this.totalErrors > 0) {
      diagnostics.push(`تم تسجيل ${this.totalErrors} أخطاء أثناء المعالجة الحالية.`);
    }

    const overallHealth: "HEALTHY" | "DEGRADED" | "CRITICAL" =
      dbStatus.status === "CRITICAL" || workerStatus.status === "OFFLINE"
        ? "CRITICAL"
        : currentStatus === "DEGRADED" || currentStatus === "RECONNECTING" || workerStatus.status === "DEGRADED"
        ? "DEGRADED"
        : "HEALTHY";

    return {
      status: currentStatus,
      overallHealth,
      workerHeartbeat: this.workerHeartbeat,
      lastEventAt: this.lastEventAt,
      lastPersistedAt: this.lastPersistedAt,
      reconnectCount: this.reconnectCount,
      totalEventsReceived: this.totalEventsReceived,
      totalEventsPersisted: this.totalEventsPersisted,
      totalErrors: this.totalErrors,
      eventProcessingLatencyMs: this.lastLatencyMs,
      dataFreshnessSeconds: eventAgeSec === 999999 ? 0 : eventAgeSec,
      isStreamActive: currentStatus === "CONNECTED" || currentStatus === "IDLE_CONNECTED",
      components: {
        worker: workerStatus,
        tiktokConnector: connectorStatus,
        database: dbStatus,
        telegramAlerts: telegramStatus,
      },
      diagnostics,
      checkedAt: now,
    };
  }
}
