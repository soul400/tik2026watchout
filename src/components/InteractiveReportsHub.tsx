"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Download,
  Eye,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Swords,
  Crown,
  Backpack,
  Activity,
  Clock,
  Scale,
  Printer,
  Sparkles,
  TrendingUp,
  Fingerprint,
  Package,
  Zap,
  XCircle,
  Users,
  BarChart2,
  Flame,
  Gift,
  Trophy,
  Send,
} from "lucide-react";

export interface ReportDefinition {
  type: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  category: "operations" | "battles" | "finance" | "governance";
}

const CANONICAL_REPORTS: ReportDefinition[] = [
  {
    type: "LIVE_SESSION_SUMMARY",
    title: "ملخص جلسات البث المباشر",
    description: "جولات السوبر (+100K) في 1v1 و 2v2، حصر مضاعفات الهدايا (Lion × 5)، وتحليل سجل أكثر المنافسين خوضاً للجولات مع فلترة اليوم والأسبوع.",
    icon: Calendar,
    color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400",
    category: "operations",
  },
  {
    type: "DAILY_OPERATIONS_SUMMARY",
    title: "ملخص العمليات اليومية المجمعة",
    description: "إحصاءات شاملة ومجمعة لأداء البث يومياً مع نسب النمو والحضور وساعات البث.",
    icon: TrendingUp,
    color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400",
    category: "operations",
  },
  {
    type: "COMMUNITY_CHAMPIONS",
    title: "أبطال المجتمع والتفاعل الطبيعي",
    description: "قائمة كبار المتفاعلين والركائز الأساسية، مستندة حصرياً للتفاعل دون الهدايا.",
    icon: Crown,
    color: "from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400",
    category: "finance",
  },
  {
    type: "BATTLE_POST_MATCH",
    title: "تحليل ما بعد النزالات (PK Post-Match)",
    description: "سجل نتائج المعارك 1v1 و 2v2 ونقاط الجولات والفوارق التكتيكية ونسب الفوز.",
    icon: Swords,
    color: "from-rose-500/20 to-rose-600/10 border-rose-500/30 text-rose-400",
    category: "battles",
  },
  {
    type: "TACTICAL_INVENTORY_AUDIT",
    title: "تدقيق المستودع التكتيكي والدفتر الذكي 2.0",
    description: "حركات دفتر الأستاذ، القفازات الممنوحة والمستهلكة، ومطابقة القيود المزدوجة.",
    icon: Backpack,
    color: "from-purple/20 to-purple/10 border-purple/30 text-purple",
    category: "governance",
  },
  {
    type: "STREAM_HEALTH_INCIDENT",
    title: "سجل أحداث وصحة البث والنبضات",
    description: "تتبع أزمنة المعالجة (Latency)، انقطاعات الاتصال، وحالات النظام اللحظية.",
    icon: Activity,
    color: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400",
    category: "operations",
  },
  {
    type: "STQI_TIMING_REPORT",
    title: "مؤشر التوقيت والإيقاع الذكي (STQI)",
    description: "تحديد أفضل 3 فترات للبث من حيث الدعم المالي، ومعدلات جودة الساعات بتوقيت الرياض لفتح الجولات التكتيكية.",
    icon: Clock,
    color: "from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 text-indigo-400",
    category: "battles",
  },
  {
    type: "DATA_QUALITY_RECONCILIATION",
    title: "مطابقة جودة البيانات والتدقيق المحاسبي",
    description: "فحص التوازن المحاسبي بين المدخلات والمخرجات ومنع التناقضات والفروقات.",
    icon: Scale,
    color: "from-teal-500/20 to-teal-600/10 border-teal-500/30 text-teal-400",
    category: "governance",
  },
  {
    type: "ENIGMA_UNMASKED_ANALYSIS",
    title: "كشف الحسابات الغامضة (تطابق قطعي SecUID)",
    description: "كشف الهويات الحقيقية لحسابات الأقنعة حصرياً عبر المعرف التقني الثابت (SecUID) بنسبة 100%.",
    icon: Fingerprint,
    color: "from-fuchsia-500/20 to-fuchsia-600/10 border-fuchsia-500/30 text-fuchsia-400",
    category: "governance",
  },
  {
    type: "SUPPORTER_PRESENCE_PATTERN",
    title: "تقرير نمط تواجد الداعمين",
    description: "تحليل أوقات ظهور الداعمين المهمين، وأنماط حضورهم خلال أيام الأسبوع، ومتوسط مدة جلساتهم المرصودة.",
    icon: Clock,
    color: "from-violet-500/20 to-purple-600/10 border-violet-500/30 text-violet-400",
    category: "operations",
  },
];

