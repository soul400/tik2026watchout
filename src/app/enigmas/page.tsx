import { prisma } from "@/lib/prisma";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { EyeOff, AlertCircle, CheckCircle, HelpCircle, Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EnigmasPage() {
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
        <h3 className="text-base font-semibold text-white mb-4">مرشحو المطابقة قيد المراجعة</h3>

        <div className="bg-elevated p-4 rounded-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-surface border border-turquoise/30 flex items-center justify-center font-bold text-turquoise">
              ف
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">فـيصل الشمري ⭐</span>
                <span className="text-secondaryText text-xs">مع</span>
                <span className="font-bold text-white text-sm">Faisal_Alt</span>
              </div>
              <p className="text-xs text-secondaryText mt-0.5">
                تطابق في معرف المنصة الثابت (SecUid Hash) ونمط الحضور المتطابق في 3 نزالات متتالية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
              تطابق قوي (Strong Match)
            </span>
            <button className="px-3 py-1.5 rounded-lg bg-surface border border-white/10 hover:bg-white/10 text-white text-xs font-medium">
              تأكيد الربط يدوياً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
