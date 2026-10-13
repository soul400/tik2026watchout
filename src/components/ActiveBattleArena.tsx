"use client";

import React, { useEffect, useState } from "react";
import { Swords, Flame, Trophy, Shield, Activity, Clock, Users } from "lucide-react";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { BattleScoreResolver } from "@/lib/battle-score-resolver";

interface Participant {
  id: string;
  teamNumber: number;
  platformUserId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface BattleData {
  id: string;
  battleType: string;
  status: string;
  team1Score: number;
  team2Score: number;
  winningTeam: number | null;
  startedAt: string;
  participants: Participant[];
}

interface ActiveBattleArenaProps {
  initialBattle: BattleData | null;
  streamer: any;
  isLive: boolean;
}

export function ActiveBattleArena({ initialBattle, streamer, isLive }: ActiveBattleArenaProps) {
  const [battle, setBattle] = useState<BattleData | null>(initialBattle);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Real-time polling every 2.5s for live battle status
  useEffect(() => {
    let isMounted = true;

    const fetchLiveBattle = async () => {
      try {
        const res = await fetch("/api/battles/active");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setBattle(data.battle || null);
            setLastUpdated(new Date());
          }
        }
      } catch (e) {
        // quiet error
      }
    };

    const interval = setInterval(fetchLiveBattle, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Clean participants: exclude any duplicate mohra in opponent team
  const rawParticipants = battle?.participants || [];
  const hostUsernames = ["mohra.2000", "mohra"];

  // Deduplicate by platformUserId and ensure host never leaks into opponent team
  const seenUids = new Set<string>();
  const sanitized: Participant[] = [];

  for (const p of rawParticipants) {
    const isHostName = hostUsernames.includes(p.username.toLowerCase()) || 
      p.displayName.includes("المهره") || 
      p.displayName.includes("مهرة");

    if (p.teamNumber === 2 && isHostName) {
      continue;
    }

    if (!seenUids.has(p.platformUserId)) {
      seenUids.add(p.platformUserId);
      sanitized.push(p);
    }
  }

  const team1 = sanitized.filter((p) => p.teamNumber === 1);
  const team2 = sanitized.filter((p) => p.teamNumber === 2);

  const team1Score = Math.max(0, battle?.team1Score || 0);
  const team2Score = Math.max(0, battle?.team2Score || 0);
  const dominance = BattleScoreResolver.calculateDominance(team1Score, team2Score);

  const isBattleActive = battle && battle.status === "IN_PROGRESS";

  return (
    <div className="space-y-6">
      {/* 1. Header banner */}
      <div className="hud-deck p-6 md:p-8 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-purple/15 text-purple text-xs font-bold font-mono border border-purple/30 flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5" />
                LIVE BATTLE ARENA • ساحة الجولات المباشرة
              </span>
              <ConfidenceBadge state="VERIFIED" methodology="مزامنة فورية مباشرة مع جولات تيك توك بدون تأخير" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">غرفة النزالات والمنافسات</h2>
            <p className="text-sm text-secondaryText mt-1">
              شاشة موحدة تنبض تلقائياً ببيانات الجولة الحالية القائمة في بث تيك توك وتوزيع الدعم اللحظي
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isBattleActive ? (
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                جولة مشتعلة الآن (ROUND ACTIVE)
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono text-secondaryText bg-elevated/60 border border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                بانتظار انطلاق الجولة القادمة
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Unified Single Stage Screen */}
      {!battle ? (
        <div className="hud-deck rounded-3xl p-16 md:p-24 text-center relative overflow-hidden border border-white/10">
          <div className="absolute inset-0 bg-radial-gradient opacity-30 pointer-events-none" />
          <div className="max-w-md mx-auto space-y-4 relative z-10">
            <div className="w-20 h-20 rounded-3xl bg-purple/10 border border-purple/30 flex items-center justify-center mx-auto text-purple shadow-xl">
              <Swords className="w-10 h-10 animate-pulse" />
            </div>
            <h3 className="text-xl md:text-2xl font-black text-white">لا توجد جولة نشطة في البث حالياً</h3>
            <p className="text-sm text-secondaryText leading-relaxed">
              شاشة النزالات مجهزة ومستعدة. بمجرد أن يفتح الستريمر جولة تحدي (1v1 أو 2v2) في بث تيك توك، ستتحول هذه الشاشة فوراً لعرض نقاط الفريقين والمنافسين لحظة بلحظة.
            </p>
            <div className="pt-2">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono text-cyan bg-cyan/10 border border-cyan/20">
                <Activity className="w-3.5 h-3.5 animate-spin" />
                رادار النزالات نشط • يدعم 1v1 و 2v2
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="hud-deck rounded-3xl overflow-hidden p-6 md:p-10 border border-white/10 relative">
          {/* Top Stage Bar */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-white/5 text-secondaryText border border-white/10">
                ROUND ID: #{battle.id.slice(-8)}
              </span>
              <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-purple/20 text-purple border border-purple/30">
                {battle.battleType}
              </span>
            </div>

            <div className="text-xs font-mono text-secondaryText flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-secondaryText" />
              <span>مباشر من تيك توك • مزامنة: {lastUpdated.toLocaleTimeString("ar-SA")}</span>
            </div>
          </div>

          {/* Versus Split Battlefield */}
          <div className="grid grid-cols-1 lg:grid-cols-11 gap-6 items-center">
            {/* Team 1 (Host / Mohra) */}
            <div className="lg:col-span-5 bg-gradient-to-br from-blue/10 via-background/90 to-background/90 p-6 md:p-8 rounded-3xl border border-blue/40 shadow-2xl relative overflow-hidden text-center">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue/10 rounded-full blur-3xl pointer-events-none" />
              <span className="px-3 py-1 rounded-full text-xs font-mono font-black text-blue bg-blue/20 border border-blue/30 inline-block mb-4">
                الفريق الأول (المستضيف) 🛡️
              </span>

              <div className="flex justify-center items-center gap-4 my-2">
                {team1.map((p) => (
                  <div key={p.id} className="text-center group">
                    <div className="w-20 h-20 rounded-2xl border-2 border-blue bg-blue/15 flex items-center justify-center font-black text-blue mx-auto mb-2 text-2xl shadow-xl overflow-hidden relative">
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span>{p.displayName.charAt(0)}</span>
                      )}
                    </div>
                    <p className="text-base font-black text-white truncate max-w-[150px]">{p.displayName}</p>
                    <p className="text-xs text-secondaryText font-mono">@{p.username}</p>
                  </div>
                ))}
              </div>

              {/* Team 1 Score */}
              <div className="mt-6 pt-4 border-t border-white/5">
                <span className="text-xs font-mono text-secondaryText tracking-widest block mb-1">نقاط الدعم الحالية</span>
                <div className="text-5xl md:text-6xl font-black text-blue digi-number tracking-tight">
                  {team1Score.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Middle VS Orb */}
            <div className="lg:col-span-1 text-center py-4 lg:py-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-elevated to-surface border border-gold/40 flex items-center justify-center mx-auto text-gold font-black text-lg shadow-2xl">
                VS
              </div>
              <span className="text-[10px] font-mono text-secondaryText block mt-2">ROUND CLASH</span>
            </div>

            {/* Team 2 (Opponent) */}
            <div className="lg:col-span-5 bg-gradient-to-br from-rose-500/10 via-background/90 to-background/90 p-6 md:p-8 rounded-3xl border border-rose-500/40 shadow-2xl relative overflow-hidden text-center">
              <div className="absolute top-0 left-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
              <span className="px-3 py-1 rounded-full text-xs font-mono font-black text-rose-400 bg-rose-500/20 border border-rose-500/30 inline-block mb-4">
                الفريق الثاني (المنافس) ⚔️
              </span>

              <div className="flex justify-center items-center gap-4 my-2">
                {team2.map((p) => (
                  <div key={p.id} className="text-center group">
                    <div className="w-20 h-20 rounded-2xl border-2 border-rose-500 bg-rose-500/15 flex items-center justify-center font-black text-rose-400 mx-auto mb-2 text-2xl shadow-xl overflow-hidden relative">
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span>{p.displayName.charAt(0)}</span>
                      )}
                    </div>
                    <p className="text-base font-black text-white truncate max-w-[150px]">{p.displayName}</p>
                    <p className="text-xs text-secondaryText font-mono">@{p.username}</p>
                  </div>
                ))}
              </div>

              {/* Team 2 Score */}
              <div className="mt-6 pt-4 border-t border-white/5">
                <span className="text-xs font-mono text-secondaryText tracking-widest block mb-1">نقاط الدعم الحالية</span>
                <div className="text-5xl md:text-6xl font-black text-rose-400 digi-number tracking-tight">
                  {team2Score.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Tug of War Dynamic Progress Bar */}
          <div className="mt-8 pt-6 border-t border-white/5 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-blue font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue inline-block" />
                {dominance.isZero ? "0%" : `${dominance.team1Percent}%`}
              </span>
              <span className="text-secondaryText font-bold px-3 py-0.5 rounded-full bg-white/5 border border-white/10">
                {dominance.label}
              </span>
              <span className="text-rose-400 font-bold flex items-center gap-1.5">
                {dominance.isZero ? "0%" : `${dominance.team2Percent}%`}
                <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-elevated overflow-hidden flex border border-white/10">
              {dominance.isZero ? (
                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                  <div className="w-1/2 h-full border-r border-white/20" />
                </div>
              ) : (
                <>
                  <div
                    className="bg-gradient-to-r from-blue to-cyan transition-all duration-700 ease-out"
                    style={{ width: `${dominance.team1Percent}%` }}
                  />
                  <div
                    className="bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-700 ease-out"
                    style={{ width: `${dominance.team2Percent}%` }}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
