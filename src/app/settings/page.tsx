import { prisma } from "@/lib/prisma";
import { Settings, Shield, User } from "lucide-react";
import { TelegramSettingsHub } from "@/components/TelegramSettingsHub";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: "mohra-live" },
    include: {
      streamers: true,
      toolDefinitions: true,
    },
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">الإعدادات والتكاملات الذكية</h2>
        <p className="text-sm text-secondaryText">
          إدارة إعدادات المستأجر، تنبيهات تليقرام المباشرة، وربط حسابات الستريمرز
        </p>
      </div>

      {/* 1. TELEGRAM AUTOMATED NOTIFICATIONS HUB */}
      <TelegramSettingsHub />

      {/* 2. TENANT & STREAMERS INFO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tenant Details */}
        <div className="bg-surface rounded-xl border border-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-turquoise" />
            <h3 className="font-bold text-white text-base">بيانات المستأجر (Tenant)</h3>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-secondaryText block">اسم المستأجر:</span>
              <span className="font-semibold text-white">{tenant?.name}</span>
            </div>
            <div>
              <span className="text-xs text-secondaryText block">المعرف المعزول (Tenant ID):</span>
              <span className="font-mono text-xs text-turquoise">{tenant?.id}</span>
            </div>
            <div>
              <span className="text-xs text-secondaryText block">خطة الاشتراك:</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                {tenant?.plan} (مفعلة)
              </span>
            </div>
          </div>
        </div>

        {/* Linked Streamers */}
        <div className="bg-surface rounded-xl border border-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-gold" />
            <h3 className="font-bold text-white text-base">حسابات الستريمرز المربوطة</h3>
          </div>

          <div className="space-y-3">
            {tenant?.streamers.map((st) => (
              <div key={st.id} className="bg-elevated p-3 rounded-lg border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-white block">{st.displayName}</span>
                  <span className="text-xs text-secondaryText">@{st.username}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-turquoise/10 text-turquoise text-xs font-medium border border-turquoise/20">
                  الحساب الأساسي
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
