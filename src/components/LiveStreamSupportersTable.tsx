"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Radio,
  Sparkles,
  RefreshCw,
  Search,
  Gift,
  Clock,
  ShieldCheck,
  TrendingUp,
  Flame,
  Award,
  Crown,
  Zap,
} from "lucide-react";
import { SupportValue } from "./SupportValue";
import { ConfidenceBadge } from "./ConfidenceBadge";
import type {
  LiveStreamSupportersData,
  LiveSessionSupporterItem,
} from "@/lib/live-supporters-service";

interface LiveStreamSupportersTableProps {
  initialData: LiveStreamSupportersData;
  tenantId?: string;
}

export function LiveStreamSupportersTable({ initialData }: LiveStreamSupportersTableProps) {
  const [data, setData] = useState<LiveStreamSupportersData>(initialData);
  const [searchQuery, setSearchQuery] = useState("");
  const [displayLimit, setDisplayLimit] = useState<number>(15);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);

  // Fetch updated data from API
  const refreshData = async (showLoading: boolean = false) => {
    if (showLoading) setIsRefreshing(true);
    try {
      const res = await fetch("/api/live-supporters?limit=100");
      const json = await res.json();
      if (json.success) {
        setData(json);
        setLastRefreshedAt(new Date());
      }
    } catch {
      // Keep existing data on error
    } finally {
      if (showLoading) setIsRefreshing(false);
    }
  };

  // Auto-refresh interval (every 5 seconds when live, 15 seconds when idle)
  useEffect(() => {
    if (!isAutoRefreshEnabled) return;

    const intervalMs = data.isLive ? 5000 : 15000;
    const timer = setInterval(() => {
      refreshData(false);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isAutoRefreshEnabled, data.isLive]);

  // Filtered supporters
  const filteredSupporters = data.topSupporters.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      s.displayName.toLowerCase().includes(q) ||
      s.username.toLowerCase().includes(q) ||
      (s.latestGiftName && s.latestGiftName.toLowerCase().includes(q))
    );
  });

  const visibleSupporters = filteredSupporters.slice(0, displayLimit);

  // Format relative time for gifts
  const formatGiftTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return "الآن";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `منذ ${diffMin} د`;
      const diffHr = Math.floor(diffMin / 60);
      return `منذ ${diffHr} س`;
    } catch {
      return "—";
    }
  };

  return (
    <div className="hud-deck rounded-3xl p-6 md:p-8 space-y-6 border border-white/10 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-turquoise/10 rounded-full blur-3xl pointer-events-none" />

      {/* 1. HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/10 relative z-10">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500/20 to-purple/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-xl md:text-2xl font-black text-white">
                  لوحة داعمين البث الحية
                </h3>
                {data.isLive ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[11px] font-bold shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    مباشر الآن
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-secondaryText text-[11px] font-bold">
                    البث غير نشط
                  </span>
                )}
              </div>
              <p className="text-xs text-secondaryText mt-1 flex items-center gap-1.5">
                <span>ترتيب حصري لداعمي البث الحالي</span>
                <span className="text-turquoise font-bold">• تتجدد وتصفر اللائحة تلقائياً مع بداية كل بث جديد 🔄</span>
              </p>
            </div>
          </div>
        </div>

        {/* Live Session Quick Stats & Refresh Control */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick stats pills */}
          <div className="flex items-center gap-2 bg-elevated/80 border border-white/10 rounded-2xl px-3 py-1.5 text-xs font-mono">
            <span className="text-secondaryText">الداعمين:</span>
            <span className="text-white font-bold">{data.uniqueSupportersCount}</span>
            <span className="text-white/20">|</span>
            <span className="text-secondaryText">دعم البث:</span>
            <span className="text-gold font-bold">
              <SupportValue value={data.totalSessionDiamonds} suffix=" 💎" />
            </span>
          </div>

          {/* Auto-Refresh Toggle */}
          <button
            onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
              isAutoRefreshEnabled
                ? "bg-turquoise/15 border-turquoise/40 text-turquoise"
                : "bg-white/5 border-white/10 text-secondaryText hover:text-white"
            }`}
            title="تبديل التحديث التلقائي اللحظي"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isAutoRefreshEnabled ? "bg-turquoise animate-pulse" : "bg-gray-500"
              }`}
            />
            <span>{isAutoRefreshEnabled ? "تحديث تلقائي 5ث" : "تحديث متوقف"}</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={() => refreshData(true)}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-elevated hover:bg-elevated/80 border border-white/10 text-white transition-all disabled:opacity-50"
            title="تحديث البيانات فورياً الآن"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-turquoise" : ""}`} />
          </button>
        </div>
      </div>

      {/* 2. CONTROLS BAR: SEARCH & VIEW FILTER */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-secondaryText absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث عن داعم في هذا البث..."
            className="w-full bg-elevated/70 border border-white/10 rounded-xl pr-10 pl-3 py-2 text-xs text-white placeholder-secondaryText focus:outline-none focus:border-turquoise transition-all font-sans"
          />
        </div>

        <div className="flex items-center gap-2 text-xs w-full sm:w-auto justify-end">
          <span className="text-secondaryText font-mono">عرض:</span>
          {[10, 25, 50].map((limit) => (
            <button
              key={limit}
              onClick={() => setDisplayLimit(limit)}
              className={`px-2.5 py-1 rounded-lg font-mono font-bold transition-all ${
                displayLimit === limit
                  ? "bg-turquoise text-background shadow-md shadow-turquoise/20"
                  : "bg-white/5 text-secondaryText hover:text-white border border-white/5"
              }`}
            >
              أفضل {limit}
            </button>
          ))}
          {data.uniqueSupportersCount > 50 && (
            <button
              onClick={() => setDisplayLimit(data.uniqueSupportersCount)}
              className={`px-2.5 py-1 rounded-lg font-mono font-bold transition-all ${
                displayLimit >= data.uniqueSupportersCount
                  ? "bg-turquoise text-background shadow-md"
                  : "bg-white/5 text-secondaryText hover:text-white border border-white/5"
              }`}
            >
              الكل ({data.uniqueSupportersCount})
            </button>
          )}
        </div>
      </div>

      {/* 3. THE LIVE SUPPORTERS TABLE */}
      {visibleSupporters.length === 0 ? (
        <div className="py-14 text-center rounded-2xl bg-white/[0.02] border border-white/5 space-y-3 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-secondaryText">
            <Radio className="w-7 h-7 text-secondaryText/60" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white">
              {data.isLive
                ? "البث المباشر نشط — بانتظار أول دعم في هذه الجلسة!"
                : "لا يوجد بث مباشر نشط حالياً"}
            </h4>
            <p className="text-xs text-secondaryText mt-1 max-w-md mx-auto">
              {data.isLive
                ? "بمجرد إرسال أول هدية في البث الحالي، ستظهر اللائحة ويتم ترتيب الداعمين لحظياً."
                : "تتجدد اللائحة وتبدأ تلقائياً من الصفر فور انطلاق البث القادم."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto relative z-10">
          <table className="digi-table">
            <thead>
              <tr>
                <th className="pr-4">الترتيب والداعم في البث</th>
                <th className="text-center">دعم البث الحالي 💎</th>
                <th className="text-center">الاستحواذ الميداني</th>
                <th className="text-center">الهدايا</th>
                <th className="text-center">آخر هدية مدعومة</th>
                <th className="text-center">التصنيف</th>
              </tr>
            </thead>
            <tbody>
              {visibleSupporters.map((sup) => {
                const isTop1 = sup.rank === 1;
                const isTop2 = sup.rank === 2;
                const isTop3 = sup.rank === 3;

                return (
                  <tr
                    key={sup.platformUserId}
                    className={`transition-colors ${
                      isTop1
                        ? "bg-gold/[0.04] hover:bg-gold/[0.08]"
                        : isTop2
                        ? "bg-slate-300/[0.02] hover:bg-slate-300/[0.05]"
                        : isTop3
                        ? "bg-amber-600/[0.02] hover:bg-amber-600/[0.05]"
                        : "hover:bg-white/[0.02]"
                    }`}
                  >
                    {/* 1. Rank & Supporter Profile */}
                    <td className="pr-4 py-3.5">
                      <div className="flex items-center gap-3.5">
                        {/* Rank Badge */}
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0 shadow-md ${
                            isTop1
                              ? "bg-gradient-to-br from-amber-300 via-gold to-amber-500 text-black shadow-gold/30"
                              : isTop2
                              ? "bg-gradient-to-br from-slate-100 to-slate-300 text-black shadow-slate-300/20"
                              : isTop3
                              ? "bg-gradient-to-br from-amber-700 to-amber-900 text-white shadow-amber-900/30"
                              : "bg-elevated border border-white/10 text-secondaryText"
                          }`}
                        >
                          {isTop1 ? "👑 1" : `#${sup.rank}`}
                        </div>

                        {/* Avatar */}
                        <div className="relative shrink-0">
                          {sup.avatarUrl ? (
                            <img
                              src={sup.avatarUrl}
                              alt={sup.displayName}
                              className={`w-10 h-10 rounded-xl object-cover border ${
                                isTop1
                                  ? "border-gold ring-2 ring-gold/40"
                                  : isTop2
                                  ? "border-slate-300"
                                  : isTop3
                                  ? "border-amber-700"
                                  : "border-white/10"
                              }`}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-elevated border border-white/10 flex items-center justify-center text-sm font-bold text-white shadow-inner">
                              {sup.displayName.charAt(0)}
                            </div>
                          )}
                          {sup.isVip && (
                            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gold text-black flex items-center justify-center text-[9px] shadow-sm">
                              👑
                            </div>
                          )}
                        </div>

                        {/* Names */}
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate flex items-center gap-1.5">
                            <span>{sup.displayName}</span>
                            {isTop1 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-gold/20 text-gold border border-gold/30 font-bold shrink-0">
                                صدارة البث
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-secondaryText font-mono truncate">
                            @{sup.username}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* 2. Diamonds in this Live Stream */}
                    <td className="text-center font-mono font-black text-gold text-base">
                      <SupportValue value={sup.sessionDiamonds} suffix=" 💎" />
                    </td>

                    {/* 3. Dominance Progress Bar */}
                    <td className="text-center px-4">
                      <div className="flex flex-col items-center gap-1 w-28 mx-auto">
                        <div className="flex items-center justify-between w-full text-[11px] font-mono text-secondaryText">
                          <span>{sup.diamondsRatio}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isTop1
                                ? "bg-gradient-to-r from-gold to-amber-300"
                                : isTop2
                                ? "bg-slate-300"
                                : isTop3
                                ? "bg-amber-600"
                                : "bg-turquoise"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(4, sup.diamondsRatio))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* 4. Total Gifts in Session */}
                    <td className="text-center font-mono font-bold text-white text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5">
                        {sup.sessionGiftsCount.toLocaleString()} هدية
                      </span>
                    </td>

                    {/* 5. Latest Gift Sent in Session */}
                    <td className="text-center text-xs">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-bold text-turquoise flex items-center gap-1 truncate max-w-[140px]">
                          <Gift className="w-3 h-3 text-turquoise shrink-0" />
                          <span className="truncate">{sup.latestGiftName || "هدية"}</span>
                        </span>
                        <span className="text-[10px] text-secondaryText/80 font-mono">
                          {formatGiftTime(sup.latestGiftTime)}
                        </span>
                      </div>
                    </td>

                    {/* 6. Classification / Category */}
                    <td className="text-center">
                      <span
                        className={`text-[11px] px-2.5 py-1 rounded-md font-bold border inline-block ${
                          sup.sessionDiamonds >= 20000
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : sup.sessionDiamonds >= 5000
                            ? "bg-gold/10 text-gold border-gold/30"
                            : sup.sessionDiamonds >= 1000
                            ? "bg-turquoise/10 text-turquoise border-turquoise/30"
                            : "bg-white/5 text-secondaryText border-white/10"
                        }`}
                      >
                        {sup.category}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. FOOTER NOTE */}
      <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-secondaryText font-mono relative z-10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>مرصود ومطابق 100% لسجلات هدايا جلسة البث الحالية</span>
        </div>
        <div>
          <span>آخر مزامنة: {lastRefreshedAt.toLocaleTimeString("ar-SA")}</span>
        </div>
      </div>
    </div>
  );
}
