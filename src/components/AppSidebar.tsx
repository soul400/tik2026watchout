"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Shield,
  Swords,
  Users,
  EyeOff,
  BarChart3,
  Trophy,
  History,
  Network,
  FileText,
  Settings,
  Sparkles,
} from "lucide-react";

const navigation = [
  { name: "غرفة المراقبة الحية", href: "/", icon: LayoutDashboard },
  { name: "خزينة الأدوات الذكية", href: "/inventory", icon: Shield },
  { name: "النزالات 1v1 و 2v2", href: "/battles", icon: Swords },
  { name: "ذكاء الداعمين", href: "/supporters", icon: Users },
  { name: "تحليل الحسابات الغامضة", href: "/enigmas", icon: EyeOff },
  { name: "التحليلات الزمنية و STQI", href: "/analytics", icon: BarChart3 },
  { name: "أبطال المجتمع", href: "/champions", icon: Trophy },
  { name: "ذاكرة البث التاريخية", href: "/stream-memory", icon: History },
  { name: "خريطة تفاعل المجتمع", href: "/community-map", icon: Network },
  { name: "التقارير الإحصائية", href: "/reports", icon: FileText },
  { name: "الإعدادات والتكاملات", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-surface border-l border-white/5 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-turquoise to-blue flex items-center justify-center text-background font-bold shadow-lg shadow-turquoise/20">
            <Sparkles className="w-5 h-5 text-background" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-white text-base block leading-tight">
              LIVEPULSE
            </span>
            <span className="text-[10px] text-turquoise tracking-widest block font-medium">
              INTELLIGENCE SAAS
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-turquoise/10 text-turquoise border border-turquoise/20 shadow-sm"
                    : "text-secondaryText hover:text-white hover:bg-white/[0.03]"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-turquoise" : "text-secondaryText"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Streamer Profile Badge */}
      <div className="p-4 border-t border-white/5 bg-elevated/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-turquoise/40 bg-turquoise/10 flex items-center justify-center font-bold text-turquoise text-sm">
            مهرة
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">مهـرة 🇸🇦</p>
            <p className="text-xs text-secondaryText truncate">@mohra.2000</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
