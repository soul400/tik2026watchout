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
  Package,
  Users,
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

interface AggregatedSupporterTool {
  key: string;
  supporterId: string;
  toolKey: string;
  supporter: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  toolDefinition: {
    key: string;
    name: string;
    colorHex: string;
    icon: string;
  };
  totalGranted: number;
  totalConsumed: number;
  available: number;
  latestReceivedAt: string;
  latestExpiresAt: string;
  grantsCount: number;
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

  // View mode: 'AGGREGATED' (matching reference design) or 'DETAILED' (grant by grant)
  const [viewMode, setViewMode] = useState<"AGGREGATED" | "DETAILED">("AGGREGATED");

  // Aggregated Supporter Tools Computation (Combining multiple grants for the same supporter and tool into a single balance row)
  const aggregatedSupporterTools = useMemo(() => {
    const map = new Map<string, AggregatedSupporterTool>();

    for (const grant of filteredGrants) {
      const groupKey = `${grant.supporterId}_${grant.toolDefinition.key}`;
      if (!map.has(groupKey)) {
        map.set(groupKey, {
          key: groupKey,
          supporterId: grant.supporterId,
          toolKey: grant.toolDefinition.key,
          supporter: grant.supporter,
          toolDefinition: grant.toolDefinition,
          totalGranted: 0,
          totalConsumed: 0,
          available: 0,
          latestReceivedAt: grant.receivedAt,
          latestExpiresAt: grant.expiresAt,
          grantsCount: 0,
        });
      }

      const item = map.get(groupKey)!;
      item.totalGranted += grant.quantityGranted;
      item.totalConsumed += grant.quantityConsumed;
      item.available = Math.max(0, item.totalGranted - item.totalConsumed);
      item.grantsCount += 1;

      if (new Date(grant.receivedAt).getTime() > new Date(item.latestReceivedAt).getTime()) {
        item.latestReceivedAt = grant.receivedAt;
      }
      if (new Date(grant.expiresAt).getTime() > new Date(item.latestExpiresAt).getTime()) {
        item.latestExpiresAt = grant.expiresAt;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      // Sort by available balance descending, then by latest acquisition time descending
      if (b.available !== a.available) {
        return b.available - a.available;
      }
      return new Date(b.latestReceivedAt).getTime() - new Date(a.latestReceivedAt).getTime();
    });
  }, [filteredGrants]);

  const activeAccountsCount = useMemo(() => {
    return aggregatedSupporterTools.filter((item) => item.available > 0).length;
  }, [aggregatedSupporterTools]);

  const getDisplayToolName = (tool: { key: string; name: string }) => {
    if (tool.key === "GLOVE") return "قفازات المعركة";
    if (tool.key === "SONG_SURGE") return "موجة الأغنية";
    if (tool.key === "BOOST_FOG") return "الضباب المعزز";
    if (tool.key === "TIME_EXTENDER") return "ممدد الوقت";
    if (tool.key === "SPEED_BOOSTER") return "معزز السرعة";
    if (tool.key === "HAMMER") return "مطرقة الحظر";
    if (tool.key === "SHIELD_DEFENSE") return "درع الصمود";
    return tool.name;
  };

  const getToolTacticalPerk = (key: string) => {
    switch (key) {
      case "GLOVE":
        return "ضربة قاضية x5 🥊";
      case "SONG_SURGE":
        return "مضاعفة النقاط x5 🎤";
      case "BOOST_FOG":
        return "حجب نقاط الجولة 30s 🌫️";
      case "TIME_EXTENDER":
        return "تمديد الوقت +10s ⏱️";
      case "SPEED_BOOSTER":
        return "معزز سرعة التحدي ⚡";
      case "HAMMER":
        return "مطرقة تعطيل الخصم 🔨";
      case "SHIELD_DEFENSE":
        return "درع صمود دفاعي 🛡️";
      default:
        return "أداة تكتيكية معتمدة 📦";
    }
  };

  const getToolEmoji = (key: string) => {
    switch (key) {
      case "GLOVE":
        return "🥊";
      case "SONG_SURGE":
        return "🎤";
      case "BOOST_FOG":
        return "🌫️";
      case "TIME_EXTENDER":
        return "⏱️";
      case "SPEED_BOOSTER":
        return "⚡";
      case "HAMMER":
        return "🔨";
      case "SHIELD_DEFENSE":
        return "🛡️";
      default:
        return "📦";
    }
  };

