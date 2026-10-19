"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Radar,
  Shield,
  Swords,
  Users,
  Search,
  Eye,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Printer,
  Sliders,
  Filter,
  Plus,
  Trash2,
  Activity,
  Zap,
  ArrowRightLeft,
  Flame,
  Fingerprint,
  FileText,
  Lock,
  ExternalLink,
} from "lucide-react";
import {
  CommandCenterOverviewDTO,
  RadarAlertDTO,
  WatchlistEntryDTO,
  AliasHistoryItemDTO,
  AccountIdentityDTO,
  ForensicComparisonDTO,
  AntiSnipePredictionDTO,
  IntelligenceSettingsDTO,
} from "@/lib/intelligence-types";

interface Props {
  tenantId: string;
  initialOverview: CommandCenterOverviewDTO | null;
  initialSettings: IntelligenceSettingsDTO | null;
  initialWatchlist: WatchlistEntryDTO[];
  initialAliasHistories: AliasHistoryItemDTO[];
  initialAccounts: AccountIdentityDTO[];
}

export function IntelligenceLabClient({
  tenantId,
  initialOverview,
  initialSettings,
  initialWatchlist,
  initialAliasHistories,
  initialAccounts,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    | "command-center"
    | "radar"
    | "forensic-lab"
    | "tactical-radar"
    | "enigma-analytics"
    | "watchlists-evidence"
    | "settings"
  >("command-center");

  const [overview, setOverview] = useState<CommandCenterOverviewDTO | null>(initialOverview);
  const [settings, setSettings] = useState<IntelligenceSettingsDTO | null>(initialSettings);
  const [watchlist, setWatchlist] = useState<WatchlistEntryDTO[]>(initialWatchlist);
  const [aliasHistories, setAliasHistories] = useState<AliasHistoryItemDTO[]>(initialAliasHistories);
  const [accounts, setAccounts] = useState<AccountIdentityDTO[]>(initialAccounts);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Forensic Comparison State
  const [accountAInput, setAccountAInput] = useState("");
  const [accountBInput, setAccountBInput] = useState("");
  const [comparisonResult, setComparisonResult] = useState<ForensicComparisonDTO | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonError, setComparisonError] = useState("");

  // Tactical Radar State
  const [tacticalData, setTacticalData] = useState<{
    isActive: boolean;
    prediction?: AntiSnipePredictionDTO;
  } | null>(null);
  const [isLoadingTactical, setIsLoadingTactical] = useState(false);

  // Watchlist Modal & Form
  const [newWatchUser, setNewWatchUser] = useState("");
  const [newWatchReason, setNewWatchReason] = useState("");
  const [newWatchCategory, setNewWatchCategory] = useState("SUSPECTED_ALT");
  const [newWatchSeverity, setNewWatchSeverity] = useState("HIGH");
  const [isAddingWatchlist, setIsAddingWatchlist] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Radar Filters
  const [radarFilterCategory, setRadarFilterCategory] = useState("ALL");

  // Settings Save State
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzingHistory, setIsAnalyzingHistory] = useState(false);
  const [historicalAuditData, setHistoricalAuditData] = useState<{
    totalAudited: number;
    sufficientDataCount: number;
    insufficientDataCount: number;
    verifiedUidCount: number;
    casesCreatedOrUpdated: number;
    results: any[];
  } | null>(null);
  const [watchlistFilterCategory, setWatchlistFilterCategory] = useState("ALL");

  // Telegram dispatch feedback
  const [telegramFeedback, setTelegramFeedback] = useState<string | null>(null);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);

  // Auto-refresh overview every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      fetchOverview();
    }, 30000);
    return () => clearInterval(timer);
  }, [tenantId]);

  const fetchOverview = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch(`/api/intelligence/overview?tenantId=${tenantId}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setOverview(json.data);
      }
    } catch {
      // silent refresh fail
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRunComparison = async (userA?: string, userB?: string) => {
    const a = userA || accountAInput.trim();
    const b = userB || accountBInput.trim();
    if (!a || !b) {
      setComparisonError("يرجى تحديد اسم الحساب الأول واسم الحساب الثاني للمقارنة.");
      return;
    }
    setComparisonError("");
    setIsComparing(true);
    try {
      const res = await fetch("/api/intelligence/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, accountA: a, accountB: b }),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setComparisonResult(json.data);
        setActiveTab("forensic-lab");
      } else {
        setComparisonError(json.error || "فشل إجراء المقارنة الجنائية.");
      }
    } catch (err: any) {
      setComparisonError(err?.message || "حدث خطأ أثناء إجراء المقارنة.");
    } finally {
      setIsComparing(false);
    }
  };

  const handleFetchTactical = async () => {
    setIsLoadingTactical(true);
    try {
      const res = await fetch(`/api/intelligence/tactical/current?tenantId=${tenantId}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setTacticalData(json.data);
      }
    } catch {
      // non-blocking
    } finally {
      setIsLoadingTactical(false);
    }
  };

  const handleAddWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWatchUser || !newWatchReason) return;
    setIsAddingWatchlist(true);
    try {
      const res = await fetch("/api/intelligence/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          username: newWatchUser,
          reason: newWatchReason,
          category: newWatchCategory,
          severity: newWatchSeverity,
        }),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setWatchlist((prev) => [json.data, ...prev]);
        setNewWatchUser("");
        setNewWatchReason("");
        setFeedbackMsg("✅ تمت إضافة الحساب إلى قائمة المراقبة بنجاح");
        setTimeout(() => setFeedbackMsg(""), 4000);
      }
    } catch {
      setFeedbackMsg("⚠️ فشلت إضافة الحساب إلى قائمة المراقبة");
    } finally {
      setIsAddingWatchlist(false);
    }
  };

  const handleDeleteWatchlist = async (id: string) => {
    try {
      await fetch(`/api/intelligence/watchlist/${id}?tenantId=${tenantId}`, {
        method: "DELETE",
      });
      setWatchlist((prev) => prev.filter((w) => w.id !== id));
    } catch {}
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setIsSavingSettings(true);
    try {
      const res = await fetch("/api/intelligence/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, settings }),
      });
      const json = await res.json();
      if (json.ok) {
        setFeedbackMsg("✅ تم حفظ إعدادات معمل الاستخبارات بنجاح");
        setTimeout(() => setFeedbackMsg(""), 4000);
      }
    } catch {
      setFeedbackMsg("⚠️ فشل حفظ الإعدادات");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSendTelegramPdf = async (reportType: string) => {
    setIsSendingTelegram(true);
    setTelegramFeedback(null);
    try {
      const res = await fetch("/api/reports/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, reportType }),
      });
      const json = await res.json();
      if (json.ok) {
        setTelegramFeedback(`✅ تم إرسال وثيقة الـ PDF إلى تليقرام بنجاح (${json.filename || ""})`);
      } else {
        setTelegramFeedback(`⚠️ تعذر الإرسال: ${json.error || "خطأ غير متوقع"}`);
      }
    } catch (err: any) {
      setTelegramFeedback(`⚠️ خطأ في الاتصال: ${err?.message}`);
    } finally {
      setIsSendingTelegram(false);
      setTimeout(() => setTelegramFeedback(null), 6000);
    }
  };

  const handleSyncHistoricalData = async () => {
    setIsSyncing(true);
    setFeedbackMsg("");
    try {
      const res = await fetch("/api/intelligence/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setFeedbackMsg(`✅ اكتملت المزامنة: ${json.data.syncedEnigmaCount} حساب أنيقما، ${json.data.syncedVipCount} من كبار الداعمين (+10K 💎)، ${json.data.syncedAliasesCount} سجل تحول هوية.`);
        const [ovRes, wlRes, alRes] = await Promise.all([
          fetch(`/api/intelligence/overview?tenantId=${tenantId}`).then((r) => r.json()),
          fetch(`/api/intelligence/watchlist?tenantId=${tenantId}`).then((r) => r.json()),
          fetch(`/api/intelligence/accounts?tenantId=${tenantId}&limit=100`).then((r) => r.json()),
        ]);
        if (ovRes.ok && ovRes.data) setOverview(ovRes.data);
        if (wlRes.ok && wlRes.data) setWatchlist(wlRes.data);
        if (alRes.ok && alRes.data) setAccounts(alRes.data);
        setTimeout(() => setFeedbackMsg(""), 8000);
      } else {
        setFeedbackMsg(`⚠️ تعذر إتمام المزامنة: ${json.error || "خطأ غير متوقع"}`);
      }
    } catch (err: any) {
      setFeedbackMsg(`⚠️ خطأ في الاتصال: ${err?.message || "تعذر إتمام المزامنة"}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeepHistoricalAnalysis = async () => {
    setIsAnalyzingHistory(true);
    setFeedbackMsg("");
    try {
      const res = await fetch("/api/intelligence/analyze-enigma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setHistoricalAuditData(json.data);
        setFeedbackMsg(
          `🔬 اكتمل التحليل الجنائي التاريخي لـ ${json.data.totalAudited} حساب أنيقما: ${json.data.sufficientDataCount} حساب ببيانات كافية، ${json.data.verifiedUidCount} كشف قطعي SecUID، و ${json.data.insufficientDataCount} حساب ببيانات غير كافية.`
        );
        const ovRes = await fetch(`/api/intelligence/overview?tenantId=${tenantId}`).then((r) => r.json());
        if (ovRes.ok && ovRes.data) setOverview(ovRes.data);
        setTimeout(() => setFeedbackMsg(""), 10000);
      } else {
        setFeedbackMsg(`⚠️ تعذر إجراء التحليل التاريخي: ${json.error || "خطأ غير متوقع"}`);
      }
    } catch (err: any) {
      setFeedbackMsg(`⚠️ خطأ في الاتصال: ${err?.message || "فشل التحليل"}`);
    } finally {
      setIsAnalyzingHistory(false);
    }
  };

  const filteredRadarAlerts = (overview?.recentRadarAlerts || []).filter((a) => {
    if (radarFilterCategory === "ALL") return true;
    return a.triggerCategory === radarFilterCategory;
  });

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* ============================================================= */}
      {/* 1. MASTER HEADER & OPERATIONAL TELEMETRY */}
      {/* ============================================================= */}
      <div className="hud-deck rounded-3xl p-6 md:p-8 relative overflow-hidden border border-white/10 shadow-2xl bg-slate-950/70 backdrop-blur-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/30 via-indigo-500/20 to-purple-500/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/20">
                <Radar className="w-6 h-6 text-cyan-300 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                    معمل الاستخبارات والرادار التكتيكي
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    INTELLIGENCE LAB 2.0
                  </span>
                </div>
                <p className="text-xs text-secondaryText font-medium mt-0.5">
                  الرصد الجنائي اللحظي لحساب <strong className="text-cyan-300">@mohra.2000</strong> • توقيت الرياض (Asia/Riyadh) • مطابق وموثق 100%
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions & Status */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchOverview}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold transition-all disabled:opacity-50"
              title="تحديث البيانات اللحظية"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
              <span>تحديث حي</span>
            </button>

            <button
              onClick={handleSyncHistoricalData}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border border-purple-500/30 text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
              title="مزامنة وتغذية حسابات أنيقما (26 حساباً) وكبار داعمي لوحة الشرف (+10K 💎)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-purple-400" : "text-purple-300"}`} />
              <span>{isSyncing ? "جاري المزامنة..." : "مزامنة أنيقما وكبار الداعمين 🔄"}</span>
            </button>

            <button
              onClick={handleDeepHistoricalAnalysis}
              disabled={isAnalyzingHistory}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-500/30 text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
              title="فحص وتحليل أحداث كافة حسابات أنيقما تاريخياً عبر سجلات الأحداث وقواعد البيانات"
            >
              <Activity className={`w-3.5 h-3.5 ${isAnalyzingHistory ? "animate-spin text-cyan-400" : "text-cyan-300"}`} />
              <span>{isAnalyzingHistory ? "جاري التحليل التاريخي..." : "تحليل أحداث أنيقما تاريخياً 🔬"}</span>
            </button>

            <button
              onClick={() => handleSendTelegramPdf("ENIGMA_UNMASKED_ANALYSIS")}
              disabled={isSendingTelegram}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600/30 to-indigo-600/30 hover:from-sky-600/40 hover:to-indigo-600/40 text-sky-200 border border-sky-400/40 text-xs font-bold transition-all shadow-md disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-sky-300" />
              <span>إرسال تقرير PDF لتليقرام</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Alert */}
        {feedbackMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold animate-in fade-in">
            {feedbackMsg}
          </div>
        )}
        {telegramFeedback && (
          <div className="mt-4 p-3 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-200 text-xs font-bold animate-in fade-in">
            {telegramFeedback}
          </div>
        )}

        {/* 4 Telemetry Metrics Cards */}
        {overview && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-cyan-200">حسابات تحت المراقبة (Watchlist)</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black font-mono text-white">
                  {overview.metrics.activeWatchlistCount}
                </span>
                <span className="text-[10px] text-cyan-400 font-mono">رصد فوري بالدخول</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-purple-200">تحولات المعرفات والأسماء</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black font-mono text-white">
                  {overview.metrics.verifiedAliasChangesCount}
                </span>
                <span className="text-[10px] text-purple-400 font-mono">وثائق SecUID مثبتة</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-amber-200">تنبيهات الرادار اللحظية</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black font-mono text-white">
                  {overview.metrics.recentRadarAlertsCount}
                </span>
                <span className="text-[10px] text-amber-400 font-mono">آخر 24 ساعة</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-rose-200">تنبيهات الخطورة العالية</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black font-mono text-white">
                  {overview.metrics.criticalThreatsCount}
                </span>
                <span className="text-[10px] text-rose-400 font-mono">كمائن وداعمو خصوم</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================= */}
      {/* 2. TAB WORKSPACE NAVIGATION */}
      {/* ============================================================= */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/10 select-none">
        {[
          { id: "command-center", label: "مركز القيادة الاستخباراتي", icon: Activity },
          { id: "radar", label: "رادار الدخول اللحظي", icon: Radar },
          { id: "forensic-lab", label: "مختبر المقارنة الجنائية", icon: ArrowRightLeft },
          { id: "tactical-radar", label: "رادار النزالات والكمائن (PK)", icon: Swords },
          { id: "enigma-analytics", label: "سجل الهويات والتحولات", icon: Fingerprint },
          { id: "watchlists-evidence", label: "قوائم المراقبة ومستكشف الأدلة", icon: Shield },
          { id: "settings", label: "إعدادات المعمل", icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                if (tab.id === "tactical-radar") handleFetchTactical();
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                isActive
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-secondaryText hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-secondaryText"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ============================================================= */}
      {/* 3. WORKSPACE TAB CONTENTS */}
      {/* ============================================================= */}

      {/* TAB 1: COMMAND CENTER */}
      {activeTab === "command-center" && overview && (
        <div className="space-y-6 animate-in fade-in">
          {/* Active Battle & Stream Health Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live PK Battle Radar Card */}
            <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                    <Flame className="w-4 h-4 text-rose-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">حالة النزال النشط ورادار الكمائن</h3>
                    <p className="text-[11px] text-secondaryText">تقييم مخاطر الانقلابات وهجمات اللحظة الأخيرة</p>
                  </div>
                </div>

                {overview.activeBattle?.isActive ? (
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                    LIVE PK IN PROGRESS
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-mono text-secondaryText bg-white/5 border border-white/10">
                    لا يوجد نزال نشط حالياً
                  </span>
                )}
              </div>

              {overview.activeBattle?.isActive ? (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                    <div>
                      <span className="text-[11px] text-slate-400">سكور المضيف</span>
                      <p className="text-xl font-black font-mono text-emerald-400 mt-1">
                        {overview.activeBattle.team1Score.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400">فارق السكور</span>
                      <p className="text-xl font-black font-mono text-amber-300 mt-1">
                        {Math.abs(overview.activeBattle.scoreDifference).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400">سكور الخصم</span>
                      <p className="text-xl font-black font-mono text-rose-400 mt-1">
                        {overview.activeBattle.team2Score.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <span className="text-xs font-bold text-rose-200">
                      مؤشر تهديد الكمائن (Anti-Snipe Threat):
                    </span>
                    <span className="text-xs font-mono font-black text-rose-300">
                      {overview.activeBattle.threatLevel} ({overview.activeBattle.snipeRiskScore}%)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-secondaryText border border-dashed border-white/10 rounded-2xl">
                  النظام في وضع الاستعداد بانتظار بدء نزال جديد لرصد السكور وتقدير كمائن الخصوم فورياً.
                </div>
              )}
            </div>

            {/* Quick Investigation Launch Card */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
                  مقارنة حسابين سريعة
                </h3>
                <p className="text-xs text-secondaryText mt-1">
                  أدخل يوزر حسابين لتحليل التزامن الزمني، والسلوك التكتيكي، وتوزيع الهدايا فوراً.
                </p>

                <div className="space-y-3 mt-4">
                  <input
                    type="text"
                    placeholder="اسم الحساب الأول (Account A)..."
                    value={accountAInput}
                    onChange={(e) => setAccountAInput(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    placeholder="اسم الحساب الثاني (Account B)..."
                    value={accountBInput}
                    onChange={(e) => setAccountBInput(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <button
                onClick={() => handleRunComparison()}
                disabled={isComparing}
                className="w-full py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isComparing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                <span>بدء الفحص والمقارنة</span>
              </button>
            </div>
          </div>

          {/* Recent Radar Entries Table */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Radar className="w-4 h-4 text-cyan-400" />
                أحدث تنبيهات الرادار اللحظية
              </h3>
              <button
                onClick={() => setActiveTab("radar")}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                عرض كامل السجل ⬅️
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-2.5 px-3">الحساب المرصود</th>
                    <th className="py-2.5 px-3">فئة الرصد</th>
                    <th className="py-2.5 px-3">الخطورة</th>
                    <th className="py-2.5 px-3">موجز الرصد</th>
                    <th className="py-2.5 px-3">التوقيت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {overview.recentRadarAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-secondaryText">
                        لا توجد تنبيهات رادار مسجلة حتى الآن.
                      </td>
                    </tr>
                  ) : (
                    overview.recentRadarAlerts.slice(0, 5).map((alert) => (
                      <tr key={alert.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-3 font-semibold text-white">
                          {alert.displayName} <span className="text-slate-400 font-mono">(@{alert.username})</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            {alert.triggerCategory}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              alert.severity === "CRITICAL"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : alert.severity === "WARNING"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-sky-500/10 text-sky-300 border border-sky-500/20"
                            }`}
                          >
                            {alert.severity}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-secondaryText max-w-md truncate" title={alert.summaryText}>
                          {alert.summaryText}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                          {new Date(alert.createdAt).toLocaleTimeString("ar-SA", {
                            timeZone: "Asia/Riyadh",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REAL-TIME ENTRY RADAR */}
      {activeTab === "radar" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Controls Bar */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white">تصفية التنبيهات حسب الفئة:</span>
              <select
                value={radarFilterCategory}
                onChange={(e) => setRadarFilterCategory(e.target.value)}
                className="bg-white/5 border border-white/10 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none"
              >
                <option value="ALL" className="bg-slate-900">جميع الفئات</option>
                <option value="WATCHLIST_MATCH" className="bg-slate-900">قائمة المراقبة (Watchlist)</option>
                <option value="METADATA_CHANGE" className="bg-slate-900">تحول الهوية والأسماء</option>
                <option value="OPPONENT_SUPPORTER" className="bg-slate-900">داعمو الخصم بالنزالات</option>
                <option value="POTENTIAL_HANDOVER" className="bg-slate-900">تسلسل تعاقبي (Handover)</option>
                <option value="KNOWN_ACCOUNT_ENTRY" className="bg-slate-900">عودة كبار الداعمين</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-cyan-300 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30">
                {filteredRadarAlerts.length} تنبيه مطابق
              </span>
            </div>
          </div>

          {/* Alerts Feed */}
          <div className="space-y-3">
            {filteredRadarAlerts.length === 0 ? (
              <div className="p-12 text-center text-sm text-secondaryText rounded-3xl bg-slate-900/40 border border-white/10">
                لا توجد تنبيهات مطابقة للفئة المحددة حالياً.
              </div>
            ) : (
              filteredRadarAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-cyan-500/30 transition-all space-y-3 shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">
                        {alert.displayName}
                      </span>
                      <span className="text-xs font-mono text-cyan-400">
                        (@{alert.username})
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                        UID: {alert.platformUserId ? `***${alert.platformUserId.slice(-6)}` : "N/A"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          alert.severity === "CRITICAL"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : alert.severity === "WARNING"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-sky-500/10 text-sky-300 border border-sky-500/20"
                        }`}
                      >
                        {alert.severity}
                      </span>

                      <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(alert.createdAt).toLocaleString("ar-SA", {
                          timeZone: "Asia/Riyadh",
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed">
                    {alert.summaryText}
                  </p>

                  {/* Actions for this alert */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => {
                        setAccountAInput(alert.username);
                        setActiveTab("forensic-lab");
                      }}
                      className="px-3 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 text-[11px] font-bold transition-all"
                    >
                      إجراء مقارنة جنائية 🔬
                    </button>
                    <button
                      onClick={() => {
                        setNewWatchUser(alert.username);
                        setActiveTab("watchlists-evidence");
                      }}
                      className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] font-semibold transition-all"
                    >
                      إضافة للمراقبة 🎯
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: FORENSIC COMPARISON LAB */}
      {activeTab === "forensic-lab" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Top Account Selectors */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
              مختبر المقارنة الجنائية بين حسابين (Side-by-Side Forensic Analysis)
            </h3>
            <p className="text-xs text-secondaryText">
              قارن بين حسابين استناداً إلى المعرفات الثابتة، والتسلسل الزمني، وتفضيلات الهدايا، والتوزيع الساعي بتوقيت الرياض.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">الطرف الأول (Account A):</label>
                <input
                  type="text"
                  placeholder="اليوزر أو المعرف الثابت (SecUID)..."
                  value={accountAInput}
                  onChange={(e) => setAccountAInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">الطرف الثاني (Account B):</label>
                <input
                  type="text"
                  placeholder="اليوزر أو المعرف الثابت (SecUID)..."
                  value={accountBInput}
                  onChange={(e) => setAccountBInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Quick Preset Selector from existing Enigma and VIP data */}
            <div className="space-y-2 pt-2 border-t border-white/5 text-xs">
              <span className="text-[11px] font-bold text-slate-400">تحديد فوري من حسابات المنظومة:</span>
              
              {/* Enigma Unmasked Accounts */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  حسابات أنيقما المكشوفة 🎭:
                </span>
                {aliasHistories.slice(0, 5).map((ah) => (
                  <button
                    key={ah.id}
                    onClick={() => {
                      setAccountAInput(ah.newUsername);
                      setAccountBInput(ah.previousUsername || "");
                      handleRunComparison(ah.newUsername, ah.previousUsername || "");
                    }}
                    className="px-2 py-1 rounded bg-white/5 hover:bg-purple-500/20 text-slate-300 hover:text-purple-200 border border-white/10 text-[10px] font-mono transition-all flex items-center gap-1"
                    title="مقارنة فورية بين القناع والحساب المعتمد"
                  >
                    <span>@{ah.newUsername}</span>
                    <span className="text-purple-400">⚡</span>
                    <span className="text-slate-400">{ah.previousDisplayName}</span>
                  </button>
                ))}
              </div>

              {/* VIP Top Supporters */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  لوحة الشرف (+10K 💎):
                </span>
                {accounts.filter((a: AccountIdentityDTO) => a.totalDiamonds >= 10000).slice(0, 8).map((vip: AccountIdentityDTO) => (
                  <div key={vip.id} className="flex items-center rounded bg-white/5 border border-white/10 text-[10px] overflow-hidden">
                    <span className="px-1.5 py-0.5 text-slate-200 font-mono">@{vip.username}</span>
                    <button
                      onClick={() => setAccountAInput(vip.username)}
                      className="px-1 py-0.5 bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 font-bold border-r border-white/10"
                      title="تعيين كطرف أ"
                    >
                      أ
                    </button>
                    <button
                      onClick={() => setAccountBInput(vip.username)}
                      className="px-1 py-0.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 font-bold"
                      title="تعيين كطرف ب"
                    >
                      ب
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {comparisonError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold">
                {comparisonError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => handleRunComparison()}
                disabled={isComparing}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {isComparing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                <span>تنفيذ المقارنة الجنائية</span>
              </button>
            </div>
          </div>

          {/* Comparison Output HUD */}
          {comparisonResult && (
            <div className="space-y-6">
              {/* Mandatory Transparency & Legal Disclaimer Banner */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200 leading-relaxed">
                  <strong>مبدأ الإثبات المعتمد:</strong> {comparisonResult.synthesis.disclaimer}
                </div>
              </div>

              {/* Overall Similarity Score Card */}
              <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
                <div>
                  <span className="text-xs font-bold text-slate-400">الحكم والتقييم السلوكي المقترح:</span>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-3xl font-black font-mono text-cyan-300">
                      {comparisonResult.synthesis.overallSimilarityScore}%
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {comparisonResult.synthesis.suggestedVerdict}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      نطاق التوافق: {comparisonResult.synthesis.confidenceBand}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSendTelegramPdf("ENIGMA_COMPARISON_PDF")}
                    disabled={isSendingTelegram}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-xs font-bold transition-all"
                  >
                    <Send className="w-3.5 h-3.5 text-sky-300" />
                    <span>إرسال تقرير المقارنة كـ PDF لتليقرام</span>
                  </button>
                </div>
              </div>

              {/* Side-by-Side Profiles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Account A Profile */}
                <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center font-bold text-cyan-300">
                      {comparisonResult.accountA.displayName.slice(0, 1)}
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white">
                        {comparisonResult.accountA.displayName}
                      </h4>
                      <p className="text-xs font-mono text-cyan-400">
                        @{comparisonResult.accountA.username}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">المعرف الثابت:</span>
                      <span className="font-mono text-white">
                        {comparisonResult.accountA.platformUserId ? `***${comparisonResult.accountA.platformUserId.slice(-6)}` : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">إجمالي الدعم المسجل:</span>
                      <span className="font-mono font-bold text-amber-300">
                        {comparisonResult.accountA.totalDiamonds.toLocaleString()} 💎
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">أول ظهور:</span>
                      <span className="font-mono text-slate-300">{comparisonResult.accountA.firstObservedAt.slice(0, 10)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">آخر ظهور:</span>
                      <span className="font-mono text-slate-300">{comparisonResult.accountA.lastObservedAt.slice(0, 10)}</span>
                    </div>
                  </div>
                </div>

                {/* Account B Profile */}
                <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <div className="w-12 h-12 rounded-full bg-purple-500/20 border border-purple-400/40 flex items-center justify-center font-bold text-purple-300">
                      {comparisonResult.accountB.displayName.slice(0, 1)}
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white">
                        {comparisonResult.accountB.displayName}
                      </h4>
                      <p className="text-xs font-mono text-purple-400">
                        @{comparisonResult.accountB.username}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">المعرف الثابت:</span>
                      <span className="font-mono text-white">
                        {comparisonResult.accountB.platformUserId ? `***${comparisonResult.accountB.platformUserId.slice(-6)}` : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">إجمالي الدعم المسجل:</span>
                      <span className="font-mono font-bold text-amber-300">
                        {comparisonResult.accountB.totalDiamonds.toLocaleString()} 💎
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">أول ظهور:</span>
                      <span className="font-mono text-slate-300">{comparisonResult.accountB.firstObservedAt.slice(0, 10)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">آخر ظهور:</span>
                      <span className="font-mono text-slate-300">{comparisonResult.accountB.lastObservedAt.slice(0, 10)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Comparative Metrics (Temporal, Gifts, Circadian) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
                  <h5 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    التزامن والتعاقب الزمني
                  </h5>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">الجلسات المشتركة:</span>
                      <span className="font-mono text-white">{comparisonResult.temporal.sharedSessionsCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">أحداث متزامنة:</span>
                      <span className="font-mono text-white">{comparisonResult.temporal.simultaneousEventCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">حالات تعاقب (Handover):</span>
                      <span className="font-mono text-amber-300 font-bold">{comparisonResult.temporal.potentialHandoverEventsCount}</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
                  <h5 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-purple-400" />
                    توزيع الهدايا (Cosine)
                  </h5>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">مؤشر تشابه الهدايا:</span>
                      <span className="font-mono text-white font-bold">{comparisonResult.giftDistribution.cosineSimilarity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">متوسط قيمة الهدية A:</span>
                      <span className="font-mono text-amber-300">{comparisonResult.giftDistribution.avgGiftValueA.toLocaleString()} 💎</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">متوسط قيمة الهدية B:</span>
                      <span className="font-mono text-amber-300">{comparisonResult.giftDistribution.avgGiftValueB.toLocaleString()} 💎</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
                  <h5 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    التوافق الساعي بتوقيت الرياض
                  </h5>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">معامل الارتباط اليومي:</span>
                      <span className="font-mono text-white font-bold">{comparisonResult.circadian.correlationScore}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">ساعات ذروة A:</span>
                      <span className="font-mono text-slate-300">{comparisonResult.circadian.peakHoursA.map((h) => h + ":00").join(", ") || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">ساعات ذروة B:</span>
                      <span className="font-mono text-slate-300">{comparisonResult.circadian.peakHoursB.map((h) => h + ":00").join(", ") || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PK TACTICAL RADAR (ANTI-SNIPE) */}
      {activeTab === "tactical-radar" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Swords className="w-4 h-4 text-rose-400" />
                رادار النزالات وتنبؤ الكمائن التكتيكي (PK Anti-Snipe Tactical Radar)
              </h3>
              <p className="text-xs text-secondaryText mt-1">
                تحليل قدرة الخصم على العودة في الثواني الأخيرة، ورصد داعمي الخصم، واحتساب الفارق الآمن المطلوب.
              </p>
            </div>

            <button
              onClick={handleFetchTactical}
              disabled={isLoadingTactical}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTactical ? "animate-spin text-rose-400" : ""}`} />
              <span>تحديث بيانات النزال</span>
            </button>
          </div>

          {tacticalData?.prediction ? (
            <div className="space-y-6">
              {/* Tactical Gauge */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-3xl bg-slate-900/60 border border-rose-500/30 flex flex-col justify-between">
                  <span className="text-xs font-bold text-slate-300">مستوى تهديد الكمين اللحظي:</span>
                  <div className="my-3">
                    <span className="text-3xl font-black font-mono text-rose-400">
                      {tacticalData.prediction.threatLevel}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">
                      مؤشر الخطر: <strong>{tacticalData.prediction.snipeRiskScore}%</strong>
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    حالة الجولة: {tacticalData.isActive ? "🔴 جولة نشطة" : "سجل مرجعي"}
                  </span>
                </div>

                <div className="p-6 rounded-3xl bg-slate-900/60 border border-amber-500/30 flex flex-col justify-between">
                  <span className="text-xs font-bold text-slate-300">القوة النارية المتوقعة للخصم:</span>
                  <div className="my-3">
                    <span className="text-3xl font-black font-mono text-amber-300">
                      {tacticalData.prediction.estimatedSnipeFirepower.toLocaleString()} 💎
                    </span>
                    <p className="text-xs text-slate-400 mt-1">
                      تقدير الثواني الـ 15 الحاسمة
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">محسوبة من السجلات السابقة</span>
                </div>

                <div className="p-6 rounded-3xl bg-slate-900/60 border border-emerald-500/30 flex flex-col justify-between">
                  <span className="text-xs font-bold text-slate-300">الفارق الآمن الموصى به:</span>
                  <div className="my-3">
                    <span className="text-3xl font-black font-mono text-emerald-400">
                      +{tacticalData.prediction.safeLeadBufferRequired.toLocaleString()}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">
                      هامش الأمان لمنع الانقلاب
                    </p>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono">موصى به لحسم الجولة</span>
                </div>
              </div>

              {/* 5 Signals Breakdown */}
              <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4">
                <h4 className="text-sm font-bold text-white">تحليل الإشارات التكتيكية الخمس:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-300">قدرة الخصم التاريخية على العودة (25%):</span>
                      <span className="font-mono text-cyan-300">{tacticalData.prediction.signals.opponentComebackCapacity}%</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-300">تهديد داعمي فريق الخصم (35%):</span>
                      <span className="font-mono text-rose-300">{tacticalData.prediction.signals.opponentSupporterThreat}%</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-300">هشاشة الفارق الحالي وركود السكور (20%):</span>
                      <span className="font-mono text-amber-300">{tacticalData.prediction.signals.scoreStagnationExposure}%</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-300">جاهزية قفازات المضيف ومضاعفات الخصم (10%):</span>
                      <span className="font-mono text-purple-300">{tacticalData.prediction.signals.boostAvailabilityImpact}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-sm text-secondaryText rounded-3xl bg-slate-900/40 border border-white/10">
              انقر على «تحديث بيانات النزال» لاستدعاء أحدث تقييم تكتيكي للجولة الحالية.
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ENIGMA ANALYTICS & ALIAS HISTORY */}
      {activeTab === "enigma-analytics" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-purple-400" />
                سجل الهويات والتحولات التاريخية (Alias & SecUID Identity History)
              </h3>
              <p className="text-xs text-secondaryText mt-1">
                توثيق التغييرات المرصودة في أسماء المستخدمين والصور الشخصية للمعرفات الثابتة.
              </p>
            </div>
            <button
              onClick={handleDeepHistoricalAnalysis}
              disabled={isAnalyzingHistory}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/40 hover:to-blue-600/40 text-cyan-200 border border-cyan-500/40 text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
              title="فحص وتحليل أحداث كافة حسابات أنيقما تاريخياً عبر 154,360 حدث وقواعد البيانات"
            >
              <Activity className={`w-4 h-4 ${isAnalyzingHistory ? "animate-spin text-cyan-400" : "text-cyan-300"}`} />
              <span>{isAnalyzingHistory ? "جاري الفحص والتحليل التاريخي..." : "فحص وتحليل حسابات أنيقما تاريخياً 🔬"}</span>
            </button>
          </div>

          {/* Historical Deep Audit Results HUD (When Executed) */}
          {historicalAuditData && (
            <div className="space-y-4 p-6 rounded-3xl bg-slate-900/80 border border-cyan-500/30 shadow-2xl animate-in fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <h4 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    نتائج الفحص الجنائي المعماري لحسابات أنيقما ({historicalAuditData.totalAudited} حساباً)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    تحليل موثق ومطابق لقواعد البيانات وسجلات الأحداث المباشرة (RawEvents & Scores).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {historicalAuditData.sufficientDataCount} بيانات كافية
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    {historicalAuditData.verifiedUidCount} كشف قطعي SecUID
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {historicalAuditData.insufficientDataCount} بيانات غير كافية
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">المعرف الثابت</th>
                      <th className="py-2.5 px-3">قناع أنيقما</th>
                      <th className="py-2.5 px-3">الحساب المعتمد</th>
                      <th className="py-2.5 px-3">إجمالي الدعم</th>
                      <th className="py-2.5 px-3">الأحداث المحللة</th>
                      <th className="py-2.5 px-3">جلسات البث</th>
                      <th className="py-2.5 px-3">كفاية البيانات</th>
                      <th className="py-2.5 px-3">الحكم الجنائي</th>
                      <th className="py-2.5 px-3">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {historicalAuditData.results.map((res: any, idx: number) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 font-mono text-cyan-300">
                          {res.platformUserId ? `***${res.platformUserId.slice(-6)}` : "N/A"}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-purple-300">
                          {res.enigmaDisplayName}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-white">
                          @{res.realUsername}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                          {res.diamondsTotal.toLocaleString()} 💎
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-200">
                          {res.totalEventsAnalyzed} حدث
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">
                          {res.distinctSessionsCount} جلسات
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              res.dataSufficiency === "SUFFICIENT"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            }`}
                          >
                            {res.dataSufficiency === "SUFFICIENT" ? "بيانات كافية" : "بيانات غير كافية"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              res.verdictStatus === "VERIFIED_IDENTIFIER_MATCH"
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                : res.verdictStatus === "BEHAVIORAL_SIMILARITY"
                                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            }`}
                          >
                            {res.verdictStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => {
                              setAccountAInput(res.realUsername);
                              setAccountBInput(res.enigmaDisplayName);
                              setActiveTab("forensic-lab");
                              handleRunComparison(res.realUsername, res.enigmaDisplayName);
                            }}
                            className="px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold transition-all flex items-center gap-1"
                            title="مقارنة فورية في مختبر المقارنة الجنائية"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>مقارنة</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-2.5 px-3">المعرف الثابت</th>
                  <th className="py-2.5 px-3">نوع التحول</th>
                  <th className="py-2.5 px-3">الاسم السابق</th>
                  <th className="py-2.5 px-3">الاسم الجديد</th>
                  <th className="py-2.5 px-3">المصدر</th>
                  <th className="py-2.5 px-3">تاريخ الرصد</th>
                  <th className="py-2.5 px-3">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {aliasHistories.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-secondaryText">
                      لا توجد تحولات هوية مسجلة بعد.
                    </td>
                  </tr>
                ) : (
                  aliasHistories.map((h) => (
                    <tr key={h.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-3 font-mono text-cyan-300">
                        {h.platformUserId ? `***${h.platformUserId.slice(-6)}` : "N/A"}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {h.changeType}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        @{h.previousUsername || "لا يوجد"}
                      </td>
                      <td className="py-3 px-3 font-bold text-white">
                        @{h.newUsername}
                      </td>
                      <td className="py-3 px-3 text-slate-400">{h.source}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                        {new Date(h.observedAt).toLocaleDateString("ar-SA", {
                          timeZone: "Asia/Riyadh",
                        })}
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => {
                            setAccountAInput(h.newUsername);
                            setAccountBInput(h.previousUsername || "");
                            handleRunComparison(h.newUsername, h.previousUsername || "");
                          }}
                          className="px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold transition-all flex items-center gap-1"
                          title="مقارنة القناع بالهوية الحقيقية في مختبر المقارنة الجنائية"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>مقارنة</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: WATCHLISTS & EVIDENCE EXPLORER */}
      {activeTab === "watchlists-evidence" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Add to Watchlist Form */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyan-400" />
              إضافة حساب إلى قائمة المراقبة الاستخباراتية (Watchlist)
            </h3>

            <form onSubmit={handleAddWatchlist} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <input
                type="text"
                placeholder="اسم المستخدم (Username)..."
                value={newWatchUser}
                onChange={(e) => setNewWatchUser(e.target.value)}
                required
                className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <input
                type="text"
                placeholder="سبب الإدراج في المراقبة..."
                value={newWatchReason}
                onChange={(e) => setNewWatchReason(e.target.value)}
                required
                className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <select
                value={newWatchCategory}
                onChange={(e) => setNewWatchCategory(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              >
                <option value="SUSPECTED_ALT" className="bg-slate-900">اشتباه حساب بديل</option>
                <option value="RIVAL_SNIPER" className="bg-slate-900">قناص خصوم (Sniper)</option>
                <option value="HIGH_VALUE_OBSERVE" className="bg-slate-900">داعم ذو ثقل تكتيكي</option>
                <option value="CUSTOM" className="bg-slate-900">مراقبة مخصصة</option>
              </select>

              <button
                type="submit"
                disabled={isAddingWatchlist}
                className="py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isAddingWatchlist ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>إدراج في المراقبة</span>
              </button>
            </form>
          </div>

          {/* Active Watchlist Table */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>الحسابات المدرجة في المراقبة ({watchlist.length})</span>
              </h4>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  onClick={() => setWatchlistFilterCategory("ALL")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    watchlistFilterCategory === "ALL"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "bg-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  الكل ({watchlist.length})
                </button>
                <button
                  onClick={() => setWatchlistFilterCategory("VIP_HONOR_ROLL")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    watchlistFilterCategory === "VIP_HONOR_ROLL"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  لوحة الشرف (+10K 💎) ({watchlist.filter((w) => w.category === "VIP_HONOR_ROLL").length})
                </button>
                <button
                  onClick={() => setWatchlistFilterCategory("ENIGMA_ORIGIN")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    watchlistFilterCategory === "ENIGMA_ORIGIN"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                      : "bg-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  حسابات أنيقما 🎭 ({watchlist.filter((w) => w.category === "ENIGMA_ORIGIN").length})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-2.5 px-3">اسم المستخدم</th>
                    <th className="py-2.5 px-3">السبب ومصدر الرصد</th>
                    <th className="py-2.5 px-3">التصنيف</th>
                    <th className="py-2.5 px-3">الخطورة</th>
                    <th className="py-2.5 px-3">تاريخ الإدراج</th>
                    <th className="py-2.5 px-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {watchlist.filter((w) => {
                    if (watchlistFilterCategory === "ALL") return true;
                    return w.category === watchlistFilterCategory;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-secondaryText">
                        لا توجد حسابات مطابقة للتصنيف المحدد حالياً.
                      </td>
                    </tr>
                  ) : (
                    watchlist
                      .filter((w) => {
                        if (watchlistFilterCategory === "ALL") return true;
                        return w.category === watchlistFilterCategory;
                      })
                      .map((w) => (
                        <tr key={w.id} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-3 font-bold text-white">
                            <div className="flex flex-col">
                              <span>@{w.username}</span>
                              {w.displayName && (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  {w.displayName}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-secondaryText max-w-xs">{w.reason}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-slate-300">
                              {w.category}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                w.severity === "CRITICAL"
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                  : w.severity === "WARNING"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : "bg-cyan-500/20 text-cyan-300"
                              }`}
                            >
                              {w.severity}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                            {new Date(w.createdAt).toLocaleDateString("ar-SA", {
                              timeZone: "Asia/Riyadh",
                            })}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setAccountAInput(w.username);
                                  setActiveTab("forensic-lab");
                                }}
                                className="px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold transition-all flex items-center gap-1"
                                title="إجراء مقارنة جنائية"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>مقارنة</span>
                              </button>
                              <button
                                onClick={() => handleDeleteWatchlist(w.id)}
                                className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                                title="إلغاء المراقبة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: SETTINGS */}
      {activeTab === "settings" && settings && (
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-6 animate-in fade-in max-w-3xl">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              إعدادات معمل الاستخبارات وضوابط الرادار
            </h3>
            <p className="text-xs text-secondaryText mt-1">
              تخصيص قواعد الرصد التلقائي، وتنبيهات تليقرام، وفترات التهدئة وحساسية التنبؤ.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <div>
                <span className="text-xs font-bold text-white block">تفعيل رادار الدخول اللحظي (Radar Engine)</span>
                <span className="text-[11px] text-secondaryText">رصد ومطابقة الحسابات الداخلة في الذاكرة بدون تأخير</span>
              </div>
              <input
                type="checkbox"
                checked={settings.radarEnabled}
                onChange={(e) => setSettings({ ...settings, radarEnabled: e.target.checked })}
                className="w-4 h-4 accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <div>
                <span className="text-xs font-bold text-white block">إرسال تنبيهات الرادار إلى تليقرام</span>
                <span className="text-[11px] text-secondaryText">إشعار فوري عند رصد حساب مراقب أو تحول في الهوية العلنية</span>
              </div>
              <input
                type="checkbox"
                checked={settings.telegramRadarAlerts}
                onChange={(e) => setSettings({ ...settings, telegramRadarAlerts: e.target.checked })}
                className="w-4 h-4 accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <div>
                <span className="text-xs font-bold text-white block">تنبيه عند رصد داعمي الخصوم بالنزالات</span>
                <span className="text-[11px] text-secondaryText">كشف الحسابات المسجلة لصالح الخصوم بالتزامن مع الجولة</span>
              </div>
              <input
                type="checkbox"
                checked={settings.notifyOpponentSupporters}
                onChange={(e) => setSettings({ ...settings, notifyOpponentSupporters: e.target.checked })}
                className="w-4 h-4 accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white">فترة التهدئة بين التنبيهات للحساب الواحد (Cooldown):</span>
                <span className="font-mono text-cyan-300">{settings.cooldownMinutes} دقيقة</span>
              </div>
              <input
                type="range"
                min="5"
                max="120"
                step="5"
                value={settings.cooldownMinutes}
                onChange={(e) => setSettings({ ...settings, cooldownMinutes: Number(e.target.value) })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white">الحد الأدنى لخطر الكمائن لإطلاق تنبيه (Anti-Snipe Threshold):</span>
                <span className="font-mono text-rose-300">{settings.minTacticalRiskAlert}%</span>
              </div>
              <input
                type="range"
                min="30"
                max="95"
                step="5"
                value={settings.minTacticalRiskAlert}
                onChange={(e) => setSettings({ ...settings, minTacticalRiskAlert: Number(e.target.value) })}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
            >
              {isSavingSettings ? "جاري الحفظ..." : "حفظ الإعدادات"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
