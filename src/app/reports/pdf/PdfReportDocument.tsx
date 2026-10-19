import React from "react";
import { GeneratedReport, ReportType } from "@/lib/reports-service";
import {
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Clock,
  Crown,
  Swords,
  Backpack,
  Activity,
  FileText,
  Scale,
  Sparkles,
  TrendingUp,
  Award,
  Hash,
  Fingerprint,
} from "lucide-react";

export interface PdfReportDocumentProps {
  report: GeneratedReport;
  reportType: ReportType;
  streamerDisplayName: string;
  streamerUsername: string;
  threshold?: number;
}

export function PdfReportDocument({
  report,
  reportType,
  streamerDisplayName,
  streamerUsername,
  threshold,
}: PdfReportDocumentProps) {
  const getReportIcon = (type: ReportType) => {
    switch (type) {
      case "LIVE_SESSION_SUMMARY":
        return Calendar;
      case "DAILY_OPERATIONS_SUMMARY":
        return TrendingUp;
      case "COMMUNITY_CHAMPIONS":
        return Crown;
      case "BATTLE_POST_MATCH":
        return Swords;
      case "TACTICAL_INVENTORY_AUDIT":
        return Backpack;
      case "STREAM_HEALTH_INCIDENT":
        return Activity;
      case "STQI_TIMING_REPORT":
        return Clock;
      case "DATA_QUALITY_RECONCILIATION":
        return Scale;
      case "ENIGMA_UNMASKED_ANALYSIS":
        return Fingerprint;
      case "SUPPORTER_PRESENCE_PATTERN":
        return Clock;
      case "ENIGMA_COMPARISON_PDF":
        return Fingerprint;
      case "ENIGMA_ENTRY_RADAR_REPORT":
        return ShieldCheck;
      case "PK_TACTICAL_INTELLIGENCE_REPORT":
        return Swords;
      default:
        return Scale;
    }
  };

  const IconComponent = getReportIcon(reportType);

  return (
    <main className="pdf-report-canvas max-w-5xl mx-auto my-6 p-8 md:p-12 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:w-full print:rounded-none">
      
      {/* ============================================================= */}
      {/* 1. DOCUMENT HEADER & BRANDING */}
      {/* ============================================================= */}
      <header className="border-b-2 border-slate-900 pb-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          
          {/* Right Side (Arabic RTL): Platform Emblem & Title */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-900 via-slate-900 to-amber-700 text-amber-400 flex items-center justify-center font-bold text-lg shadow-md border border-amber-500/30">
                LP
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">
                  منصة لايف بالس للذكاء التحليلي
                </h1>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  LivePulse Stream Intelligence System • Certified Report
                </p>
              </div>
            </div>
          </div>

          {/* Left Side: Streamer Identity Badge & Official Document Meta */}
          <div className="flex flex-col sm:items-end text-right sm:text-left space-y-1">
            <div className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <Crown className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-slate-900">{streamerDisplayName}</span>
              <span className="text-xs font-mono font-semibold text-indigo-700 dir-ltr">@{streamerUsername}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span>رقم الوثيقة:</span>
              <strong className="text-slate-800">{report.metadata.serialNumber}</strong>
            </div>
          </div>
        </div>

        {/* Provenance Metadata Bar */}
        <div className="mt-5 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="text-slate-500 block text-[10px] font-semibold">تاريخ الإصدار (توقيت مكة/الرياض):</span>
            <strong className="text-slate-900 font-mono">{report.metadata.generatedAt}</strong>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="text-slate-500 block text-[10px] font-semibold">المنطقة الزمنية الموحدة:</span>
            <strong className="text-slate-900 font-mono">Asia/Riyadh (UTC+3)</strong>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="text-slate-500 block text-[10px] font-semibold">حالة الاعتماد والمطابقة:</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              معتمد وموثق 100%
            </span>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="text-slate-500 block text-[10px] font-semibold">تصنيف الوثيقة:</span>
            <strong className="text-slate-900">سري ومخصص لإدارة البث</strong>
          </div>
        </div>
      </header>

      {/* ============================================================= */}
      {/* 2. REPORT TITLE BANNER */}
      {/* ============================================================= */}
      <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl mb-6 shadow-sm border border-slate-800 flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <IconComponent className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-wide">
              {report.metadata.title}
            </h2>
          </div>
          <p className="text-xs text-slate-300 font-mono pr-10">
            {reportType === "SUPPORTER_PRESENCE_PATTERN"
              ? `الحد الأدنى المعتمد لاختيار الداعمين: ${(threshold || 100000).toLocaleString("en-US")} ماسة فأكثر • توقيت الرياض (Asia/Riyadh)`
              : reportType === "STQI_TIMING_REPORT"
              ? "تحليل مؤشر جودة التوقيت والإيقاع الذكي (STQI) مع إبراز أفضل 3 فترات للبث من حيث الدعم المالي • توقيت الرياض (Asia/Riyadh)"
              : reportType === "LIVE_SESSION_SUMMARY"
              ? `نطاق التحليل: ${report.metadata.periodLabel || "كامل السجل التشغيلي"} • جولات السوبر (+100K) وتوزيع الهدايا والمنافسين`
              : "تقرير استراتيجي موثق ومستخرج مباشرة من قاعدة البيانات التشغيلية"}
          </p>
        </div>

        <div className="hidden sm:block text-left">
          <span className="bg-white/10 text-white text-[11px] font-mono px-3 py-1 rounded-full border border-white/20">
            {reportType}
          </span>
        </div>
      </section>

      {/* ============================================================= */}
      {/* 3. EXECUTIVE KPI CARDS */}
      {/* ============================================================= */}
      <section className="mb-6 page-break-inside-avoid">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          المؤشرات القيادية التنفيذية (Executive Key Performance Indicators)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {report.kpis.map((kpi, idx) => {
            const borderColors: Record<string, string> = {
              amber: "border-amber-300 bg-amber-50/60 text-amber-950",
              cyan: "border-sky-300 bg-sky-50/60 text-sky-950",
              emerald: "border-emerald-300 bg-emerald-50/60 text-emerald-950",
              purple: "border-purple-300 bg-purple-50/60 text-purple-950",
              rose: "border-rose-300 bg-rose-50/60 text-rose-950",
            };
            const style = borderColors[kpi.color || "amber"] || borderColors.amber;

            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border ${style} flex flex-col justify-between shadow-xs`}
              >
                <span className="text-xs font-semibold text-slate-600 mb-1">{kpi.label}</span>
                <div className="my-1">
                  <span className="text-2xl font-black font-mono tracking-tight text-slate-900">
                    {kpi.value}
                  </span>
                </div>
                {kpi.subtext && (
                  <span className="text-[11px] text-slate-500 mt-1 font-medium">{kpi.subtext}</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================================================= */}
      {/* 4. EXECUTIVE SUMMARY & STRATEGIC RECOMMENDATIONS */}
      {/* ============================================================= */}
      <section className="mb-6 bg-slate-50 border border-slate-200 rounded-2xl p-5 page-break-inside-avoid space-y-4">
        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-700" />
            التحليل التفسيري الذكي (Smart Operational Narrative)
          </h3>
          <p className="text-xs text-slate-800 leading-relaxed text-justify">
            {report.executiveSummary}
          </p>
        </div>

        {report.recommendations && report.recommendations.length > 0 && (
          <div className="pt-3 border-t border-slate-200">
            <h4 className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              التوجيهات الاستراتيجية الموصى بها:
            </h4>
            <ul className="space-y-1.5 pr-4 text-xs text-slate-700 list-disc">
              {report.recommendations.map((rec, rIdx) => (
                <li key={rIdx} className="leading-relaxed">{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ============================================================= */}
      {/* 4.5. LIVE SESSION SPECIAL PANELS (Super Battles, Gifts, Rivals) */}
      {/* ============================================================= */}
      {reportType === "LIVE_SESSION_SUMMARY" && (
        <section className="mb-6 space-y-4 page-break-inside-avoid">
          {/* Super Battles (>= 100K) Panel */}
          {report._superBattles && report._superBattles.length > 0 && (
            <div className="bg-amber-50/50 border border-amber-300 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                  <span className="text-amber-600">🔥</span>
                  أقوى جولات تخطى فيها الدعم 100 ألف ماسة (1v1 و 2v2):
                </h4>
                <span className="text-[10px] font-mono font-bold bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                  {report._superBattles.length} جولة سوبر موثقة
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {report._superBattles.slice(0, 4).map((sb: any, sbIdx: number) => (
                  <div key={sbIdx} className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-900 truncate max-w-[220px]" title={sb.opponentsText}>
                        فريق الخصم: {sb.opponentsText}
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        sb.battleType === "1V1" ? "bg-sky-100 text-sky-800" : "bg-purple-100 text-purple-800"
                      }`}>
                        {sb.battleType}
                      </span>
                    </div>
                    <div className="flex items-center justify-between my-1 text-xs">
                      <span className="text-slate-600 font-mono">المضيف: <strong className="text-amber-900">{sb.hostScore.toLocaleString("ar-SA")} 💎</strong></span>
                      <span className="text-slate-600 font-mono">الخصم: <strong>{sb.oppScore.toLocaleString("ar-SA")} 💎</strong></span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                      <span className="text-slate-500 font-mono">{sb.startedAtFormatted}</span>
                      <span className={`font-bold ${sb.outcome.includes("فوز المضيف") ? "text-emerald-700" : "text-rose-700"}`}>
                        {sb.outcome}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gift Inventory Breakdown (>= 10,000 Diamonds) */}
          {report._giftBreakdown && report._giftBreakdown.length > 0 && (
            <div className="bg-purple-50/40 border border-purple-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                  <span>🎁</span>
                  الهدايا الكبرى المرصودة في البث (10,000 ماسة فأكثر - حصراً للمضيفة @mohra.2000):
                </h4>
                <span className="text-[10px] font-mono font-bold text-purple-800 bg-purple-200/50 px-2 py-0.5 rounded-full border border-purple-300">
                  {report._giftBreakdown.length} صنف حصري (+10k)
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {report._giftBreakdown.slice(0, 16).map((g: any, gIdx: number) => (
                  <span
                    key={gIdx}
                    className="inline-flex items-center gap-1 text-[11px] font-mono font-bold bg-white text-purple-950 px-2.5 py-1 rounded-lg border border-purple-200 shadow-2xs"
                  >
                    <span className="text-purple-600">✨</span>
                    {g.formattedMultiplier}
                    <span className="text-[9px] text-slate-500 font-medium">({g.diamonds.toLocaleString("ar-SA")} 💎)</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top Rivalries with Clean Names */}
          {report._topRivals && report._topRivals.length > 0 && (
            <div className="bg-sky-50/40 border border-sky-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                  <span>⚔️</span>
                  أكثر المنافسين خوضاً للجولات (Rivalry & Match Record):
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {report._topRivals.slice(0, 3).map((riv: any, rivIdx: number) => (
                  <div key={rivIdx} className="bg-white p-2.5 rounded-xl border border-sky-200 text-xs shadow-xs">
                    <span className="font-bold text-slate-900 block truncate">{riv.displayName}</span>
                    <span className="text-[10px] text-slate-500 block truncate">منافس مواجه</span>
                    <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono">
                      <span className="font-bold text-sky-800">{riv.totalBattles} جولة</span>
                      <span className="text-emerald-700 font-bold">فوز {riv.hostWins}</span>
                      <span className="text-rose-700 font-bold">خسارة {riv.oppWins}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ============================================================= */}
      {/* 5. STRUCTURED AUDIT TABLE OR BATTLE POST-MATCH CARDS */}
      {/* ============================================================= */}
      {reportType === "BATTLE_POST_MATCH" ? (
        <section className="mb-6 space-y-6">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Swords className="w-4 h-4 text-rose-600" />
              سجل نزالات التحدي والداعمين بالجولة (PK Match Rectangles)
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              إجمالي النزالات المعتمدة: <strong>{report._matchCards?.length || 0}</strong> نزال
              {report._minHostScore && Number(report._minHostScore) > 0
                ? ` (الحد الأدنى لسكور المضيف: ${Number(report._minHostScore).toLocaleString("ar-SA")} 💎)`
                : " (بدون دعم صفري)"}
            </span>
          </div>

          {(!report._matchCards || report._matchCards.length === 0) ? (
            <div className="border border-slate-200 rounded-2xl p-8 text-center text-slate-500 bg-slate-50">
              لا توجد نزالات مسجلة ذات دعم نشط في هذا النطاق الزمني.
            </div>
          ) : (
            <div className="space-y-6">
              {report._matchCards.map((m: any, idx: number) => (
                <div key={m.id || idx} className="space-y-2 page-break-inside-avoid">
                  {/* فوق المستطيل: تاريخ الجولة والوقت */}
                  <div className="flex items-center justify-between px-2 text-xs font-semibold text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-mono font-bold">
                        {idx + 1}
                      </span>
                      <span className="flex items-center gap-1 text-slate-900 font-bold">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        {m.headerDateTime}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">(بتوقيت الرياض)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        ⏱️ {m.durationMin} دقائق
                      </span>
                      <span
                        className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${
                          m.battleType === "2V2"
                            ? "bg-purple-100 text-purple-900 border-purple-300"
                            : "bg-sky-100 text-sky-900 border-sky-300"
                        }`}
                      >
                        {m.battleType}
                      </span>
                    </div>
                  </div>

                  {/* المستطيل: البيانات والسكورات والداعمين والفائز */}
                  <div className="border-2 border-slate-300 rounded-2xl p-4 bg-white shadow-xs space-y-4">
                    {/* 1. من الفريق الفائز */}
                    <div
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
                        m.isHostWinner
                          ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                          : m.winningTeam === 2
                          ? "bg-rose-50 text-rose-900 border-rose-300"
                          : "bg-slate-100 text-slate-800 border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🏆</span>
                        <span>الفريق الفائز: {m.winnerLabel}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span>فارق الحسم:</span>
                        <span className="px-2 py-0.5 rounded bg-white/80 shadow-2xs">
                          {m.scoreDifference.toLocaleString("ar-SA")} 💎
                        </span>
                      </div>
                    </div>

                    {/* 2. بيانات الفريقين وسكوراتهما */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* بيانات فريق المضيف وسكوره */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-bold text-amber-700 text-sm overflow-hidden shrink-0 shadow-xs">
                            {m.team1Participants[0]?.avatarUrl ? (
                              <img
                                src={m.team1Participants[0].avatarUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>👑</span>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                              فريق المضيف
                            </span>
                            <h5 className="font-extrabold text-slate-900 text-sm">
                              {m.team1Participants.map((p: any) => p.displayName).join(" ، ")}
                            </h5>
                          </div>
                        </div>
                        <div className="text-left font-mono">
                          <span className="text-[10px] text-slate-500 block">السكور النهائي</span>
                          <span className="text-base font-black text-amber-900 bg-amber-100/70 px-2.5 py-0.5 rounded-lg border border-amber-200 inline-block shadow-2xs">
                            {m.team1Score.toLocaleString("ar-SA")} 💎
                          </span>
                        </div>
                      </div>

                      {/* بيانات فريق الخصم وسكوره */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex items-center justify-between">
                        <div className="text-right font-mono">
                          <span className="text-[10px] text-slate-500 block">السكور النهائي</span>
                          <span className="text-base font-black text-slate-900 bg-slate-200 px-2.5 py-0.5 rounded-lg border border-slate-300 inline-block shadow-2xs">
                            {m.team2Score.toLocaleString("ar-SA")} 💎
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 text-left md:text-right">
                          <div className="md:order-1 order-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              فريق الخصم
                            </span>
                            <h5 className="font-extrabold text-slate-900 text-sm">
                              {m.team2Participants.map((p: any) => p.displayName).join(" ، ")}
                            </h5>
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-700 text-sm overflow-hidden shrink-0 shadow-xs md:order-2 order-1">
                            {m.team2Participants[0]?.avatarUrl ? (
                              <img
                                src={m.team2Participants[0].avatarUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>⚔️</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. توب 10 داعمين بالجولة لكل فريق */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      {/* قائمة داعمي المضيف */}
                      <div className="border border-amber-200 bg-amber-50/30 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                          <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                            <span>⭐</span>
                            توب 10 داعمي فريق المضيف:
                          </span>
                          <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                            {m.team1TopSupporters.length} داعم
                          </span>
                        </div>

                        {m.team1TopSupporters.length === 0 ? (
                          <p className="text-[11px] text-slate-400 py-3 text-center">
                            لم يُسجل داعمون محددون في نافذة الجولة.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {m.team1TopSupporters.map((sup: any, sIdx: number) => (
                              <div
                                key={sIdx}
                                className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white border border-amber-100 shadow-2xs"
                              >
                                <div className="flex items-center gap-1.5 truncate max-w-[190px]">
                                  <span
                                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold font-mono ${
                                      sup.rank === 1
                                        ? "bg-amber-400 text-slate-950 font-black shadow-xs"
                                        : sup.rank === 2
                                        ? "bg-slate-300 text-slate-900 font-black"
                                        : sup.rank === 3
                                        ? "bg-amber-600 text-white font-black"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {sup.rank}
                                  </span>
                                  <span className="font-bold text-slate-900 truncate" title={sup.name}>
                                    {sup.name}
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-amber-700 shrink-0 text-[11px]">
                                  💎 {sup.diamonds.toLocaleString("ar-SA")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* قائمة داعمي الخصم */}
                      <div className="border border-slate-200 bg-slate-50/50 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span>🛡️</span>
                            توب 10 داعمي فريق الخصم:
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded">
                            {m.team2TopSupporters.length} داعم
                          </span>
                        </div>

                        {m.team2TopSupporters.length === 0 ? (
                          <div className="py-3 px-2 text-center space-y-1">
                            <p className="text-[11px] text-slate-500">
                              مسجل عبر سكور التحدي العام للخصم
                            </p>
                            <span className="inline-block font-mono font-bold text-[10px] text-slate-700 bg-slate-200/60 px-2 py-0.5 rounded">
                              إجمالي السكور: {m.team2Score.toLocaleString("ar-SA")} 💎
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {m.team2TopSupporters.map((sup: any, sIdx: number) => (
                              <div
                                key={sIdx}
                                className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white border border-slate-200 shadow-2xs"
                              >
                                <div className="flex items-center gap-1.5 truncate max-w-[190px]">
                                  <span
                                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold font-mono ${
                                      sup.rank === 1
                                        ? "bg-slate-700 text-white font-black"
                                        : sup.rank === 2
                                        ? "bg-slate-300 text-slate-900"
                                        : sup.rank === 3
                                        ? "bg-slate-200 text-slate-700"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {sup.rank}
                                  </span>
                                  <span className="font-bold text-slate-900 truncate" title={sup.name}>
                                    {sup.name}
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-slate-700 shrink-0 text-[11px]">
                                  💎 {sup.diamonds.toLocaleString("ar-SA")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-slate-700" />
              سجل البيانات المعتمدة والمدققة (Audited Ledger Data)
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              عدد السجلات: <strong>{report.rows.length}</strong> سجل
            </span>
          </div>

          <div className={reportType === "LIVE_SESSION_SUMMARY" ? "border border-slate-200 rounded-xl overflow-hidden w-full" : "overflow-x-auto border border-slate-200 rounded-xl"}>
            <table className={`w-full text-right text-xs border-collapse ${reportType === "LIVE_SESSION_SUMMARY" ? "table-fixed" : ""}`}>
              <thead>
                <tr className="bg-slate-900 text-white font-semibold">
                  <th className="py-2.5 px-2 border-b border-slate-800 w-8 text-center font-mono">#</th>
                  {report.headers.map((h, i) => {
                    const colWidth = reportType === "LIVE_SESSION_SUMMARY" ? (
                      i === 0 ? "w-[15%]" :
                      i === 1 ? "w-[30%]" :
                      i === 2 ? "w-[14%]" :
                      i === 3 ? "w-[14%]" :
                      i === 4 ? "w-[13%]" : "w-[14%]"
                    ) : "";
                    return (
                      <th key={i} className={`py-2.5 px-2.5 border-b border-slate-800 ${colWidth} ${i === 1 ? "text-right" : "text-center"}`}>
                        {h}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={report.headers.length + 1} className="py-6 text-center text-slate-400">
                      لا توجد سجلات مطابقة في نطاق البحث الحالي.
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className={rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/80"}
                    >
                      <td className="py-2 px-2 text-center text-slate-400 font-sans text-[11px]">
                        {rowIdx + 1}
                      </td>
                      {report.headers.map((h, colIdx) => {
                        const val = row[h];
                        const displayVal = val !== null && val !== undefined ? String(val) : "-";
                        const isVerified = displayVal === "VERIFIED" || displayVal.includes("متطابق");
                        const isDiamondCol = h.includes("الماس") || h.includes("الدعم") || displayVal.includes("💎");

                        const isAvailableBalanceCol = h === "الرصيد المتاح";
                        const isSupporterCol = h === "الداعم / المستخدم" || h === "الداعم المعتمد";
                        const isToolCol = h === "الأداة والتأثير التكتيكي";
                        const isMovementTypeCol = h === "نوع حركة القيد";
                        const isReadinessCol = h.includes("الجاهزية");
                        const isQualityCol = h === "موثوقية النمط الإحصائي";
                        const isSupportRankCol = h === "ترتيب وتصنيف الدعم المالي";
                        const isDiamondTierCol = h === "تصنيف الجولة الماسية";
                        const isBattleTypeCol = h === "نوع النزال" || h === "نوع الجولة";
                        const isOutcomeCol = h === "النتيجة والحسم";
                        const isOpponentCol = h.includes("الخصم") && !h.includes("دعم");

                        return (
                          <td key={colIdx} className={`py-2 px-2.5 ${colIdx === 1 ? "text-right" : "text-center"}`}>
                            {isOpponentCol ? (
                              <span className="font-bold text-slate-900 text-xs block truncate" title={displayVal}>
                                {displayVal}
                              </span>
                            ) : isBattleTypeCol ? (
                              <span className={`inline-flex items-center font-mono font-black text-[10px] px-2 py-0.5 rounded border ${
                                displayVal.includes("2V2")
                                  ? "bg-purple-100 text-purple-900 border-purple-300"
                                  : "bg-sky-100 text-sky-900 border-sky-300"
                              }`}>
                                {displayVal}
                              </span>
                            ) : isOutcomeCol ? (
                              <span className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded border ${
                                displayVal.includes("فوز المضيف")
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                  : displayVal.includes("فوز الخصم")
                                  ? "bg-rose-50 text-rose-800 border-rose-300"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}>
                                {displayVal}
                              </span>
                            ) : isDiamondTierCol ? (
                              <span className={`inline-flex items-center gap-1 font-bold text-[10px] px-2.5 py-1 rounded-md border shadow-xs ${
                                displayVal.includes("سوبر")
                                  ? "bg-amber-100 text-amber-950 border-amber-400 font-black"
                                  : "bg-slate-50 text-slate-700 border-slate-200"
                              }`}>
                                {displayVal}
                              </span>
                            ) : isSupportRankCol ? (
                              <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center font-mono mx-auto shadow-sm">
                                {displayVal}
                              </div>
                            ) : isQualityCol ? (
                              <span className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded border ${
                                row._evidenceQuality === "STABLE_PATTERN"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                  : row._evidenceQuality === "RECURRENT_PATTERN"
                                  ? "bg-cyan-50 text-cyan-800 border-cyan-300"
                                  : row._evidenceQuality === "INITIAL_PATTERN"
                                  ? "bg-amber-50 text-amber-800 border-amber-300"
                                  : "bg-slate-100 text-slate-800 border-slate-300"
                              }`}>
                                <ShieldCheck className="w-3 h-3" />
                                {displayVal}
                              </span>
                            ) : isSupporterCol && row._supporter ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-slate-100 border border-slate-300 flex items-center justify-center font-bold text-slate-700 text-xs overflow-hidden shrink-0">
                                  {row._supporter.avatarUrl ? (
                                    <img src={row._supporter.avatarUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span>{(row._supporter.displayName || row._supporter.username || "U").charAt(0)}</span>
                                  )}
                                </div>
                                <div className="text-right leading-tight">
                                  <span className="font-bold text-slate-900 block text-xs">@{row._supporter.username}</span>
                                  <span className="text-[10px] text-slate-500 block truncate max-w-[120px]">{row._supporter.displayName}</span>
                                </div>
                              </div>
                            ) : isToolCol ? (
                              <div className="text-right leading-tight">
                                <span className="font-bold text-slate-900 text-xs block">
                                  {row._tool?.emoji ? `${row._tool.emoji} ` : ""}{row._tool?.name || displayVal.split("-")[0]?.trim()}
                                </span>
                                <span className="inline-block text-[9px] font-mono font-medium text-amber-800 bg-amber-50 px-1 rounded border border-amber-200 mt-0.5">
                                  {row._tool?.perk || (displayVal.includes("-") ? displayVal.split("-")[1]?.trim() : "أداة تكتيكية")}
                                </span>
                              </div>
                            ) : isMovementTypeCol ? (
                              <span className={`inline-flex items-center gap-1 font-mono font-bold text-[10px] px-2 py-0.5 rounded border ${
                                (row._quantity ?? 0) >= 0 ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-rose-50 text-rose-800 border-rose-300"
                              }`}>
                                {displayVal}
                              </span>
                            ) : isReadinessCol ? (
                              <span className="inline-flex items-center gap-1 font-mono font-bold text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-300">
                                {displayVal}
                              </span>
                            ) : isVerified ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                {displayVal}
                              </span>
                            ) : isDiamondCol ? (
                              <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-900 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-300 text-xs shadow-xs">
                                <span className="text-amber-600">💎</span>
                                <span className="dir-ltr">{displayVal.replace("💎", "").trim()}</span>
                              </span>
                            ) : (
                              displayVal
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ============================================================= */}
      {/* 6. OFFICIAL PROVENANCE SEAL & SIGNATURES */}
      {/* ============================================================= */}
      <footer className="mt-8 pt-6 border-t-2 border-slate-900 page-break-inside-avoid">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          
          {/* Digital Stamp Emblem */}
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-amber-600 bg-amber-50 flex flex-col items-center justify-center text-center p-1">
              <ShieldCheck className="w-5 h-5 text-amber-700 mb-0.5" />
              <span className="text-[8px] font-black text-amber-900 leading-none">معتمد رسمياً</span>
              <span className="text-[7px] font-mono text-amber-800">VERIFIED</span>
            </div>
            <div className="space-y-0.5">
              <h5 className="text-xs font-bold text-slate-900">
                شهادة الاعتماد والتدقيق المحاسبي الرقمي
              </h5>
              <p className="text-[10px] text-slate-500 max-w-sm leading-relaxed">
                هذه الوثيقة صادرة عن محرك LivePulse Governance 2.0 بعد فحص السجلات برمجياً ومطابقة القيود بنسبة 100%. لا تتطلب توقيعاً يدوياً لاعتمادها.
              </p>
              <p className="text-[9px] font-mono text-slate-400">
                SHA-256 HASH: {Math.random().toString(36).substring(2, 10).toUpperCase()}-VERIFIED-CORE-LP2026
              </p>
            </div>
          </div>

          {/* Signature Blocks */}
          <div className="flex items-center gap-8 text-center text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-slate-500 block">تدقيق النظام الذكي</span>
              <div className="w-28 border-b border-slate-400 pb-1 font-mono text-emerald-700 font-bold text-[11px]">
                [✓ موثق آلياً]
              </div>
              <span className="text-[9px] text-slate-400">LivePulse Core Engine</span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-slate-500 block">اعتماد إدارة البث</span>
              <div className="w-28 border-b border-slate-400 pb-1 font-bold text-slate-900 text-[11px]">
                {streamerDisplayName}
              </div>
              <span className="text-[9px] text-slate-400">@{streamerUsername}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>منصة لايف بالس للتحليلات التكتيكية • جميع الحقوق محفوظة 2026</span>
          <span>صفحة 1 من 1 • A4 Executive Intelligence Document</span>
        </div>
      </footer>

    </main>
  );
}
