"use client";

import { useState, useMemo } from "react";
import {
  ScoredChampion,
  ChampionsOverview,
  ChampionRecommendation,
  PeriodOption,
} from "@/lib/champions-engine";
import { DigitalCounter } from "@/components/DigitalCounter";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import {
  Trophy,
  Award,
  Crown,
  Flame,
  MessageSquare,
  Heart,
  Clock,
  Sparkles,
  ShieldCheck,
  Ban,
  UserCheck,
  Search,
  Filter,
  Check,
  Copy,
  TrendingUp,
  Users,
  Target,
  Zap,
  Activity,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  Share2,
  Calendar,
  CalendarDays,
  CalendarRange,
  Loader2,
} from "lucide-react";

export function SupporterAvatar({
  avatarUrl,
  displayName,
  size = "md",
  className = "",
  ringColor = "border-white/10",
}: {
  avatarUrl: string | null;
  displayName: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  ringColor?: string;
}) {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-11 h-11 text-sm",
    lg: "w-16 h-16 text-base",
    xl: "w-20 h-20 md:w-24 md:h-24 text-xl",
  }[size];

  if (avatarUrl && !hasError) {
    return (
      <img
        src={avatarUrl}
        alt={displayName}
        className={`${sizeClasses} rounded-2xl object-cover shrink-0 border ${ringColor} shadow-md ${className}`}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
      />
    );
  }

  const initial = displayName ? displayName.trim().charAt(0).toUpperCase() : "👤";
  return (
    <div
      className={`${sizeClasses} rounded-2xl bg-gradient-to-br from-elevated to-surface border ${ringColor} flex items-center justify-center font-bold text-gold shrink-0 shadow-inner ${className}`}
    >
      {initial}
    </div>
  );
}

interface ChampionsClientProps {
  initialChampions: ScoredChampion[];
  initialOverview: ChampionsOverview;
  initialPeriod?: PeriodOption;
  presetPeriods?: {
    weekly: PeriodOption[];
    monthly: PeriodOption[];
  };
}

