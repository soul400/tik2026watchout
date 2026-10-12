import { prisma } from "@/lib/prisma";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { BarChart3, Clock, TrendingUp, Sparkles, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
  const tenantId = tenant?.id || "";

  const hourlyData = await prisma.hourlyAnalytics.findMany({
    where: { tenantId },
    orderBy: { riyadhHour: "asc" },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            التحليلات الزمنية ومؤشر جودة وقت البث (STQI)
          </h2>
          <ConfidenceBadge state="PARTIAL" methodology="توقيت الرياض Asia/Riyadh؛ يتطلب 3 جلسات على الأقل لتأكيد الثقة" />
        </div>
        <p className="text-sm text-secondaryText">
          تقييم موضوعي لجودة فترات البث يجمع بين استمرارية التفاعل، المشاهدات، ومعدل الدعم لكل دقيقة
        </p>
      </div>

      {/* Recommended Time Spotlight */}
      <div className="bg-gradient-to-r from-surface to-elevated p-6 rounded-2xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-gold/10 text-gold border border-gold/20 mb-2 inline-block">
            الفترة الذهبية الأكثر استقراراً
          </span>
          <h3 className="text-xl font-bold text-white">الساعة 9:00 مساءً — 10:00 مساءً (توقيت مكة)</h3>
          <p className="text-xs text-secondaryText mt-1 max-w-2xl">
            سجلت هذه الفترة أعلى معدل استمرارية (Consistency: 88%) عبر 6 جلسات سابقة مكتملة، مع تفاعل تعليقات ودعم متوازن.
          </p>
        </div>

        <div className="bg-background/60 p-4 rounded-xl border border-white/5 text-center min-w-[140px]">
          <span className="text-xs text-secondaryText block">مؤشر الجودة STQI</span>
          <span className="text-3xl font-extrabold text-turquoise">92.4</span>
          <span className="text-[10px] text-emerald-400 block mt-0.5">درجة ممتازة</span>
        </div>
      </div>

      {/* Hourly Performance Breakdown */}
      <div className="bg-surface rounded-xl border border-white/5 p-5">
        <h3 className="text-base font-semibold text-white mb-4">أداء الساعات المسائية (بتوقيت الرياض)</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead>
              <tr className="border-b border-white/5 text-xs text-secondaryText">
                <th className="pb-3 font-medium">الساعة (Asia/Riyadh)</th>
                <th className="pb-3 font-medium">عدد الجلسات</th>
                <th className="pb-3 font-medium">متوسط الماس</th>
                <th className="pb-3 font-medium">متوسط المشاهدين</th>
                <th className="pb-3 font-medium">الاستمرارية</th>
                <th className="pb-3 font-medium">مؤشر STQI</th>
                <th className="pb-3 font-medium">حالة الثقة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {hourlyData.map((h) => (
                <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 font-bold text-white">{h.riyadhHour}:00 م</td>
                  <td className="py-3 text-secondaryText">{h.sampleSessions} جلسات</td>
                  <td className="py-3 font-bold text-gold">{h.avgDiamonds.toLocaleString()} 💎</td>
                  <td className="py-3 text-white">{h.avgViewers.toLocaleString()}</td>
                  <td className="py-3 text-turquoise">{Math.round(h.consistencyScore * 100)}%</td>
                  <td className="py-3 font-bold text-white">{h.stqiScore}</td>
                  <td className="py-3">
                    <ConfidenceBadge state={h.confidenceState as any} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
