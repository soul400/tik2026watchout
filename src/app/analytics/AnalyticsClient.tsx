"use client";

import { useState } from "react";
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
} from "lucide-react";

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

export function AnalyticsClient({ initialHourly, initialBestWindow }: Props) {
  const [selectedDay, setSelectedDay] = useState<number>(-1);
  const [hourlyData, setHourlyData] = useState<HourlyItem[]>(initialHourly);
  const [bestWindow, setBestWindow] = useState<BestWindow | null>(initialBestWindow);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

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

  // Compute aggregate KPIs from current data
  const maxDiamondsHour = hourlyData.length > 0 ? Math.max(...hourlyData.map((h) => h.avgDiamonds)) : 0;
  const maxConsistencyHour = hourlyData.length > 0 ? Math.max(...hourlyData.map((h) => h.consistencyScore)) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with Title and Recalculate Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              التحليلات الزمنية ومؤشر جودة وقت البث (STQI)
            </h2>
            <ConfidenceBadge
              state={bestWindow ? bestWindow.confidenceState : "INSUFFICIENT_DATA"}
              methodology="مؤشر مركب محلي يحسب معدل الدعم، تفاعل التعليقات، والاستمرارية الإحصائية بتوقيت الرياض (Asia/Riyadh)"
            />
          </div>
          <p className="text-sm text-secondaryText">
            تقييم خوارزمي موضوعي لجودة فترات البث مبني على الجلسات الحقيقية المسجلة فقط — بدون افتراضات وهمية
          </p>
        </div>

        <div className="flex items-center gap-3">
          {refreshMessage && (
            <span className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              {refreshMessage}
            </span>
          )}
          <button
            onClick={handleRecalculate}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface hover:bg-elevated border border-white/10 text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-turquoise" : ""}`} />
            <span>{isRefreshing ? "جاري الحساب..." : "تحديث المؤشرات الآن"}</span>
          </button>
        </div>
      </div>

      {/* Recommended Time Spotlight (100% Dynamic) */}
      {bestWindow ? (
        <div className="bg-gradient-to-r from-surface via-elevated to-surface p-6 rounded-2xl border border-gold/20 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-gold/10 text-gold border border-gold/20 inline-flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  الفترة الذهبية الأكثر كفاءة واستقراراً
                </span>
                <span className="text-xs text-secondaryText">
                  ({bestWindow.sampleSessions} جلسات مكتملة)
                </span>
              </div>

              <h3 className="text-2xl font-black text-white">
                {bestWindow.formattedHourArabic} <span className="text-sm font-normal text-secondaryText">(توقيت الرياض)</span>
              </h3>

              <p className="text-xs text-secondaryText max-w-2xl leading-relaxed">
                {bestWindow.summaryArabic}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs">
                <div className="bg-background/40 px-3 py-1.5 rounded-lg border border-white/5">
                  <span className="text-secondaryText block text-[10px]">متوسط الدعم</span>
                  <span className="font-bold text-gold">{bestWindow.avgDiamonds.toLocaleString()} 💎 / ساعة</span>
                </div>
                <div className="bg-background/40 px-3 py-1.5 rounded-lg border border-white/5">
                  <span className="text-secondaryText block text-[10px]">متوسط التعليقات</span>
                  <span className="font-bold text-turquoise">{bestWindow.avgComments.toLocaleString()} 💬</span>
                </div>
                <div className="bg-background/40 px-3 py-1.5 rounded-lg border border-white/5">
                  <span className="text-secondaryText block text-[10px]">متوسط الإعجابات</span>
                  <span className="font-bold text-rose-400">{bestWindow.avgLikes.toLocaleString()} ❤️</span>
                </div>
                <div className="bg-background/40 px-3 py-1.5 rounded-lg border border-white/5">
                  <span className="text-secondaryText block text-[10px]">معدل الاستمرارية</span>
                  <span className="font-bold text-emerald-400">{bestWindow.consistencyPercent}%</span>
                </div>
              </div>
            </div>

            <div className="bg-background/80 p-5 rounded-2xl border border-white/10 text-center min-w-[170px] shadow-inner flex flex-col items-center justify-center">
              <span className="text-xs text-secondaryText font-medium block mb-1">مؤشر الجودة STQI</span>
              <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-turquoise to-emerald-400">
                {bestWindow.stqiScore}
              </span>
              <span className="text-[11px] font-bold text-emerald-400 block mt-1">
                {bestWindow.stqiScore >= 70
                  ? "درجة استثنائية ⭐"
                  : bestWindow.stqiScore >= 50
                  ? "أداء قوي ومستقر"
                  : "أداء متوسط"}
              </span>
              <div className="mt-3">
                <ConfidenceBadge state={bestWindow.confidenceState} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface p-6 rounded-2xl border border-white/5 text-center py-8">
          <Clock className="w-8 h-8 text-secondaryText mx-auto mb-2 opacity-50" />
          <h3 className="text-base font-semibold text-white">لا توجد بيانات جلسات كافية بعد</h3>
          <p className="text-xs text-secondaryText mt-1">
            سيبدأ النظام في حساب مؤشر جودة وقت البث تلقائياً فور تسجيل جلسات بث حقيقية.
          </p>
        </div>
      )}

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-secondaryText mb-1">
            <span className="text-xs">فترات الذروة المرصودة</span>
            <Clock className="w-4 h-4 text-turquoise" />
          </div>
          <span className="text-xl font-bold text-white">{hourlyData.length} فترة</span>
          <span className="text-[11px] text-secondaryText block mt-0.5">ساعات تغطية نشطة</span>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-secondaryText mb-1">
            <span className="text-xs">أعلى كثافة دعم بالماس</span>
            <Flame className="w-4 h-4 text-gold" />
          </div>
          <span className="text-xl font-bold text-gold">{maxDiamondsHour.toLocaleString()} 💎</span>
          <span className="text-[11px] text-secondaryText block mt-0.5">لكل ساعة في الذروة</span>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-secondaryText mb-1">
            <span className="text-xs">أعلى مؤشر ثبات</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-xl font-bold text-emerald-400">
            {Math.round(maxConsistencyHour * 100)}%
          </span>
          <span className="text-[11px] text-secondaryText block mt-0.5">استقرار عالي بين الجلسات</span>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-secondaryText mb-1">
            <span className="text-xs">المعيار الزمني</span>
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-xl font-bold text-white">توقيت الرياض</span>
          <span className="text-[11px] text-secondaryText block mt-0.5">Asia/Riyadh (UTC+3)</span>
        </div>
      </div>

      {/* Filter Tabs by Day */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {DAYS_OF_WEEK.map((d) => (
          <button
            key={d.value}
            onClick={() => handleDayChange(d.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedDay === d.value
                ? "bg-turquoise/15 text-turquoise border border-turquoise/30"
                : "bg-surface hover:bg-elevated text-secondaryText hover:text-white border border-white/5"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Hourly Performance Breakdown Table */}
      <div className="bg-surface rounded-xl border border-white/5 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">سجل أداء الساعات (بتوقيت الرياض)</h3>
            <p className="text-xs text-secondaryText mt-0.5">
              ترتيب الساعات التي شهدت نشاط بث فعلي وتحليل جودتها وفق مؤشر STQI
            </p>
          </div>
          <span className="text-xs text-secondaryText">
            إجمالي الساعات المسجلة: {hourlyData.length}
          </span>
        </div>

        {hourlyData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b border-white/5 text-xs text-secondaryText">
                  <th className="pb-3 font-medium">الفترة الزمنية</th>
                  <th className="pb-3 font-medium">الجلسات المرصودة</th>
                  <th className="pb-3 font-medium">متوسط الماس/ساعة</th>
                  <th className="pb-3 font-medium">متوسط التعليقات</th>
                  <th className="pb-3 font-medium">متوسط الإعجابات</th>
                  <th className="pb-3 font-medium">معدل الاستمرارية</th>
                  <th className="pb-3 font-medium">مؤشر STQI</th>
                  <th className="pb-3 font-medium">حالة الثقة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {hourlyData.map((h) => {
                  const isTop = bestWindow && bestWindow.hour === h.riyadhHour && selectedDay === -1;
                  return (
                    <tr
                      key={h.id}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        isTop ? "bg-gold/[0.03] border-l-2 border-gold" : ""
                      }`}
                    >
                      <td className="py-3 font-bold text-white flex items-center gap-2">
                        {isTop && <Sparkles className="w-3.5 h-3.5 text-gold shrink-0" />}
                        <span>{formatHourWindow(h.riyadhHour)}</span>
                      </td>
                      <td className="py-3 text-secondaryText">{h.sampleSessions} جلسات</td>
                      <td className="py-3 font-bold text-gold">{h.avgDiamonds.toLocaleString()} 💎</td>
                      <td className="py-3 text-white">{h.avgComments.toLocaleString()} 💬</td>
                      <td className="py-3 text-secondaryText">{h.avgLikes.toLocaleString()} ❤️</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full bg-turquoise rounded-full"
                              style={{ width: `${Math.round(h.consistencyScore * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-turquoise">
                            {Math.round(h.consistencyScore * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`font-black text-sm px-2 py-0.5 rounded ${
                            h.stqiScore >= 70
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : h.stqiScore >= 50
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {h.stqiScore}
                        </span>
                      </td>
                      <td className="py-3">
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

      {/* Methodology & Quality Pillars */}
      <div className="bg-surface rounded-xl border border-white/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-gold" />
          <h4 className="text-sm font-semibold text-white">
            منهجية احتساب مؤشر جودة وقت البث (STQI Methodology)
          </h4>
        </div>
        <p className="text-xs text-secondaryText leading-relaxed mb-4">
          صُمم مؤشر STQI (Stream Time Quality Index) لمنع الخداع الإحصائي الناتج عن &quot;الجلسة الواحدة الاستثنائية&quot;.
          فلا يكفي أن يسجل البث دعماً ضخماً في ساعة واحدة لمرة واحدة حتى يُعتمد كوقت مثالي؛ بل يشترط المؤشر تكرار الجلسات واستقرار التفاعل.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-background/40 p-3 rounded-lg border border-white/5">
            <span className="font-bold text-gold block mb-1">1. كثافة الدعم المالي (35%)</span>
            <p className="text-secondaryText text-[11px]">
              معدل تدفق الماس في الدقيقة والساعة خلال الفترة مقارنة بأعلى ذروة مسجلة.
            </p>
          </div>
          <div className="bg-background/40 p-3 rounded-lg border border-white/5">
            <span className="font-bold text-turquoise block mb-1">2. كثافة التفاعل والمحادثة (25%)</span>
            <p className="text-secondaryText text-[11px]">
              سرعة تدفق التعليقات والإعجابات لضمان أن الجمهور حاضر ومتفاعل وليس صامتاً.
            </p>
          </div>
          <div className="bg-background/40 p-3 rounded-lg border border-white/5">
            <span className="font-bold text-emerald-400 block mb-1">3. استقرار وثبات الجلسات (25%)</span>
            <p className="text-secondaryText text-[11px]">
              يقاس عبر معامل التباين الإحصائي (Variance) للتأكد من تقارب أداء الجلسات المختلفة في نفس التوقيت.
            </p>
          </div>
          <div className="bg-background/40 p-3 rounded-lg border border-white/5">
            <span className="font-bold text-blue-400 block mb-1">4. موثوقية وتكرار العينة (15%)</span>
            <p className="text-secondaryText text-[11px]">
              كلما تكرر البث في نفس الساعة (3 جلسات فأكثر)، ارتفعت درجة الثقة من غير كافٍ إلى جزئي ثم قطعي.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
