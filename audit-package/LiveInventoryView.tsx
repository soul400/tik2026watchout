"use client";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import {
  Sparkles,
  ShieldAlert,
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Filter,
  Search,
  RotateCcw,
  Mic2,
  Zap,
  Shield,
  Hourglass,
  Hammer,
  CloudFog,
  Trash2,
  Lock,
  KeyRound,
  Loader2,
} from "lucide-react";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { DigitalCounter } from "@/components/DigitalCounter";

interface CounterItem {
  toolKey: string;
  toolName: string;
  colorHex: string;
  icon: string;
  totalAvailable: number;
  totalReceived: number;
  totalConsumed: number;
  totalExpiringSoon: number;
  totalExpired: number;
}

interface GrantItem {
  id: string;
  toolDefinitionId: string;
  supporterId: string;
  quantityGranted: number;
  quantityConsumed: number;
  receivedAt: string;
  expiresAt: string;
  status: string;
  auditReference: string | null;
  toolDefinition: {
    key: string;
    name: string;
    colorHex: string;
    icon: string;
  };
  supporter: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

interface LiveInventoryViewProps {
  initialCounters: CounterItem[];
  initialGrants: GrantItem[];
}

export function LiveInventoryView({ initialCounters, initialGrants }: LiveInventoryViewProps) {
  const [counters, setCounters] = useState<CounterItem[]>(initialCounters);
  const [grants, setGrants] = useState<GrantItem[]>(initialGrants);
  const [lastSync, setLastSync] = useState<Date>(new Date());

  // Filter States
  const [selectedTool, setSelectedTool] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Reset Modal States
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [resetPassword, setResetPassword] = useState<string>("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    if (!resetPassword.trim()) {
      setResetError("يرجى إدخال كلمة المرور");
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch("/api/inventory/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setResetError(data.message || "كلمة المرور غير صحيحة");
        setIsResetting(false);
        return;
      }

      setResetSuccess(data.message || "تم تصفير البيانات بنجاح");
      if (data.counters) {
        setCounters(data.counters);
      } else {
        setCounters((prev) =>
          prev.map((c) => ({
            ...c,
            totalAvailable: 0,
            totalReceived: 0,
            totalConsumed: 0,
            totalExpiringSoon: 0,
            totalExpired: 0,
          }))
        );
      }
      setGrants([]);
      setResetPassword("");

      setTimeout(() => {
        setShowResetModal(false);
        setResetSuccess(null);
      }, 1500);
    } catch (err: any) {
      setResetError("فشل الاتصال بالخادم أثناء التصفير");
    } finally {
      setIsResetting(false);
    }
  };

  // Automatic real-time polling every 3 seconds
  useEffect(() => {
    let isMounted = true;

    const fetchInventory = async () => {
      try {
        const res = await fetch("/api/inventory");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setCounters(data.counters || []);
            setGrants(data.grants || []);
            setLastSync(new Date());
          }
        }
      } catch (err) {
        // quiet error
      }
    };

