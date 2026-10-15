"use client";

import { useState } from "react";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import {
  EyeOff,
  Shield,
  CheckCircle,
  HelpCircle,
  RefreshCw,
  Flame,
  UserCheck,
  Fingerprint,
  Sparkles,
  Gift,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { EnigmaCandidate } from "@/lib/enigma-engine";

interface Props {
  initialReviews: EnigmaCandidate[];
}

export function EnigmaClient({ initialReviews }: Props) {
  const [reviews, setReviews] = useState<EnigmaCandidate[]>(initialReviews);
  const [filterTab, setFilterTab] = useState<"ALL" | "STRONG" | "PROBABLE" | "CONFIRMED">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleRecalculate = async () => {
    setIsRefreshing(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/enigmas", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message || "تم تحديث ومزامنة الحسابات الغامضة بنجاح");
        // Reload list
        const getRes = await fetch("/api/enigmas");
        const getData = await getRes.json();
        if (getData.success) {
          setReviews(getData.reviews || []);
        }
      } else {
        setActionMessage("فشل تحديث الحسابات الغامضة");
      }
    } catch {
      setActionMessage("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleUpdateStatus = async (reviewId: string, status: "CONFIRMED" | "DISMISSED") => {
    try {
      const res = await fetch("/api/enigmas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, status }),
      });
      const data = await res.json();
      if (data.success) {
        setReviews((prev) =>
          prev.map((r) => (r.id === reviewId ? { ...r, status } : r))
        );
        setActionMessage(`تم تحديث حالة المرشح إلى ${status === "CONFIRMED" ? "مؤكد" : "متجاهل"}`);
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch {
      setActionMessage("فشل تحديث الحالة");
    }
  };

  // KPIs
  const totalEnigmas = reviews.length;
  const strongMatches = reviews.filter((r) => r.matchLevel === "STRONG_MATCH").length;
  const totalEnigmaDiamonds = reviews.reduce((sum, r) => sum + (r.evidence.diamondsWithEnigma || 0), 0);
  const topEnigmaGifter = reviews.reduce(
    (max, r) => (r.evidence.diamondsWithEnigma > (max?.evidence.diamondsWithEnigma || 0) ? r : max),
    null as EnigmaCandidate | null
  );

  // Filtered list
  const filteredReviews = reviews.filter((r) => {
    if (filterTab === "STRONG") return r.matchLevel === "STRONG_MATCH";
    if (filterTab === "PROBABLE") return r.matchLevel === "PROBABLE_MATCH";
    if (filterTab === "CONFIRMED") return r.status === "CONFIRMED";
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <EyeOff className="w-6 h-6 text-purple-400" />
              <span>تحليل الحسابات الغامضة (Enigma Forensics)</span>
            </h2>
            <ConfidenceBadge
              state="VERIFIED"
              methodology="مطابقة جنائية تقنية للمعرف الثابت (SecUID / Persistent ID) وسجل الهدايا لتحديد الهوية الأصلية لمن يدخل بوضع القناع"
            />
          </div>
          <p className="text-sm text-secondaryText">
            كشف ومطابقة الداعمين الذين دخلوا البث تحت &quot;وضع القناع الغامض&quot; وربطهم بهوياتهم الأصلية المسجلة مسبقاً
          </p>
        </div>

        <div className="flex items-center gap-3">
          {actionMessage && (
            <span className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              {actionMessage}
            </span>
          )}
          <button
            onClick={handleRecalculate}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface hover:bg-elevated border border-white/10 text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-turquoise" : ""}`} />
            <span>{isRefreshing ? "جاري الفحص..." : "إعادة فحص الهويات الآن"}</span>
          </button>
        </div>
      </div>

      {/* Ethical & Security Notice */}
      <div className="bg-surface/60 border border-purple-500/20 p-4 rounded-xl flex items-start gap-3">
        <Shield className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="text-xs text-secondaryText leading-relaxed">
          <span className="font-semibold text-white block mb-0.5">ضوابط التحليل الجنائي التقني (Privacy Safe):</span>
          هذه الأداة تعتمد كلياً على الإشارات البرمجية الواردة من بروتوكول TikTok Webcast (المعرف الثابت <span className="text-white font-mono">SecUID</span>، وسجل الدعم بالماس، وبصمة الهدايا المشتركة). لا يتم أي تخمين خارجي بل مطابقة السجلات الرقمية للبث الفعلي فقط.
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-secondaryText mb-1">
            <span className="text-xs">الحسابات المقنعة المرصودة</span>
            <EyeOff className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-2xl font-bold text-white">{totalEnigmas} حساباً</span>
          <span className="text-[11px] text-secondaryText block mt-0.5">دخلوا بوضع القناع (Enigma)</span>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-secondaryText mb-1">
            <span className="text-xs">تطابق قطعي بالهوية</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold text-emerald-400">{strongMatches} حالة</span>
          <span className="text-[11px] text-secondaryText block mt-0.5">كشف هوية قطعي 99% بالمعرف</span>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-secondaryText mb-1">
            <span className="text-xs">الدعم تحت القناع الغامض</span>
            <Flame className="w-4 h-4 text-gold" />
          </div>
          <span className="text-2xl font-bold text-gold">{totalEnigmaDiamonds.toLocaleString()} 💎</span>
          <span className="text-[11px] text-secondaryText block mt-0.5">أرسلت أثناء إخفاء الاسم</span>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-secondaryText mb-1">
            <span className="text-xs">أكبر داعم مقنع</span>
            <Sparkles className="w-4 h-4 text-turquoise" />
          </div>
          <span className="text-base font-bold text-white truncate block">
            {topEnigmaGifter ? `@${topEnigmaGifter.evidence.realUsername}` : "لا يوجد"}
          </span>
          <span className="text-[11px] text-gold font-bold block mt-0.5">
            {topEnigmaGifter ? `${topEnigmaGifter.evidence.diamondsWithEnigma.toLocaleString()} 💎` : "0 💎"}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setFilterTab("ALL")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            filterTab === "ALL"
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
              : "bg-surface hover:bg-elevated text-secondaryText hover:text-white border border-white/5"
          }`}
        >
          جميع الحسابات ({reviews.length})
        </button>
        <button
          onClick={() => setFilterTab("STRONG")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            filterTab === "STRONG"
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
              : "bg-surface hover:bg-elevated text-secondaryText hover:text-white border border-white/5"
          }`}
        >
          تطابق قطعي قوي ({strongMatches})
        </button>
        <button
          onClick={() => setFilterTab("PROBABLE")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            filterTab === "PROBABLE"
              ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
              : "bg-surface hover:bg-elevated text-secondaryText hover:text-white border border-white/5"
          }`}
        >
          تطابق محتمل ({reviews.filter((r) => r.matchLevel === "PROBABLE_MATCH").length})
        </button>
        <button
          onClick={() => setFilterTab("CONFIRMED")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            filterTab === "CONFIRMED"
              ? "bg-gold/20 text-gold border border-gold/40"
              : "bg-surface hover:bg-elevated text-secondaryText hover:text-white border border-white/5"
          }`}
        >
          الحالات المؤكدة ({reviews.filter((r) => r.status === "CONFIRMED").length})
        </button>
      </div>

      {/* Enigma Candidates Forensics Feed */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <div className="bg-surface rounded-xl border border-white/5 p-12 text-center text-secondaryText">
            <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <h4 className="text-base font-bold text-white">لا توجد حالات تطابق في هذا القسم</h4>
            <p className="text-xs text-secondaryText mt-1">
              اضغط على زر &quot;إعادة فحص الهويات الآن&quot; لمسح سجلات البث ومزامنة الحالات الحديثة.
            </p>
          </div>
        ) : (
          filteredReviews.map((candidate) => {
            const isExpanded = expandedId === candidate.id;
            const isStrong = candidate.matchLevel === "STRONG_MATCH";

            return (
              <div
                key={candidate.id}
                className="bg-surface rounded-xl border border-white/5 overflow-hidden transition-all hover:border-white/10"
              >
                {/* Main Card Header / Side-by-Side Match */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Pair Comparison Box */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
                    {/* Real Identified Persona */}
                    <div className="bg-background/60 p-3.5 rounded-xl border border-emerald-500/20 flex-1 min-w-[220px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                          الهوية الأصلية المكشوفة
                        </span>
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <h4 className="text-base font-black text-white">
                        @{candidate.evidence.realUsername}
                      </h4>
                      <p className="text-xs text-secondaryText truncate">
                        {candidate.evidence.realDisplayName}
                      </p>
                      <div className="mt-2 text-[11px] text-secondaryText flex items-center justify-between">
                        <span>الدعم العلني:</span>
                        <span className="font-bold text-gold">
                          {candidate.evidence.diamondsPublic.toLocaleString()} 💎
                        </span>
                      </div>
                    </div>

                    {/* Bridge Indicator */}
                    <div className="flex flex-col items-center justify-center shrink-0 px-2">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-[11px] font-black text-purple-300">
                        <Fingerprint className="w-3.5 h-3.5" />
                        <span>{(candidate.confidenceScore * 100).toFixed(0)}% تطابق</span>
                      </div>
                      <ArrowRightLeft className="w-4 h-4 text-secondaryText/40 my-1 hidden sm:block" />
                    </div>

                    {/* Enigma Persona */}
                    <div className="bg-background/60 p-3.5 rounded-xl border border-purple-500/20 flex-1 min-w-[220px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                          <EyeOff className="w-3 h-3" />
                          القناع المستخدم في البث
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                          Enigma Mask
                        </span>
                      </div>
                      <h4 className="text-base font-black text-purple-200">
                        @{candidate.evidence.enigmaUsername}
                      </h4>
                      <p className="text-xs text-secondaryText truncate">
                        {candidate.evidence.enigmaDisplayName}
                      </p>
                      <div className="mt-2 text-[11px] text-secondaryText flex items-center justify-between">
                        <span>الدعم تحت القناع:</span>
                        <span className="font-bold text-gold">
                          {candidate.evidence.diamondsWithEnigma.toLocaleString()} 💎
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Confidence */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-md font-bold border ${
                          isStrong
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        }`}
                      >
                        {isStrong ? "تطابق قطعي بالمعرف" : "تطابق سلوكي محتمل"}
                      </span>
                      {candidate.status === "CONFIRMED" && (
                        <span className="text-xs px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20 font-bold">
                          تم التأكيد ✓
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {candidate.status !== "CONFIRMED" && (
                        <button
                          onClick={() => handleUpdateStatus(candidate.id, "CONFIRMED")}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold transition-colors"
                        >
                          تأكيد المطابقة
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : candidate.id)}
                        className="p-1.5 rounded-lg bg-elevated hover:bg-surface border border-white/10 text-secondaryText hover:text-white transition-colors"
                        title="عرض الأدلة التفصيلية"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expandable Technical Evidence Drawer */}
                {isExpanded && (
                  <div className="border-t border-white/5 bg-background/50 p-5 space-y-4 text-xs">
                    <div>
                      <h5 className="font-bold text-white mb-2 flex items-center gap-1.5">
                        <Fingerprint className="w-4 h-4 text-turquoise" />
                        <span>الأدلة الجنائية والتقنية الموثقة:</span>
                      </h5>
                      <ul className="space-y-1.5 pr-2">
                        {candidate.evidence.evidencePoints.map((pt, idx) => (
                          <li key={idx} className="text-secondaryText flex items-start gap-2">
                            <span className="text-turquoise font-black">•</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Gifts sent under Enigma */}
                    {candidate.evidence.topGifts.length > 0 && (
                      <div>
                        <h5 className="font-bold text-white mb-2 flex items-center gap-1.5">
                          <Gift className="w-4 h-4 text-gold" />
                          <span>الهدايا المرسلة أثناء تفعيل القناع الغامض:</span>
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {candidate.evidence.topGifts.map((g, gIdx) => (
                            <div
                              key={gIdx}
                              className="bg-surface/80 border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2"
                            >
                              <span className="text-white font-medium">
                                {g.name} x{g.count}
                              </span>
                              <span className="text-gold font-bold">{g.diamonds.toLocaleString()} 💎</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Technical details footer */}
                    <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between text-[11px] text-secondaryText font-mono">
                      <span>Platform UID: {candidate.evidence.platformUserId}</span>
                      {candidate.evidence.secUid && (
                        <span className="truncate max-w-xs" title={candidate.evidence.secUid}>
                          SecUID: {candidate.evidence.secUid.slice(0, 20)}...
                        </span>
                      )}
                      <span>أحداث مرصودة بالقناع: {candidate.evidence.enigmaEventsCount}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
