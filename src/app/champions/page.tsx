import { prisma } from "@/lib/prisma";
import { ChampionsEngine } from "@/lib/champions-engine";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { DigitalCounter } from "@/components/DigitalCounter";
import {
  Trophy,
  Award,
  Flame,
  MessageSquare,
  Heart,
  Clock,
  Sparkles,
  ShieldCheck,
  Ban,
  UserCheck,
} from "lucide-react";

import { StreamerHudHeader } from "@/components/StreamerHudHeader";

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

  const now = new Date();
  const pastSevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const champions = await ChampionsEngine.computePeriodChampions({
    tenantId,
    periodType: "WEEKLY",
    startDate: pastSevenDays,
    endDate: now,
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* 1. TOP STREAMER HUD HEADER */}
      <StreamerHudHeader streamer={streamer} isLive={isCurrentlyLive} />

      {/* High-Tech Banner with Strict Zero Gift Policy Notice */}
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

      {/* Engagement Dimensions Metrics Formula */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="cyber-card p-4 rounded-xl text-center border-t-2 border-t-turquoise">
          <Clock className="w-4 h-4 mx-auto text-turquoise mb-1.5" />
          <span className="text-[11px] text-secondaryText block font-medium">الحضور المرصود</span>
          <span className="text-lg font-bold text-white font-mono">35%</span>
        </div>
        <div className="cyber-card p-4 rounded-xl text-center border-t-2 border-t-blue">
          <MessageSquare className="w-4 h-4 mx-auto text-blue mb-1.5" />
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

      {/* Champions Cards Showcase */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-gold" />
          لوحة صدارة أبطال الأسبوع (Community Leaderboard)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {champions.map((champ) => (
            <div
              key={champ.supporter.id}
              className="cyber-card rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between"
              style={{
                borderTop: champ.rank === 1 ? "3px solid #F5B942" : champ.rank === 2 ? "3px solid #E2E8F0" : "3px solid #CD7F32",
              }}
            >
              <div>
                {/* Header Rank */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shadow-md ${
                        champ.rank === 1
                          ? "bg-gold text-background shadow-gold/20"
                          : champ.rank === 2
                          ? "bg-slate-200 text-background"
                          : "bg-amber-800 text-white"
                      }`}
                    >
                      #{champ.rank}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {champ.rank === 1 ? "بطل المجتمع الأول 👑" : `المرتبة ${champ.rank}`}
                    </span>
                  </div>
                  <DigitalCounter value={champ.finalScore} size="lg" color="text-gold" suffix="نقطة" />
                </div>

                {/* Profile Pod */}
                <div className="flex items-center gap-3.5 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-elevated border border-gold/30 flex items-center justify-center font-bold text-gold text-lg shadow-inner">
                    {champ.supporter.displayName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base leading-snug">{champ.supporter.displayName}</h4>
                    <p className="text-xs text-secondaryText font-mono">@{champ.supporter.username}</p>
                  </div>
                </div>

                {/* Reason Pod */}
                <div className="bg-background/90 p-3.5 rounded-xl border border-white/5 mb-5 text-xs text-secondaryText leading-relaxed">
                  <span className="text-white font-bold block mb-1">سبب الاستحقاق والتكريم:</span>
                  {champ.qualificationReason}
                </div>
              </div>

              {/* Engagement Dimensions Progress */}
              <div className="space-y-2.5 pt-4 border-t border-white/5 text-xs">
                <div className="flex justify-between items-center text-secondaryText">
                  <span>الحضور والوفاء للبث:</span>
                  <span className="text-white font-mono font-bold">{champ.presenceScore}%</span>
                </div>
                <div className="flex justify-between items-center text-secondaryText">
                  <span>المحادثة والتعليقات:</span>
                  <span className="text-white font-mono font-bold">{champ.chatScore}%</span>
                </div>
                <div className="flex justify-between items-center text-secondaryText">
                  <span>التكبيس ودعم التفاعل:</span>
                  <span className="text-white font-mono font-bold">{champ.likeScore}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
