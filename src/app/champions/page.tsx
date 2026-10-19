import { prisma } from "@/lib/prisma";
import { ChampionsEngine } from "@/lib/champions-engine";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import {
  Trophy,
  Ban,
  Clock,
  MessageSquare,
  Heart,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { StreamerHudHeader } from "@/components/StreamerHudHeader";
import { ChampionsClient } from "./ChampionsClient";

export const dynamic = "force-dynamic";

export default async function ChampionsPage() {
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

  const presetPeriods = ChampionsEngine.getPresetPeriods();
  const initialPeriod = presetPeriods.weekly[0];

  const [champions, overview] = await Promise.all([
    ChampionsEngine.computePeriodChampions({
      tenantId,
      periodType: "WEEKLY",
      startDate: new Date(initialPeriod.startDate),
      endDate: new Date(initialPeriod.endDate),
      limit: 50,
    }),
    ChampionsEngine.getChampionsOverview({
      tenantId,
      startDate: new Date(initialPeriod.startDate),
      endDate: new Date(initialPeriod.endDate),
    }),
  ]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* 1. TOP STREAMER HUD HEADER */}
      <StreamerHudHeader streamer={streamer} isLive={isCurrentlyLive} />

      {/* 2. High-Tech Banner with Strict Zero Gift Policy Notice */}
      <div className="cyber-card p-6 md:p-8 rounded-2xl relative overflow-hidden border border-gold/30">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gold/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-gold/15 text-gold text-xs font-bold border border-gold/30 flex items-center gap-1.5 shadow-sm shadow-gold/10">
                <Trophy className="w-3.5 h-3.5" />
                نظام تكريم أوفياء المجتمع (Community Champions)
              </span>
              <ConfidenceBadge
                state="VERIFIED"
                methodology="معادلة تفاعلية حصرية؛ تم حظر إدراج الدعم المالي أو الهدايا بنسبة 0% نهائياً"
              />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">
              أبطال المجتمع والأوفياء في البث
            </h2>
            <p className="text-sm text-secondaryText max-w-3xl leading-relaxed">
              تكريم حقيقي وعادل لمتابعي البث الأوفياء بناءً على تفاعلهم العضوي (الحضور، التعليقات، التكبيس، والمشاركات).
              النقاط <strong className="text-gold font-bold">لا تشمل الدعم المالي أو الهدايا إطلاقاً</strong> لحفظ حق المتابعين المستمرين.
            </p>
          </div>

          {/* Exclusion Guarantee Badge */}
          <div className="bg-background/90 p-4 rounded-xl border border-white/10 shrink-0 flex items-center gap-3 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-secondaryText block">قاعدة العدالة المجتمعية:</span>
              <span className="text-xs font-bold text-white block">نقاط الهدايا = 0% مستبعدة تماماً</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Engagement Dimensions Metrics Formula */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="cyber-card p-4 rounded-xl text-center border-t-2 border-t-turquoise">
          <Clock className="w-4 h-4 mx-auto text-turquoise mb-1.5" />
          <span className="text-[11px] text-secondaryText block font-medium">الحضور المرصود</span>
          <span className="text-lg font-bold text-white font-mono">35%</span>
        </div>
        <div className="cyber-card p-4 rounded-xl text-center border-t-2 border-t-blue-400">
          <MessageSquare className="w-4 h-4 mx-auto text-blue-400 mb-1.5" />
          <span className="text-[11px] text-secondaryText block font-medium">التعليقات والمحادثة</span>
          <span className="text-lg font-bold text-white font-mono">25%</span>
        </div>
        <div className="cyber-card p-4 rounded-xl text-center border-t-2 border-t-purple">
          <Heart className="w-4 h-4 mx-auto text-purple mb-1.5" />
          <span className="text-[11px] text-secondaryText block font-medium">التكبيس والإعجابات</span>
          <span className="text-lg font-bold text-white font-mono">15%</span>
        </div>
        <div className="cyber-card p-4 rounded-xl text-center border-t-2 border-t-emerald-400">
          <Sparkles className="w-4 h-4 mx-auto text-emerald-400 mb-1.5" />
          <span className="text-[11px] text-secondaryText block font-medium">مشاركات البث</span>
          <span className="text-lg font-bold text-white font-mono">15%</span>
        </div>
        <div className="cyber-card p-4 rounded-xl text-center border-t-2 border-t-gold">
          <UserCheck className="w-4 h-4 mx-auto text-gold mb-1.5" />
          <span className="text-[11px] text-secondaryText block font-medium">تفاعل الأعضاء والمنشن</span>
          <span className="text-lg font-bold text-white font-mono">10%</span>
        </div>
      </div>

      {/* 4. Champions Interactive Client (Dashboard, Podium, AI Analysis, Recommendations & Leaderboard) */}
      <ChampionsClient
        initialChampions={champions}
        initialOverview={overview}
        initialPeriod={initialPeriod}
        presetPeriods={presetPeriods}
      />
    </div>
  );
}