    const interval = setInterval(fetchInventory, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const getToolImagePath = (key: string) => {
    switch (key) {
      case "GLOVE":
        return "/tools/glove.svg";
      case "SONG_SURGE":
        return "/tools/song.svg";
      case "BOOST_FOG":
        return "/tools/fog.svg";
      case "TIME_EXTENDER":
        return "/tools/time.svg";
      case "SPEED_BOOSTER":
        return "/tools/speed.svg";
      case "HAMMER":
        return "/tools/hammer.svg";
      case "SHIELD_DEFENSE":
      default:
        return "/tools/shield.svg";
    }
  };

  const totalAllAvailable = counters.reduce((acc, c) => acc + c.totalAvailable, 0);
  const totalAllReceived = counters.reduce((acc, c) => acc + c.totalReceived, 0);
  const totalAllConsumed = counters.reduce((acc, c) => acc + c.totalConsumed, 0);

  // Filtered Grants Computation
  const filteredGrants = useMemo(() => {
    const now = Date.now();

    return grants.filter((grant) => {
      // 1. Tool type filter
      if (selectedTool !== "ALL" && grant.toolDefinition.key !== selectedTool) {
        return false;
      }

      // Compute status conditions
      const expiresAtMs = new Date(grant.expiresAt).getTime();
      const remainingQty = grant.quantityGranted - grant.quantityConsumed;
      const isExpired = expiresAtMs <= now || grant.status === "EXPIRED";
      const isExpiringSoon = !isExpired && (expiresAtMs - now <= 48 * 60 * 60 * 1000 || grant.status === "EXPIRING_SOON");
      const isAvailable = remainingQty > 0 && !isExpired;
      const isFullyUsed = remainingQty <= 0 || grant.status === "FULLY_USED";

      // 2. Status / Validity filter
      if (selectedStatus === "AVAILABLE" && !isAvailable) {
        return false;
      }
      if (selectedStatus === "VALID" && isExpired) {
        return false;
      }
      if (selectedStatus === "EXPIRING_SOON" && !isExpiringSoon) {
        return false;
      }
      if (selectedStatus === "FULLY_USED" && !isFullyUsed) {
        return false;
      }
      if (selectedStatus === "EXPIRED" && !isExpired) {
        return false;
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = grant.supporter.displayName.toLowerCase().includes(q);
        const matchUser = grant.supporter.username.toLowerCase().includes(q);
        const matchTool = grant.toolDefinition.name.toLowerCase().includes(q);
        if (!matchName && !matchUser && !matchTool) {
          return false;
        }
      }

      return true;
    });
  }, [grants, selectedTool, selectedStatus, searchQuery]);

  const hasActiveFilters = selectedTool !== "ALL" || selectedStatus !== "ALL" || searchQuery.trim().length > 0;

  const resetFilters = () => {
    setSelectedTool("ALL");
    setSelectedStatus("ALL");
    setSearchQuery("");
  };

  const formatRemainingTime = (expiresAtStr: string) => {
    const diffMs = new Date(expiresAtStr).getTime() - Date.now();
    if (diffMs <= 0) return { text: "منتهية الصلاحية", isExpired: true, isSoon: false };
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    const remHours = diffHours % 24;

    if (diffDays > 0) {
      return { text: `متبقي ${diffDays} يوم و ${remHours} س`, isExpired: false, isSoon: diffDays < 2 };
    }
    return { text: `متبقي ${diffHours} ساعة`, isExpired: false, isSoon: true };
  };

  return (
    <div className="space-y-8">
      {/* Top HUD Deck */}
      <div className="hud-deck p-6 md:p-8 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-turquoise/15 text-turquoise text-xs font-bold font-mono border border-turquoise/30 flex items-center gap-1.5 shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
                TIKTOK LIVE OFFICIAL POWER-UPS
              </span>
              <ConfidenceBadge
                state="VERIFIED"
                methodology="عمليات ذرية مشفرة؛ انتهاء خادمي قطعي بـ 120 ساعة وتتبع دقيق للدفعة"
              />
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                رصد حي لحظي وتلقائي (Auto-Sync)
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              خزينة الأدوات التكتيكية الذكية
            </h2>
            <p className="text-sm text-secondaryText max-w-3xl leading-relaxed">
              تتبع دقيق وشامل لأدوات الـ Power-Ups الرسمية في تيك توك لايف (القفاز x5، موجة الأغنية x5، الضباب المعزز، ممدد الوقت، معزز السرعة، مطرقة التعطيل، ودرع الصمود)
              المرصودة تلقائياً فور منحها في البث المباشر مع دعم المنح المتعدد بعد الجولات.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="flex items-center gap-4 bg-background/90 p-4 px-5 rounded-2xl border border-turquoise/30 shadow-lg">
              <div className="text-center px-4 border-l border-white/10">
                <span className="text-[11px] text-secondaryText font-mono block mb-1">الرصيد النشط</span>
                <DigitalCounter value={totalAllAvailable} size="lg" color="text-turquoise" />
              </div>
              <div className="text-center px-4 border-l border-white/10">
                <span className="text-[11px] text-secondaryText font-mono block mb-1">المستلم</span>
                <DigitalCounter value={totalAllReceived} size="md" color="text-white" />
              </div>
              <div className="text-center px-2">
                <span className="text-[11px] text-secondaryText font-mono block mb-1">المستهلك</span>
                <DigitalCounter value={totalAllConsumed} size="md" color="text-secondaryText" />
              </div>
            </div>

            <button
              onClick={() => {
                setResetPassword("");
                setResetError(null);
                setResetSuccess(null);
                setShowResetModal(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all shadow-md hover:shadow-rose-500/15 active:scale-95 group"
              title="تصفير بيانات الخزينة التكتيكية"
            >
              <Trash2 className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
              <span>تصفير البيانات</span>
            </button>
          </div>
        </div>
      </div>

      {/* Official Power-Up Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {counters.map((tool) => {
          const imgPath = getToolImagePath(tool.toolKey);

          return (
            <div
              key={tool.toolKey}
              className={`hud-deck rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:border-turquoise/50 hover:shadow-xl hover:shadow-turquoise/10 flex flex-col justify-between cursor-pointer ${
                selectedTool === tool.toolKey ? "ring-2 ring-turquoise bg-turquoise/5" : ""
              }`}
              style={{ borderTop: `4px solid ${tool.colorHex}` }}
              onClick={() => setSelectedTool(selectedTool === tool.toolKey ? "ALL" : tool.toolKey)}
            >
              <div>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-surface/80 border border-white/10 flex items-center justify-center p-2 shadow-inner">
                    <Image
                      src={imgPath}
                      alt={tool.toolName}
                      width={44}
                      height={44}
                      className="object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                    />
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] font-mono text-secondaryText block uppercase tracking-wider">
                      الرصيد المتاح
                    </span>
                    <span className="text-2xl font-black digi-number" style={{ color: tool.colorHex }}>
                      {tool.totalAvailable}
                    </span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-white mb-0.5 line-clamp-1">{tool.toolName}</h3>
                <p className="text-[11px] font-mono text-secondaryText mb-4">
                  {tool.toolKey} • 120H TTL
                </p>
              </div>

              <div className="pt-3 border-t border-white/5 grid grid-cols-3 gap-1.5 text-center text-xs font-mono">
                <div className="bg-background/50 p-1.5 rounded-lg">
                  <span className="text-secondaryText block text-[9px]">مستلم</span>
                  <span className="font-bold text-white text-xs">{tool.totalReceived}</span>
                </div>
                <div className="bg-background/50 p-1.5 rounded-lg">
                  <span className="text-secondaryText block text-[9px]">مستهلك</span>
                  <span className="font-bold text-secondaryText text-xs">{tool.totalConsumed}</span>
                </div>
                <div className="bg-background/50 p-1.5 rounded-lg">
                  <span className="text-secondaryText block text-[9px]">منتهي</span>
                  <span className="font-bold text-rose-400 text-xs">{tool.totalExpired}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grants Activity Ledger with Advanced Filtering */}
      <div className="hud-deck rounded-2xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-turquoise" />
              سجل الأدوات التكتيكية المرصودة في البث
            </h3>
            <p className="text-xs text-secondaryText mt-1">
              تسجيل لحظي وتلقائي للأدوات الممنوحة للداعمين مع مهلة انتهاء الـ 120 ساعة وفلترة تكتيكية متقدمة
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-turquoise px-3 py-1 rounded-full bg-turquoise/10 border border-turquoise/30">
              عرض {filteredGrants.length} من {grants.length} سجل
            </span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                title="إلغاء جميع الفلاتر"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                إعادة ضبط
              </button>
            )}
          </div>
        </div>

        {/* Interactive Filter Toolbar */}
        <div className="bg-background/60 p-4 rounded-xl border border-white/5 space-y-3 mb-6">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-secondaryText absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم الداعم، المعرف، أو نوع الأداة..."
                className="w-full bg-surface/80 border border-white/10 rounded-xl pr-9 pl-4 py-2 text-sm text-white placeholder-secondaryText/60 focus:outline-none focus:border-turquoise/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-secondaryText hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Tool Type Selector */}
            <div className="flex items-center gap-2 shrink-0">
              <Filter className="w-4 h-4 text-turquoise" />
              <select
                value={selectedTool}
                onChange={(e) => setSelectedTool(e.target.value)}
                className="bg-surface/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-turquoise/50 cursor-pointer"
              >
                <option value="ALL">جميع الأدوات (All Tools)</option>
                <option value="GLOVE">🥊 القفاز التكتيكي (Glove x5)</option>
                <option value="SONG_SURGE">🎤 موجة الأغنية (Song Surge x5)</option>
                <option value="BOOST_FOG">🌫️ الضباب المعزز (Magic Mist)</option>
                <option value="TIME_EXTENDER">⏱️ ممدد الوقت (Timer +10s)</option>
                <option value="HAMMER">🔨 مطرقة الحظر (Victory Hammer)</option>
                <option value="SPEED_BOOSTER">⚡ معزز السرعة (Speed Booster)</option>
                <option value="SHIELD_DEFENSE">🛡️ درع الصمود (Shield Defense)</option>
              </select>
            </div>

            {/* Status / Validity Selector */}
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-surface/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-turquoise/50 cursor-pointer"
              >
                <option value="ALL">جميع الحالات (All Statuses)</option>
                <option value="AVAILABLE">⚡ المتاحة فقط (Available)</option>
                <option value="VALID">🛡️ الصالحة فقط (Valid / Not Expired)</option>
                <option value="EXPIRING_SOON">⏳ القريبة من الانتهاء (Expiring Soon)</option>
                <option value="FULLY_USED">✓ المستهلكة بالكامل (Fully Used)</option>
                <option value="EXPIRED">✕ المنتهية الصلاحية (Expired)</option>
              </select>
            </div>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5 text-xs font-mono">
            <span className="text-secondaryText text-[11px] ml-1">تصفية سريعة:</span>
            <button
              onClick={() => setSelectedStatus("AVAILABLE")}
              className={`px-2.5 py-1 rounded-lg border transition-all ${
                selectedStatus === "AVAILABLE"
                  ? "bg-turquoise/20 text-turquoise border-turquoise"
                  : "bg-surface/40 text-secondaryText border-white/5 hover:border-white/20"
              }`}
            >
              المتاحة فقط ⚡
            </button>
            <button
              onClick={() => setSelectedStatus("EXPIRING_SOON")}
              className={`px-2.5 py-1 rounded-lg border transition-all ${
                selectedStatus === "EXPIRING_SOON"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-surface/40 text-secondaryText border-white/5 hover:border-white/20"
              }`}
            >
              القريبة من الانتهاء ⏳
            </button>
            <button
              onClick={() => setSelectedStatus("VALID")}
              className={`px-2.5 py-1 rounded-lg border transition-all ${
                selectedStatus === "VALID"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-surface/40 text-secondaryText border-white/5 hover:border-white/20"
              }`}
            >
              الصالحة فقط 🛡️
            </button>
            <button
              onClick={() => setSelectedTool("SONG_SURGE")}
              className={`px-2.5 py-1 rounded-lg border transition-all ${
                selectedTool === "SONG_SURGE"
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                  : "bg-surface/40 text-secondaryText border-white/5 hover:border-white/20"
              }`}
            >
              موجة الأغنية 🎤
            </button>
            <button
              onClick={() => setSelectedTool("GLOVE")}
              className={`px-2.5 py-1 rounded-lg border transition-all ${
                selectedTool === "GLOVE"
                  ? "bg-gold/20 text-gold border-gold/40"
                  : "bg-surface/40 text-secondaryText border-white/5 hover:border-white/20"
              }`}
            >
              القفاز x5 🥊
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          {filteredGrants.length === 0 ? (
            <div className="py-12 text-center text-secondaryText">
              <p className="text-base font-bold text-white">
                {grants.length === 0
                  ? "لا توجد أدوات ممنوحة مسجلة بعد"
                  : "لا توجد نتائج تطابق الفلاتر المحددة"}
              </p>
              <p className="text-xs font-mono mt-1 text-secondaryText">
                {grants.length === 0
                  ? "سيتم رصد الأدوات الممنوحة تلقائياً فور نزولها أو إهدائها في جولات التحدي الحية"
                  : "جرب تغيير معايير البحث أو تصفية نوع الأداة والحالة لعرض النتائج"}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-mono text-turquoise bg-turquoise/10 border border-turquoise/30 hover:bg-turquoise/20 transition-colors"
                >
                  إعادة ضبط جميع الفلاتر
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b border-white/10 text-xs text-secondaryText uppercase font-mono">
                  <th className="pb-3 pr-2">الداعم المستفيد</th>
                  <th className="pb-3">الأداة التكتيكية</th>
                  <th className="pb-3 text-center">الكمية (المتبقي / الإجمالي)</th>
                  <th className="pb-3 text-center">تاريخ الاستلام</th>
                  <th className="pb-3 text-center">الصلاحية المتبقية (120H)</th>
                  <th className="pb-3 text-center">الحالة الحالية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {filteredGrants.map((grant) => {
                  const remQty = Math.max(0, grant.quantityGranted - grant.quantityConsumed);
                  const remTime = formatRemainingTime(grant.expiresAt);
                  const isAvailable = remQty > 0 && !remTime.isExpired;

                  return (
                    <tr key={grant.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 pr-2 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-surface border border-white/10 flex items-center justify-center font-bold text-turquoise text-sm overflow-hidden shrink-0">
                          {grant.supporter.avatarUrl ? (
                            <img
                              src={grant.supporter.avatarUrl}
                              alt={grant.supporter.displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{grant.supporter.displayName.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{grant.supporter.displayName}</p>
                          <p className="text-xs text-secondaryText font-mono">@{grant.supporter.username}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: grant.toolDefinition.colorHex }}
                          />
                          <span className="font-bold text-white text-sm">
                            {grant.toolDefinition.name}
                          </span>
                        </div>
                        {grant.auditReference && (
                          <span className="text-[10px] text-secondaryText font-mono block mt-0.5">
                            {grant.auditReference}
                          </span>
                        )}
                      </td>
                      <td className="py-4 text-center font-mono">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-bold text-turquoise text-base">{remQty}</span>
                          <span className="text-secondaryText text-xs">/</span>
                          <span className="text-secondaryText text-xs font-semibold">{grant.quantityGranted}</span>
                        </div>
                        {grant.quantityConsumed > 0 && (
                          <span className="text-[10px] text-secondaryText block">
                            (استُهلك {grant.quantityConsumed})
                          </span>
                        )}
                      </td>
                      <td className="py-4 text-center font-mono text-xs text-secondaryText">
                        {new Date(grant.receivedAt).toLocaleTimeString("ar-SA", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                        <span className="block text-[10px] text-secondaryText/70">
                          {new Date(grant.receivedAt).toLocaleDateString("ar-SA")}
                        </span>
                      </td>
                      <td className="py-4 text-center font-mono text-xs">
                        <span
                          className={`font-semibold ${
                            remTime.isExpired
                              ? "text-rose-400"
                              : remTime.isSoon
                              ? "text-amber-300"
                              : "text-emerald-300"
                          }`}
                        >
                          {remTime.text}
                        </span>
                        <span className="text-[10px] text-secondaryText block mt-0.5">
                          {new Date(grant.expiresAt).toLocaleDateString("ar-SA")}
                        </span>
                      </td>
                      <td className="py-4 text-center">
                        {remTime.isExpired || grant.status === "EXPIRED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3 h-3" />
                            منتهية الصلاحية
                          </span>
                        ) : remQty <= 0 || grant.status === "FULLY_USED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-zinc-500/10 text-secondaryText border border-zinc-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            مستهلكة بالكامل
                          </span>
                        ) : remTime.isSoon || grant.status === "EXPIRING_SOON" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            قريبة من الانتهاء ⏳
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-turquoise/10 text-turquoise border border-turquoise/20">
                            <Zap className="w-3 h-3" />
                            نشطة ومتاحة ⚡
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

      {/* Password-Protected Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121820] border border-rose-500/30 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
            {/* Ambient Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">تصفير بيانات الخزينة</h3>
                  <p className="text-xs text-rose-400 font-mono flex items-center gap-1 mt-0.5">
                    <Lock className="w-3 h-3" />
                    عملية محمية بكلمة مرور
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isResetting) setShowResetModal(false);
                }}
                disabled={isResetting}
                className="text-secondaryText hover:text-white transition-colors p-1 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-secondaryText leading-relaxed mb-6 bg-rose-950/20 p-3.5 rounded-xl border border-rose-500/20">
              <strong className="text-rose-300 block mb-1">تنبيه هام جداً:</strong>
              سيؤدي هذا الإجراء إلى حذف جميع سجلات الأدوات المرصودة، المستهلكة، والتنبيهات نهائياً وإعادة جميع عدادات الأدوات إلى الصفر فوراً.
            </p>

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-rose-400" />
                  أدخل كلمة المرور لتأكيد التصفير:
                </label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => {
                    setResetPassword(e.target.value);
                    if (resetError) setResetError(null);
                  }}
                  placeholder="كلمة المرور (0000)"
                  autoFocus
                  disabled={isResetting}
                  className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-widest text-white placeholder-secondaryText/40 focus:outline-none focus:border-rose-500/50 transition-colors"
                />
              </div>

              {resetError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  disabled={isResetting}
                  className="flex-1 py-2.5 rounded-xl bg-surface border border-white/10 text-xs font-bold text-secondaryText hover:text-white transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isResetting || !resetPassword}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-900/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التصفير...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>تأكيد التصفير</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
