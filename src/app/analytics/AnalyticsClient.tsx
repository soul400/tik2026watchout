"use client";

import { useState, useMemo } from "react";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import {
  BarChart3,
  Clock,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Calendar,
  Award,
  Zap,
  ShieldCheck,
  Flame,
  Target,
  Swords,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Layers,
  SlidersHorizontal,
} from "lucide-react";
import { SupportValue } from "@/components/SupportValue";
import { SmartAnalyticsOverview, SmartRecommendation } from "@/lib/stqi-engine";

interface HourlyItem {
  id: string;
  riyadhHour: number;
  dayOfWeek: number;
  sampleSessions: number;
  avgDiamonds: number;
  avgLikes: number;
  avgComments: number;
  avgViewers: number;
  stqiScore: number;
  consistencyScore: number;
  confidenceState: string;
}

interface BestWindow {
  hour: number;
  formattedHourArabic: string;
  stqiScore: number;
  consistencyPercent: number;
  sampleSessions: number;
  confidenceState: "VERIFIED" | "PARTIAL" | "INSUFFICIENT_DATA";
  avgDiamonds: number;
  avgComments: number;
  avgLikes: number;
  summaryArabic: string;
}

interface Props {
  initialHourly: HourlyItem[];
  initialBestWindow: BestWindow | null;
  initialSmartOverview?: SmartAnalyticsOverview | null;
}

const DAYS_OF_WEEK = [
  { value: -1, label: "جميع الأيام (المجمل)" },
  { value: 0, label: "الأحد" },
  { value: 1, label: "الاثنين" },
  { value: 2, label: "الثلاثاء" },
  { value: 3, label: "الأربعاء" },
  { value: 4, label: "الخميس" },
  { value: 5, label: "الجمعة" },
  { value: 6, label: "السبت" },
];

const REC_CATEGORIES = [
  { value: "ALL", label: "جميع التوصيات الذكية" },
  { value: "TIMING", label: "توقيت الانطلاق 🎯" },
  { value: "BATTLES", label: "النزالات الكبرى ⚔️" },
  { value: "MIDNIGHT", label: "ذروة منتصف الليل 🔥" },
  { value: "FATIGUE", label: "تجنب الإجهاد ⚠️" },
  { value: "POWER_UPS", label: "الأدوات التكتيكية ⚡" },
];

