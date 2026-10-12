import { UserPlus, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function OnboardingPage() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="bg-surface rounded-2xl border border-white/5 p-8">
        <div className="w-12 h-12 rounded-xl bg-turquoise/10 border border-turquoise/20 flex items-center justify-center text-turquoise mb-4">
          <UserPlus className="w-6 h-6" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">تهيئة وإعداد حساب ستريمر جديد</h2>
        <p className="text-sm text-secondaryText mb-6">
          أدخل اسم المستخدم لربط البث المباشر وإنشاء مساحة عمل معزولة ومستأجر جديد في المنصة.
        </p>

        <form className="space-y-4">
          <div>
            <label className="text-xs text-secondaryText block mb-1.5 font-medium">اسم مستخدم TikTok LIVE:</label>
            <div className="relative">
              <span className="absolute right-3 top-3 text-secondaryText text-sm">@</span>
              <input
                type="text"
                defaultValue="mohra.2000"
                className="w-full bg-elevated border border-white/10 rounded-lg px-8 py-2.5 text-sm text-white focus:outline-none focus:border-turquoise"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-secondaryText block mb-1.5 font-medium">اسم العرض المستعار:</label>
            <input
              type="text"
              defaultValue="مهـرة 🇸🇦"
              className="w-full bg-elevated border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-turquoise"
            />
          </div>

          <div className="pt-4">
            <button
              type="button"
              className="w-full py-3 bg-gradient-to-r from-turquoise to-blue text-background font-bold rounded-lg hover:opacity-95 transition-all text-sm"
            >
              حفظ وتأكيد إعداد الستريمر
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
