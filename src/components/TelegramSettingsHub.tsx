"use client";

import { useState, useEffect } from "react";
import {
  Send,
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Key,
  Shield,
  User,
  Trophy,
  EyeOff,
  BarChart3,
  Clock,
  Sparkles,
  ExternalLink,
  Eye,
  Sliders,
  Play,
  Flame,
  Activity,
} from "lucide-react";

interface TelegramConfig {
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
  lastDailyChampionsAt?: string | null;
  lastDailyStqiAt?: string | null;
}

interface NotificationLog {
  id: string;
  alertType: string;
  recipient: string;
  messageText: string;
  status: "SENT" | "FAILED";
  errorReason?: string | null;
  createdAt: string;
}

export function TelegramSettingsHub() {
  const [config, setConfig] = useState<TelegramConfig | null>(null);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [stats, setStats] = useState<{ totalSent: number; totalFailed: number }>({
    totalSent: 0,
    totalFailed: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testingAction, setTestingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [showToken, setShowToken] = useState(false);

  // Form state
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [alertVipEntry, setAlertVipEntry] = useState(true);
  const [vipDiamondsThreshold, setVipDiamondsThreshold] = useState(5000);
  const [alertEnigmaUnmasked, setAlertEnigmaUnmasked] = useState(true);
  const [alertDailyChampions, setAlertDailyChampions] = useState(true);
  const [alertDailyStqi, setAlertDailyStqi] = useState(true);

  // Fetch initial data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/notifications/telegram");
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setBotToken(data.config.botToken || "");
        setChatId(data.config.chatId || "");
        setIsEnabled(data.config.isEnabled);
        setAlertVipEntry(data.config.alertVipEntry);
        setVipDiamondsThreshold(data.config.vipDiamondsThreshold || 5000);
        setAlertEnigmaUnmasked(data.config.alertEnigmaUnmasked);
        setAlertDailyChampions(data.config.alertDailyChampions);
        setAlertDailyStqi(data.config.alertDailyStqi);
        setLogs(data.recentLogs || []);
        setStats(data.stats || { totalSent: 0, totalFailed: 0 });
      }
    } catch {
      setFeedback({ type: "error", message: "تعذر تحميل إعدادات تليقرام." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Save settings
  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/notifications/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: botToken.trim() || null,
          chatId: chatId.trim() || null,
          isEnabled,
          alertVipEntry,
          vipDiamondsThreshold: Number(vipDiamondsThreshold) || 5000,
          alertEnigmaUnmasked,
          alertDailyChampions,
          alertDailyStqi,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: "تم حفظ إعدادات تليقرام بنجاح!" });
        setConfig(data.config);
      } else {
        setFeedback({ type: "error", message: data.error || "فشل حفظ الإعدادات." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "حدث خطأ أثناء الحفظ." });
    } finally {
      setIsSaving(false);
    }
  };

  // Run test action
  const handleTestAction = async (
    action: "ping" | "test_vip" | "test_enigma" | "send_daily_champions" | "send_daily_stqi"
  ) => {
    setTestingAction(action);
    setFeedback(null);
    try {
      const res = await fetch("/api/notifications/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          botToken: botToken.trim() || undefined,
          chatId: chatId.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: "success",
          message: data.message || "تم إرسال التنبيه إلى تليقرام بنجاح!",
        });
        // Refresh logs after a short delay
        setTimeout(fetchData, 800);
      } else {
        setFeedback({
          type: "error",
          message: data.error || "تعذر إرسال التنبيه إلى تليقرام. يرجى التحقق من صحة الرمز والمعرف.",
        });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "فشل الاتصال بخادم التنبيهات." });
    } finally {
      setTestingAction(null);
    }
  };

  const isConfigured = !!(botToken.trim() && chatId.trim());

  return (
    <div className="space-y-6">
      {/* 1. MAIN TELEGRAM STATUS & HERO BANNER */}
      <div className="cyber-card p-6 md:p-8 rounded-3xl relative overflow-hidden border border-turquoise/40">
        <div className="absolute top-0 right-0 w-80 h-80 bg-turquoise/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-turquoise/15 text-turquoise text-xs font-bold border border-turquoise/30 flex items-center gap-1.5 shadow-sm shadow-turquoise/10">
                <Send className="w-3.5 h-3.5" />
                مركز تنبيهات تليقرام المباشرة (Telegram Automated Bot)
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${
                  isEnabled && isConfigured
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : isConfigured
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isEnabled && isConfigured
                      ? "bg-emerald-400 animate-pulse"
                      : isConfigured
                      ? "bg-amber-400"
                      : "bg-rose-400"
                  }`}
                />
                {isEnabled && isConfigured
                  ? "البوت مفعل ومتصل بالروم"
                  : isConfigured
                  ? "تم ضبط البيانات (بانتظار التفعيل)"
                  : "غير متصل / بانتظار الإعداد"}
              </span>
            </div>

            <h3 className="text-2xl font-black text-white tracking-tight">
              نظام الإنذار والتنبيهات التكتيكية على تليقرام
            </h3>
            <p className="text-xs text-secondaryText max-w-2xl leading-relaxed">
              اربط بوت تليقرام الخاص بك لاستقبال تنبيهات فورية ولحظية أثناء البث عند دخول كبار الداعمين،
              كشف أقنعة أنيقما، وتقارير يومية لصدارة أبطال المجتمع ومؤشر جودة البث (STQI).
            </p>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-background/90 p-4 rounded-2xl border border-white/10 text-center min-w-[110px] shadow-lg">
              <span className="text-[10px] text-secondaryText block font-medium">تنبيهات أُرسلت</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {stats.totalSent}
              </span>
            </div>
            <div className="bg-background/90 p-4 rounded-2xl border border-white/10 text-center min-w-[110px] shadow-lg">
              <span className="text-[10px] text-secondaryText block font-medium">تنبيهات متعثرة</span>
              <span className="text-2xl font-black text-rose-400 font-mono">
                {stats.totalFailed}
              </span>
            </div>
          </div>
        </div>

        {/* Global Feedback Alert */}
        {feedback && (
          <div
            className={`mt-6 p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
              feedback.type === "success"
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : "bg-rose-500/15 text-rose-300 border-rose-500/30"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 2. CREDENTIALS & CONNECTION CONFIG (Left Column - 5 cols) */}
        <div className="lg:col-span-5 cyber-card p-6 rounded-3xl border border-white/10 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-turquoise" />
              <h4 className="text-base font-bold text-white">إعدادات اتصال البوت</h4>
            </div>
            <span className="text-[11px] text-secondaryText font-mono">Telegram API v6.0</span>
          </div>

          {/* Master Switch */}
          <div className="bg-background/90 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-white block">التفعيل العام للتنبيهات</span>
              <span className="text-[11px] text-secondaryText">تشغيل محرك الإرسال الآلي</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-turquoise"></div>
            </label>
          </div>

          {/* Bot Token Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-secondaryText flex items-center justify-between">
              <span>رمز البوت السري (Bot Token):</span>
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="text-[10px] text-turquoise hover:underline flex items-center gap-1"
              >
                {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showToken ? "إخفاء" : "إظهار"}
              </button>
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                placeholder="123456789:AAFgHjKlMnOpQrStUvWxYz..."
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="w-full bg-elevated border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-secondaryText/50 focus:outline-none focus:border-turquoise font-mono"
              />
            </div>
            <p className="text-[10px] text-secondaryText">
              يمكن الحصول عليه مجاناً عبر محادثة <strong>@BotFather</strong> في تليقرام.
            </p>
          </div>

          {/* Chat ID Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-secondaryText">
              معرف المحادثة أو القناة (Chat ID):
            </label>
            <input
              type="text"
              placeholder="-100123456789 أو 987654321"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              className="w-full bg-elevated border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-secondaryText/50 focus:outline-none focus:border-turquoise font-mono"
            />
            <p className="text-[10px] text-secondaryText">
              المعرف الرقمي للمحادثة أو حساب تليقرام.
            </p>
          </div>

          {/* Quick Connect for @mem121212 */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-turquoise/10 via-background to-background border border-turquoise/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-turquoise" />
                الحساب المستهدف: <span className="text-turquoise font-mono">@mem121212</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-turquoise/15 text-turquoise font-bold">
                ربط تلقائي ذكي
              </span>
            </div>
            <p className="text-[11px] text-secondaryText leading-relaxed">
              لربط حسابك <strong>@mem121212</strong> فوراً: افتح البوت في تليقرام واضغط <strong>Start</strong>، ثم اضغط الزر أدناه لجلب معرفك الرقمي والربط تلقائياً!
            </p>
            <button
              type="button"
              onClick={async () => {
                if (!botToken.trim()) {
                  setFeedback({ type: "error", message: "يرجى لصق رمز البوت (Bot Token) أولاً." });
                  return;
                }
                setTestingAction("discover_chat_id");
                setFeedback(null);
                try {
                  const res = await fetch("/api/notifications/telegram/test", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "discover_chat_id",
                      targetUsername: "mem121212",
                      botToken: botToken.trim(),
                    }),
                  });
                  const data = await res.json();
                  if (data.success && data.chatId) {
                    setChatId(data.chatId);
                    setIsEnabled(true);
                    setFeedback({
                      type: "success",
                      message: `تم العثور على المعرف الرقمي لحساب @mem121212 (${data.chatId}) وتفعيله بنجاح! يمكنك الآن تجربة الإرسال.`,
                    });
                    setTimeout(fetchData, 800);
                  } else {
                    setFeedback({
                      type: "error",
                      message: data.error || "تعذر العثور على محادثة من @mem121212 في البوت بعد.",
                    });
                  }
                } catch {
                  setFeedback({ type: "error", message: "حدث خطأ أثناء فحص البوت." });
                } finally {
                  setTestingAction(null);
                }
              }}
              disabled={testingAction === "discover_chat_id" || !botToken.trim()}
              className="w-full py-2 rounded-xl bg-turquoise/20 hover:bg-turquoise/30 border border-turquoise/40 text-turquoise text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {testingAction === "discover_chat_id" ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري البحث عن @mem121212 في البوت...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>⚡ جلب المعرف وربط @mem121212 تلقائياً</span>
                </>
              )}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-turquoise to-blue text-background font-bold text-xs shadow-md shadow-turquoise/20 hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>حفظ الإعدادات</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleTestAction("ping")}
              disabled={testingAction === "ping" || !isConfigured}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {testingAction === "ping" ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-turquoise" />
                  <span>جاري فحص الاتصال...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-turquoise" />
                  <span>فحص واختبار اتصال البوت (Ping Test)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3. THE 4 SPECIALIZED ALERT CHANNELS (Right Column - 7 cols) */}
        <div className="lg:col-span-7 cyber-card p-6 rounded-3xl border border-white/10 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <BellRing className="w-5 h-5 text-gold" />
              <h4 className="text-base font-bold text-white">قنوات التنبيهات الأربعة المطلوبة</h4>
            </div>
            <span className="text-[11px] text-secondaryText">تخصيص واختبار مباشر</span>
          </div>

          <div className="space-y-4">
            {/* Channel 1: VIP Supporter Entry Alert */}
            <div className="bg-background/90 p-4 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gold/15 text-gold border border-gold/30 flex items-center justify-center">
                    👑
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-white">
                      1. تنبيه دخول كبار الداعمين (VIP Entry)
                    </h5>
                    <p className="text-[11px] text-secondaryText">
                      إرسال إنذار فوري بمجرد دخول داعم كبير للروم مع إحصائياته وتوصية تكتيكية.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={alertVipEntry}
                    onChange={(e) => setAlertVipEntry(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold"></div>
                </label>
              </div>

              {/* Threshold Setting */}
              <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-secondaryText">
                  <Sliders className="w-3.5 h-3.5 text-gold" />
                  <span>الحد الأدنى لاعتبار الداعم VIP:</span>
                  <input
                    type="number"
                    value={vipDiamondsThreshold}
                    onChange={(e) => setVipDiamondsThreshold(Number(e.target.value))}
                    className="w-24 bg-elevated border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono text-center focus:outline-none focus:border-gold"
                  />
                  <span>ماسة 💎</span>
                </div>

                <button
                  onClick={() => handleTestAction("test_vip")}
                  disabled={testingAction === "test_vip" || !isConfigured}
                  className="px-3 py-1.5 rounded-lg bg-gold/15 text-gold border border-gold/30 font-bold hover:bg-gold/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Play className="w-3 h-3 fill-gold" />
                  <span>{testingAction === "test_vip" ? "جاري الإرسال..." : "إرسال تجربة VIP"}</span>
                </button>
              </div>
            </div>

            {/* Channel 2: Enigma Unmasked Alert */}
            <div className="bg-background/90 p-4 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple/15 text-purple border border-purple/30 flex items-center justify-center">
                    🎭
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-white">
                      2. تنبيه كشف قناع أنيقما (Enigma Unmasked)
                    </h5>
                    <p className="text-[11px] text-secondaryText">
                      إرسال تقرير جنائي سري فور كشف هوية أي داعم يدعم بوضع القناع أو التخفي.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={alertEnigmaUnmasked}
                    onChange={(e) => setAlertEnigmaUnmasked(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple"></div>
                </label>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-secondaryText text-[11px]">
                  مطابقة تلقائية عبر بصمة secUid وسلوك الإهداء التاريخي.
                </span>
                <button
                  onClick={() => handleTestAction("test_enigma")}
                  disabled={testingAction === "test_enigma" || !isConfigured}
                  className="px-3 py-1.5 rounded-lg bg-purple/15 text-purple border border-purple/30 font-bold hover:bg-purple/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Play className="w-3 h-3 fill-purple" />
                  <span>
                    {testingAction === "test_enigma" ? "جاري الإرسال..." : "إرسال تجربة أنيقما"}
                  </span>
                </button>
              </div>
            </div>

            {/* Channel 3: Daily Community Champions Alert */}
            <div className="bg-background/90 p-4 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    🏆
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-white">
                      3. الترتيب اليومي لأبطال المجتمع والأوفياء
                    </h5>
                    <p className="text-[11px] text-secondaryText">
                      تقرير يومي لثلاثي الصدارة وقوة التكبيس والشات (مستبعد منه الهدايا 100%).
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={alertDailyChampions}
                    onChange={(e) => setAlertDailyChampions(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-secondaryText text-[11px]">
                  {config?.lastDailyChampionsAt
                    ? `آخر إرسال: ${new Date(config.lastDailyChampionsAt).toLocaleDateString("ar-SA")}`
                    : "مجدول يومياً عبر محرك المراقبة الذاتي"}
                </span>
                <button
                  onClick={() => handleTestAction("send_daily_champions")}
                  disabled={testingAction === "send_daily_champions" || !isConfigured}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Play className="w-3 h-3 fill-emerald-400" />
                  <span>
                    {testingAction === "send_daily_champions"
                      ? "جاري الإرسال..."
                      : "إرسال التقرير الآن"}
                  </span>
                </button>
              </div>
            </div>

            {/* Channel 4: Daily STQI Stream Timing Quality Report */}
            <div className="bg-background/90 p-4 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                    ⏱️
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-white">
                      4. تقرير يومي لمؤشر جودة وقت البث (STQI)
                    </h5>
                    <p className="text-[11px] text-secondaryText">
                      تحليل الساعة الذهبية، وتوقيت النزالات، وساعات الانحسار مع التوصية التكتيكية.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={alertDailyStqi}
                    onChange={(e) => setAlertDailyStqi(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-secondaryText text-[11px]">
                  {config?.lastDailyStqiAt
                    ? `آخر إرسال: ${new Date(config.lastDailyStqiAt).toLocaleDateString("ar-SA")}`
                    : "مجدول يومياً عبر محرك المراقبة الذاتي"}
                </span>
                <button
                  onClick={() => handleTestAction("send_daily_stqi")}
                  disabled={testingAction === "send_daily_stqi" || !isConfigured}
                  className="px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 font-bold hover:bg-blue-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Play className="w-3 h-3 fill-blue-400" />
                  <span>
                    {testingAction === "send_daily_stqi"
                      ? "جاري الإرسال..."
                      : "إرسال تقرير STQI الآن"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. NOTIFICATION LOGS & AUDIT TRAIL */}
      <div className="cyber-card p-6 rounded-3xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-turquoise" />
            <h4 className="text-base font-bold text-white">سجل التنبيهات والرسائل المرسلة</h4>
          </div>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-secondaryText hover:text-white transition-all text-xs flex items-center gap-1.5"
            title="تحديث السجل"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>تحديث</span>
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-secondaryText text-xs bg-background/60 rounded-2xl border border-white/5">
            لا توجد تنبيهات مرسلة حتى الآن. استخدم أزرار التجربة أعلاه لإرسال أول تنبيه تجريبي!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="text-secondaryText border-b border-white/5">
                  <th className="pb-3 font-semibold pr-3">نوع التنبيه</th>
                  <th className="pb-3 font-semibold">المستلم / القناة</th>
                  <th className="pb-3 font-semibold">الحالة</th>
                  <th className="pb-3 font-semibold">التوقيت</th>
                  <th className="pb-3 font-semibold pl-3">تفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => {
                  const isSent = log.status === "SENT";
                  const typeLabel =
                    log.alertType === "VIP_ENTRY"
                      ? "👑 دخول VIP"
                      : log.alertType === "ENIGMA_UNMASKED"
                      ? "🎭 كشف أنيقما"
                      : log.alertType === "DAILY_CHAMPIONS"
                      ? "🏆 صدارة أبطال المجتمع"
                      : log.alertType === "DAILY_STQI"
                      ? "⏱️ تقرير STQI"
                      : "📡 فحص اتصال";

                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 pr-3 font-bold text-white flex items-center gap-2">
                        <span>{typeLabel}</span>
                      </td>
                      <td className="py-3 font-mono text-secondaryText text-[11px]">
                        {log.recipient}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isSent
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/25"
                          }`}
                        >
                          {isSent ? "تم الإرسال بنجاح" : "تعذر الإرسال"}
                        </span>
                      </td>
                      <td className="py-3 text-secondaryText text-[11px] font-mono">
                        {new Date(log.createdAt).toLocaleTimeString("ar-SA", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-3 pl-3 text-secondaryText text-[11px] max-w-xs truncate">
                        {isSent ? (
                          <span className="text-white/80 truncate block">
                            {log.messageText.replace(/<[^>]*>?/gm, "").slice(0, 45)}...
                          </span>
                        ) : (
                          <span className="text-rose-400 truncate block">
                            {log.errorReason || "خطأ غير معروف"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