  const formatAcquisitionTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour12: false,
      });
      const parts = formatter.formatToParts(d);
      const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";
      const hours = getPart("hour");
      const minutes = getPart("minute");
      const seconds = getPart("second");
      const year = getPart("year");
      const month = getPart("month");
      const day = getPart("day");
      return `${hours}:${minutes}:${seconds} ${year}-${month}-${day}`;
    } catch {
      const d = new Date(isoString);
      return d.toISOString().replace("T", " ").substring(0, 19);
    }
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
      <div className="space-y-4">
        {/* View Switcher Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-background/80 p-2.5 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2 bg-surface/90 p-1 rounded-xl border border-white/10 w-fit">
            <button
              onClick={() => setViewMode("AGGREGATED")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
                viewMode === "AGGREGATED"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-secondaryText hover:text-white"
              }`}
            >
              <Package className="w-4 h-4" />
              <span>أرصدة الأدوات للداعمين (مجمع)</span>
            </button>
            <button
              onClick={() => setViewMode("DETAILED")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
                viewMode === "DETAILED"
                  ? "bg-turquoise text-slate-950 shadow-md shadow-turquoise/20"
                  : "text-secondaryText hover:text-white"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>سجل العمليات والتدقيق (120H TTL)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-secondaryText px-3 py-1.5 rounded-full bg-surface border border-white/10">
              {viewMode === "AGGREGATED"
                ? `عرض ${aggregatedSupporterTools.length} حساب مجمع (${activeAccountsCount} نشط)`
                : `عرض ${filteredGrants.length} من ${grants.length} سجل`}
            </span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                title="إلغاء جميع الفلاتر"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                إعادة ضبط
              </button>
            )}
          </div>
        </div>

        {/* Interactive Filter Toolbar */}
        <div className="bg-background/60 p-4 rounded-xl border border-white/5 space-y-3">
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

        {/* View Content: AGGREGATED (Harmonized Tactical Dark Glassmorphism) OR DETAILED (Ledger) */}
        {viewMode === "AGGREGATED" ? (
          <div className="hud-deck rounded-3xl p-6 md:p-8 relative overflow-hidden">
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
                  {activeAccountsCount > 0 ? activeAccountsCount : aggregatedSupporterTools.length} حسابات نشطة
                </span>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-turquoise/30 bg-turquoise/10 text-turquoise font-bold font-mono text-xs">
                  <Zap className="w-3.5 h-3.5" />
                  {aggregatedSupporterTools.reduce((acc, r) => acc + r.available, 0)} رصيد قتالي متاح
                </span>
              </div>
            </div>

            {/* Aggregated Table */}
            <div className="overflow-x-auto relative z-10 mt-4">
              {aggregatedSupporterTools.length === 0 ? (
                <div className="py-16 text-center text-secondaryText">
                  <Package className="w-12 h-12 text-secondaryText/40 mx-auto mb-3" />
                  <p className="text-base font-bold text-white">
                    {grants.length === 0
                      ? "لا توجد أدوات ممنوحة مسجلة بعد"
                      : "لا توجد نتائج تطابق الفلاتر المحددة"}
                  </p>
                  <p className="text-xs font-mono mt-1 text-secondaryText">
                    {grants.length === 0
                      ? "سيتم تجميع وتحديث أرصدة الأدوات للداعمين تلقائياً فور منحها في جولات البث المباشر"
                      : "جرب تغيير معايير البحث أو اختيار نوع أداة أو حالة أخرى"}
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
                    {aggregatedSupporterTools.map((row) => {
                      const remTime = formatRemainingTime(row.latestExpiresAt);
                      const isExpired = remTime.isExpired;
                      const isExpiringSoon = remTime.isSoon;
                      const isReady = row.available > 0 && !isExpired;
                      const percentConsumed = row.totalGranted > 0 ? Math.round((row.totalConsumed / row.totalGranted) * 100) : 0;

                      return (
                        <tr key={row.key} className="hover:bg-white/[0.025] transition-colors group">
                          {/* 1. الداعم / المستخدم */}
                          <td className="py-4 pr-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-surface border border-white/10 flex items-center justify-center font-bold text-turquoise text-sm overflow-hidden shrink-0 shadow-inner group-hover:border-turquoise/40 transition-colors">
                                {row.supporter.avatarUrl ? (
                                  <img
                                    src={row.supporter.avatarUrl}
                                    alt={row.supporter.displayName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>{row.supporter.displayName?.charAt(0) || row.supporter.username.charAt(0)}</span>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-white text-sm leading-tight group-hover:text-turquoise transition-colors">
                                  {row.supporter.username}@
                                </p>
                                <p className="text-xs text-secondaryText leading-tight mt-0.5 truncate max-w-[150px]">
                                  {row.supporter.displayName}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* 2. الأداة والتأثير التكتيكي */}
                          <td className="py-4">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl shrink-0">{getToolEmoji(row.toolDefinition.key)}</span>
                              <div>
                                <span className="font-bold text-white text-sm block leading-tight">
                                  {getDisplayToolName(row.toolDefinition)}
                                </span>
                                <span className="inline-block text-[10px] font-mono text-amber-400/90 font-medium mt-0.5">
                                  {getToolTacticalPerk(row.toolDefinition.key)}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 3. الرصيد المتاح (Glowing Cyber Gold Badge) */}
                          <td className="py-4 text-center">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-sm flex items-center justify-center shadow-lg shadow-amber-500/30 mx-auto digi-number">
                              {row.available}
                            </div>
                          </td>

                          {/* 4. إجمالي الحيازة */}
                          <td className="py-4 text-center font-mono font-bold text-white text-sm md:text-base digi-number">
                            {row.totalGranted}
                          </td>

                          {/* 5. المستهلك منها */}
                          <td className="py-4 text-center font-mono text-secondaryText text-sm md:text-base digi-number">
                            {row.totalConsumed}
                          </td>

                          {/* 6. الجاهزية التكتيكية والمعدل */}
                          <td className="py-4 text-center">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              {isExpired ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  <XCircle className="w-3 h-3" />
                                  منتهية الصلاحية
                                </span>
                              ) : row.available <= 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-zinc-500/10 text-secondaryText border border-zinc-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  مستهلكة بالكامل
                                </span>
                              ) : isExpiringSoon ? (
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
                                    isReady ? "bg-amber-400" : "bg-secondaryText/40"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(5, percentConsumed))}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* 7. الصلاحية (120H TTL) */}
                          <td className="py-4 text-center font-mono text-xs">
                            <span
                              suppressHydrationWarning
                              className={`font-semibold block ${
                                isExpired
                                  ? "text-rose-400"
                                  : isExpiringSoon
                                  ? "text-amber-300 font-bold"
                                  : "text-emerald-400"
                              }`}
                            >
                              {remTime.text}
                            </span>
                            <span className="text-[10px] text-secondaryText/70 block mt-0.5" suppressHydrationWarning>
                              {new Date(row.latestExpiresAt).toLocaleDateString("ar-SA")}
                            </span>
                          </td>

                          {/* 8. آخر حيازة */}
                          <td className="py-4 text-center font-mono text-xs text-secondaryText">
                            <span className="text-white font-medium block" suppressHydrationWarning>
                              {new Date(row.latestReceivedAt).toLocaleTimeString("ar-SA", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                            <span className="text-[10px] text-secondaryText/70 block mt-0.5" suppressHydrationWarning>
                              {new Date(row.latestReceivedAt).toLocaleDateString("ar-SA")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          /* Detailed Ledger View */
          <div className="hud-deck rounded-3xl p-6 md:p-8 relative overflow-hidden">
            {/* Ambient Tactical Glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-turquoise/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header Deck */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/10 relative z-10">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
                  <Layers className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg md:text-xl font-black text-white tracking-tight">
                      سجل الأدوات التكتيكية المرصودة في البث (تفصيلي)
                    </h3>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      AUDITED ENTRIES
                    </span>
                  </div>
                  <p className="text-xs text-secondaryText mt-1 max-w-2xl leading-relaxed">
                    تسجيل لحظي وتلقائي للأدوات الممنوحة للداعمين مع مهلة انتهاء الـ 120 ساعة وتتبع دقيق للدفعة والمطابقة التكتيكية
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-300 font-bold font-mono text-xs shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  {filteredGrants.length} إدخالات مقيدة
                </span>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-turquoise/30 bg-turquoise/10 text-turquoise font-bold font-mono text-xs">
                  <Zap className="w-3.5 h-3.5" />
                  {filteredGrants.reduce((acc, g) => acc + Math.max(0, g.quantityGranted - g.quantityConsumed), 0)} رصيد متاح
                </span>
              </div>
            </div>

            <div className="overflow-x-auto relative z-10 mt-4">
              {filteredGrants.length === 0 ? (
                <div className="py-16 text-center text-secondaryText">
                  <Package className="w-12 h-12 text-secondaryText/40 mx-auto mb-3" />
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
                </div>
              ) : (
                <table className="w-full text-sm text-right">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-secondaryText uppercase font-mono tracking-wider">
                      <th className="py-4 pr-3 text-right">الداعم المستفيد</th>
                      <th className="py-4 text-right">الأداة والتأثير التكتيكي</th>
                      <th className="py-4 text-center">الرصيد المتاح</th>
                      <th className="py-4 text-center">إجمالي الحيازة</th>
                      <th className="py-4 text-center">المستهلك منها</th>
                      <th className="py-4 text-center">الجاهزية التكتيكية</th>
                      <th className="py-4 text-center">الصلاحية (120H)</th>
                      <th className="py-4 text-center">تاريخ ووقت الاستلام</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-sans">
                    {filteredGrants.map((grant) => {
                      const remQty = Math.max(0, grant.quantityGranted - grant.quantityConsumed);
                      const remTime = formatRemainingTime(grant.expiresAt);
                      const isExpired = remTime.isExpired || grant.status === "EXPIRED";
                      const isExpiringSoon = !isExpired && (remTime.isSoon || grant.status === "EXPIRING_SOON");
                      const isReady = remQty > 0 && !isExpired;
                      const percentConsumed = grant.quantityGranted > 0 ? Math.round((grant.quantityConsumed / grant.quantityGranted) * 100) : 0;

                      return (
                        <tr key={grant.id} className="hover:bg-white/[0.025] transition-colors group">
                          {/* 1. الداعم المستفيد */}
                          <td className="py-4 pr-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-surface border border-white/10 flex items-center justify-center font-bold text-turquoise text-sm overflow-hidden shrink-0 shadow-inner group-hover:border-turquoise/40 transition-colors">
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
                              <div className="text-right">
                                <p className="font-bold text-white text-sm leading-tight group-hover:text-turquoise transition-colors">
                                  @{grant.supporter.username}
                                </p>
                                <p className="text-xs text-secondaryText leading-tight mt-0.5 truncate max-w-[150px]">
                                  {grant.supporter.displayName}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* 2. الأداة والتأثير التكتيكي */}
                          <td className="py-4">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl shrink-0">{getToolEmoji(grant.toolDefinition.key)}</span>
                              <div>
                                <span className="font-bold text-white text-sm block leading-tight">
                                  {getDisplayToolName(grant.toolDefinition)}
                                </span>
                                <span className="inline-block text-[10px] font-mono text-amber-400/90 font-medium mt-0.5">
                                  {getToolTacticalPerk(grant.toolDefinition.key)}
                                </span>
                                {grant.auditReference && (
                                  <span className="text-[10px] text-secondaryText/70 font-mono block mt-0.5">
                                    {grant.auditReference}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 3. الرصيد المتاح (Glowing Cyber Gold Badge) */}
                          <td className="py-4 text-center">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-sm flex items-center justify-center shadow-lg shadow-amber-500/30 mx-auto digi-number">
                              {remQty}
                            </div>
                          </td>

                          {/* 4. إجمالي الحيازة */}
                          <td className="py-4 text-center font-mono font-bold text-white text-sm md:text-base digi-number">
                            {grant.quantityGranted}
                          </td>

                          {/* 5. المستهلك منها */}
                          <td className="py-4 text-center font-mono text-secondaryText text-sm md:text-base digi-number">
                            {grant.quantityConsumed}
                          </td>

                          {/* 6. الجاهزية التكتيكية والمعدل */}
                          <td className="py-4 text-center">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              {isExpired ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  <XCircle className="w-3 h-3" />
                                  منتهية الصلاحية
                                </span>
                              ) : remQty <= 0 || grant.status === "FULLY_USED" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-zinc-500/10 text-secondaryText border border-zinc-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  مستهلكة بالكامل
                                </span>
                              ) : isExpiringSoon ? (
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
                                    isReady ? "bg-amber-400" : "bg-secondaryText/40"
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
                                  : isExpiringSoon
                                  ? "text-amber-300 font-bold"
                                  : "text-emerald-400"
                              }`}
                            >
                              {remTime.text}
                            </span>
                            <span className="text-[10px] text-secondaryText/70 block mt-0.5" suppressHydrationWarning>
                              {new Date(grant.expiresAt).toLocaleDateString("ar-SA")}
                            </span>
                          </td>

                          {/* 8. تاريخ ووقت الاستلام */}
                          <td className="py-4 text-center font-mono text-xs text-secondaryText">
                            <span className="text-white font-medium block" suppressHydrationWarning>
                              {new Date(grant.receivedAt).toLocaleTimeString("ar-SA", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                            <span className="block text-[10px] text-secondaryText/70" suppressHydrationWarning>
                              {new Date(grant.receivedAt).toLocaleDateString("ar-SA")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
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
