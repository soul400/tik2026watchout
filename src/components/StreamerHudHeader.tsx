"use client";

import React from "react";
import Image from "next/image";
import { Activity, Radio, Signal, Wifi, WifiOff } from "lucide-react";

interface StreamerHudHeaderProps {
  streamer: {
    displayName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
    platformUserId?: string | null;
  } | null | undefined;
  isLive: boolean;
  activeSessionId?: string | null;
}

export function StreamerHudHeader({ streamer, isLive, activeSessionId }: StreamerHudHeaderProps) {
  const displayName = streamer?.displayName || "مهـرة 🇸🇦";
  const username = streamer?.username || "mohra.2000";
  const avatarUrl = streamer?.avatarUrl || "/mohra-avatar.webp";
  const platformUserId = streamer?.platformUserId || "7108920192847291001";

  return (
    <div className="hud-deck p-6 md:p-8 relative overflow-hidden">
      {/* Ambient Top Glow Bar */}
      <div
        className={`absolute top-0 right-1/4 w-1/2 h-1 bg-gradient-to-r from-transparent ${
          isLive ? "via-emerald-400" : "via-amber-400"
        } to-transparent opacity-80`}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        {/* Streamer Identity Profile */}
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            {/* Profile Image with Neon Ring & Cyber Glow */}
            <div
              className={`w-20 h-20 rounded-2xl bg-gradient-to-br p-1 border-2 shadow-2xl transition-all duration-300 ${
                isLive
                  ? "from-emerald-400/40 via-elevated to-turquoise/40 border-emerald-400 shadow-emerald-500/20"
                  : "from-amber-400/30 via-elevated to-surface border-amber-500/40 shadow-amber-500/10"
              }`}
            >
              <div className="w-full h-full rounded-xl bg-elevated overflow-hidden relative flex items-center justify-center font-black text-2xl text-turquoise shadow-inner">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  displayName.charAt(0)
                )}
              </div>
            </div>

            {/* Real-time Status Pulse Dot */}
            <span className="absolute -bottom-1 -left-1 flex h-4 w-4">
              {isLive ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-background" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-background" />
              )}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">{displayName}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-turquoise/15 text-turquoise border border-turquoise/35 shadow-sm">
                VERIFIED STREAMER
              </span>
            </div>
            <p className="text-sm font-mono text-secondaryText">@{username}</p>
            <div className="flex items-center gap-3 pt-1 text-xs text-secondaryText font-mono">
              <span className="text-turquoise font-bold">ID: {platformUserId}</span>
              <span>•</span>
              <span>TikTok Webcast Protocol 2.5</span>
            </div>
          </div>
        </div>

        {/* Corresponding Connection Status Pod */}
        <div
          className={`flex items-center gap-4 p-4 px-5 rounded-2xl border shadow-xl shrink-0 transition-all duration-300 ${
            isLive
              ? "bg-emerald-950/20 border-emerald-500/40 shadow-emerald-500/10"
              : "bg-amber-950/15 border-amber-500/30 shadow-amber-500/5"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-xl border flex items-center justify-center shadow-inner ${
              isLive
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                : "bg-amber-500/15 border-amber-500/30 text-amber-400"
            }`}
          >
            {isLive ? <Radio className="w-6 h-6 animate-pulse" /> : <WifiOff className="w-6 h-6" />}
          </div>

          <div>
            <span className="text-[11px] text-secondaryText font-mono block">حالة الاتصال بالبث المباشر</span>
            <span
              className={`text-sm font-bold flex items-center gap-2 mt-0.5 ${
                isLive ? "text-emerald-400" : "text-amber-300"
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isLive ? "bg-emerald-400 animate-ping" : "bg-amber-400"
                }`}
              />
              {isLive ? "متصل بروم البث المباشر (LIVE)" : "البث غير متصل حالياً (OFFLINE)"}
            </span>
          </div>

          <div className="h-8 w-[1px] bg-white/10 mx-1 hidden sm:block" />

          <div className="hidden sm:flex flex-col text-[11px] font-mono text-secondaryText">
            <span>{isLive ? "LATENCY: 18ms" : "MONITOR: ACTIVE"}</span>
            <span className={isLive ? "text-emerald-400 font-bold" : "text-amber-400/90 font-bold"}>
              {isLive ? "SOCKET ACTIVE" : "STANDBY (بانتظار البث)"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