export function ChampionsClient({
  initialChampions,
  initialOverview,
  initialPeriod,
  presetPeriods,
}: ChampionsClientProps) {
  const [periodType, setPeriodType] = useState<"WEEKLY" | "MONTHLY">(
    initialPeriod?.type || "WEEKLY"
  );
  const [periods] = useState(
    presetPeriods || {
      weekly: [],
      monthly: [],
    }
  );
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption | null>(
    initialPeriod || (presetPeriods ? presetPeriods.weekly[0] : null)
  );
  const [champions, setChampions] = useState<ScoredChampion[]>(initialChampions);
  const [overview, setOverview] = useState<ChampionsOverview>(initialOverview);
  const [isLoadingPeriod, setIsLoadingPeriod] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArchetype, setSelectedArchetype] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Switch specific period handler (fetch from API)
  const handleSelectPeriod = async (targetPeriod: PeriodOption) => {
    if (selectedPeriod?.id === targetPeriod.id && selectedPeriod?.type === targetPeriod.type) return;
    setSelectedPeriod(targetPeriod);
    setPeriodType(targetPeriod.type);
    setIsLoadingPeriod(true);

    try {
      const res = await fetch(
        `/api/champions?periodType=${targetPeriod.type}&startDate=${encodeURIComponent(
          targetPeriod.startDate
        )}&endDate=${encodeURIComponent(targetPeriod.endDate)}`
      );
      const json = await res.json();
      if (json.success) {
        setChampions(json.champions || []);
        if (json.overview) {
          setOverview(json.overview);
        }
      }
    } catch (err) {
      console.error("Failed to fetch champions for period:", err);
    } finally {
      setIsLoadingPeriod(false);
    }
  };

  // Switch period type (WEEKLY <-> MONTHLY)
  const handleSwitchPeriodType = (newType: "WEEKLY" | "MONTHLY") => {
    if (newType === periodType) return;
    const availableList = newType === "WEEKLY" ? periods.weekly : periods.monthly;
    const firstPeriod = availableList[0];
    if (firstPeriod) {
      handleSelectPeriod(firstPeriod);
    }
  };

  // Copy recommendation handler
  const handleCopyRecommendation = (rec: ChampionRecommendation) => {
    const textToCopy = `📋 [خطة تكتيكية مقترحة: ${rec.title}]
🎯 التصنيف: ${rec.badge} (دقة التحليل: ${rec.confidencePercent}%)
👤 البطل المستهدف: ${rec.targetChampion ? `${rec.targetChampion.displayName} (@${rec.targetChampion.username}) - ${rec.targetChampion.metricLabel}: ${rec.targetChampion.metricValue}` : "عام للروم"}

🔍 التشخيص:
${rec.description}

📊 الشواهد الميدانية:
${rec.evidence}

⚡ خطوات التنفيذ:
${rec.actionItems.map((item, idx) => `${idx + 1}. ${item}`).join("\n")}
`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedId(rec.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Filter champions
  const filteredChampions = useMemo(() => {
    return champions.filter((champ) => {
      const matchesSearch =
        champ.supporter.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        champ.supporter.username.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesArchetype =
        selectedArchetype === "ALL" || champ.archetype === selectedArchetype;

      return matchesSearch && matchesArchetype;
    });
  }, [champions, searchQuery, selectedArchetype]);

  // Filter recommendations
  const filteredRecommendations = useMemo(() => {
    if (selectedCategory === "ALL") return overview.recommendations;
    return overview.recommendations.filter((rec) => rec.category === selectedCategory);
  }, [overview.recommendations, selectedCategory]);

  const top3 = champions.slice(0, 3);

  return (
    <div className="space-y-10">
      {/* 0. STATISTICAL PERIOD SELECTOR & TIMELINE CONTROLS */}
      <div className="cyber-card p-5 md:p-6 rounded-2xl relative overflow-hidden border border-white/10 bg-elevated/70">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Header Info */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-gold/15 text-gold border border-gold/30">
                <CalendarDays className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  النطاق الزمني للإحصائيات والتتويج
                  {isLoadingPeriod && (
                    <Loader2 className="w-4 h-4 text-gold animate-spin" />
                  )}
                </h3>
                <p className="text-xs text-secondaryText">
                  {periodType === "WEEKLY"
                    ? "إحصائية أسبوعية معتمدة؛ استعراض المراكز الثلاثة الأولى بنهاية كل أسبوع بتاريخه"
                    : "إحصائية شهرية معتمدة؛ استعراض المراكز الثلاثة الأولى بنهاية كل شهر معتمد"}
                </p>
              </div>
            </div>
          </div>

          {/* Period Type Switcher (Weekly vs Monthly) */}
          <div className="flex items-center gap-2 bg-background/90 p-1.5 rounded-2xl border border-white/10 shadow-inner">
            <button
              onClick={() => handleSwitchPeriodType("WEEKLY")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                periodType === "WEEKLY"
                  ? "bg-gradient-to-r from-amber-500 to-gold text-black shadow-lg shadow-gold/20"
                  : "text-secondaryText hover:text-white hover:bg-white/5"
              }`}
            >
              <CalendarRange className="w-4 h-4" />
              <span>إحصائية أسبوعية (نهاية الأسبوع)</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  periodType === "WEEKLY"
                    ? "bg-black/20 text-black font-black"
                    : "bg-white/10 text-secondaryText"
                }`}
              >
                {periods.weekly.length} أسابيع
              </span>
            </button>

            <button
              onClick={() => handleSwitchPeriodType("MONTHLY")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                periodType === "MONTHLY"
                  ? "bg-gradient-to-r from-amber-500 to-gold text-black shadow-lg shadow-gold/20"
                  : "text-secondaryText hover:text-white hover:bg-white/5"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>إحصائية شهرية (نهاية الشهر)</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  periodType === "MONTHLY"
                    ? "bg-black/20 text-black font-black"
                    : "bg-white/10 text-secondaryText"
                }`}
              >
                {periods.monthly.length} أشهر
              </span>
            </button>
          </div>
        </div>

        {/* Timeline Pills List */}
        <div className="mt-5 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-semibold text-secondaryText">
              {periodType === "WEEKLY"
                ? "اختر تاريخ الأسبوع لعرض الترتيب والتتويج:"
                : "اختر الشهر المطلوب لعرض الترتيب والتتويج:"}
            </span>
            {selectedPeriod && (
              <span className="text-xs font-mono font-bold text-gold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                الفترة المحددة: {selectedPeriod.sublabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
            {(periodType === "WEEKLY" ? periods.weekly : periods.monthly).map((p) => {
              const isSelected =
                selectedPeriod?.id === p.id && selectedPeriod?.type === p.type;
              return (
                <button
                  key={`${p.type}_${p.id}`}
                  onClick={() => handleSelectPeriod(p)}
                  disabled={isLoadingPeriod}
                  className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
                    isSelected
                      ? "bg-gold/15 text-gold border-gold shadow-sm shadow-gold/20 font-bold"
                      : "bg-background/60 text-secondaryText border-white/5 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>{p.label}</span>
                  {p.isCurrent && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold">
                      نشط الآن
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 1. EXECUTIVE DASHBOARD KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Community Health Score */}
        <div className="cyber-card p-5 rounded-2xl relative overflow-hidden border border-gold/30 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-28 h-28 bg-gold/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-secondaryText">مؤشر حيوية المجتمع</span>
            <div className="p-2 rounded-xl bg-gold/15 text-gold border border-gold/25">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-gold font-mono">
                {overview.communityHealthScore}%
              </span>
              <span className="text-xs text-emerald-400 font-bold">ممتاز واستثنائي</span>
            </div>
            <p className="text-[11px] text-secondaryText mt-1">
              متوسط التفاعل العضوي لكل متابع دون اشتراط الهدايا
            </p>
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-gold h-full rounded-full transition-all duration-1000"
              style={{ width: `${overview.communityHealthScore}%` }}
            />
          </div>
        </div>

        {/* KPI 2: Active Organic Community */}
        <div className="cyber-card p-5 rounded-2xl relative overflow-hidden border border-turquoise/30 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-28 h-28 bg-turquoise/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-secondaryText">جمهور البث العضوي</span>
            <div className="p-2 rounded-xl bg-turquoise/15 text-turquoise border border-turquoise/25">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <DigitalCounter
                value={overview.totalAudienceCount}
                size="xl"
                color="text-white"
                suffix="عضو"
              />
            </div>
            <p className="text-[11px] text-secondaryText mt-1">
              متابعون تم رصد حضورهم وتفاعلهم الفعلي
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-turquoise mt-3 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>بطل التواجد: {overview.topChampion.displayName}</span>
          </div>
        </div>

        {/* KPI 3: Total Organic Likes / Taps */}
        <div className="cyber-card p-5 rounded-2xl relative overflow-hidden border border-purple/30 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-28 h-28 bg-purple/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-secondaryText">قوة التكبيس العضوي</span>
            <div className="p-2 rounded-xl bg-purple/15 text-purple border border-purple/25">
              <Heart className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <DigitalCounter
                value={overview.totalOrganicLikes}
                size="xl"
                color="text-white"
                suffix="تكبيسة"
              />
            </div>
            <p className="text-[11px] text-secondaryText mt-1">
              مجموع الإعجابات الحقيقية المحفزة لخوارزمية FYP
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-purple mt-3 font-medium truncate">
            <Flame className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              عملاق التكبيس: {overview.topLiker.displayName} (
              {overview.topLiker.count.toLocaleString()})
            </span>
          </div>
        </div>

        {/* KPI 4: Total Chat Comments */}
        <div className="cyber-card p-5 rounded-2xl relative overflow-hidden border border-blue-500/30 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-secondaryText">مشاركات الشات والحوار</span>
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <DigitalCounter
                value={overview.totalChatComments}
                size="xl"
                color="text-white"
                suffix="رسالة"
              />
            </div>
            <p className="text-[11px] text-secondaryText mt-1">
              تعليقات بناءة أثرت النقاش ودعمت البث
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-blue-400 mt-3 font-medium truncate">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              رائد الحوار: {overview.topCommenter.displayName} (
              {overview.topCommenter.count.toLocaleString()})
            </span>
          </div>
        </div>
      </div>

      {/* 2. THE ROYAL PODIUM (منصة التتويج الشرفية للثلاثة الأوائل) */}
      <div className="cyber-card p-6 md:p-8 rounded-3xl relative overflow-hidden border border-gold/30">
        <div className="text-center mb-8">
          <div className="inline-flex flex-wrap items-center justify-center gap-2 mb-3">
            <span className="px-3 py-1 rounded-full bg-gold/15 text-gold text-xs font-bold border border-gold/30 inline-flex items-center gap-1.5 shadow-sm">
              <Trophy className="w-3.5 h-3.5" />
              {periodType === "WEEKLY"
                ? "منصة التتويج الشرفية لأبطال نهاية الأسبوع"
                : "منصة التتويج الشرفية لأبطال نهاية الشهر"}
            </span>
            {selectedPeriod && (
              <span className="px-3 py-1 rounded-full bg-white/10 text-white text-xs font-mono font-bold border border-white/15">
                📅 {selectedPeriod.sublabel}
              </span>
            )}
          </div>
          <h3 className="text-2xl font-black text-white">
            {periodType === "WEEKLY"
              ? `المراكز الثلاثة الأولى (Top 3) — نهاية أسبوع: ${selectedPeriod?.sublabel || ""}`
              : `المراكز الثلاثة الأولى (Top 3) — نهاية شهر: ${selectedPeriod?.sublabel || ""}`}
          </h3>
          <p className="text-xs text-secondaryText mt-1 max-w-xl mx-auto">
            فرسان المجتمع الأكثر وفاءً وحضوراً بنهاية {periodType === "WEEKLY" ? "الأسبوع المحدد" : "الشهر المحدد"} وفق معادلة الوفاء العضوي الحصرية (حضور، شات، تكبيس، ومشاركات) بدون هدايا
          </p>
        </div>

        {isLoadingPeriod ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-gold animate-spin" />
            <span className="text-xs text-secondaryText">
              جارٍ استخراج وتتويج المراكز الثلاثة الأولى لهذه الفترة...
            </span>
          </div>
        ) : top3.length >= 3 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-5xl mx-auto">
            {/* Rank 2 (Silver) */}
            <div className="order-2 md:order-1 bg-gradient-to-b from-slate-800/80 to-slate-900/90 rounded-2xl p-5 border border-slate-400/40 text-center relative shadow-xl hover:border-slate-300 transition-all">
              <div className="relative flex flex-col items-center -mt-12 mb-2">
                <div className="relative">
                  <SupporterAvatar
                    avatarUrl={top3[1].supporter.avatarUrl}
                    displayName={top3[1].supporter.displayName}
                    size="lg"
                    ringColor="border-slate-300 ring-4 ring-slate-400/30"
                    className="w-20 h-20 shadow-xl"
                  />
                  <div className="absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 w-7 h-7 rounded-full bg-slate-300 text-slate-950 font-black flex items-center justify-center text-sm shadow-lg border-2 border-background">
                    2
                  </div>
                </div>
              </div>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-slate-400/15 text-slate-300 text-[11px] font-bold">
                وصيف أبطال المجتمع 🥈
              </span>
              <h4 className="text-base font-bold text-white mt-3 truncate">
                {top3[1].supporter.displayName}
              </h4>
              <p className="text-xs text-secondaryText font-mono">@{top3[1].supporter.username}</p>

              <div className="my-4 p-3 bg-black/40 rounded-xl border border-white/5">
                <span className="text-[10px] text-secondaryText block">معدل الوفاء والتفاعل:</span>
                <span className="text-2xl font-black text-slate-200 font-mono">
                  {top3[1].finalScore} <span className="text-xs">نقطة</span>
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] text-secondaryText text-right">
                <div className="flex justify-between">
                  <span>التعليقات:</span>
                  <span className="text-white font-mono font-bold">
                    {top3[1].supporter.totalComments.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>التكبيس:</span>
                  <span className="text-white font-mono font-bold">
                    {top3[1].supporter.totalLikes.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Rank 1 (Gold - Center - Elevated) */}
            <div className="order-1 md:order-2 bg-gradient-to-b from-amber-950/70 via-background to-black rounded-3xl p-6 md:p-8 border-2 border-gold text-center relative shadow-2xl shadow-gold/15 transform md:-translate-y-4">
              <div className="relative flex flex-col items-center -mt-14 mb-2">
                <div className="relative">
                  <SupporterAvatar
                    avatarUrl={top3[0].supporter.avatarUrl}
                    displayName={top3[0].supporter.displayName}
                    size="xl"
                    ringColor="border-gold ring-4 ring-gold/40"
                    className="w-24 h-24 md:w-28 md:h-28 shadow-2xl shadow-gold/30"
                  />
                  <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2 w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-gold text-black flex items-center justify-center border-2 border-background shadow-xl">
                    <Crown className="w-5 h-5 fill-black" />
                  </div>
                  <div className="absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-gold text-slate-950 font-black text-xs shadow-lg border border-background">
                    #1
                  </div>
                </div>
              </div>
              <span className="inline-block mt-3 px-3 py-1 rounded-full bg-gold/20 text-gold text-xs font-black border border-gold/40 shadow-sm shadow-gold/20">
                بطل المجتمع الأكبر 👑
              </span>
              <h4 className="text-xl font-black text-white mt-3 truncate">
                {top3[0].supporter.displayName}
              </h4>
              <p className="text-xs text-gold font-mono">@{top3[0].supporter.username}</p>

              <div className="my-5 p-4 bg-gold/10 rounded-2xl border border-gold/30">
                <span className="text-[11px] text-gold/80 block font-medium">
                  المؤشر الاستثنائي العام:
                </span>
                <span className="text-4xl font-black text-gold font-mono tracking-tight">
                  {top3[0].finalScore} <span className="text-sm font-bold">نقطة</span>
                </span>
                <span className="block text-[11px] text-white/90 font-medium mt-1">
                  {top3[0].archetypeLabelArabic}
                </span>
              </div>

              <div className="bg-black/60 p-3 rounded-xl border border-white/10 text-xs text-secondaryText text-right mb-4">
                <span className="text-gold font-bold block mb-1">سبب الاستحقاق:</span>
                {top3[0].qualificationReason}
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                  <span className="text-[10px] text-secondaryText block">التعليقات</span>
                  <span className="font-mono font-bold text-white">
                    {top3[0].supporter.totalComments.toLocaleString()}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                  <span className="text-[10px] text-secondaryText block">التكبيس</span>
                  <span className="font-mono font-bold text-white">
                    {top3[0].supporter.totalLikes.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Rank 3 (Bronze) */}
            <div className="order-3 md:order-3 bg-gradient-to-b from-amber-950/40 to-slate-900/90 rounded-2xl p-5 border border-amber-700/40 text-center relative shadow-xl hover:border-amber-600 transition-all">
              <div className="relative flex flex-col items-center -mt-12 mb-2">
                <div className="relative">
                  <SupporterAvatar
                    avatarUrl={top3[2].supporter.avatarUrl}
                    displayName={top3[2].supporter.displayName}
                    size="lg"
                    ringColor="border-amber-700 ring-4 ring-amber-700/30"
                    className="w-20 h-20 shadow-xl"
                  />
                  <div className="absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 w-7 h-7 rounded-full bg-amber-700 text-white font-black flex items-center justify-center text-sm shadow-lg border-2 border-background">
                    3
                  </div>
                </div>
              </div>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-amber-700/15 text-amber-400 text-[11px] font-bold">
                المرتبة الثالثة شرفياً 🥉
              </span>
              <h4 className="text-base font-bold text-white mt-3 truncate">
                {top3[2].supporter.displayName}
              </h4>
              <p className="text-xs text-secondaryText font-mono">@{top3[2].supporter.username}</p>

              <div className="my-4 p-3 bg-black/40 rounded-xl border border-white/5">
                <span className="text-[10px] text-secondaryText block">معدل الوفاء والتفاعل:</span>
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {top3[2].finalScore} <span className="text-xs">نقطة</span>
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] text-secondaryText text-right">
                <div className="flex justify-between">
                  <span>التعليقات:</span>
                  <span className="text-white font-mono font-bold">
                    {top3[2].supporter.totalComments.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>التكبيس:</span>
                  <span className="text-white font-mono font-bold">
                    {top3[2].supporter.totalLikes.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center max-w-md mx-auto space-y-4 bg-background/50 rounded-2xl border border-white/5 p-6">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-secondaryText">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">لا توجد بيانات كافية لهذه الفترة</h4>
              <p className="text-xs text-secondaryText mt-1">
                لم يتم رصد 3 أبطال مؤهلين خلال فترة {selectedPeriod?.sublabel || "المحددة"}. يمكنك الرجوع إلى الأسبوع الحالي أو اختيار فترة أخرى.
              </p>
            </div>
            {periods.weekly[0] && (
              <button
                onClick={() => handleSelectPeriod(periods.weekly[0])}
                className="px-4 py-2 rounded-xl bg-gold/15 text-gold border border-gold/30 text-xs font-bold hover:bg-gold/25 transition-all inline-block"
              >
                العودة إلى الأسبوع الحالي
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. SMART AI COMMUNITY ANALYSIS (التحليل الذكي لحيوية المجتمع) */}
      <div className="cyber-card p-6 md:p-8 rounded-3xl relative overflow-hidden border border-turquoise/30">
        <div className="absolute top-0 right-0 w-80 h-80 bg-turquoise/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-turquoise/15 text-turquoise">
                <BrainCircuit className="w-5 h-5" />
              </span>
              <h3 className="text-xl font-black text-white">التحليل الذكي لتكتلات المجتمع والوفاء</h3>
            </div>
            <p className="text-xs text-secondaryText">
              تشخيص آلي فوري يوضح البنية التحتية لجمهور البث العضوي ومصادر القوة الخفية
            </p>
          </div>
          <ConfidenceBadge state="VERIFIED" methodology="تحليل إحصائي لسلوك 5,540 متابع حقيقي" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Chat Dynamics */}
          <div className="bg-background/80 p-5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                ديناميكية حوار الشات
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400">
                معدل استثنائي
              </span>
            </div>
            <p className="text-xs text-secondaryText leading-relaxed">
              سجلت الروم <strong className="text-white font-mono">{overview.totalChatComments.toLocaleString()}</strong> تعليقاً حياً. 
              يبرز التوزيع أن هناك نواة صلبة من المتابعين يقودون حركة النقاش، مما يشكل خط دفاع مستمر يمنع فتور البث في الأوقات الفاصلة بين الجولات.
            </p>
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-secondaryText">
              <span>أبرز محرك للشات:</span>
              <span className="text-blue-400 font-bold">@{overview.topCommenter.username}</span>
            </div>
          </div>

          {/* Card 2: Liking Powerhouse */}
          <div className="bg-background/80 p-5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-purple" />
                كتائب التكبيس التراكمي
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple/20 text-purple">
                +{overview.totalOrganicLikes.toLocaleString()} إعجاب
              </span>
            </div>
            <p className="text-xs text-secondaryText leading-relaxed">
              قوة التكبيس العضوي تمثل الركيزة الأساسية لرفع البث في خوارزمية الاكسبلور (For You Page). 
              المتابعون الأوفياء يساهمون بآلاف النقرات المتزامنة دون توقف، مما يمنح البث أولوية ظهور مستمرة بدون تكلفة إعلانية.
            </p>
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-secondaryText">
              <span>أعلى مساهم تكبيس:</span>
              <span className="text-purple font-bold">@{overview.topLiker.username}</span>
            </div>
          </div>

          {/* Card 3: Room Immunity & Retention */}
          <div className="bg-background/80 p-5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                مناعة الروم وثبات الجمهور
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                وفاء {overview.communityHealthScore}%
              </span>
            </div>
            <p className="text-xs text-secondaryText leading-relaxed">
              معدل استمرار المشاهدين في الروم لأكثر من ساعتين متواصلتين يعكس ولاءً استثنائياً بين كبار الأوفياء. 
              هذا الاستقرار الزمني يحمي العداد اللحظي من الانهيار عند مواجهة حسابات منافسة قوية.
            </p>
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-secondaryText">
              <span>المتصدر الشامل:</span>
              <span className="text-emerald-400 font-bold">@{overview.topChampion.username}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SMART RECOMMENDATIONS HUB (بنك التوصيات التكتيكية الذكية) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-gold" />
              التوصيات التكتيكية لاستثمار طاقات الأوفياء
            </h3>
            <p className="text-xs text-secondaryText mt-0.5">
              خطط عمل فورية موجهة لكل نمط تفاعلي لتحويل الوفاء المجتمعي إلى مكاسب تنافسية بالبث
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "ALL", label: "جميع التوصيات" },
              { id: "MODERATION", label: "🛡️ الإشراف" },
              { id: "TAPPING", label: "⚡ التكبيس" },
              { id: "SHOUTOUT", label: "👑 التكريم" },
              { id: "SHIELDING", label: "⚔️ درع الروم" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  selectedCategory === cat.id
                    ? "bg-gold text-background shadow-md shadow-gold/20"
                    : "bg-elevated text-secondaryText hover:text-white border border-white/5"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredRecommendations.map((rec) => {
            const isCopied = copiedId === rec.id;
            return (
              <div
                key={rec.id}
                className="cyber-card rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between border border-white/10 hover:border-gold/30 transition-all duration-300"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gold/15 text-gold border border-gold/30">
                          {rec.badge}
                        </span>
                        <span className="text-[11px] font-mono text-emerald-400 font-bold">
                          دقة {rec.confidencePercent}%
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white leading-snug">{rec.title}</h4>
                      <p className="text-xs text-gold/80 mt-0.5 font-medium">{rec.subtitle}</p>
                    </div>

                    <button
                      onClick={() => handleCopyRecommendation(rec)}
                      className={`shrink-0 p-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold ${
                        isCopied
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "bg-white/5 hover:bg-white/10 text-secondaryText hover:text-white border-white/10"
                      }`}
                      title="نسخ خطة التوصية"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>نسخ الخطة</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Target Champion Highlight */}
                  {rec.targetChampion && (
                    <div className="bg-gradient-to-r from-gold/10 via-background to-background p-3 rounded-xl border border-gold/20 mb-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <SupporterAvatar
                          avatarUrl={
                            champions.find(
                              (c) => c.supporter.username === rec.targetChampion?.username
                            )?.supporter.avatarUrl || null
                          }
                          displayName={rec.targetChampion.displayName}
                          size="sm"
                          ringColor="border-gold/30"
                        />
                        <div>
                          <span className="text-[10px] text-secondaryText block">البطل المستهدف خوارزمياً:</span>
                          <span className="font-bold text-white">
                            {rec.targetChampion.displayName}{" "}
                            <span className="text-gold font-mono">(@{rec.targetChampion.username})</span>
                          </span>
                        </div>
                      </div>
                      <div className="text-left font-mono font-bold text-white bg-black/40 px-2 py-1 rounded border border-white/5">
                        {rec.targetChampion.metricValue}
                      </div>
                    </div>
                  )}

                  {/* Diagnostic Description */}
                  <p className="text-xs text-secondaryText leading-relaxed mb-3">
                    {rec.description}
                  </p>

                  {/* Evidence Pod */}
                  <div className="bg-background/90 p-3 rounded-xl border border-white/5 text-[11px] text-secondaryText mb-4">
                    <span className="text-white font-bold block mb-0.5">الشاهد الميداني:</span>
                    {rec.evidence}
                  </div>
                </div>

                {/* Action Items Checklist */}
                <div className="space-y-1.5 pt-3 border-t border-white/5">
                  <span className="text-[11px] font-bold text-white block mb-1">
                    خطوات التنفيذ المباشرة:
                  </span>
                  {rec.actionItems.map((action, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-xs text-secondaryText leading-snug"
                    >
                      <div className="w-4 h-4 rounded-full bg-gold/15 text-gold flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-mono font-bold">
                        {idx + 1}
                      </div>
                      <span>{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. FULL CHAMPIONS DIRECTORY & LEADERBOARD (دليل وصدارة الأبطال التفاعلي) */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-gold" />
              لوحة صدارة أبطال المجتمع (Community Leaderboard)
            </h3>
            <p className="text-xs text-secondaryText mt-0.5">
              ترتيب الأبطال وفق النقاط التفاعلية العضوية المجمعة (الحد الأقصى المعروض: {filteredChampions.length} بطل)
            </p>
          </div>

          {/* Search & Archetype Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-secondaryText absolute right-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث بالاسم أو المعرف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-elevated border border-white/10 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-secondaryText focus:outline-none focus:border-gold/50 w-full sm:w-60"
              />
            </div>

            {/* Archetype Selector */}
            <div className="flex items-center gap-1 bg-elevated p-1 rounded-xl border border-white/10 overflow-x-auto">
              {[
                { id: "ALL", label: "الكل" },
                { id: "CHAT_CATALYST", label: "💬 رواد الحوار" },
                { id: "LIKE_TITAN", label: "❤️ عمالقة التكبيس" },
                { id: "PRESENCE_GUARDIAN", label: "🛡️ حراس التواجد" },
                { id: "ALL_ROUNDER", label: "🌟 شامل" },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedArchetype(type.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    selectedArchetype === type.id
                      ? "bg-gold text-background shadow"
                      : "text-secondaryText hover:text-white"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Champions Grid */}
        {filteredChampions.length === 0 ? (
          <div className="cyber-card p-12 text-center rounded-2xl border border-white/10">
            <Users className="w-12 h-12 text-secondaryText mx-auto mb-3 opacity-40" />
            <h4 className="text-base font-bold text-white">لا توجد نتائج تطابق بحثك</h4>
            <p className="text-xs text-secondaryText mt-1">
              جرب تغيير معيار البحث أو اختيار تصنيف آخر
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredChampions.map((champ) => {
              const isTopRank = champ.rank <= 3;
              return (
                <div
                  key={champ.supporter.id}
                  className="cyber-card rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between border border-white/10 hover:border-gold/30 transition-all group"
                  style={{
                    borderTop:
                      champ.rank === 1
                        ? "3px solid #F5B942"
                        : champ.rank === 2
                        ? "3px solid #CBD5E1"
                        : champ.rank === 3
                        ? "3px solid #D97706"
                        : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div>
                    {/* Header Rank & Score */}
                    <div className="flex items-center justify-between mb-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                            champ.rank === 1
                              ? "bg-gold text-background shadow-md shadow-gold/20"
                              : champ.rank === 2
                              ? "bg-slate-300 text-slate-950"
                              : champ.rank === 3
                              ? "bg-amber-700 text-white"
                              : "bg-white/10 text-white font-mono"
                          }`}
                        >
                          #{champ.rank}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 border border-white/10 text-white">
                          {champ.archetypeLabelArabic}
                        </span>
                      </div>
                      <div className="text-left font-mono">
                        <span className="text-lg font-black text-gold">{champ.finalScore}</span>
                        <span className="text-[10px] text-secondaryText mr-1">نقطة</span>
                      </div>
                    </div>

                    {/* Supporter Profile */}
                    <div className="flex items-center gap-3 mb-4">
                      <SupporterAvatar
                        avatarUrl={champ.supporter.avatarUrl}
                        displayName={champ.supporter.displayName}
                        size="md"
                        ringColor={
                          champ.rank === 1
                            ? "border-gold ring-2 ring-gold/40"
                            : champ.rank === 2
                            ? "border-slate-300 ring-2 ring-slate-300/30"
                            : champ.rank === 3
                            ? "border-amber-700 ring-2 ring-amber-700/30"
                            : "border-white/10"
                        }
                      />
                      <div className="overflow-hidden">
                        <h4 className="font-bold text-white text-sm truncate leading-snug">
                          {champ.supporter.displayName}
                        </h4>
                        <p className="text-xs text-secondaryText font-mono truncate">
                          @{champ.supporter.username}
                        </p>
                      </div>
                    </div>

                    {/* Qualification Reason */}
                    <div className="bg-background/90 p-3 rounded-xl border border-white/5 mb-4 text-xs text-secondaryText leading-relaxed">
                      <span className="text-white font-bold block mb-0.5">سبب التكريم:</span>
                      {champ.qualificationReason}
                    </div>
                  </div>

                  {/* Multi-Dimensional Engagement Scores */}
                  <div className="space-y-2 pt-3 border-t border-white/5 text-[11px]">
                    <div className="flex justify-between items-center text-secondaryText">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-turquoise" />
                        الحضور والوفاء الزمني:
                      </span>
                      <span className="text-white font-mono font-bold">{champ.presenceScore}%</span>
                    </div>
                    <div className="flex justify-between items-center text-secondaryText">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                        مشاركات المحادثة:
                      </span>
                      <span className="text-white font-mono font-bold">{champ.chatScore}%</span>
                    </div>
                    <div className="flex justify-between items-center text-secondaryText">
                      <span className="flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-purple" />
                        التكبيس والإعجابات:
                      </span>
                      <span className="text-white font-mono font-bold">{champ.likeScore}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
