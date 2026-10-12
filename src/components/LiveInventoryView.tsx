"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Sparkles, ShieldAlert, Layers, ArrowDownToLine, Clock, CheckCircle2 } from "lucide-react";
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
              تتبع دقيق وشامل لأدوات الـ Power-Up الستة الرسمية في تيك توك لايف (القفاز x5، الضباب المعزز، ممدد الوقت، معزز السرعة، مطرقة التعطيل، ودرع الصمود)
              المرصودة تلقائياً فور منحها في البث المباشر.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-background/90 p-4 px-5 rounded-2xl border border-turquoise/30 shrink-0 shadow-lg">
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
        </div>
      </div>

      {/* 6 Official Power-Up Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {counters.map((tool) => {
          const imgPath = getToolImagePath(tool.toolKey);

          return (
            <div
              key={tool.toolKey}
              className="hud-deck rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:border-turquoise/50 hover:shadow-xl hover:shadow-turquoise/10 flex flex-col justify-between"
              style={{ borderTop: `4px solid ${tool.colorHex}` }}
            >
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-surface/80 border border-white/10 flex items-center justify-center p-2.5 shadow-inner">
                    <Image
                      src={imgPath}
                      alt={tool.toolName}
                      width={52}
                      height={52}
                      className="object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                    />
                  </div>
                  <div className="text-left">
                    <span className="text-[11px] font-mono text-secondaryText block uppercase tracking-wider">
                      الرصيد الحالي
                    </span>
                    <span className="text-3xl font-black digi-number" style={{ color: tool.colorHex }}>
                      {tool.totalAvailable}
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white mb-1">{tool.toolName}</h3>
                <p className="text-xs font-mono text-secondaryText mb-6">
                  {tool.toolKey} • 120H SERVER TTL
                </p>
              </div>

              <div className="pt-4 border-t border-white/5 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div className="bg-background/50 p-2 rounded-xl">
                  <span className="text-secondaryText block text-[10px]">مستلم</span>
                  <span className="font-bold text-white text-sm">{tool.totalReceived}</span>
                </div>
                <div className="bg-background/50 p-2 rounded-xl">
                  <span className="text-secondaryText block text-[10px]">مستهلك</span>
                  <span className="font-bold text-secondaryText text-sm">{tool.totalConsumed}</span>
                </div>
                <div className="bg-background/50 p-2 rounded-xl">
                  <span className="text-secondaryText block text-[10px]">منتهي</span>
                  <span className="font-bold text-rose-400 text-sm">{tool.totalExpired}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grants Activity Ledger */}
      <div className="hud-deck rounded-2xl p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-turquoise" />
              سجل الأدوات التكتيكية المرصودة في البث
            </h3>
            <p className="text-xs text-secondaryText mt-1">
              تسجيل لحظي وتلقائي للأدوات الممنوحة للداعمين مع مهلة انتهاء الـ 120 ساعة
            </p>
          </div>
          <span className="text-xs font-mono text-turquoise px-3 py-1 rounded-full bg-turquoise/10 border border-turquoise/30 self-start sm:self-auto">
            TOTAL RECORDS: {grants.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          {grants.length === 0 ? (
            <div className="py-12 text-center text-secondaryText">
              <p className="text-base font-bold text-white">لا توجد أدوات ممنوحة مسجلة بعد</p>
              <p className="text-xs font-mono mt-1 text-secondaryText">
                سيتم رصد الأدوات الممنوحة تلقائياً فور نزولها أو إهدائها في جولات التحدي الحية
              </p>
            </div>
          ) : (
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b border-white/10 text-xs text-secondaryText uppercase font-mono">
                  <th className="pb-3 pr-2">الداعم المستفيد</th>
                  <th className="pb-3">الأداة التكتيكية</th>
                  <th className="pb-3 text-center">الكمية</th>
                  <th className="pb-3 text-center">تاريخ الاستلام</th>
                  <th className="pb-3 text-center">انتهاء الصلاحية (120H)</th>
                  <th className="pb-3 text-center">الحالة الحالية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {grants.map((grant) => (
                  <tr key={grant.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 pr-2 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-surface border border-white/10 flex items-center justify-center font-bold text-turquoise text-sm overflow-hidden">
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
                          className="w-2.5 h-2.5 rounded-full"
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
                    <td className="py-4 text-center font-mono font-bold text-turquoise text-base">
                      +{grant.quantityGranted}
                    </td>
                    <td className="py-4 text-center font-mono text-xs text-secondaryText">
                      {new Date(grant.receivedAt).toLocaleTimeString("ar-SA", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="py-4 text-center font-mono text-xs text-gold">
                      {new Date(grant.expiresAt).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="py-4 text-center">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-turquoise/10 text-turquoise border border-turquoise/20">
                        {grant.status === "AVAILABLE" ? "نشط ومتاح ⚡" : grant.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