export function InteractiveReportsHub({ tenantId }: { tenantId: string }) {
  const [selectedReport, setSelectedReport] = useState<string>("LIVE_SESSION_SUMMARY");
  const [previewData, setPreviewData] = useState<{
    headers: string[];
    rows: any[];
    kpis?: any[];
    superBattles?: any[];
    giftBreakdown?: any[];
    topRivals?: any[];
    matchCards?: any[];
    periodLabel?: string;
    executiveSummary?: string;
    recommendations?: string[];
  } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [presenceThreshold, setPresenceThreshold] = useState<number>(100000);
  const [activeSupporterIdx, setActiveSupporterIdx] = useState<number>(0);

  // Date Filtering States for Live Session Summary & Battle Post Match
  const [sessionPeriodPreset, setSessionPeriodPreset] = useState<string>("today");
  const [sessionCustomDate, setSessionCustomDate] = useState<string>("");
  const [battleMinHostScore, setBattleMinHostScore] = useState<number>(0);

  const handlePreview = async (
    reportType: string,
    customThreshold?: number,
    overridePeriod?: string,
    overrideDate?: string,
    overrideMinHostScore?: number
  ) => {
    setSelectedReport(reportType);
    setIsPreviewLoading(true);
    setPreviewError(null);

    const thresholdToUse = customThreshold !== undefined ? customThreshold : presenceThreshold;
    const periodToUse = overridePeriod !== undefined ? overridePeriod : sessionPeriodPreset;
    const dateToUse = overrideDate !== undefined ? overrideDate : sessionCustomDate;
    const minHostScoreToUse = overrideMinHostScore !== undefined ? overrideMinHostScore : battleMinHostScore;

    try {
      let url = `/api/reports/export?type=${reportType}&format=json&tenantId=${tenantId}`;
      if (reportType === "SUPPORTER_PRESENCE_PATTERN") {
        url += `&threshold=${thresholdToUse}`;
      } else if (reportType === "LIVE_SESSION_SUMMARY" || reportType === "BATTLE_POST_MATCH") {
        if (periodToUse && periodToUse !== "custom") {
          url += `&periodPreset=${periodToUse}`;
        }
        if (periodToUse === "custom" && dateToUse) {
          url += `&date=${encodeURIComponent(dateToUse)}`;
        }
        if (reportType === "BATTLE_POST_MATCH" && minHostScoreToUse > 0) {
          url += `&minHostScore=${minHostScoreToUse}`;
        }
      }

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "فشل تحميل معاينة التقرير");
      }
      setPreviewData({
        headers: data.report.headers || [],
        rows:
          reportType === "TACTICAL_INVENTORY_AUDIT"
            ? (data.report.rows || []).slice(0, 20)
            : reportType === "SUPPORTER_PRESENCE_PATTERN"
            ? data.report.rows || []
            : reportType === "STQI_TIMING_REPORT"
            ? data.report.rows || []
            : reportType === "LIVE_SESSION_SUMMARY"
            ? data.report.rows || []
            : reportType === "BATTLE_POST_MATCH"
            ? data.report.rows || []
            : (data.report.rows || []).slice(0, 5),
        kpis: data.report.kpis || [],
        superBattles: data.report._superBattles || [],
        giftBreakdown: data.report._giftBreakdown || [],
        topRivals: data.report._topRivals || [],
        matchCards: data.report._matchCards || [],
        periodLabel: data.report._periodLabel || data.report.metadata?.periodLabel,
        executiveSummary: data.report.executiveSummary,
        recommendations: data.report.recommendations,
      });
      setActiveSupporterIdx(0);
    } catch (err: any) {
      setPreviewError(err.message || "حدث خطأ أثناء تحميل المعاينة.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleDownload = (
    reportType: string,
    format: "csv" | "json",
    overridePeriod?: string,
    overrideDate?: string,
    overrideMinHostScore?: number
  ) => {
    let url = `/api/reports/export?type=${reportType}&format=${format}&tenantId=${tenantId}`;
    if (reportType === "SUPPORTER_PRESENCE_PATTERN") {
      url += `&threshold=${presenceThreshold}`;
    } else if (reportType === "LIVE_SESSION_SUMMARY" || reportType === "BATTLE_POST_MATCH") {
      const periodToUse = overridePeriod !== undefined ? overridePeriod : sessionPeriodPreset;
      const dateToUse = overrideDate !== undefined ? overrideDate : sessionCustomDate;
      const minHostScoreToUse = overrideMinHostScore !== undefined ? overrideMinHostScore : battleMinHostScore;
      if (periodToUse && periodToUse !== "custom") {
        url += `&periodPreset=${periodToUse}`;
      }
      if (periodToUse === "custom" && dateToUse) {
        url += `&date=${encodeURIComponent(dateToUse)}`;
      }
      if (reportType === "BATTLE_POST_MATCH" && minHostScoreToUse > 0) {
        url += `&minHostScore=${minHostScoreToUse}`;
      }
    }
    window.open(url, "_blank");
  };

  const handleOpenPdf = (
    reportType: string,
    autoPrint = true,
    overridePeriod?: string,
    overrideDate?: string,
    overrideMinHostScore?: number
  ) => {
    let url = `/reports/pdf?type=${reportType}&tenantId=${tenantId}${autoPrint ? "&autoPrint=true" : ""}`;
    if (reportType === "SUPPORTER_PRESENCE_PATTERN") {
      url += `&threshold=${presenceThreshold}`;
    } else if (reportType === "LIVE_SESSION_SUMMARY" || reportType === "BATTLE_POST_MATCH") {
      const periodToUse = overridePeriod !== undefined ? overridePeriod : sessionPeriodPreset;
      const dateToUse = overrideDate !== undefined ? overrideDate : sessionCustomDate;
      const minHostScoreToUse = overrideMinHostScore !== undefined ? overrideMinHostScore : battleMinHostScore;
      if (periodToUse && periodToUse !== "custom") {
        url += `&periodPreset=${periodToUse}`;
      }
      if (periodToUse === "custom" && dateToUse) {
        url += `&date=${encodeURIComponent(dateToUse)}`;
      }
      if (reportType === "BATTLE_POST_MATCH" && minHostScoreToUse > 0) {
        url += `&minHostScore=${minHostScoreToUse}`;
      }
    }
    window.open(url, "_blank");
  };

  const [sendingTelegramReport, setSendingTelegramReport] = useState<string | null>(null);
  const [telegramFeedback, setTelegramFeedback] = useState<{
    reportType: string;
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleSendTelegramPdf = async (
    reportType: string,
    overridePeriod?: string,
    overrideDate?: string,
    overrideMinHostScore?: number
  ) => {
    setSendingTelegramReport(reportType);
    setTelegramFeedback(null);

    const periodToUse = overridePeriod !== undefined ? overridePeriod : sessionPeriodPreset;
    const dateToUse = overrideDate !== undefined ? overrideDate : sessionCustomDate;
    const minHostScoreToUse = overrideMinHostScore !== undefined ? overrideMinHostScore : battleMinHostScore;

    try {
      const res = await fetch("/api/reports/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          reportType,
          periodPreset: periodToUse,
          date: dateToUse,
          threshold: reportType === "SUPPORTER_PRESENCE_PATTERN" ? presenceThreshold : undefined,
          minHostScore: reportType === "BATTLE_POST_MATCH" ? minHostScoreToUse : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "فشل إرسال تقرير الـ PDF إلى تليقرام");
      }

      setTelegramFeedback({
        reportType,
        type: "success",
        message: `تم إرسال تقرير الـ PDF بنجاح إلى تليقرام (${data.filename || ""}) 🚀`,
      });

      setTimeout(() => {
        setTelegramFeedback((prev) => (prev?.reportType === reportType ? null : prev));
      }, 7000);
    } catch (err: any) {
      setTelegramFeedback({
        reportType,
        type: "error",
        message: err.message || "حدث خطأ أثناء إرسال تقرير الـ PDF إلى تليقرام.",
      });
    } finally {
      setSendingTelegramReport(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Grid of 8 Canonical Reports */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">مركز التقارير المعتمدة والمطابقة (Certified Reports Hub)</h3>
              <span className="text-[10px] font-bold text-rose-300 bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/30">
                PDF تنفيذي متاح
              </span>
            </div>
            <p className="text-xs text-secondaryText">
              تقارير تنفيذية شاملة ومترجمة بالعربي، جاهزة للطباعة والتصدير كملفات PDF رسمية متجهة عالية الدقة ومطابقة للمعايير المحاسبية
            </p>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5 self-start sm:self-auto">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            جاهزية PDF بنسبة 100%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {CANONICAL_REPORTS.map((rep) => {
            const Icon = rep.icon;
            const isSelected = selectedReport === rep.type;

            return (
              <div
                key={rep.type}
                className={`bg-surface rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                  isSelected ? "border-turquoise shadow-lg shadow-turquoise/10" : "border-white/5 hover:border-white/20"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${rep.color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono text-secondaryText uppercase tracking-wider">
                      {rep.category}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-white">{rep.title}</h4>
                    <p className="text-xs text-secondaryText leading-relaxed mt-1 line-clamp-2">
                      {rep.description}
                    </p>
                  </div>
                </div>

                {/* Specific Date Filter Selector for Live Session Summary and Battle Post-Match Reports */}
                {(rep.type === "LIVE_SESSION_SUMMARY" || rep.type === "BATTLE_POST_MATCH") && (
                  <div className="bg-white/[0.03] border border-blue-500/25 rounded-xl p-2.5 mt-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-secondaryText font-medium">نطاق البث الزمني:</span>
                      <span className="text-blue-300 font-mono font-bold">
                        {sessionPeriodPreset === "today"
                          ? "اليوم"
                          : sessionPeriodPreset === "yesterday"
                          ? "أمس"
                          : sessionPeriodPreset === "this_week"
                          ? "هذا الأسبوع"
                          : sessionPeriodPreset === "all"
                          ? "كامل السجل"
                          : sessionCustomDate || "تاريخ محدد"}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { label: "اليوم", value: "today" },
                        { label: "أمس", value: "yesterday" },
                        { label: "الأسبوع", value: "this_week" },
                        { label: "الكل", value: "all" },
                      ].map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionPeriodPreset(preset.value);
                            setSessionCustomDate("");
                            if (selectedReport === rep.type) {
                              handlePreview(rep.type, undefined, preset.value, "");
                            }
                          }}
                          className={`py-1 rounded text-[10px] font-bold transition-all ${
                            sessionPeriodPreset === preset.value && !sessionCustomDate
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-white/5 text-secondaryText hover:text-white hover:bg-white/10"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
                      <span className="text-[10px] text-secondaryText shrink-0">تاريخ محدد:</span>
                      <input
                        type="date"
                        value={sessionCustomDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSessionCustomDate(val);
                          setSessionPeriodPreset("custom");
                          if (val && selectedReport === rep.type) {
                            handlePreview(rep.type, undefined, "custom", val);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-surface text-white text-[10px] font-mono px-2 py-0.5 rounded border border-white/10 focus:border-blue-400 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Specific Min Host Score Selector for Battle Post-Match Report */}
                {rep.type === "BATTLE_POST_MATCH" && (
                  <div className="bg-white/[0.03] border border-amber-500/20 rounded-xl p-2.5 mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-secondaryText font-medium">الحد الأدنى لسكور المضيف:</span>
                      <span className="text-amber-300 font-mono font-bold">
                        {battleMinHostScore > 0 ? `💎 ${battleMinHostScore.toLocaleString("en-US")}` : "الكل (0)"}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[0, 1000, 10000, 50000, 100000].map((sc) => (
                        <button
                          key={sc}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBattleMinHostScore(sc);
                            if (selectedReport === rep.type) {
                              handlePreview(rep.type, undefined, undefined, undefined, sc);
                            }
                          }}
                          className={`py-1 rounded text-[10px] font-mono font-bold transition-all ${
                            battleMinHostScore === sc
                              ? "bg-amber-500 text-slate-950 shadow-sm"
                              : "bg-white/5 text-secondaryText hover:text-white hover:bg-white/10"
                          }`}
                        >
                          {sc === 0 ? "الكل" : sc >= 1000000 ? `${sc / 1000000}M` : `${sc / 1000}k`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Specific Threshold Selector for Presence Pattern Report */}
                {rep.type === "SUPPORTER_PRESENCE_PATTERN" && (
                  <div className="bg-white/[0.03] border border-violet-500/20 rounded-xl p-2.5 mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-secondaryText font-medium">الحد الأدنى للدعم:</span>
                      <span className="text-amber-300 font-mono font-bold">💎 {presenceThreshold.toLocaleString("en-US")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[10000, 50000, 100000, 250000, 500000].map((th) => (
                        <button
                          key={th}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPresenceThreshold(th);
                          }}
                          className={`flex-1 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                            presenceThreshold === th
                              ? "bg-violet-500 text-white shadow-sm"
                              : "bg-white/5 text-secondaryText hover:text-white hover:bg-white/10"
                          }`}
                        >
                          {th >= 1000000 ? `${th / 1000000}M` : `${th / 1000}k`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 mt-4 border-t border-white/5 space-y-2">
                  {/* Primary Actions: Official PDF Report & Telegram Send */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenPdf(rep.type, true)}
                      className="flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-red-600/25 via-rose-600/25 to-amber-600/25 hover:from-red-600/40 hover:to-amber-600/40 text-rose-200 hover:text-white rounded-xl text-xs font-bold border border-rose-500/30 transition-all shadow-sm"
                      title="فتح التقرير كوثيقة PDF تنفيذية بالعربي مع إمكانية الحفظ والطباعة"
                    >
                      <Printer className="w-3.5 h-3.5 text-rose-400" />
                      <span>طباعة PDF</span>
                    </button>

                    <button
                      onClick={() => handleSendTelegramPdf(rep.type)}
                      disabled={sendingTelegramReport === rep.type}
                      className="flex items-center justify-center gap-1.5 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 hover:text-white rounded-xl text-xs font-bold border border-sky-500/30 transition-all shadow-sm disabled:opacity-50"
                      title="إرسال التقرير فورياً كملف PDF رسمي إلى قناة أو محادثة تليقرام المعتمدة"
                    >
                      {sendingTelegramReport === rep.type ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-300" />
                      ) : (
                        <Send className="w-3.5 h-3.5 text-sky-300" />
                      )}
                      <span>{sendingTelegramReport === rep.type ? "جاري الإرسال..." : "تليقرام PDF"}</span>
                    </button>
                  </div>

                  {/* Inline Telegram feedback notice */}
                  {telegramFeedback?.reportType === rep.type && (
                    <div
                      className={`text-[10px] p-2 rounded-lg font-medium border ${
                        telegramFeedback.type === "success"
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                          : "bg-rose-500/15 border-rose-500/30 text-rose-300"
                      }`}
                    >
                      {telegramFeedback.message}
                    </div>
                  )}

                  {/* Secondary Actions: Preview & Formats */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePreview(rep.type)}
                      disabled={isPreviewLoading && selectedReport === rep.type}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold border border-white/10 transition-colors"
                    >
                      {isPreviewLoading && selectedReport === rep.type ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-turquoise" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-turquoise" />
                      )}
                      <span>معاينة</span>
                    </button>

                    <button
                      onClick={() => handleDownload(rep.type, "csv")}
                      title="تحميل كملف إكسل CSV"
                      className="flex items-center justify-center p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold border border-emerald-500/20 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDownload(rep.type, "json")}
                      title="تحميل كملف JSON"
                      className="flex items-center justify-center p-2 bg-purple/10 hover:bg-purple/20 text-purple rounded-lg text-xs font-semibold border border-purple/20 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Instant Preview Section */}
      {previewData && (
        selectedReport === "LIVE_SESSION_SUMMARY" ? (
          <div className="hud-deck rounded-3xl p-6 md:p-8 relative overflow-hidden animate-in fade-in duration-200 space-y-6">
            {/* Ambient Atmosphere Glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header Deck */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/10 relative z-10">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-lg shadow-blue-500/10">
                  <Calendar className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg md:text-xl font-black text-white tracking-tight">
                      ملخص جلسات البث المباشر (Live Session Summary)
                    </h3>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      LIVE PULSE
                    </span>
                  </div>
                  <p className="text-xs text-secondaryText mt-1 max-w-2xl leading-relaxed">
                    نطاق التحليل: <strong className="text-blue-300">{previewData.periodLabel || "كامل السجل"}</strong> • أقوى الجولات الماسية (+100K)، حصر مضاعفات الهدايا (Lion × 5)، وسجل أكثر المنافسين خوضاً للجولات.
                  </p>
                </div>
              </div>

              {/* Direct Export Actions */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={() => handleOpenPdf("LIVE_SESSION_SUMMARY", true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-red-600/30 to-amber-600/30 hover:from-red-600/40 hover:to-amber-600/40 text-rose-200 border border-rose-500/40 text-xs font-bold transition-all shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 text-rose-300" />
                  <span>PDF رسمي معتمد</span>
                </button>

                <button
                  onClick={() => handleSendTelegramPdf("LIVE_SESSION_SUMMARY")}
                  disabled={sendingTelegramReport === "LIVE_SESSION_SUMMARY"}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                  title="إرسال تقرير PDF مباشرة إلى تليقرام"
                >
                  {sendingTelegramReport === "LIVE_SESSION_SUMMARY" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-300" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-sky-300" />
                  )}
                  <span>إرسال PDF لتليقرام</span>
                </button>

                <button
                  onClick={() => handleDownload("LIVE_SESSION_SUMMARY", "csv")}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير CSV</span>
                </button>
              </div>
            </div>

            {/* Interactive Live Date Filter Bar */}
            <div className="bg-white/[0.03] border border-blue-500/25 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="text-blue-400">📅</span>
                    تغيير نطاق التاريخ للبث المطلوب:
                  </span>
                  <span className="text-xs font-mono font-black text-blue-300 bg-blue-500/15 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                    {previewData.periodLabel || "تاريخ محدد"}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {previewData.rows.length} جولة مرصودة
                  </span>
                </div>
                <p className="text-[11px] text-secondaryText">
                  اختر يوم محدد أو استعرض كامل الأسبوع أو السجل ليتم تحديث الأرقام والجداول فوراً
                </p>
              </div>

              {/* Quick Presets & Date Input */}
              <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">
                {[
                  { label: "اليوم", value: "today" },
                  { label: "أمس", value: "yesterday" },
                  { label: "هذا الأسبوع", value: "this_week" },
                  { label: "كامل السجل", value: "all" },
                ].map((preset) => {
                  const isSelected = sessionPeriodPreset === preset.value && !sessionCustomDate;
                  return (
                    <button
                      key={preset.value}
                      onClick={() => {
                        setSessionPeriodPreset(preset.value);
                        setSessionCustomDate("");
                        handlePreview("LIVE_SESSION_SUMMARY", undefined, preset.value, "");
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400"
                          : "bg-surface border border-white/10 text-secondaryText hover:text-white hover:border-white/20"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}

                <div className="flex items-center gap-1.5 bg-surface px-2.5 py-1 rounded-xl border border-white/10">
                  <span className="text-[10px] text-secondaryText">يوم محدد:</span>
                  <input
                    type="date"
                    value={sessionCustomDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSessionCustomDate(val);
                      setSessionPeriodPreset("custom");
                      if (val) {
                        handlePreview("LIVE_SESSION_SUMMARY", undefined, "custom", val);
                      }
                    }}
                    className="bg-transparent text-white text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 4 Executive KPI Cards */}
            {previewData.kpis && previewData.kpis.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
                {previewData.kpis.map((kpi: any, kIdx: number) => {
                  const borderColors: Record<string, string> = {
                    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
                    cyan: "border-sky-500/30 bg-sky-500/10 text-sky-300",
                    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                    purple: "border-purple-500/30 bg-purple-500/10 text-purple-300",
                    rose: "border-rose-500/30 bg-rose-500/10 text-rose-300",
                  };
                  const colorClass = borderColors[kpi.color || "amber"] || borderColors.amber;
                  return (
                    <div key={kIdx} className={`p-4 rounded-2xl border ${colorClass} flex flex-col justify-between shadow-xs`}>
                      <span className="text-[11px] font-semibold text-slate-300">{kpi.label}</span>
                      <span className="text-base sm:text-xl font-black font-mono my-1 text-white truncate" title={kpi.value}>
                        {kpi.value}
                      </span>
                      {kpi.subtext && <span className="text-[10px] text-slate-400 font-mono truncate">{kpi.subtext}</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3 SPECIALIZED DECKS */}
            <div className="space-y-4 relative z-10">
              {/* 1. Super Battles (+100K) Deck */}
              {previewData.superBattles && previewData.superBattles.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                        <Flame className="w-4 h-4 text-amber-400" />
                      </div>
                      <h4 className="text-sm font-black text-white">
                        أقوى جولات تخطى فيها الدعم 100 ألف ماسة (1v1 و 2v2):
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                      {previewData.superBattles.length} جولة سوبر موثقة
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {previewData.superBattles.map((sb: any, sbIdx: number) => {
                      const isHostWin = sb.outcome?.includes("فوز المضيف");
                      return (
                        <div
                          key={sbIdx}
                          className="bg-surface/80 p-3.5 rounded-xl border border-amber-500/20 shadow-sm flex flex-col justify-between hover:border-amber-500/40 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-white truncate max-w-[200px]" title={sb.opponentsText}>
                              ضد: {sb.opponentsText}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${
                                sb.battleType === "2V2"
                                  ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                  : "bg-sky-500/20 text-sky-300 border-sky-500/30"
                              }`}
                            >
                              {sb.battleType}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-2 border-y border-white/5 text-xs font-mono">
                            <div>
                              <span className="text-[10px] text-secondaryText block">دعم المضيف</span>
                              <span className="font-black text-amber-300">
                                💎 {sb.hostScore.toLocaleString("en-US")}
                              </span>
                            </div>
                            <div className="text-left">
                              <span className="text-[10px] text-secondaryText block">دعم الخصم</span>
                              <span className="font-bold text-slate-300">
                                💎 {sb.oppScore.toLocaleString("en-US")}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 text-[11px]">
                            <span className="text-secondaryText font-mono text-[10px]">
                              {sb.startedAtFormatted}
                            </span>
                            <span
                              className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                                isHostWin
                                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                  : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                              }`}
                            >
                              {sb.outcome}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Gift Inventory Breakdown Deck (Lion x5, Rose x6314, etc.) */}
              {previewData.giftBreakdown && previewData.giftBreakdown.length > 0 && (
                <div className="bg-purple-500/5 border border-purple-500/25 rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                        <Gift className="w-4 h-4 text-purple-400" />
                      </div>
                      <h4 className="text-sm font-black text-white">
                        الهدايا الكبرى المرصودة في البث (10,000 ماسة فأكثر - حصراً للمضيفة @mohra.2000):
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-medium text-purple-300">
                      {previewData.giftBreakdown.length} صنف حصري (+10K)
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {previewData.giftBreakdown.map((g: any, gIdx: number) => (
                      <span
                        key={gIdx}
                        className="inline-flex items-center gap-1.5 text-xs font-mono font-bold bg-surface/90 text-purple-200 px-3 py-1.5 rounded-xl border border-purple-500/25 shadow-xs hover:border-purple-400 transition-colors"
                      >
                        <span className="text-purple-400">✨</span>
                        {g.formattedMultiplier}
                        <span className="text-[10px] text-secondaryText">
                          ({g.totalDiamonds?.toLocaleString("en-US")} 💎)
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Top Rivalries Deck */}
              {previewData.topRivals && previewData.topRivals.length > 0 && (
                <div className="bg-sky-500/5 border border-sky-500/25 rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                        <Trophy className="w-4 h-4 text-sky-400" />
                      </div>
                      <h4 className="text-sm font-black text-white">
                        أكثر المنافسين خوضاً للجولات (Rivalry & Match Record):
                      </h4>
                    </div>
                    <span className="text-xs font-mono text-secondaryText">
                      ترتيب حسب تكرار المواجهات
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {previewData.topRivals.map((riv: any, rivIdx: number) => (
                      <div
                        key={rivIdx}
                        className="bg-surface/80 p-3.5 rounded-xl border border-sky-500/20 shadow-xs flex flex-col justify-between"
                      >
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center font-bold text-sky-300 text-xs shrink-0">
                            {(riv.displayName || riv.username || "U").charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <span className="font-bold text-white text-xs block truncate" title={riv.displayName || riv.username}>
                              {riv.displayName || riv.username}
                            </span>
                            {riv.displayName && riv.displayName !== riv.username && (
                              <span className="text-[10px] text-secondaryText block truncate">@{riv.username}</span>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                          <span className="font-bold text-sky-300">{riv.totalBattles} جولة</span>
                          <span className="text-emerald-400 font-bold">فوز {riv.hostWins}</span>
                          <span className="text-rose-400 font-bold">خسارة {riv.oppWins}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Audited Battles Ledger Table - Responsive, zero horizontal scroll, print ready */}
            <div className="w-full relative z-10 mt-4 rounded-xl border border-white/10 overflow-hidden bg-surface/60 shadow-sm">
              <div className="flex items-center justify-between p-3 border-b border-white/10 bg-white/[0.02]">
                <h4 className="text-xs font-bold text-secondaryText uppercase tracking-wider flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-blue-400" />
                  سجل جميع جولات البث المباشر المعتمدة (Audited Battles Ledger)
                </h4>
                <span className="text-[11px] font-mono text-secondaryText">
                  {previewData.rows.length} جولة موثقة
                </span>
              </div>

              <table className="w-full text-right text-xs table-fixed border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.04] text-secondaryText font-mono">
                    {previewData.headers.map((h, i) => {
                      const colWidth =
                        i === 0 ? "w-[12%]" :
                        i === 1 ? "w-[33%]" :
                        i === 2 ? "w-[14%]" :
                        i === 3 ? "w-[14%]" :
                        i === 4 ? "w-[13%]" : "w-[14%]";
                      return (
                        <th
                          key={i}
                          className={`py-2.5 px-2.5 font-semibold text-[11px] ${colWidth} ${
                            i === 1 ? "text-right" : "text-center"
                          }`}
                        >
                          {h}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-200">
                  {previewData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={previewData.headers.length} className="py-8 text-center text-secondaryText">
                        لا توجد جولات مسجلة في نطاق التاريخ المحدد.
                      </td>
                    </tr>
                  ) : (
                    previewData.rows.map((row, rowIdx) => {
                      const isSuper = row["تصنيف الجولة الماسية"]?.includes("سوبر");
                      return (
                        <tr
                          key={rowIdx}
                          className={`transition-colors ${
                            isSuper ? "bg-amber-500/10 hover:bg-amber-500/15" : "hover:bg-white/[0.02]"
                          }`}
                        >
                          {previewData.headers.map((h, colIdx) => {
                            const val = row[h];
                            const displayVal = val !== undefined && val !== null ? String(val) : "-";
                            const isBattleType = h === "نوع النزال" || h === "نوع الجولة";
                            const isOpponent = h.includes("الخصم") && !h.includes("دعم");
                            const isOutcome = h === "النتيجة والحسم";
                            const isDiamond = h.includes("الماس") || h.includes("الدعم") || displayVal.includes("💎");

                            return (
                              <td
                                key={colIdx}
                                className={`py-2.5 px-2.5 ${
                                  colIdx === 1 ? "text-right" : "text-center"
                                }`}
                              >
                                {isOpponent ? (
                                  <span className="font-bold text-white text-xs block truncate" title={displayVal}>
                                    {displayVal}
                                  </span>
                                ) : isBattleType ? (
                                  <span
                                    className={`inline-flex items-center font-mono font-black text-[10px] px-2 py-0.5 rounded border ${
                                      displayVal.includes("2V2")
                                        ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                        : "bg-sky-500/20 text-sky-300 border-sky-500/30"
                                    }`}
                                  >
                                    {displayVal}
                                  </span>
                                ) : isOutcome ? (
                                  <span
                                    className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded border ${
                                      displayVal.includes("فوز المضيف")
                                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                        : displayVal.includes("فوز الخصم")
                                        ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                        : "bg-white/5 text-secondaryText border-white/10"
                                    }`}
                                  >
                                    {displayVal}
                                  </span>
                                ) : isDiamond ? (
                                  <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30 text-xs">
                                    <span className="text-amber-400">💎</span>
                                    <span className="dir-ltr">{displayVal.replace("💎", "").trim()}</span>
                                  </span>
                                ) : (
                                  <span className="text-secondaryText font-mono text-[11px] block truncate" title={displayVal}>
                                    {displayVal}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : selectedReport === "BATTLE_POST_MATCH" ? (
          <div className="hud-deck rounded-3xl p-6 md:p-8 relative overflow-hidden animate-in fade-in duration-200 space-y-6">
            {/* Ambient Atmosphere Glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header Deck */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/10 relative z-10">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-lg shadow-rose-500/10">
                  <Swords className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg md:text-xl font-black text-white tracking-tight">
                      تحليل ما بعد النزالات (PK Post-Match)
                    </h3>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                      BATTLE RECTANGLES
                    </span>
                  </div>
                  <p className="text-xs text-secondaryText mt-1 max-w-2xl leading-relaxed">
                    نطاق التحليل: <strong className="text-rose-300">{previewData.periodLabel || "كامل السجل"}</strong> • مستبعد منها أي دعم صفري • بطاقات مستطيلة تشمل بيانات الفريقين وسكوراتهما وتوب 10 داعمين بالجولة لكل فريق.
                  </p>
                </div>
              </div>

              {/* Direct Export Actions */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={() => handleOpenPdf("BATTLE_POST_MATCH", true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-red-600/30 to-amber-600/30 hover:from-red-600/40 hover:to-amber-600/40 text-rose-200 border border-rose-500/40 text-xs font-bold transition-all shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 text-rose-300" />
                  <span>PDF رسمي معتمد</span>
                </button>

                <button
                  onClick={() => handleSendTelegramPdf("BATTLE_POST_MATCH")}
                  disabled={sendingTelegramReport === "BATTLE_POST_MATCH"}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                  title="إرسال تقرير PDF مباشرة إلى تليقرام"
                >
                  {sendingTelegramReport === "BATTLE_POST_MATCH" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-300" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-sky-300" />
                  )}
                  <span>إرسال PDF لتليقرام</span>
                </button>

                <button
                  onClick={() => handleDownload("BATTLE_POST_MATCH", "csv")}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير CSV</span>
                </button>
              </div>
            </div>

            {/* Interactive Filters: Date Range & Minimum Host Score */}
            <div className="bg-white/[0.03] border border-rose-500/25 rounded-2xl p-4 space-y-3 relative z-10 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="text-rose-400">📅</span>
                      نطاق تاريخ النزالات المطلوب:
                    </span>
                    <span className="text-xs font-mono font-black text-rose-300 bg-rose-500/15 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                      {previewData.periodLabel || "تاريخ محدد"}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      {previewData.matchCards?.length || 0} نزال معتمد (بدون دعم صفري)
                    </span>
                  </div>
                  <p className="text-[11px] text-secondaryText">
                    اختر يوماً محدداً أو استعرض كامل الأسبوع أو السجل ليتم تصفية النزالات واستبعاد الدعم الصفري فوراً
                  </p>
                </div>

                {/* Quick Presets & Date Input */}
                <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">
                  {[
                    { label: "اليوم", value: "today" },
                    { label: "أمس", value: "yesterday" },
                    { label: "هذا الأسبوع", value: "this_week" },
                    { label: "كامل السجل", value: "all" },
                  ].map((preset) => {
                    const isSelected = sessionPeriodPreset === preset.value && !sessionCustomDate;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => {
                          setSessionPeriodPreset(preset.value);
                          setSessionCustomDate("");
                          handlePreview("BATTLE_POST_MATCH", undefined, preset.value, "", battleMinHostScore);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isSelected
                            ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                            : "bg-surface hover:bg-white/10 text-secondaryText hover:text-white border border-white/5"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}

                  <div className="flex items-center gap-1 bg-surface border border-white/10 rounded-xl px-2 py-1">
                    <span className="text-[10px] text-secondaryText shrink-0">تاريخ:</span>
                    <input
                      type="date"
                      value={sessionCustomDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSessionCustomDate(val);
                        setSessionPeriodPreset("custom");
                        if (val) {
                          handlePreview("BATTLE_POST_MATCH", undefined, "custom", val, battleMinHostScore);
                        }
                      }}
                      className="bg-transparent text-white text-xs font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Minimum Host Score Filter Bar */}
              <div className="pt-3 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <span>🎯</span>
                    الحد الأدنى لسكور المضيف:
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    {battleMinHostScore > 0 ? `💎 ${battleMinHostScore.toLocaleString("en-US")}+` : "الكل (بدون حد أدنى)"}
                  </span>
                  <span className="text-[10px] text-secondaryText">
                    (تصفية النزالات التي حقق فيها المضيف هذا السكور فأعلى)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">
                  {[
                    { label: "الكل (0)", value: 0 },
                    { label: "1,000+", value: 1000 },
                    { label: "10,000+", value: 10000 },
                    { label: "50,000+", value: 50000 },
                    { label: "100,000+", value: 100000 },
                  ].map((preset) => {
                    const isSelected = battleMinHostScore === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => {
                          setBattleMinHostScore(preset.value);
                          handlePreview("BATTLE_POST_MATCH", undefined, undefined, undefined, preset.value);
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                          isSelected
                            ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black"
                            : "bg-surface hover:bg-white/10 text-secondaryText hover:text-white border border-white/5"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}

                  <div className="flex items-center gap-1 bg-surface border border-white/10 rounded-xl px-2 py-1">
                    <span className="text-[10px] text-secondaryText shrink-0">مخصص:</span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={battleMinHostScore || ""}
                      placeholder="0"
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setBattleMinHostScore(val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handlePreview("BATTLE_POST_MATCH", undefined, undefined, undefined, battleMinHostScore);
                        }
                      }}
                      className="w-20 bg-transparent text-amber-300 text-xs font-mono focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handlePreview("BATTLE_POST_MATCH", undefined, undefined, undefined, battleMinHostScore)}
                      className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded font-bold transition-colors"
                    >
                      تطبيق
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Executive KPIs Cards */}
            {previewData.kpis && previewData.kpis.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
                {previewData.kpis.map((kpi: any, kIdx: number) => {
                  const borderColors: Record<string, string> = {
                    cyan: "border-sky-500/30 bg-sky-500/10 text-sky-400",
                    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
                    amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
                    purple: "border-purple-500/30 bg-purple-500/10 text-purple-400",
                    rose: "border-rose-500/30 bg-rose-500/10 text-rose-400",
                  };
                  const colorClass = borderColors[kpi.color || "rose"] || borderColors.rose;
                  return (
                    <div
                      key={kIdx}
                      className={`p-4 rounded-2xl border ${colorClass} bg-surface/80 flex flex-col justify-between shadow-xs`}
                    >
                      <span className="text-xs font-medium text-slate-300">{kpi.label}</span>
                      <span className="text-lg md:text-xl font-black font-mono my-1 text-white">
                        {kpi.value}
                      </span>
                      {kpi.subtext && (
                        <span className="text-[11px] text-slate-400 font-mono truncate">{kpi.subtext}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Smart Operational Narrative */}
            {previewData.executiveSummary && (
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 relative z-10">
                <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                  التحليل التفسيري الذكي لجولات النزالات (PK Post-Match Summary):
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {previewData.executiveSummary}
                </p>
              </div>
            )}

            {/* List of Match Rectangles (المستطيلات وفوق كل مستطيل تاريخ الجولة والوقت) */}
            <div className="space-y-6 relative z-10">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Swords className="w-4 h-4 text-rose-400" />
                  بطاقات النزالات التكتيكية (Match Rectangles):
                </h4>
                <span className="text-xs font-mono text-secondaryText">
                  إجمالي الجولات: {previewData.matchCards?.length || 0}
                </span>
              </div>

              {(!previewData.matchCards || previewData.matchCards.length === 0) ? (
                <div className="bg-surface/60 border border-white/10 rounded-2xl p-8 text-center text-secondaryText">
                  لا توجد جولات ذات نقاط مسجلة في هذا النطاق الزمني المحدد.
                </div>
              ) : (
                previewData.matchCards.map((m: any, idx: number) => {
                  return (
                    <div key={m.id || idx} className="space-y-2">
                      {/* فوق المستطيل: تاريخ الجولة والوقت */}
                      <div className="flex items-center justify-between px-2 text-xs font-semibold text-secondaryText">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold border border-rose-500/30">
                            {idx + 1}
                          </span>
                          <span className="flex items-center gap-1.5 text-white font-bold">
                            <Calendar className="w-3.5 h-3.5 text-rose-400" />
                            {m.headerDateTime}
                          </span>
                          <span className="text-[10px] text-secondaryText font-mono">(بتوقيت الرياض)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-secondaryText bg-white/5 px-2 py-0.5 rounded border border-white/10">
                            ⏱️ {m.durationMin} دقائق
                          </span>
                          <span
                            className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${
                              m.battleType === "2V2"
                                ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                : "bg-sky-500/20 text-sky-300 border-sky-500/30"
                            }`}
                          >
                            {m.battleType}
                          </span>
                        </div>
                      </div>

                      {/* المستطيل: البيانات والسكورات والداعمين والفائز */}
                      <div className="bg-surface/90 border border-white/10 rounded-2xl p-5 space-y-4 hover:border-white/20 transition-all shadow-lg">
                        {/* 1. من الفريق الفائز */}
                        <div
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                            m.isHostWinner
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              : m.winningTeam === 2
                              ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                              : "bg-white/5 text-secondaryText border-white/10"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">🏆</span>
                            <span className="text-sm">الفريق الفائز: {m.winnerLabel}</span>
                          </div>
                          <span className="font-mono text-xs bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
                            فارق النقاط: +{m.scoreDifference.toLocaleString("en-US")} 💎
                          </span>
                        </div>

                        {/* 2. بيانات الفريق المضيف - سكورات كل فريق - بيانات الفريق الخصم */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center bg-white/[0.02] p-4 rounded-xl border border-white/5">
                          {/* الفريق المضيف */}
                          <div className="flex items-center justify-between md:justify-start gap-3">
                            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-sm overflow-hidden shrink-0 shadow-inner">
                              {m.team1Participants[0]?.avatarUrl ? (
                                <img
                                  src={m.team1Participants[0].avatarUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>👑</span>
                              )}
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider block">
                                الفريق المضيف
                              </span>
                              <h5 className="font-extrabold text-white text-sm">
                                {m.team1Participants.map((p: any) => p.displayName).join(" ، ")}
                              </h5>
                            </div>
                          </div>

                          {/* السكورات المتقابلة */}
                          <div className="text-center py-2 px-3 bg-surface rounded-xl border border-white/10">
                            <div className="flex items-center justify-center gap-3 font-mono font-black text-lg">
                              <span className="text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                                💎 {m.team1Score.toLocaleString("en-US")}
                              </span>
                              <span className="text-secondaryText text-xs font-sans">ضد</span>
                              <span className="text-slate-300 bg-white/5 px-2.5 py-0.5 rounded-lg border border-white/10">
                                💎 {m.team2Score.toLocaleString("en-US")}
                              </span>
                            </div>
                            <span className="text-[11px] text-secondaryText font-mono mt-1 block">
                              مجموع الجولة: {m.totalScore.toLocaleString("en-US")} 💎
                            </span>
                          </div>

                          {/* الفريق الخصم */}
                          <div className="flex items-center justify-between md:justify-end gap-3 text-left md:text-left">
                            <div className="md:order-1 order-2">
                              <span className="text-[10px] font-bold text-secondaryText uppercase tracking-wider block">
                                فريق الخصم
                              </span>
                              <h5 className="font-extrabold text-white text-sm">
                                {m.team2Participants.map((p: any) => p.displayName).join(" ، ")}
                              </h5>
                            </div>
                            <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-secondaryText text-sm overflow-hidden shrink-0 md:order-2 order-1">
                              {m.team2Participants[0]?.avatarUrl ? (
                                <img
                                  src={m.team2Participants[0].avatarUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>⚔️</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 3. توب 10 داعمين بالجولة لكل فريق */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                          {/* قائمة داعمي المضيف */}
                          <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                                <span>⭐</span>
                                توب 10 داعمي فريق المضيف:
                              </span>
                              <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded">
                                {m.team1TopSupporters.length} داعم
                              </span>
                            </div>

                            {m.team1TopSupporters.length === 0 ? (
                              <p className="text-[11px] text-secondaryText py-3 text-center">
                                لم يُسجل داعمون محددون في نافذة الجولة.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {m.team1TopSupporters.map((sup: any, sIdx: number) => (
                                  <div
                                    key={sIdx}
                                    className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-surface border border-white/5 hover:border-amber-500/30 transition-colors"
                                  >
                                    <div className="flex items-center gap-2 truncate max-w-[200px]">
                                      <span
                                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                                          sup.rank === 1
                                            ? "bg-amber-400 text-slate-950 font-black shadow-xs"
                                            : sup.rank === 2
                                            ? "bg-slate-300 text-slate-900 font-black"
                                            : sup.rank === 3
                                            ? "bg-amber-600 text-white font-black"
                                            : "bg-white/10 text-slate-300"
                                        }`}
                                      >
                                        {sup.rank}
                                      </span>
                                      <span className="font-bold text-white truncate" title={sup.name}>
                                        {sup.name}
                                      </span>
                                    </div>
                                    <span className="font-mono font-bold text-amber-300 shrink-0 text-xs">
                                      💎 {sup.diamonds.toLocaleString("en-US")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* قائمة داعمي الخصم */}
                          <div className="border border-white/10 bg-white/[0.02] rounded-xl p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                <span>🛡️</span>
                                توب 10 داعمي فريق الخصم:
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-400 bg-white/10 px-2 py-0.5 rounded">
                                {m.team2TopSupporters.length} داعم
                              </span>
                            </div>

                            {m.team2TopSupporters.length === 0 ? (
                              <div className="py-3 px-2 text-center space-y-1">
                                <p className="text-[11px] text-secondaryText">
                                  مسجل عبر سكور التحدي العام للخصم
                                </p>
                                <span className="inline-block font-mono font-bold text-xs text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                                  إجمالي السكور: {m.team2Score.toLocaleString("en-US")} 💎
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {m.team2TopSupporters.map((sup: any, sIdx: number) => (
                                  <div
                                    key={sIdx}
                                    className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-surface border border-white/5"
                                  >
                                    <div className="flex items-center gap-2 truncate max-w-[200px]">
                                      <span
                                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                                          sup.rank === 1
                                            ? "bg-slate-700 text-white font-black"
                                            : sup.rank === 2
                                            ? "bg-slate-400 text-slate-900"
                                            : sup.rank === 3
                                            ? "bg-slate-500 text-white"
                                            : "bg-white/10 text-slate-400"
                                        }`}
                                      >
                                        {sup.rank}
                                      </span>
                                      <span className="font-bold text-slate-300 truncate" title={sup.name}>
                                        {sup.name}
                                      </span>
                                    </div>
                                    <span className="font-mono font-bold text-slate-400 shrink-0 text-xs">
                                      💎 {sup.diamonds.toLocaleString("en-US")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : selectedReport === "TACTICAL_INVENTORY_AUDIT" ? (
          <div className="hud-deck rounded-3xl p-6 md:p-8 relative overflow-hidden animate-in fade-in duration-200">
            {/* Ambient Tactical Glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-turquoise/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header Deck */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/10 relative z-10">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
                  <Package className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg md:text-xl font-black text-white tracking-tight">
                      أرصدة الأدوات للداعمين والمستخدمين في المعركة
                    </h3>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      LIVE BALANCES
                    </span>
                  </div>
                  <p className="text-xs text-secondaryText mt-1 max-w-2xl leading-relaxed">
                    تحديث لحظي وتجميع ذكي لأرصدة القفازات والأدوات المحمولة مع مهلة الصلاحية الـ 120 ساعة ومتابعة الجاهزية التكتيكية قبل الجولات
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-300 font-bold font-mono text-xs shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  {previewData.rows.filter((r: any) => (r._available ?? 0) > 0).length} حسابات نشطة
                </span>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-turquoise/30 bg-turquoise/10 text-turquoise font-bold font-mono text-xs">
                  <Zap className="w-3.5 h-3.5" />
                  {previewData.rows.reduce((acc: number, r: any) => acc + (r._available ?? 0), 0)} رصيد قتالي متاح
                </span>

                <button
                  onClick={() => handleOpenPdf(selectedReport, true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-red-600/30 to-amber-600/30 hover:from-red-600/40 hover:to-amber-600/40 text-rose-200 border border-rose-500/40 text-xs font-bold transition-all shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 text-rose-300" />
                  <span>حفظ وطباعة كـ PDF رسمي</span>
                </button>

                <button
                  onClick={() => handleDownload(selectedReport, "csv")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير CSV</span>
                </button>
              </div>
            </div>

            {/* Tactical Aggregated Table */}
            <div className="overflow-x-auto relative z-10 mt-4">
              {previewError ? (
                <p className="text-xs text-rose-400 py-4">{previewError}</p>
              ) : previewData.rows.length === 0 ? (
                <div className="py-16 text-center text-secondaryText">
                  <Package className="w-12 h-12 text-secondaryText/40 mx-auto mb-3" />
                  <p className="text-base font-bold text-white">لا توجد أدوات ممنوحة مسجلة بعد</p>
                  <p className="text-xs font-mono mt-1 text-secondaryText">
                    سيتم تجميع وتحديث أرصدة الأدوات للداعمين تلقائياً فور منحها في جولات البث المباشر
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm text-right">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-secondaryText uppercase font-mono tracking-wider">
                      <th className="py-4 pr-3 text-right">الداعم / المستخدم</th>
                      <th className="py-4 text-right">الأداة والتأثير التكتيكي</th>
                      <th className="py-4 text-center">الرصيد المتاح</th>
                      <th className="py-4 text-center">إجمالي الحيازة</th>
                      <th className="py-4 text-center">المستهلك منها</th>
                      <th className="py-4 text-center">الجاهزية التكتيكية</th>
                      <th className="py-4 text-center">الصلاحية (120H)</th>
                      <th className="py-4 text-center">آخر حيازة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-sans">
                    {previewData.rows.map((row: any, idx: number) => {
                      const supporter = row._supporter || {};
                      const tool = row._tool || {};
                      const available = row._available ?? (typeof row["الرصيد المتاح"] === "number" ? row["الرصيد المتاح"] : 0);
                      const totalGranted = row._totalGranted ?? row["إجمالي الحيازة"] ?? available;
                      const totalConsumed = row._totalConsumed ?? row["المستهلك منها"] ?? 0;
                      const percentConsumed = row._percentConsumed ?? (totalGranted > 0 ? Math.round((totalConsumed / totalGranted) * 100) : 0);
                      const isExpired = row._isExpired ?? false;
                      const isSoon = row._isSoon ?? false;
                      const remText = row._remText ?? (row["الصلاحية (120H)"] ? row["الصلاحية (120H)"].split("(")[0]?.trim() : "-");

                      return (
                        <tr key={idx} className="hover:bg-white/[0.025] transition-colors group">
                          {/* 1. الداعم / المستخدم */}
                          <td className="py-4 pr-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-surface border border-white/10 flex items-center justify-center font-bold text-turquoise text-sm overflow-hidden shrink-0 shadow-inner group-hover:border-turquoise/40 transition-colors">
                                {supporter.avatarUrl ? (
                                  <img
                                    src={supporter.avatarUrl}
                                    alt={supporter.displayName || "Supporter"}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>{(supporter.displayName || supporter.username || "U").charAt(0)}</span>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-white text-sm leading-tight group-hover:text-turquoise transition-colors">
                                  @{supporter.username || "supporter"}
                                </p>
                                <p className="text-xs text-secondaryText leading-tight mt-0.5 truncate max-w-[150px]">
                                  {supporter.displayName || supporter.username || "داعم"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* 2. الأداة والتأثير التكتيكي */}
                          <td className="py-4">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl shrink-0">{tool.emoji || "🥊"}</span>
                              <div>
                                <span className="font-bold text-white text-sm block leading-tight">
                                  {tool.name || "أداة تكتيكية"}
                                </span>
                                <span className="inline-block text-[10px] font-mono text-amber-400/90 font-medium mt-0.5">
                                  {tool.perk || "ضربة قاضية x5 🥊"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 3. الرصيد المتاح (Glowing Cyber Gold Badge) */}
                          <td className="py-4 text-center">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-sm flex items-center justify-center shadow-lg shadow-amber-500/30 mx-auto digi-number">
                              {available}
                            </div>
                          </td>

                          {/* 4. إجمالي الحيازة */}
                          <td className="py-4 text-center font-mono font-bold text-white text-sm md:text-base digi-number">
                            {totalGranted}
                          </td>

                          {/* 5. المستهلك منها */}
                          <td className="py-4 text-center font-mono text-secondaryText text-sm md:text-base digi-number">
                            {totalConsumed}
                          </td>

                          {/* 6. الجاهزية التكتيكية والمعدل */}
                          <td className="py-4 text-center">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              {isExpired ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  <XCircle className="w-3 h-3" />
                                  منتهية الصلاحية
                                </span>
                              ) : available <= 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-zinc-500/10 text-secondaryText border border-zinc-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  مستهلكة بالكامل
                                </span>
                              ) : isSoon ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-500/10 animate-pulse">
                                  <Clock className="w-3 h-3" />
                                  قريبة من الانتهاء ⏳
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10">
                                  <Zap className="w-3 h-3" />
                                  جاهز للقتال ⚡
                                </span>
                              )}

                              {/* Mini consumption bar */}
                              <div className="w-20 bg-white/10 rounded-full h-1 overflow-hidden" title={`نسبة الاستهلاك: ${percentConsumed}%`}>
                                <div
                                  className={`h-full rounded-full ${
                                    available > 0 && !isExpired ? "bg-amber-400" : "bg-secondaryText/40"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(5, percentConsumed))}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* 7. الصلاحية (120H) */}
                          <td className="py-4 text-center font-mono text-xs">
                            <span
                              suppressHydrationWarning
                              className={`font-semibold block ${
                                isExpired
                                  ? "text-rose-400"
                                  : isSoon
                                  ? "text-amber-300 font-bold"
                                  : "text-emerald-400"
                              }`}
                            >
                              {remText || "صالحة"}
                            </span>
                            {row._latestExpiresAt && (
                              <span className="text-[10px] text-secondaryText/70 block mt-0.5" suppressHydrationWarning>
                                {new Date(row._latestExpiresAt).toLocaleDateString("ar-SA")}
                              </span>
                            )}
                          </td>

                          {/* 8. آخر حيازة */}
                          <td className="py-4 text-center font-mono text-xs text-secondaryText">
                            <span className="text-white font-medium block" suppressHydrationWarning>
                              {row._latestReceivedAt ? new Date(row._latestReceivedAt).toLocaleTimeString("ar-SA", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              }) : "-"}
                            </span>
                            {row._latestReceivedAt && (
                              <span className="block text-[10px] text-secondaryText/70" suppressHydrationWarning>
                                {new Date(row._latestReceivedAt).toLocaleDateString("ar-SA")}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : selectedReport === "SUPPORTER_PRESENCE_PATTERN" ? (
          <div className="hud-deck rounded-3xl p-6 md:p-8 relative overflow-hidden animate-in fade-in duration-200 space-y-6">
            {/* Ambient Presence Glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header Deck */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/10 relative z-10">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0 shadow-lg shadow-violet-500/10">
                  <Clock className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg md:text-xl font-black text-white tracking-tight">
                      تقرير نمط تواجد الداعمين وجلسات التفاعل
                    </h3>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                      PRESENCE PATTERN
                    </span>
                  </div>
                  <p className="text-xs text-secondaryText mt-1 max-w-2xl leading-relaxed">
                    تحليل أوقات ظهور الداعمين المهمين، وساعات الذروة بتوقيت الرياض (Asia/Riyadh)، وأنماط الحضور الأسبوعية ومتوسط مدة النوافذ النشطة
                  </p>
                </div>
              </div>

              {/* Controls: Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={() => handleOpenPdf("SUPPORTER_PRESENCE_PATTERN", true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-red-600/30 to-amber-600/30 hover:from-red-600/40 hover:to-amber-600/40 text-rose-200 border border-rose-500/40 text-xs font-bold transition-all shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 text-rose-300" />
                  <span>PDF رسمي</span>
                </button>

                <button
                  onClick={() => handleSendTelegramPdf("SUPPORTER_PRESENCE_PATTERN")}
                  disabled={sendingTelegramReport === "SUPPORTER_PRESENCE_PATTERN"}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                  title="إرسال تقرير PDF مباشرة إلى تليقرام"
                >
                  {sendingTelegramReport === "SUPPORTER_PRESENCE_PATTERN" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-300" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-sky-300" />
                  )}
                  <span>إرسال PDF لتليقرام</span>
                </button>

                <button
                  onClick={() => handleDownload("SUPPORTER_PRESENCE_PATTERN", "csv")}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير CSV</span>
                </button>
              </div>
            </div>

            {/* Dedicated Minimum Support Threshold Control Panel */}
            <div className="bg-white/[0.03] border border-violet-500/25 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="text-amber-400">💎</span>
                    تحديد الحد الأدنى للدعم المطلوب لإظهار الداعم:
                  </span>
                  <span className="text-xs font-mono font-black text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    {presenceThreshold.toLocaleString("en-US")} ماسة فأكثر
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {previewData.rows.length} داعم مطابق
                  </span>
                </div>
                <p className="text-[11px] text-secondaryText">
                  اختر من القيم الشائعة أو حدد رقماً مخصصاً لتصفية التقرير والمخططات البيانية فوراً
                </p>
              </div>

              {/* Quick Presets & Custom Input */}
              <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">
                {[
                  { label: "10k", title: "10 آلاف ماسة", value: 10000 },
                  { label: "50k", title: "50 ألف ماسة", value: 50000 },
                  { label: "100k (الموصى به)", title: "100 ألف ماسة", value: 100000 },
                  { label: "250k", title: "250 ألف ماسة", value: 250000 },
                  { label: "500k", title: "500 ألف ماسة", value: 500000 },
                  { label: "1M+", title: "مليون ماسة فأكثر", value: 1000000 },
                ].map((preset) => {
                  const isSelected = presenceThreshold === preset.value;
                  return (
                    <button
                      key={preset.value}
                      title={preset.title}
                      onClick={() => {
                        setPresenceThreshold(preset.value);
                        handlePreview("SUPPORTER_PRESENCE_PATTERN", preset.value);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                        isSelected
                          ? "bg-violet-600 text-white shadow-md shadow-violet-600/30 border border-violet-400"
                          : "bg-surface border border-white/10 text-secondaryText hover:text-white hover:border-white/20"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}

                <div className="flex items-center gap-1.5 bg-surface px-2.5 py-1 rounded-xl border border-white/10">
                  <span className="text-[10px] text-secondaryText">مخصص:</span>
                  <input
                    type="number"
                    value={presenceThreshold}
                    onChange={(e) => setPresenceThreshold(Number(e.target.value) || 0)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handlePreview("SUPPORTER_PRESENCE_PATTERN", presenceThreshold);
                      }
                    }}
                    className="w-24 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-white font-mono focus:border-violet-500 outline-none"
                    step="10000"
                    min="1000"
                  />
                  <button
                    onClick={() => handlePreview("SUPPORTER_PRESENCE_PATTERN", presenceThreshold)}
                    disabled={isPreviewLoading}
                    className="px-2.5 py-0.5 rounded bg-violet-500 hover:bg-violet-600 text-white text-xs font-bold transition-colors shadow-xs"
                  >
                    تطبيق
                  </button>
                </div>
              </div>
            </div>

            {/* KPIs Cards */}
            {previewData.kpis && previewData.kpis.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 relative z-10">
                {previewData.kpis.map((kpi: any, kIdx: number) => (
                  <div key={kIdx} className="bg-surface/80 border border-white/5 rounded-2xl p-3.5 flex flex-col justify-between">
                    <span className="text-[11px] text-secondaryText block leading-tight">{kpi.label}</span>
                    <div className="my-1.5 font-bold text-white text-base md:text-lg font-mono">
                      {kpi.value}
                    </div>
                    {kpi.subtext && (
                      <span className="text-[10px] text-secondaryText/70 font-mono truncate">{kpi.subtext}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Supporter Deep-Dive Section */}
            {previewData.rows.length > 0 && (() => {
              const currentSupporter = previewData.rows[Math.min(activeSupporterIdx, previewData.rows.length - 1)];
              const sInfo = currentSupporter._supporter || {};
              const hourly = (currentSupporter._hourlyDistribution || []) as any[];
              const weekday = (currentSupporter._weekdayDistribution || []) as any[];
              const qualityLabel = currentSupporter._qualityLabel || "نمط أولي";
              const qualityState = currentSupporter._evidenceQuality || "INITIAL_PATTERN";

              const maxHourCount = Math.max(...hourly.map((h: any) => h.eventCount), 1);
              const maxDayCount = Math.max(...weekday.map((d: any) => d.eventCount), 1);

              return (
                <div className="space-y-4 relative z-10">
                  {/* Supporter Selector Tabs */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                    <span className="text-xs text-secondaryText whitespace-nowrap pl-2">اختيار الداعم:</span>
                    {previewData.rows.map((r: any, idx: number) => {
                      const isActive = idx === activeSupporterIdx;
                      return (
                        <button
                          key={idx}
                          onClick={() => setActiveSupporterIdx(idx)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs whitespace-nowrap transition-all ${
                            isActive
                              ? "bg-violet-500/20 border-violet-500 text-white font-bold shadow-md shadow-violet-500/20"
                              : "bg-surface border-white/5 text-secondaryText hover:text-white hover:border-white/20"
                          }`}
                        >
                          <span className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center font-bold text-[10px]">
                            {(r._supporter?.displayName || r._supporter?.username || "U").charAt(0)}
                          </span>
                          <span>@{r._supporter?.username || "supporter"}</span>
                          <span className="text-[10px] font-mono text-amber-300">
                            💎 {r._supporter?.totalDiamonds ? (r._supporter.totalDiamonds >= 1000000 ? `${(r._supporter.totalDiamonds / 1000000).toFixed(1)}M` : `${Math.round(r._supporter.totalDiamonds / 1000)}k`) : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Supporter Detailed Card */}
                  <div className="bg-surface/90 border border-white/10 rounded-2xl p-5 space-y-5">
                    {/* Supporter Profile Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-surface border border-white/10 flex items-center justify-center font-bold text-violet-400 text-lg overflow-hidden shrink-0 shadow-inner">
                          {sInfo.avatarUrl ? (
                            <img src={sInfo.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{(sInfo.displayName || sInfo.username || "U").charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-white text-base">@{sInfo.username}</h4>
                            <span className="text-xs text-secondaryText">({sInfo.displayName})</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              💎 {sInfo.totalDiamonds?.toLocaleString("en-US")} ماسة
                            </span>
                            <span className="text-[11px] text-secondaryText font-mono">
                              مرصود في {currentSupporter["عدد البثوث المرصودة"]} بث مباشر
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Evidence Quality Pill */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                            qualityState === "STABLE_PATTERN"
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              : qualityState === "RECURRENT_PATTERN"
                              ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                              : qualityState === "INITIAL_PATTERN"
                              ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                              : "bg-zinc-500/15 text-zinc-300 border-zinc-500/30"
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {qualityLabel}
                        </span>
                      </div>
                    </div>

                    {/* Operational Insight Banner */}
                    {currentSupporter._insight && (
                      <div className="p-3.5 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-start gap-3">
                        <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-violet-200 leading-relaxed font-sans">
                          {currentSupporter._insight}
                        </p>
                      </div>
                    )}

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
                      {/* 24-Hour Distribution Bar Chart */}
                      <div className="bg-surface/50 border border-white/5 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-violet-400" />
                            توزيع الحضور خلال ساعات اليوم (00 - 23 بتوقيت الرياض)
                          </h5>
                          <span className="text-[10px] font-mono text-secondaryText">Asia/Riyadh</span>
                        </div>

                        {/* Bar Grid */}
                        <div className="h-28 flex items-end gap-1 pt-4 pb-2 border-b border-white/5">
                          {hourly.map((hItem: any, hIdx: number) => {
                            const heightPercent = maxHourCount > 0 ? Math.round((hItem.eventCount / maxHourCount) * 100) : 0;
                            const isPeak = (currentSupporter._analysis?.peakHours || []).includes(hItem.hour);

                            return (
                              <div
                                key={hIdx}
                                className="flex-1 flex flex-col items-center justify-end h-full group relative"
                              >
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[9px] rounded px-1.5 py-0.5 border border-white/20 whitespace-nowrap z-20 pointer-events-none">
                                  <span>{hItem.hourLabel}</span>
                                  <span className="font-bold text-turquoise">{hItem.eventCount} حدث ({hItem.percentage}%)</span>
                                </div>
                                <div
                                  className={`w-full rounded-t transition-all ${
                                    isPeak
                                      ? "bg-gradient-to-t from-violet-600 to-amber-400 shadow-sm shadow-amber-400/20"
                                      : hItem.eventCount > 0
                                      ? "bg-violet-500/40 hover:bg-violet-500/60"
                                      : "bg-white/5"
                                  }`}
                                  style={{ height: `${Math.max(4, heightPercent)}%` }}
                                />
                              </div>
                            );
                          })}
                        </div>
                        {/* Hour Labels */}
                        <div className="flex justify-between text-[9px] font-mono text-secondaryText px-1">
                          <span>00:00</span>
                          <span>06:00</span>
                          <span>12:00</span>
                          <span>18:00</span>
                          <span>23:00</span>
                        </div>
                      </div>

                      {/* Weekday Distribution Chart */}
                      <div className="bg-surface/50 border border-white/5 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-turquoise" />
                            تكرار الحضور خلال أيام الأسبوع
                          </h5>
                          <span className="text-[10px] font-mono text-secondaryText">الأحد - السبت</span>
                        </div>

                        <div className="space-y-2 pt-2">
                          {weekday.map((dItem: any, dIdx: number) => {
                            const isPeak = (currentSupporter._analysis?.peakWeekdays || []).includes(dItem.day);
                            const widthPercent = maxDayCount > 0 ? Math.round((dItem.eventCount / maxDayCount) * 100) : 0;

                            return (
                              <div key={dIdx} className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className={`font-medium ${isPeak ? "text-amber-300 font-bold" : "text-secondaryText"}`}>
                                    {dItem.dayName}
                                  </span>
                                  <span className="font-mono text-[10px] text-secondaryText">
                                    {dItem.eventCount} حدث ({dItem.percentage}%)
                                  </span>
                                </div>
                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      isPeak ? "bg-gradient-to-r from-amber-400 to-violet-500" : "bg-violet-500/50"
                                    }`}
                                    style={{ width: `${Math.max(2, widthPercent)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Canonical Aggregated Table for all Supporters */}
            <div className="overflow-x-auto relative z-10 mt-6">
              <table className="w-full text-sm text-right">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-secondaryText uppercase font-mono tracking-wider">
                    <th className="py-4 pr-3 text-right">الداعم المعتمد</th>
                    <th className="py-4 text-center">إجمالي الدعم التراكمي</th>
                    <th className="py-4 text-center">ساعات الذروة (بتوقيت الرياض)</th>
                    <th className="py-4 text-center">أيام الحضور المفضلة</th>
                    <th className="py-4 text-center">البثوث</th>
                    <th className="py-4 text-center">الجلسات</th>
                    <th className="py-4 text-center">متوسط مدة الجلسة</th>
                    <th className="py-4 text-center">وسيط المدة</th>
                    <th className="py-4 text-center">آخر نشاط مرصود</th>
                    <th className="py-4 text-center">موثوقية النمط</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-sans">
                  {previewData.rows.map((row: any, idx: number) => {
                    const supporter = row._supporter || {};
                    const isSelected = idx === activeSupporterIdx;
                    const qState = row._evidenceQuality || "INITIAL_PATTERN";

                    return (
                      <tr
                        key={idx}
                        onClick={() => setActiveSupporterIdx(idx)}
                        className={`hover:bg-white/[0.03] transition-colors cursor-pointer group ${
                          isSelected ? "bg-violet-500/10 border-l-2 border-violet-400" : ""
                        }`}
                      >
                        {/* 1. الداعم */}
                        <td className="py-3.5 pr-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-surface border border-white/10 flex items-center justify-center font-bold text-violet-400 text-xs overflow-hidden shrink-0">
                              {supporter.avatarUrl ? (
                                <img src={supporter.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span>{(supporter.displayName || supporter.username || "U").charAt(0)}</span>
                              )}
                            </div>
                            <div className="text-right leading-tight">
                              <p className="font-bold text-white text-xs group-hover:text-violet-300 transition-colors">
                                @{supporter.username || "supporter"}
                              </p>
                              <p className="text-[10px] text-secondaryText truncate max-w-[120px]">
                                {supporter.displayName}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 2. إجمالي الدعم */}
                        <td className="py-3.5 text-center font-mono">
                          <span className="inline-flex items-center gap-1 font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-xs">
                            💎 {supporter.totalDiamonds?.toLocaleString("en-US")}
                          </span>
                        </td>

                        {/* 3. ساعات الذروة */}
                        <td className="py-3.5 text-center text-xs font-mono text-violet-300">
                          {row["ساعات الذروة (بتوقيت الرياض)"]}
                        </td>

                        {/* 4. أيام الحضور */}
                        <td className="py-3.5 text-center text-xs font-medium text-white">
                          {row["أيام الحضور المفضلة"]}
                        </td>

                        {/* 5. البثوث */}
                        <td className="py-3.5 text-center font-mono text-xs text-white">
                          {row["عدد البثوث المرصودة"]}
                        </td>

                        {/* 6. الجلسات */}
                        <td className="py-3.5 text-center font-mono text-xs text-turquoise">
                          {row["عدد الجلسات المرصودة"]}
                        </td>

                        {/* 7. متوسط مدة الجلسة */}
                        <td className="py-3.5 text-center font-mono text-xs text-white">
                          {row["متوسط مدة الجلسة (تقديري)"]}
                        </td>

                        {/* 8. وسيط الجلسة */}
                        <td className="py-3.5 text-center font-mono text-xs text-secondaryText">
                          {row["وسيط مدة الجلسة"]}
                        </td>

                        {/* 9. آخر نشاط */}
                        <td className="py-3.5 text-center font-mono text-[11px] text-secondaryText">
                          {row["آخر نشاط مرصود"]}
                        </td>

                        {/* 10. موثوقية النمط */}
                        <td className="py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              qState === "STABLE_PATTERN"
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                                : qState === "RECURRENT_PATTERN"
                                ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                                : qState === "INITIAL_PATTERN"
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                : "bg-zinc-500/10 text-zinc-300 border-zinc-500/20"
                            }`}
                          >
                            {row["موثوقية النمط الإحصائي"]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-white/10 p-6 space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Eye className="w-4 h-4 text-turquoise" />
                <h4 className="text-sm font-bold text-white">
                  معاينة مباشرة: {CANONICAL_REPORTS.find((r) => r.type === selectedReport)?.title}
                </h4>
                <span className="text-[11px] font-mono text-secondaryText">
                  {selectedReport === "STQI_TIMING_REPORT"
                    ? "(تحليل ساعات اليوم 0-23 بتوقيت الرياض)"
                    : "(أول 5 صفوف محسوبة)"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenPdf(selectedReport, true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-red-600/30 to-amber-600/30 hover:from-red-600/40 hover:to-amber-600/40 text-rose-200 border border-rose-500/40 text-xs font-bold transition-all shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 text-rose-300" />
                  <span>حفظ وطباعة كـ PDF رسمي</span>
                </button>

                <button
                  onClick={() => handleSendTelegramPdf(selectedReport)}
                  disabled={sendingTelegramReport === selectedReport}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                  title="إرسال تقرير PDF مباشرة إلى تليقرام"
                >
                  {sendingTelegramReport === selectedReport ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-300" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-sky-300" />
                  )}
                  <span>إرسال PDF لتليقرام</span>
                </button>

                <button
                  onClick={() => handleDownload(selectedReport, "csv")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير CSV</span>
                </button>
              </div>
            </div>

            {/* Render Executive KPIs if present */}
            {previewData.kpis && previewData.kpis.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-2">
                {previewData.kpis.map((kpi: any, kIdx: number) => {
                  const borderColors: Record<string, string> = {
                    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
                    cyan: "border-sky-500/30 bg-sky-500/10 text-sky-300",
                    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                    purple: "border-purple-500/30 bg-purple-500/10 text-purple-300",
                    rose: "border-rose-500/30 bg-rose-500/10 text-rose-300",
                  };
                  const colorClass = borderColors[kpi.color || "amber"] || borderColors.amber;
                  return (
                    <div key={kIdx} className={`p-3.5 rounded-xl border ${colorClass} flex flex-col justify-between shadow-xs`}>
                      <span className="text-[11px] font-semibold text-slate-300">{kpi.label}</span>
                      <span className="text-sm sm:text-base font-black font-mono my-1 text-white truncate" title={kpi.value}>
                        {kpi.value}
                      </span>
                      {kpi.subtext && <span className="text-[10px] text-slate-400 font-mono truncate">{kpi.subtext}</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {previewError ? (
              <p className="text-xs text-rose-400 py-4">{previewError}</p>
            ) : previewData.rows.length === 0 ? (
              <p className="text-xs text-secondaryText py-4 text-center">لا توجد سجلات مسجلة في هذا التقرير حالياً.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-secondaryText font-mono">
                      {previewData.headers.map((h, i) => (
                        <th key={i} className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-200">
                    {previewData.rows.map((row, rowIdx) => {
                      const isRank1 = row._supportRank === 1;
                      const isRank2 = row._supportRank === 2;
                      const isRank3 = row._supportRank === 3;
                      const rowHighlight = isRank1
                        ? "bg-amber-500/10 hover:bg-amber-500/15"
                        : isRank2
                        ? "bg-sky-500/10 hover:bg-sky-500/15"
                        : isRank3
                        ? "bg-purple-500/10 hover:bg-purple-500/15"
                        : "hover:bg-white/[0.02]";

                      return (
                        <tr key={rowIdx} className={`${rowHighlight} transition-colors`}>
                          {previewData.headers.map((h, colIdx) => {
                            const val = row[h];
                            const displayVal = val !== undefined && val !== null ? String(val) : "-";
                            const isDiamond = h.includes("الماس") || h.includes("الدعم") || displayVal.includes("💎");
                            const isSupportRank = h === "ترتيب وتصنيف الدعم المالي";

                            return (
                              <td key={colIdx} className="py-2.5 px-3 whitespace-nowrap">
                                {isSupportRank ? (
                                  displayVal !== "-" ? (
                                    <span
                                      className={`inline-flex items-center gap-1 font-bold text-[10px] px-2.5 py-1 rounded-md border ${
                                        row._supportRank === 1
                                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-black shadow-sm"
                                          : row._supportRank === 2
                                          ? "bg-sky-500/20 text-sky-300 border-sky-500/40 font-black shadow-sm"
                                          : row._supportRank === 3
                                          ? "bg-purple-500/20 text-purple-300 border-purple-500/40 font-black shadow-sm"
                                          : "bg-white/5 text-gray-300 border-white/10"
                                      }`}
                                    >
                                      {displayVal}
                                    </span>
                                  ) : (
                                    <span className="text-secondaryText font-mono text-[11px]">-</span>
                                  )
                                ) : isDiamond ? (
                                  <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30 text-xs">
                                    <span className="text-amber-400">💎</span>
                                    <span className="dir-ltr">{displayVal.replace("💎", "").trim()}</span>
                                  </span>
                                ) : (
                                  displayVal
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
