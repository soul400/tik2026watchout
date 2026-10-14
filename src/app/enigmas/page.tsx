import { prisma } from "@/lib/prisma";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { EyeOff, AlertCircle, CheckCircle, HelpCircle, Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EnigmasPage() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: "mohra-live" },
  });
  const tenantId = tenant?.id || "";

  const reviews = await prisma.enigmaReview.findMany({
    where: { tenantId, status: "PENDING" },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-2xl font-bold text-white tracking-tight">تحليل الحسابات الغامضة (Enigma)</h2>
          <ConfidenceBadge state="ESTIMATED" methodology="تحليل احتمالي مبني على المعرفات الثابتة والتزامن الزمني؛ لا يجزم بالهوية الحقيقية" />
        </div>
        <p className="text-sm text-secondaryText">
          فحص ومراجعة احتمالية ارتباط حسابات متعددة استناداً إلى المعرفات الثابتة وأنماط الأحداث وتوقيت الدخول
        </p>
      </div>

      {/* Ethical & Security Notice */}
      <div className="bg-elevated/40 border border-white/5 p-4 rounded-xl flex items-start gap-3">
        <Shield className="w-5 h-5 text-turquoise shrink-0 mt-0.5" />
        <div className="text-xs text-secondaryText leading-relaxed">
          <span className="font-semibold text-white block mb-0.5">ضوابط الخصوصية والأمن:</span>
          هذه الأداة تعتمد حصراً على الإشارات التقنية العامة (تغييرات اسم العرض، تطابق المعرف التقني الثابت، وأنماط التواجد المشترك). يُمنع النظام من ادعاء كشف الهوية الشخصية الواقعية للداعمين.
        </div>
      </div>

      {/* Candidates List */}
      <div className="bg-surface rounded-xl border border-white/5 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">مرشحو المطابقة قيد المراجعة</h3>
          <span className="text-xs font-mono text-secondaryText">
            الحالات النشطة: {reviews.length}
          </span>
        </div>

        {reviews.length === 0 ? (
          <div className="py-12 text-center text-secondaryText border border-dashed border-white/10 rounded-xl">
            <HelpCircle className="w-10 h-10 mx-auto mb-3 text-secondaryText/40" />
            <p className="text-base font-bold text-white">لا توجد حالات تطابق مشبوهة قيد المراجعة حالياً</p>
            <p className="text-xs font-mono mt-1 text-secondaryText max-w-md mx-auto">
              يقوم محرك الرصد الذكي بتحليل أنماط التواجد وتغيرات المعرفات تلقائياً عند رصد أي حسابات متزامنة في البث المباشر
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-elevated p-4 rounded-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <span className="text-sm font-bold text-white">مرشح فحص هوية رقم #{review.id.slice(-6)}</span>
                  <p className="text-xs text-secondaryText mt-0.5 font-mono">
                    درجة الثقة التقنية: {(review.confidenceScore * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded bg-turquoise/10 text-turquoise border border-turquoise/20 text-xs font-semibold">
                    {review.matchLevel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