export function AnalyticsClient({ initialHourly, initialBestWindow, initialSmartOverview }: Props) {
  const [selectedDay, setSelectedDay] = useState<number>(-1);
  const [hourlyData, setHourlyData] = useState<HourlyItem[]>(initialHourly);
  const [bestWindow, setBestWindow] = useState<BestWindow | null>(initialBestWindow);
  const [smartOverview, setSmartOverview] = useState<SmartAnalyticsOverview | null>(
    initialSmartOverview || null
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  // Dashboard & Visual Chart Controls
  const [activeChartMetric, setActiveChartMetric] = useState<"STQI" | "DIAMONDS" | "COMMENTS" | "CONSISTENCY">("STQI");
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [pinnedHour, setPinnedHour] = useState<number | null>(initialBestWindow?.hour ?? 20);
  const [selectedRecCategory, setSelectedRecCategory] = useState<string>("ALL");
  const [copiedRecId, setCopiedRecId] = useState<string | null>(null);

  const activeDetailHour = hoveredHour !== null ? hoveredHour : pinnedHour;
  const activeDetailItem = hourlyData.find((h) => h.riyadhHour === activeDetailHour);

  const formatHourWindow = (hour: number) => {
    const nextHour = (hour + 1) % 24;
    const formatH = (h: number) => {
      if (h === 0) return "12:00 ص";
      if (h === 12) return "12:00 م";
      if (h < 12) return `${h}:00 ص`;
      return `${h - 12}:00 م`;
    };
    return `${formatH(hour)} — ${formatH(nextHour)}`;
  };

  const handleDayChange = async (day: number) => {
    setSelectedDay(day);
    try {
      const res = await fetch(`/api/analytics/stqi?dayOfWeek=${day}`);
      const data = await res.json();
      if (data.success) {
        setHourlyData(data.hourlyData || []);
        if (day === -1) {
          setBestWindow(data.bestWindow);
          if (data.smartOverview) setSmartOverview(data.smartOverview);
        }
      }
    } catch (e) {
      console.error("Failed to filter by day:", e);
    }
  };

  const handleRecalculate = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = await fetch("/api/analytics/stqi", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setRefreshMessage(data.message || "تم تحديث المؤشرات بنجاح");
        // Reload current view
        const getRes = await fetch(`/api/analytics/stqi?dayOfWeek=${selectedDay}`);
        const getData = await getRes.json();
        if (getData.success) {
          setHourlyData(getData.hourlyData || []);
          setBestWindow(getData.bestWindow);
          if (getData.smartOverview) setSmartOverview(getData.smartOverview);
        }
      } else {
        setRefreshMessage("فشل تحديث المؤشرات");
      }
    } catch (e) {
      setRefreshMessage("حدث خطأ أثناء التحديث");
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshMessage(null), 4000);
    }
  };

  const handleCopyRecommendation = (rec: SmartRecommendation) => {
    const text = `🎯 [توصية ذكية للبث المباشر - STQI]\nالعنوان: ${rec.title}\n${rec.subtitle}\nالتحليل: ${rec.description}\nالخطوات التنفيذية:\n${rec.actionItems.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopiedRecId(rec.id);
    setTimeout(() => setCopiedRecId(null), 2500);
  };

  // Compute aggregate KPIs from current data
  const maxDiamondsHour = hourlyData.length > 0 ? Math.max(...hourlyData.map((h) => h.avgDiamonds)) : 0;
  const maxCommentsHour = hourlyData.length > 0 ? Math.max(...hourlyData.map((h) => h.avgComments)) : 0;
  const maxConsistencyHour = hourlyData.length > 0 ? Math.max(...hourlyData.map((h) => h.consistencyScore)) : 0;
  const avgStqiOverall = hourlyData.length > 0 ? Math.round(hourlyData.reduce((acc, h) => acc + h.stqiScore, 0) / hourlyData.length) : 0;

  // Filter recommendations by selected category
  const filteredRecommendations = useMemo(() => {
    if (!smartOverview?.recommendations) return [];
    if (selectedRecCategory === "ALL") return smartOverview.recommendations;
    return smartOverview.recommendations.filter((r) => r.category === selectedRecCategory);
  }, [smartOverview, selectedRecCategory]);

  // Build 24-hour visual distribution array
  const fullDayTimeline = useMemo(() => {
    return Array.from({ length: 24 }, (_, hour) => {
      const match = hourlyData.find((h) => h.riyadhHour === hour);
      return {
        hour,
        formattedHour: formatHourWindow(hour),
        item: match || null,
      };
    });
  }, [hourlyData]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 1. TOP HEADER & INSTANT SYNC */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              التحليلات الزمنية ومؤشر جودة وقت البث (STQI)
            </h2>
            <ConfidenceBadge
              state={bestWindow ? bestWindow.confidenceState : "INSUFFICIENT_DATA"}
              methodology="مؤشر مركب محلي يحسب معدل الدعم، تفاعل التعليقات، والاستمرارية الإحصائية بتوقيت الرياض (Asia/Riyadh)"
            />
          </div>
          <p className="text-sm text-secondaryText max-w-3xl leading-relaxed">
            محرك تحليلات وخوارزميات ذكية لاستخراج التوصيات التكتيكية، فترات الذروة المليونية، وتحذيرات الإجهاد الزمني
            بناءً على 130+ جلسة حقيقية مرصودة.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {refreshMessage && (
            <span className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold animate-in fade-in">
              {refreshMessage}
            </span>
          )}
          <button
            onClick={handleRecalculate}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface hover:bg-elevated border border-turquoise/30 text-white text-xs font-bold transition-all shadow-md hover:shadow-turquoise/10 disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-turquoise" : ""}`} />
            <span>{isRefreshing ? "جاري الحساب الذكي..." : "تحديث التحليلات الآن"}</span>
          </button>
        </div>
      </div>

      {/* 2. EXECUTIVE DASHBOARD KPIS DECK (داش بورد المؤشرات القيادية الذكية) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Overall STQI Efficiency */}
        <div className="hud-deck p-5 rounded-2xl relative overflow-hidden border-t-4 border-t-turquoise flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-secondaryText mb-2 text-xs font-bold font-mono">
              <span>كفاءة البث العامة STQI</span>
              <div className="w-8 h-8 rounded-lg bg-turquoise/15 border border-turquoise/30 flex items-center justify-center text-turquoise">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-turquoise to-emerald-400 font-mono">
                {smartOverview?.overallEfficiencyScore || avgStqiOverall}
              </span>
              <span className="text-xs text-secondaryText font-mono">/ 100</span>
            </div>
          </div>
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-secondaryText">
            <span>معدل جودة الساعات النشطة</span>
            <span className="text-turquoise font-bold">
              {hourlyData.length} ساعات مرصودة
            </span>
          </div>
        </div>

        {/* KPI 2: Golden Launch Window */}
        <div className="hud-deck p-5 rounded-2xl relative overflow-hidden border-t-4 border-t-cyan-400 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-secondaryText mb-2 text-xs font-bold font-mono">
              <span>ساعة الانطلاق الذهبية</span>
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Target className="w-4 h-4" />
              </div>
            </div>
            <h4 className="text-xl font-black text-white mt-1">
              {smartOverview?.goldenLaunchWindow || "6:00 م — 7:00 م"}
            </h4>
          </div>
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-secondaryText">
            <span>ذروة التفاعل والمحادثة</span>
            <span className="text-cyan-400 font-bold">{maxCommentsHour.toLocaleString()} 💬/س</span>
          </div>
        </div>

        {/* KPI 3: Prime Battle Window */}
        <div className="hud-deck p-5 rounded-2xl relative overflow-hidden border-t-4 border-t-gold flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-secondaryText mb-2 text-xs font-bold font-mono">
              <span>نافذة النزالات والجولات</span>
              <div className="w-8 h-8 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center text-gold">
                <Swords className="w-4 h-4" />
              </div>
            </div>
            <h4 className="text-xl font-black text-white mt-1">
              {smartOverview?.primeBattleWindow || "8:00 م — 9:00 م"}
            </h4>
          </div>
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-secondaryText">
            <span>أعلى مؤشر تنافس STQI</span>
            <span className="text-gold font-bold">{bestWindow?.stqiScore || 76.2} ⭐</span>
          </div>
        </div>

        {/* KPI 4: Curfew / Fatigue Alert */}
        <div className="hud-deck p-5 rounded-2xl relative overflow-hidden border-t-4 border-t-rose-500 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-secondaryText mb-2 text-xs font-bold font-mono">
              <span>حد التوقف لتجنب الإجهاد</span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <h4 className="text-xl font-black text-white mt-1">
              {smartOverview?.curfewWindow || "بعد 02:00 صباحاً"}
            </h4>
          </div>
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-secondaryText">
            <span>انخفاض حاد في الدعم</span>
            <span className="text-rose-400 font-bold">-88% هبوط</span>
          </div>
        </div>
      </div>

      {/* 3. INTERACTIVE 24-HOUR VISUAL TIMELINE DASHBOARD (داش بورد المخطط الزمني التفاعلي) */}
      <div className="hud-deck p-6 md:p-8 rounded-2xl relative overflow-visible">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-turquoise" />
              <h3 className="text-xl font-bold text-white">المخطط البياني لتوزيع الساعات على مدار اليوم (24H Heatmap)</h3>
            </div>
            <p className="text-xs text-secondaryText mt-1">
              مقارنة بصرية شاملة لأداء كل ساعة بتوقيت الرياض — انقر أو مرر الفأرة فوق أي عمود لمعاينة أدائه بالتفصيل
            </p>
          </div>

          {/* Metric Switcher Tabs */}
          <div className="flex items-center gap-1.5 bg-background/80 p-1.5 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setActiveChartMetric("STQI")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeChartMetric === "STQI"
                  ? "bg-turquoise text-background shadow-md shadow-turquoise/20"
                  : "text-secondaryText hover:text-white"
              }`}
            >
              مؤشر STQI
            </button>
            <button
              onClick={() => setActiveChartMetric("DIAMONDS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeChartMetric === "DIAMONDS"
                  ? "bg-gold text-background shadow-md shadow-gold/20"
                  : "text-secondaryText hover:text-white"
              }`}
            >
              كثافة الماس 💎
            </button>
            <button
              onClick={() => setActiveChartMetric("COMMENTS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeChartMetric === "COMMENTS"
                  ? "bg-cyan-400 text-background shadow-md shadow-cyan-400/20"
                  : "text-secondaryText hover:text-white"
              }`}
            >
              التفاعل 💬
            </button>
            <button
              onClick={() => setActiveChartMetric("CONSISTENCY")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeChartMetric === "CONSISTENCY"
                  ? "bg-emerald-400 text-background shadow-md shadow-emerald-400/20"
                  : "text-secondaryText hover:text-white"
              }`}
            >
              الثبات %
            </button>
          </div>
        </div>

        {/* Live Hour Inspection Banner (شريط المعاينة والتفاصيل اللحظي الثابت) */}
        <div className="mb-6 p-4 md:p-5 rounded-2xl bg-surface/95 border border-turquoise/40 shadow-xl relative overflow-hidden transition-all">
          <div className="absolute top-0 right-0 w-64 h-64 bg-turquoise/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-turquoise/15 border border-turquoise/30 flex items-center justify-center text-turquoise shrink-0 shadow-inner">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-turquoise bg-turquoise/15 px-2.5 py-0.5 rounded-full border border-turquoise/30">
                    {hoveredHour !== null ? "معاينة فورية (تمرير الفأرة)" : "الساعة المحددة حالياً"}
                  </span>
                  {activeDetailItem && <ConfidenceBadge state={activeDetailItem.confidenceState as any} />}
                </div>
                <h4 className="text-lg md:text-xl font-black text-white mt-1 font-mono">
                  {formatHourWindow(activeDetailHour ?? (bestWindow?.hour ?? 0))}
                  <span className="text-xs font-normal text-secondaryText mr-2 font-sans">(بتوقيت الرياض)</span>
                </h4>
              </div>
            </div>

            {activeDetailItem ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center shrink-0">
                <div className="bg-background/90 p-2.5 px-4 rounded-xl border border-white/10 shadow-sm">
                  <span className="text-[10px] text-secondaryText block font-mono">مؤشر STQI</span>
                  <span className="text-xl font-black text-turquoise font-mono">
                    {activeDetailItem.stqiScore} <span className="text-[10px] font-normal text-secondaryText">/100</span>
                  </span>
                </div>
                <div className="bg-background/90 p-2.5 px-4 rounded-xl border border-white/10 shadow-sm">
                  <span className="text-[10px] text-secondaryText block font-mono">متوسط الماس/ساعة</span>
                  <span className="text-xl font-black text-gold font-mono">
                    <SupportValue value={activeDetailItem.avgDiamonds} suffix=" 💎" />
                  </span>
                </div>
                <div className="bg-background/90 p-2.5 px-4 rounded-xl border border-white/10 shadow-sm">
                  <span className="text-[10px] text-secondaryText block font-mono">التعليقات / س</span>
                  <span className="text-xl font-black text-white font-mono">
                    {activeDetailItem.avgComments.toLocaleString()} 💬
                  </span>
                </div>
                <div className="bg-background/90 p-2.5 px-4 rounded-xl border border-white/10 shadow-sm">
                  <span className="text-[10px] text-secondaryText block font-mono">نسبة الثبات</span>
                  <span className="text-xl font-black text-emerald-400 font-mono">
                    {Math.round(activeDetailItem.consistencyScore * 100)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-secondaryText bg-background/60 px-4 py-3 rounded-xl border border-white/10">
                لا توجد جلسات بث مسجلة في هذه الساعة المحددة حتى الآن
              </div>
            )}
          </div>
        </div>

        {/* The 24-Hour Column Chart */}
        <div className="bg-background/60 p-6 rounded-2xl border border-white/5 relative overflow-visible">
          <div className="h-64 flex items-end gap-1.5 md:gap-2.5 pb-8 pt-4 px-2 relative">
            {fullDayTimeline.map(({ hour, formattedHour, item }) => {
              let barHeightPercent = 6;
              let barColorClass = "bg-white/5 border border-white/5";
              let displayLabel = "—";

              if (item) {
                if (activeChartMetric === "STQI") {
                  barHeightPercent = Math.max(10, item.stqiScore);
                  displayLabel = `${item.stqiScore}`;
                  if (item.stqiScore >= 70) {
                    barColorClass = "bg-gradient-to-t from-amber-600 via-yellow-500 to-amber-300 border-amber-400 shadow-lg shadow-amber-500/20";
                  } else if (item.stqiScore >= 50) {
                    barColorClass = "bg-gradient-to-t from-cyan-600 via-teal-500 to-cyan-300 border-cyan-400 shadow-md shadow-cyan-500/20";
                  } else if (item.stqiScore >= 35) {
                    barColorClass = "bg-gradient-to-t from-blue-700 to-blue-500 border-blue-400";
                  } else {
                    barColorClass = "bg-gradient-to-t from-zinc-700 to-zinc-600 border-zinc-500";
                  }
                } else if (activeChartMetric === "DIAMONDS") {
                  const ratio = maxDiamondsHour > 0 ? item.avgDiamonds / maxDiamondsHour : 0;
                  barHeightPercent = Math.max(10, Math.round(ratio * 100));
                  displayLabel = item.avgDiamonds > 1000000 ? `${(item.avgDiamonds / 1000000).toFixed(1)}M` : `${Math.round(item.avgDiamonds / 1000)}k`;
                  barColorClass = "bg-gradient-to-t from-amber-600 to-yellow-400 border-amber-400 shadow-md shadow-amber-500/15";
                } else if (activeChartMetric === "COMMENTS") {
                  const ratio = maxCommentsHour > 0 ? item.avgComments / maxCommentsHour : 0;
                  barHeightPercent = Math.max(10, Math.round(ratio * 100));
                  displayLabel = `${item.avgComments.toLocaleString()}`;
                  barColorClass = "bg-gradient-to-t from-cyan-600 to-teal-400 border-cyan-400 shadow-md shadow-cyan-500/15";
                } else {
                  barHeightPercent = Math.max(10, Math.round(item.consistencyScore * 100));
                  displayLabel = `${Math.round(item.consistencyScore * 100)}%`;
                  barColorClass = "bg-gradient-to-t from-emerald-600 to-emerald-400 border-emerald-400 shadow-md shadow-emerald-500/15";
                }
              }

              const isHovered = hoveredHour === hour;
              const isPinned = pinnedHour === hour;
              const isBestWindowHour = bestWindow?.hour === hour;

              // Smart tooltip placement to prevent clipping on left/right screen edges
              const tooltipAlignClass =
                hour <= 4
                  ? "right-0 translate-x-0"
                  : hour >= 19
                  ? "left-0 translate-x-0"
                  : "left-1/2 -translate-x-1/2";

              return (
                <div
                  key={hour}
                  className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                  onMouseEnter={() => setHoveredHour(hour)}
                  onMouseLeave={() => setHoveredHour(null)}
                  onClick={() => setPinnedHour(hour)}
                >
                  {/* Floating Tooltip with Ultra-Crisp Styling & Smart Positioning */}
                  {isHovered && (
                    <div
                      dir="rtl"
                      className={`absolute bottom-full mb-3.5 z-50 w-72 bg-[#0c121e] border-2 border-turquoise/70 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.95)] text-right animate-in fade-in zoom-in-95 pointer-events-none ${tooltipAlignClass}`}
                    >
                      {/* Tooltip Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-turquoise shrink-0" />
                          <span className="font-bold text-white text-xs">{formattedHour}</span>
                        </div>
                        {item && <ConfidenceBadge state={item.confidenceState as any} />}
                      </div>

                      {item ? (
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between bg-surface/90 px-3 py-2 rounded-xl border border-white/5">
                            <span className="text-secondaryText text-[11px] font-medium">مؤشر الجودة STQI:</span>
                            <span className="font-black text-turquoise font-mono text-sm">{item.stqiScore} / 100</span>
                          </div>

                          <div className="flex items-center justify-between bg-surface/90 px-3 py-2 rounded-xl border border-white/5">
                            <span className="text-secondaryText text-[11px] font-medium">متوسط الماس / ساعة:</span>
                            <span className="font-extrabold text-gold font-mono text-sm">
                              <SupportValue value={item.avgDiamonds} suffix=" 💎" />
                            </span>
                          </div>

                          <div className="flex items-center justify-between bg-surface/90 px-3 py-2 rounded-xl border border-white/5">
                            <span className="text-secondaryText text-[11px] font-medium">متوسط التعليقات:</span>
                            <span className="font-bold text-white font-mono text-xs">{item.avgComments.toLocaleString()} 💬</span>
                          </div>

                          <div className="flex items-center justify-between bg-surface/90 px-3 py-2 rounded-xl border border-white/5">
                            <span className="text-secondaryText text-[11px] font-medium">نسبة الثبات:</span>
                            <span className="font-bold text-emerald-400 font-mono text-xs">
                              {Math.round(item.consistencyScore * 100)}%
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1.5 px-1 text-[11px] text-secondaryText font-mono">
                            <span>الجلسات المرصودة:</span>
                            <span className="text-white font-bold">{item.sampleSessions} جلسة</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-secondaryText text-center py-2">لا توجد جلسات مسجلة في هذا التوقيت</p>
                      )}

                      {/* Downward Pointer Arrow */}
                      <div
                        className={`absolute top-full w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-turquoise/70 ${
                          hour <= 4 ? "right-5" : hour >= 19 ? "left-5" : "left-1/2 -translate-x-1/2"
                        }`}
                      />
                    </div>
                  )}

                  {/* Value pill atop the bar */}
                  {item && (
                    <span
                      className={`text-[9px] font-mono mb-1 transition-opacity ${
                        isHovered || isPinned ? "opacity-100 font-bold text-white scale-110" : "opacity-60 text-secondaryText"
                      }`}
                    >
                      {displayLabel}
                    </span>
                  )}

                  {/* The Bar */}
                  <div
                    style={{ height: `${barHeightPercent}%` }}
                    className={`w-full rounded-t-lg transition-all duration-300 relative ${barColorClass} ${
                      isHovered ? "ring-2 ring-white scale-y-105" : ""
                    } ${isPinned ? "ring-2 ring-turquoise shadow-lg" : ""} ${isBestWindowHour ? "ring-2 ring-gold" : ""}`}
                  >
                    {isBestWindowHour && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-gold animate-bounce">
                        ★
                      </span>
                    )}
                  </div>

                  {/* Hour label below */}
                  <span
                    className={`absolute bottom-0 text-[10px] font-mono mt-2 transition-colors ${
                      isHovered || isPinned
                        ? "text-turquoise font-bold"
                        : isBestWindowHour
                        ? "text-gold font-bold"
                        : item
                        ? "text-white"
                        : "text-secondaryText/40"
                    }`}
                  >
                    {hour === 0 ? "12ص" : hour === 12 ? "12م" : hour > 12 ? `${hour - 12}م` : `${hour}ص`}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="pt-4 mt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-secondaryText">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-amber-400" />
                فترة ذهبية (STQI ≥ 70)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-cyan-400" />
                نشاط تكتيكي مرتفع (50 — 69)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-blue-500" />
                نشاط متوسط (35 — 49)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-zinc-600" />
                فتور / راحة (&lt; 35)
              </span>
            </div>
            <span className="text-secondaryText text-[11px]">
              ★ النجمة تشير إلى الفترة الأكثر كفاءة واستقراراً
            </span>
          </div>
        </div>
      </div>

      {/* 4. SMART AI RECOMMENDATIONS CENTER (مركز التوصيات والاستراتيجيات الذكية) */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-gold" />
              التوصيات التكتيكية والتحليل الذكي للبث
            </h3>
            <p className="text-xs text-secondaryText mt-1">
              توصيات تشغيلية مستخرجة خوارزمياً لمضاعفة الإيرادات، توقيت النزالات، وتفادي استنزاف الجهد
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {REC_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedRecCategory(cat.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedRecCategory === cat.value
                    ? "bg-turquoise/20 text-turquoise border border-turquoise/40 shadow-sm"
                    : "bg-surface hover:bg-elevated text-secondaryText hover:text-white border border-white/5"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recommendations Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredRecommendations.map((rec) => {
            const isCopied = copiedRecId === rec.id;

            const borderColors: Record<string, string> = {
              gold: "border-t-gold",
              turquoise: "border-t-turquoise",
              emerald: "border-t-emerald-400",
              rose: "border-t-rose-500",
              purple: "border-t-purple-400",
            };

            const badgeBg: Record<string, string> = {
              gold: "bg-gold/15 text-gold border-gold/30",
              turquoise: "bg-turquoise/15 text-turquoise border-turquoise/30",
              emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
              rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
              purple: "bg-purple-500/15 text-purple-300 border-purple-500/30",
            };

            const iconMap: Record<string, React.ReactNode> = {
              Target: <Target className="w-5 h-5 text-turquoise" />,
              Swords: <Swords className="w-5 h-5 text-gold" />,
              Flame: <Flame className="w-5 h-5 text-emerald-400" />,
              AlertTriangle: <AlertTriangle className="w-5 h-5 text-rose-400" />,
              Zap: <Zap className="w-5 h-5 text-purple-400" />,
            };

            return (
              <div
                key={rec.id}
                className={`hud-deck p-6 rounded-2xl relative overflow-hidden border-t-4 ${
                  borderColors[rec.badgeColor] || "border-t-turquoise"
                } flex flex-col justify-between hover:border-white/20 transition-all`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-surface border border-white/10 flex items-center justify-center shadow-inner">
                        {iconMap[rec.icon] || <Sparkles className="w-5 h-5 text-gold" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeBg[rec.badgeColor]}`}>
                            {rec.badge}
                          </span>
                          <span className="text-[11px] font-mono text-secondaryText">
                            {rec.confidencePercent}% دقة إحصائية
                          </span>
                        </div>
                        <h4 className="text-base font-black text-white">{rec.title}</h4>
                        <p className="text-xs font-mono text-turquoise mt-0.5">{rec.subtitle}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCopyRecommendation(rec)}
                      className="text-secondaryText hover:text-white p-2 rounded-lg bg-surface hover:bg-elevated border border-white/5 transition-colors shrink-0"
                      title="نسخ التوصية"
                    >
                      {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Narrative Analysis */}
                  <p className="text-xs text-secondaryText leading-relaxed mb-4 bg-background/50 p-3.5 rounded-xl border border-white/5">
                    {rec.description}
                  </p>

                  {/* Evidence & Metrics Snapshot */}
                  {rec.metricsSnapshot && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface/80 border border-white/10 text-xs mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-secondaryText">المعيار الميداني:</span>
                        <span className="font-bold text-white font-mono">{rec.metricsSnapshot.windowArabic}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-secondaryText">{rec.metricsSnapshot.primaryMetricLabel}:</span>
                        <span className="font-extrabold text-gold font-mono">{rec.metricsSnapshot.primaryMetricValue}</span>
                      </div>
                    </div>
                  )}

                  {/* Actionable Steps Checklist */}
                  <div className="space-y-2 mb-2">
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider block">
                      الخطوات التنفيذية الموصى بها:
                    </span>
                    <ul className="space-y-1.5">
                      {rec.actionItems.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-secondaryText">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-3 mt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-secondaryText font-mono">
                  <span>تم الفحص والتحليل عبر محرك STQI</span>
                  <span className="text-emerald-400 font-bold">جاهزة للتطبيق ⚡</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. HOURLY PERFORMANCE BREAKDOWN TABLE & DAY FILTER */}
      <div className="hud-deck rounded-2xl p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-turquoise" />
              سجل أداء الساعات الكامل (بتوقيت الرياض)
            </h3>
            <p className="text-xs text-secondaryText mt-0.5">
              جدول إحصائي تفصيلي يوضح أداء كل ساعة مسجلة بدقة مع معدلات الاستقرار والثقة
            </p>
          </div>

          {/* Filter Tabs by Day */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {DAYS_OF_WEEK.map((d) => (
              <button
                key={d.value}
                onClick={() => handleDayChange(d.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedDay === d.value
                    ? "bg-turquoise/20 text-turquoise border border-turquoise/40 shadow-sm"
                    : "bg-surface hover:bg-elevated text-secondaryText hover:text-white border border-white/5"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {hourlyData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b border-white/10 text-xs text-secondaryText font-mono">
                  <th className="pb-3 pr-2 font-bold">الفترة الزمنية</th>
                  <th className="pb-3 font-bold">الجلسات</th>
                  <th className="pb-3 font-bold text-center">متوسط الماس/ساعة 💎</th>
                  <th className="pb-3 font-bold text-center">التعليقات 💬</th>
                  <th className="pb-3 font-bold text-center">الإعجابات ❤️</th>
                  <th className="pb-3 font-bold text-center">معدل الاستمرارية</th>
                  <th className="pb-3 font-bold text-center">مؤشر STQI</th>
                  <th className="pb-3 font-bold text-center">حالة الثقة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {hourlyData.map((h) => {
                  const isTop = bestWindow && bestWindow.hour === h.riyadhHour && selectedDay === -1;
                  return (
                    <tr
                      key={h.id}
                      className={`hover:bg-white/[0.03] transition-colors ${
                        isTop ? "bg-gold/[0.05] border-r-4 border-r-gold" : ""
                      }`}
                    >
                      <td className="py-4 pr-2 font-bold text-white flex items-center gap-2 font-mono">
                        {isTop && <Sparkles className="w-3.5 h-3.5 text-gold shrink-0" />}
                        <span>{formatHourWindow(h.riyadhHour)}</span>
                      </td>
                      <td className="py-4 text-secondaryText font-mono">{h.sampleSessions} جلسات</td>
                      <td className="py-4 text-center font-bold text-gold font-mono text-base">
                        <SupportValue value={h.avgDiamonds} suffix=" 💎" />
                      </td>
                      <td className="py-4 text-center text-white font-mono">{h.avgComments.toLocaleString()}</td>
                      <td className="py-4 text-center text-secondaryText font-mono">{h.avgLikes.toLocaleString()}</td>
                      <td className="py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-turquoise rounded-full"
                              style={{ width: `${Math.round(h.consistencyScore * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-turquoise font-mono font-bold">
                            {Math.round(h.consistencyScore * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        <span
                          className={`font-black text-sm px-2.5 py-1 rounded-lg font-mono ${
                            h.stqiScore >= 70
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              : h.stqiScore >= 50
                              ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                              : "bg-zinc-500/15 text-zinc-300 border border-zinc-500/30"
                          }`}
                        >
                          {h.stqiScore}
                        </span>
                      </td>
                      <td className="py-4 text-center">
                        <ConfidenceBadge state={h.confidenceState as any} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-secondaryText">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">لا توجد بيانات مسجلة لهذا اليوم المحدد حتى الآن.</p>
          </div>
        )}
      </div>

      {/* 6. METHODOLOGY PILLARS */}
      <div className="hud-deck rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-5 h-5 text-gold" />
          <h4 className="text-base font-bold text-white">
            الركائز العلمية لاحتساب مؤشر جودة وقت البث (STQI Methodology)
          </h4>
        </div>
        <p className="text-xs text-secondaryText leading-relaxed mb-6">
          صُمم مؤشر STQI (Stream Time Quality Index) لمنع الخداع الإحصائي الناتج عن &quot;الجلسة الواحدة الاستثنائية&quot;.
          فلا يكفي أن يسجل البث دعماً ضخماً في ساعة واحدة لمرة واحدة حتى يُعتمد كوقت مثالي؛ بل يشترط المؤشر تكرار الجلسات واستقرار التفاعل وتماسك الحضور.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-background/60 p-4 rounded-xl border border-white/5">
            <span className="font-bold text-gold block mb-1 text-sm">1. كثافة الدعم المالي (35%)</span>
            <p className="text-secondaryText text-[11px] leading-relaxed">
              معدل تدفق الماس في الدقيقة والساعة خلال الفترة مقارنة بأعلى ذروة مسجلة في كامل تاريخ البث.
            </p>
          </div>
          <div className="bg-background/60 p-4 rounded-xl border border-white/5">
            <span className="font-bold text-turquoise block mb-1 text-sm">2. كثافة التفاعل والمحادثة (25%)</span>
            <p className="text-secondaryText text-[11px] leading-relaxed">
              سرعة تدفق التعليقات والإعجابات لضمان أن الروم حيوي ومتفاعل ومستعد لدعم النزالات.
            </p>
          </div>
          <div className="bg-background/60 p-4 rounded-xl border border-white/5">
            <span className="font-bold text-emerald-400 block mb-1 text-sm">3. استقرار وثبات الجلسات (25%)</span>
            <p className="text-secondaryText text-[11px] leading-relaxed">
              يقاس عبر معامل التباين الإحصائي (Variance) للتأكد من تقارب أداء الجلسات المختلفة في نفس التوقيت وعدم تذبذبها.
            </p>
          </div>
          <div className="bg-background/60 p-4 rounded-xl border border-white/5">
            <span className="font-bold text-purple-400 block mb-1 text-sm">4. موثوقية وتكرار العينة (15%)</span>
            <p className="text-secondaryText text-[11px] leading-relaxed">
              كلما تكرر البث في نفس الساعة (3 جلسات فأكثر)، ارتفعت درجة الثقة من غير كافٍ إلى جزئي ثم قطعي معتمد.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
