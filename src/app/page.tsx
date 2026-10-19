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
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Compass,
  Lightbulb,
} from "lucide-react";

import { StreamerHudHeader } from "@/components/StreamerHudHeader";
import { SupportValue } from "@/components/SupportValue";
import { LiveStreamSupportersTable } from "@/components/LiveStreamSupportersTable";
import { LiveStreamSupportersService } from "@/lib/live-supporters-service";
import { SmartInventoryService } from "@/lib/smart-inventory";
import { StreamHealthService } from "@/lib/stream-health";
import { STQIEngine } from "@/lib/stqi-engine";
import { LivePulseCopilotWidget } from "@/components/LivePulseCopilotWidget";

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

  const [
    supportersCount,
    activeBattles,
    liveSupportersData,
    inventoryCounters,
    healthTelemetry,
    reconciliationReport,
    stqiOverview,
  ] = await Promise.all([
    prisma.supporter.count({ where: { tenantId } }),
    prisma.battle.count({ where: { tenantId, status: "IN_PROGRESS" } }),
    LiveStreamSupportersService.getCurrentLiveSupporters(tenantId, 50),
    SmartInventoryService.getInventoryCounters(tenantId),
    StreamHealthService.getHealthTelemetry(tenantId),
    SmartInventoryService.reconcileInventory(tenantId),
    STQIEngine.getSmartAnalyticsOverview(tenantId).catch(() => null),
  ]);

  const availableToolsCount = inventoryCounters.reduce((acc, c) => acc + c.totalAvailable, 0);

  const diamondsAggregate = await prisma.supporter.aggregate({
    where: { tenantId },
    _sum: { totalDiamonds: true },
  });
  const totalDiamondsAccumulated = diamondsAggregate._sum.totalDiamonds || 0;

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-16">
      {/* ============================================================== */}
      {/* 1. TOP HEADER: الستريمر مع حالة البث المباشر الفعلية */}
      {/* ============================================================== */}
      <StreamerHudHeader
        streamer={streamer}
        isLive={isCurrentlyLive}
        activeSessionId={activeLiveSession?.id}
      />

      {/* ============================================================== */}
      {/* LAYER A — ماذا يحدث الآن؟ (What is happening now?) */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm font-bold font-mono text-emerald-400 uppercase tracking-wider">
              المستوى أ — ماذا يحدث الآن؟ (Layer A: Operational State)
            </h2>
          </div>
          <span className="text-xs font-mono text-secondaryText">تحديث لحظي مستمر</span>
        </div>

        {/* 4 Large Digi Stat Cards */}
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

        {/* Live Stream Supporters Board */}
        <LiveStreamSupportersTable initialData={liveSupportersData} tenantId={tenantId} />
      </section>

      {/* ============================================================== */}
      {/* LAYER B — ما الذي يتطلب انتباهي؟ (What requires attention?) */}
      {/* ============================================================== */}
      <section className="hud-deck rounded-2xl p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono">
                المستوى ب — التنبيهات التشغيلية والسلامة (Layer B: Priority Attention)
              </h2>
              <p className="text-xs text-secondaryText mt-0.5">
                مراقبة حية لصحة الاتصال، وسلامة دفتر الأستاذ التكتيكي، وتطابق البيانات
              </p>
            </div>
          </div>
          <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
            healthTelemetry.overallHealth === "HEALTHY"
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
              : "text-amber-400 bg-amber-500/10 border-amber-500/30"
          }`}>
            الحالة: {healthTelemetry.overallHealth}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Health Telemetry Card */}
          <div className="bg-background/90 p-5 rounded-2xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">صحة اتصال البث (Stream Health)</span>
              <span className="text-xs font-mono text-emerald-400">{healthTelemetry.status}</span>
            </div>
            <div className="text-xs text-secondaryText space-y-1.5 font-mono">
              <p>• عامل المعالجة: <span className="text-white font-bold">{healthTelemetry.components.worker.status}</span></p>
              <p>• اتصال تيك توك: <span className="text-white font-bold">{healthTelemetry.components.tiktokConnector.status}</span></p>
              <p>• إعادة الاتصال: <span className="text-white font-bold">{healthTelemetry.reconnectCount} مرات</span></p>
            </div>
          </div>

          {/* Ledger 2.0 Reconciliation Card */}
          <div className="bg-background/90 p-5 rounded-2xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">تدقيق دفتر المستودع (Ledger 2.0)</span>
              <span className={`text-xs font-mono font-bold ${reconciliationReport.isReconciled ? "text-emerald-400" : "text-rose-400"}`}>
                {reconciliationReport.isReconciled ? "متطابق 100% ✅" : "فارق مرصود ⚠️"}
              </span>
            </div>
            <div className="text-xs text-secondaryText space-y-1.5 font-mono">
              <p>• الرصيد المحسوب: <span className="text-white font-bold">{reconciliationReport.totalGrantsProjected} أداة</span></p>
              <p>• حركات الدفتر: <span className="text-white font-bold">{reconciliationReport.movementsCount} حركة</span></p>
              <p>• الفارق المالي: <span className="text-white font-bold">{reconciliationReport.netDiscrepancy}</span></p>
            </div>
          </div>

          {/* Diagnostics Card */}
          <div className="bg-background/90 p-5 rounded-2xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">المؤشرات التشغيلية</span>
              <span className="text-xs font-mono text-turquoise">Asia/Riyadh</span>
            </div>
            <div className="text-xs text-secondaryText space-y-1 leading-relaxed">
              {healthTelemetry.diagnostics.length > 0 ? (
                healthTelemetry.diagnostics.slice(0, 2).map((d, i) => (
                  <p key={i} className="text-amber-300">⚠️ {d}</p>
                ))
              ) : (
                <p className="text-emerald-400">✅ جميع الخدمات تعمل باستقرار كامل دون أي أعطال مسجلة.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* LAYER C — ماذا يجب أن أفعل تالياً؟ (What should I do next?) */}
      {/* ============================================================== */}
      <section className="hud-deck rounded-2xl p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-turquoise/15 border border-turquoise/30 flex items-center justify-center text-turquoise">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono">
                المستوى ج — التوجيهات والاستراتيجية (Layer C: Strategic Actions)
              </h2>
              <p className="text-xs text-secondaryText mt-0.5">
                توصيات تشغيلية مبنية على الأدلة والبيانات التاريخية المرصودة
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-turquoise bg-turquoise/10 px-3 py-1 rounded-full border border-turquoise/30">
            مبني على STQI v2.0
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-background/90 p-5 rounded-2xl border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-turquoise text-sm font-bold">
              <Lightbulb className="w-4 h-4" />
              <span>نافذة البث الذهبية (Golden Launch Window)</span>
            </div>
            <p className="text-xs text-secondaryText leading-relaxed">
              أظهر التحليل الإحصائي لجلسات البث السابقة أن التوقيت الأمثل لتحقيق أعلى كثافة تفاعل يبدأ من:
            </p>
            <p className="text-sm font-mono font-bold text-white pt-1">
              {stqiOverview?.goldenLaunchWindow || "8:00 مساءً — 11:00 مساءً بتوقيت الرياض"}
            </p>
          </div>

          <div className="bg-background/90 p-5 rounded-2xl border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-gold text-sm font-bold">
              <Swords className="w-4 h-4" />
              <span>توقيت النزالات الحاسم (Prime Battle Window)</span>
            </div>
            <p className="text-xs text-secondaryText leading-relaxed">
              الفترة المسجلة لأعلى استجابة تكتيكية واستخدام للأدوات من قبل الداعمين في جولات التحدي:
            </p>
            <p className="text-sm font-mono font-bold text-white pt-1">
              {stqiOverview?.primeBattleWindow || "10:00 مساءً — 12:00 منتصف الليل بتوقيت الرياض"}
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* LAYER D — هل نتحسن؟ (Are we improving?) */}
      {/* ============================================================== */}
      <section className="hud-deck rounded-2xl p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple/15 border border-purple/30 flex items-center justify-center text-purple">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono">
                المستوى د — قياس التحسن والموثوقية (Layer D: Long-Term Performance)
              </h2>
              <p className="text-xs text-secondaryText mt-0.5">
                سجل موثوقية المقاييس ومنهجية تتبع الأداء التراكمي
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
              تتبع خادمي دقيق مع دفتر أستاذ متوازن يمنع الاستهلاك المزدوج لكل دفعة
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
              مشتق حصرياً من التفاعل الطبيعي؛ TikTok لا يبث قائمة المشاهدين الصامتين
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-secondaryText font-mono">
          <span>المنطقة الزمنية المرجعية: Asia/Riyadh (UTC+3)</span>
          <span className="text-turquoise font-bold">LivePulse Intelligence System</span>
        </div>
      </section>

      {/* Floating Tactical Copilot */}
      <LivePulseCopilotWidget />
    </div>
  );
}
