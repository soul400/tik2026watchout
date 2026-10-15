import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { SupportPrivacyProvider } from "@/context/SupportPrivacyContext";

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-arabic",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LIVEPULSE INTELLIGENCE | منصة ذكاء البثوث والنزالات",
  description: "المنصة الهندسية المتطورة لتحليل بثوث TikTok LIVE وخزينة أدوات الداعمين",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${ibmPlexArabic.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-background text-primaryText antialiased flex flex-row selection:bg-turquoise/30 selection:text-white">
        <SupportPrivacyProvider>
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0 min-h-screen">
            <AppHeader />
            <main className="flex-1 p-6 md:p-8 overflow-y-auto">
              {children}
            </main>
          </div>
        </SupportPrivacyProvider>
      </body>
    </html>
  );
}
