import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

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
      <body className="min-h-screen bg-background text-primaryText antialiased flex flex-row selection:bg-turquoise/30 selection:text-white print:bg-white print:text-black">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
