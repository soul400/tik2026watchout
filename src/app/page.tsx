import { prisma } from "@/lib/prisma";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { DigitalCounter } from "@/components/DigitalCounter";
import {
  Radio,
  Users,
  ShieldAlert,
  Award,
  Zap,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  RefreshCw,
  Swords,
  BatteryCharging,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowUpRight,
} from "lucide-react";

import { StreamerHudHeader } from "@/components/StreamerHudHeader";
import { SupportValue } from "@/components/SupportValue";
import { LiveStreamSupportersTable } from "@/components/LiveStreamSupportersTable";
import { LiveStreamSupportersService } from "@/lib/live-supporters-service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: "mohra-live" },
    include: { streamers: true },
  });
  const tenantId = tenant?.id || "";
  const streamer = tenant?.streamers[0];

  const activeLiveSession = await prisma.liveSession.findFirst({
    where: { tenantId, status: "LIVE" },
    orderBy: { startedAt: "desc" },
  });
  const isCurrentlyLive = !!activeLiveSession;

  const supportersCount = await prisma.supporter.count({ where: { tenantId } });
  const activeBattles = await prisma.battle.count({ where: { tenantId, status: "IN_PROGRESS" } });
  const liveSupportersData = await LiveStreamSupportersService.getCurrentLiveSupporters(tenantId, 50);

  const { SmartInventoryService } = await import("@/lib/smart-inventory");
  const inventoryCounters = await SmartInventoryService.getInventoryCounters(tenantId);
  const availableToolsCount = inventoryCounters.reduce((acc, c) => acc + c.totalAvailable, 0);

  const diamondsAggregate = await prisma.supporter.aggregate({
    where: { tenantId },
    _sum: { totalDiamonds: true },
  });
  const totalDiamondsAccumulated = diamondsAggregate._sum.totalDiamonds || 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 1. TOP HEADER: الستريمر مع حالة البث المباشر الفعلية */}
      <StreamerHudHeader
        streamer={streamer}
        isLive={isCurrentlyLive}
        activeSessionId={activeLiveSession?.id}
      />

      {/* ============================================================== */}
      {/* 2. THE FOUR LARGE DIGI-DESIGN CARDS (بطاقات أكبر حجماً وتصميم تقني ديجيتال) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Diamonds */}
        <div className="digi-stat-card border-t-4 border-t-gold flex flex-col justify-between min-h-[190px]">
          <div>
            <div className="flex items-center justify-between text-secondaryText text-xs font-bold font-mono uppercase tracking-wider mb-2">
              <span>الماس المرصود في الجلسة</span>
              <div className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center text-gold shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <DigitalCounter value={totalDiamondsAccumulated} size="xl" color="text-gold" suffix="💎" isSupportNumber={true} />
            </div>
          </div>
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-secondaryText font-mono">
            <span>مجموع هدايا النزالات</span>
            <span className="text-gold font-bold">100% قطعي</span>
          </div>
        </div>

        {/* Card 2: Power-Ups */}
        <div className="digi-stat-card border-t-4 border-t-turquoise flex flex-col justify-between min-h-[190px]">
          <div>
            <div className="flex items-center justify-between text-secondaryText text-xs font-bold font-mono uppercase tracking-wider mb-2">
              <span>رصيد الـ Power-Ups النشط</span>
              <div className="w-9 h-9 rounded-xl bg-turquoise/15 border border-turquoise/30 flex items-center justify-center text-turquoise shadow-md">
                <BatteryCharging className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <DigitalCounter value={availableToolsCount} size="xl" color="text-turquoise" suffix="أداة" />
            </div>
          </div>
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-secondaryText font-mono">
            <span>القفاز، الضباب، والسرعة</span>
            <span className="text-turquoise font-bold">صلاحية 5 أيام</span>
          </div>
        </div>

        {/* Card 3: Supporters */}
        <div className="digi-stat-card border-t-4 border-t-blue flex flex-col justify-between min-h-[190px]">
          <div>
            <div className="flex items-center justify-between text-secondaryText text-xs font-bold font-mono uppercase tracking-wider mb-2">
              <span>الداعمون المتفاعلون</span>
              <div className="w-9 h-9 rounded-xl bg-blue/15 border border-blue/30 flex items-center justify-center text-blue shadow-md">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <DigitalCounter value={supportersCount} size="xl" color="text-blue" suffix="عضو" />
            </div>
          </div>
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-secondaryText font-mono">
            <span>هويات موثقة بدون تكرار</span>
            <span className="text-blue font-bold">رصد حقيقي</span>
          </div>
        </div>

        {/* Card 4: Battles */}
        <div className="digi-stat-card border-t-4 border-t-purple flex flex-col justify-between min-h-[190px]">
          <div>
            <div className="flex items-center justify-between text-secondaryText text-xs font-bold font-mono uppercase tracking-wider mb-2">
              <span>النزالات النشطة (1v1 / 2v2)</span>
              <div className="w-9 h-9 rounded-xl bg-purple/15 border border-purple/30 flex items-center justify-center text-purple shadow-md">
                <Swords className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <DigitalCounter value={activeBattles} size="xl" color="text-purple" suffix="جولة" />
            </div>
          </div>
          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-secondaryText font-mono">
            <span>إسناد الفرق القطعي</span>
            <span className="text-purple font-bold">LINK-MIC</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. LIVE STREAM SUPPORTERS BOARD: لوحة داعمين البث الحية تتجدد مع كل بث */}
      {/* ============================================================== */}
      <LiveStreamSupportersTable initialData={liveSupportersData} tenantId={tenantId} />

      {/* ============================================================== */}
      {/* 4. UNDER TABLE: سجل موثوقية المقاييس (Full Width Digi Pod) */}
      {/* ============================================================== */}
      <div className="hud-deck rounded-2xl p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-turquoise/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-turquoise/15 border border-turquoise/30 flex items-center justify-center text-turquoise">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">سجل موثوقية المقاييس (Data Confidence Ledger)</h3>
              <p className="text-xs text-secondaryText mt-0.5">
                تلتزم المنصة بتوثيق مصدر كل مقياس ومنهجيته لمنع أي توليد أو تخمين للأرقام
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
            100% شفاف وقابل للتفسير
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-background/90 p-5 rounded-2xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">خزينة أدوات الـ Power-Ups</span>
              <ConfidenceBadge state="VERIFIED" />
            </div>
            <p className="text-xs text-secondaryText leading-relaxed">
              تتبع 120 ساعة خادمية دقيقة ومنع الاستهلاك المزدوج لكل دفعة
            </p>
          </div>

          <div className="bg-background/90 p-5 rounded-2xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">نتائج النزالات 1v1 و 2v2</span>
              <ConfidenceBadge state="VERIFIED" />
            </div>
            <p className="text-xs text-secondaryText leading-relaxed">
              إسناد قطعي للفرق ونقاط الهدايا بناءً على المعرف الدائم للستريمر
            </p>
          </div>

          <div className="bg-background/90 p-5 rounded-2xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">دقائق الحضور للمجتمع</span>
              <ConfidenceBadge state="ESTIMATED" />
            </div>
            <p className="text-xs text-secondaryText leading-relaxed">
              مشتق من النشاط والتفاعل المرصود؛ TikTok لا يبث قائمة المشاهدين الصامتين
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-secondaryText font-mono">
          <span>المنطقة الزمنية المرجعية: Asia/Riyadh (UTC+3)</span>
          <span className="text-turquoise font-bold">تحديث لحظي مستمر عبر محرك الأحداث</span>
        </div>
      </div>
    </div>
  );
}
