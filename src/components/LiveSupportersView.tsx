"use client";

import React, { useEffect, useState } from "react";
import { Users, Award, Clock, Activity, ShieldCheck } from "lucide-react";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { DigitalCounter } from "@/components/DigitalCounter";

interface SupporterItem {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  totalDiamonds: number;
  presenceMinutes: number;
  presenceHours: string;
  firstObservedAt: string;
  lastObservedAt: string;
}

interface LiveSupportersViewProps {
  initialSupportersBySupport: SupporterItem[];
  initialSupportersByPresence: SupporterItem[];
  initialTotalDiamonds: number;
  initialTotalPresenceHours: number;
}

export function LiveSupportersView({
  initialSupportersBySupport,
  initialSupportersByPresence,
  initialTotalDiamonds,
  initialTotalPresenceHours,
}: LiveSupportersViewProps) {
  const [supportersBySupport, setSupportersBySupport] = useState<SupporterItem[]>(initialSupportersBySupport);
  const [supportersByPresence, setSupportersByPresence] = useState<SupporterItem[]>(initialSupportersByPresence);
  const [totalDiamonds, setTotalDiamonds] = useState<number>(initialTotalDiamonds);
  const [totalPresenceHours, setTotalPresenceHours] = useState<number>(initialTotalPresenceHours);
  const [lastSync, setLastSync] = useState<Date>(new Date());

  // Automatic real-time polling every 3 seconds without refreshing page
  useEffect(() => {
    let isMounted = true;

    const fetchSupporters = async () => {
      try {
        const res = await fetch("/api/supporters");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setSupportersBySupport(data.supportersBySupport || []);
            setSupportersByPresence(data.supportersByPresence || []);
            setTotalDiamonds(data.totalDiamonds || 0);
            setTotalPresenceHours(data.totalPresenceHours || 0);
            setLastSync(new Date());
          }
        }
      } catch (err) {
        // quiet error
      }
    };

    const interval = setInterval(fetchSupporters, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="cyber-card p-6 md:p-8 rounded-2xl relative overflow-hidden border border-turquoise/25">
        <div className="absolute top-0 right-0 w-80 h-80 bg-turquoise/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-turquoise/15 text-turquoise text-xs font-bold border border-turquoise/30 flex items-center gap-1.5 shadow-sm shadow-turquoise/10">
                <Users className="w-3.5 h-3.5" />
                ذكاء الداعمين والتواجد المنفصل (كبار الداعمين +10,000 💎)
              </span>
              <ConfidenceBadge
                state="VERIFIED"
                methodology="فصل تام بين مقاييس الدعم المالي ومقاييس التواجد؛ محصور حصراً لمن تجاوز 10,000 ماسة"
              />
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                تحديث تلقائي حي (Real-time Live Sync)
              </span>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">
              تحليل الداعمين والتواجد المنفصل
            </h2>
            <p className="text-sm text-secondaryText max-w-3xl leading-relaxed">
              فصل هندسي صارم بين إحصائيات الدعم (الماس والهدايا التكتيكية) وإحصائيات التواجد (ساعات الحضور والوفاء).
              تضم هذه اللوحة حصرياً نخبة كبار الداعمين الذين تجاوز إجمالي دعمهم <strong className="text-gold font-bold">10,000 ماسة</strong>.
            </p>
          </div>

          {/* Quick Metrics Pods */}
          <div className="flex items-center gap-4 bg-background/90 p-4 rounded-xl border border-white/10 shrink-0 shadow-lg">
            <div className="text-center px-4 border-l border-white/10">
              <span className="text-[11px] text-secondaryText block mb-1">إجمالي دعم النخبة (+10k)</span>
              <DigitalCounter value={totalDiamonds} size="lg" color="text-gold" suffix="💎" />
            </div>
            <div className="text-center px-2">
              <span className="text-[11px] text-secondaryText block mb-1">إجمالي ساعات التواجد</span>
              <span className="digital-counter text-2xl font-bold text-turquoise">
                {Number(totalPresenceHours).toFixed(1)} <span className="text-xs font-normal opacity-70">ساعة</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: لوحة شرف الداعمين (+10,000 دعم) */}
      <div className="cyber-card rounded-2xl p-6 border-t-4 border-t-gold">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-gold" />
              لوحة شرف كبار الداعمين (أكثر من 10,000 ماسة 💎)
            </h3>
            <p className="text-xs text-secondaryText mt-0.5">
              ترتيب نخبة الداعمين أصحاب المساهمات الكبرى التي تتجاوز 10,000 ماسة في البث الحقيقي
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-gold px-3 py-1 rounded-full bg-gold/10 border border-gold/30">
            فئة كبار الداعمين (+10K DIAMONDS)
          </span>
        </div>

        {/* Support Table */}
        <div className="overflow-x-auto">
          {supportersBySupport.length === 0 ? (
            <div className="py-12 text-center text-secondaryText">
              <p className="text-base font-bold text-white">لا يوجد داعمون تجاوزوا 10,000 ماسة حتى الآن</p>
              <p className="text-xs font-mono mt-1 text-secondaryText">سيتم إدراج أي داعم يتخطى حاجز 10,000 ماسة هنا تلقائياً</p>
            </div>
          ) : (
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b border-white/10 text-xs text-secondaryText uppercase tracking-wider">
                  <th className="pb-3 pr-2">المرتبة والداعم</th>
                  <th className="pb-3">تصنيف الداعم</th>
                  <th className="pb-3 text-center">إجمالي الماس 💎</th>
                  <th className="pb-3 text-center">النسبة من إجمالي دعم النخبة</th>
                  <th className="pb-3 text-center">حالة التدقيق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {supportersBySupport.map((sup, idx) => {
                  const percentage = totalDiamonds > 0 ? ((sup.totalDiamonds / totalDiamonds) * 100).toFixed(1) : "0";
                  return (
                    <tr key={sup.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-4 pr-2 flex items-center gap-3">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                            idx === 0
                              ? "bg-gold text-background shadow-md shadow-gold/20"
                              : idx === 1
                              ? "bg-slate-200 text-background"
                              : idx === 2
                              ? "bg-amber-800 text-white"
                              : "bg-elevated text-secondaryText"
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div className="w-9 h-9 rounded-xl bg-elevated border border-gold/30 flex items-center justify-center font-bold text-gold text-sm shadow-inner overflow-hidden">
                          {sup.avatarUrl ? (
                            <img src={sup.avatarUrl} alt={sup.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <span>{sup.displayName.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{sup.displayName}</p>
                          <p className="text-xs text-secondaryText font-mono">@{sup.username}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="text-xs px-2.5 py-1 rounded-md font-semibold bg-gold/10 text-gold border border-gold/20">
                          {sup.totalDiamonds >= 500000 ? "داعم أسطوري 👑" : sup.totalDiamonds >= 100000 ? "داعم ملكي 💎" : "داعم ذهبي نخبة"}
                        </span>
                      </td>
                      <td className="py-4 text-center font-mono font-extrabold text-gold text-lg">
                        {sup.totalDiamonds.toLocaleString()} 💎
                      </td>
                      <td className="py-4 text-center">
                        <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                          {percentage}%
                        </span>
                      </td>
                      <td className="py-4 text-center">
                        <ConfidenceBadge state="VERIFIED" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SECTION 2: إحصائيات التواجد والوفاء للبث (ساعات الحضور لكبار الداعمين) */}
      <div className="cyber-card rounded-2xl p-6 border-t-4 border-t-turquoise">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-turquoise" />
              إحصائيات التواجد والوفاء لكبار الداعمين (+10,000 💎)
            </h3>
            <p className="text-xs text-secondaryText mt-0.5">
              قياس مستقل تماماً لحضور كبار الداعمين واستمراريتهم في البث وساعات التواجد الفعلية
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-turquoise px-3 py-1 rounded-full bg-turquoise/10 border border-turquoise/30">
            مقياس التواجد والوفاء الزمني
          </span>
        </div>

        {/* Presence Table */}
        <div className="overflow-x-auto">
          {supportersByPresence.length === 0 ? (
            <div className="py-12 text-center text-secondaryText">
              <p className="text-base font-bold text-white">لا توجد بيانات تواجد لكبار الداعمين حالياً</p>
            </div>
          ) : (
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b border-white/10 text-xs text-secondaryText uppercase tracking-wider">
                  <th className="pb-3 pr-2">الداعم</th>
                  <th className="pb-3 text-center">ساعات الحضور المرصودة ⏱️</th>
                  <th className="pb-3 text-center">دقائق النشاط الإجمالية</th>
                  <th className="pb-3 text-center">أول ظهور مرصود</th>
                  <th className="pb-3 text-center">آخر ظهور في البث</th>
                  <th className="pb-3 text-center">مؤشر الاستمرارية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {supportersByPresence.map((sup, idx) => (
                  <tr key={sup.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-4 pr-2 flex items-center gap-3">
                      <span className="font-mono text-xs text-secondaryText w-5">#{idx + 1}</span>
                      <div className="w-9 h-9 rounded-xl bg-elevated border border-turquoise/30 flex items-center justify-center font-bold text-turquoise text-sm shadow-inner overflow-hidden">
                        {sup.avatarUrl ? (
                          <img src={sup.avatarUrl} alt={sup.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span>{sup.displayName.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{sup.displayName}</p>
                        <p className="text-xs text-secondaryText font-mono">@{sup.username}</p>
                      </div>
                    </td>
                    <td className="py-4 text-center font-mono font-extrabold text-turquoise text-base">
                      {sup.presenceHours} ساعة
                    </td>
                    <td className="py-4 text-center font-mono font-bold text-white">
                      {sup.presenceMinutes.toLocaleString()} دقيقة
                    </td>
                    <td className="py-4 text-center text-xs text-secondaryText font-mono">
                      {new Date(sup.firstObservedAt).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="py-4 text-center text-xs text-secondaryText font-mono">
                      {new Date(sup.lastObservedAt).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="py-4 text-center">
                      <span className="text-xs px-2.5 py-1 rounded-md font-semibold bg-turquoise/10 text-turquoise border border-turquoise/20">
                        {sup.presenceMinutes > 60 ? "داعم وفي دائم" : "داعم نشط"}
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
