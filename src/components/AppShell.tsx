"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { SupportPrivacyProvider } from "@/context/SupportPrivacyContext";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPdfPage = pathname?.startsWith("/reports/pdf");

  if (isPdfPage) {
    return (
      <SupportPrivacyProvider>
        <div className="w-full min-h-screen bg-slate-950 print:bg-white text-slate-900">
          {children}
        </div>
      </SupportPrivacyProvider>
    );
  }

  return (
    <SupportPrivacyProvider>
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <AppHeader />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </SupportPrivacyProvider>
  );
}
