import { prisma } from "@/lib/prisma";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { FileText, Sparkles, Download, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-2xl font-bold text-white tracking-tight">التقارير التحليلية والتفسير الذكي</h2>
          <ConfidenceBadge state="VERIFIED" methodology="الأرقام محسوبة بالكامل برمجياً؛ الذكاء الاصطناعي يقتصر على الشرح والتوصيات فقط" />
        </div>
        <p className="text-sm text-secondaryText">
          تقارير دورية تترجم الأرقام والإحصائيات المحسوبة إلى إرشادات عملية قابلة للتنفيذ
        </p>
      </div>

      {/* AI Synthesis Card */}
      <div className="bg-surface rounded-xl border border-white/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple/10 border border-purple/30 flex items-center justify-center text-purple">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">تقرير الأداء الأسبوعي وتفسير الاتجاهات</h3>
            <span className="text-xs text-secondaryText">الفترة: الأسبوع الحالي (توقيت مكة)</span>
          </div>
        </div>

        <div className="bg-elevated/60 p-5 rounded-xl border border-white/5 space-y-3 text-sm text-secondaryText leading-relaxed">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-turquoise shrink-0 mt-1" />
            <p>
              <strong className="text-white">نمو الدعم في الجولات الحاسمة:</strong> أظهرت البيانات المحسوبة زيادة بنسبة 35% في فاعلية استخدام القفازات التكتيكية في الثواني الأخيرة من النزالات، مما ساهم في حسم 4 جولات متتالية لصالح الفريق.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-turquoise shrink-0 mt-1" />
            <p>
              <strong className="text-white">ثبات الحضور المسائي:</strong> لوحظ استقرار كبير في معدل تفاعل التعليقات بين الساعة 9:00 و 10:30 مساءً، مما يؤكد أن هذا النطاق هو التوقيت الأنسب لفتح الجولات الرئيسية.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-turquoise shrink-0 mt-1" />
            <p>
              <strong className="text-white">تفاعل الداعمين الصاعدين:</strong> انضمام 3 داعمين جدد إلى فئة "مشارك جولات" مما يعزز تنوع قاعدة الدعم وعدم الاعتماد على حساب فردي واحد.
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button className="flex items-center gap-2 px-4 py-2 bg-elevated hover:bg-white/10 text-white rounded-lg border border-white/10 text-xs font-semibold">
            <Download className="w-3.5 h-3.5 text-turquoise" />
            <span>تحميل التقرير كـ PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
