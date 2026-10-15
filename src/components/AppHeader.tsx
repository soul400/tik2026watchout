"use client";

import { useState } from "react";
import { Radio, RefreshCw, Clock, Globe, Eye, EyeOff } from "lucide-react";
import { useSupportPrivacy } from "@/context/SupportPrivacyContext";

export function AppHeader() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"CONNECTED" | "DISCONNECTED">("DISCONNECTED");
  const { hideSupportNumbers, toggleHideSupportNumbers } = useSupportPrivacy();

  const handleToggleConnect = async () => {
    setIsConnecting(true);
    // Simulate real handshake toggle
    setTimeout(() => {
      setConnectionStatus((prev) => (prev === "CONNECTED" ? "DISCONNECTED" : "CONNECTED"));
      setIsConnecting(false);
    }, 800);
  };

  return (
    <header className="h-16 bg-surface/80 backdrop-blur-md border-b border-white/5 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <h1 className="text-base font-semibold text-white">منصة ذكاء البثوث والنزالات</h1>
        <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
        <div className="flex items-center gap-2 text-xs text-secondaryText">
          <Globe className="w-3.5 h-3.5 text-turquoise" />
          <span>المنطقة الزمنية المرجعية:</span>
          <span className="text-white font-medium bg-elevated px-2 py-0.5 rounded border border-white/5">
            Asia/Riyadh (توقيت مكة)
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Toggle Support Privacy (Hide / Show Support Numbers) */}
        <button
          onClick={toggleHideSupportNumbers}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all ${
            hideSupportNumbers
              ? "bg-amber-500/15 text-amber-300 border-amber-500/35 shadow-sm shadow-amber-500/10 hover:bg-amber-500/25"
              : "bg-surface hover:bg-white/10 text-secondaryText hover:text-white border-white/10"
          }`}
          title={
            hideSupportNumbers
              ? "أرقام الدعم مخفية حالياً لحماية الخصوصية (انقر للإظهار)"
              : "انقر لإخفاء أرقام الدعم والماس لحماية الخصوصية"
          }
        >
          {hideSupportNumbers ? (
            <>
              <EyeOff className="w-3.5 h-3.5 text-amber-400" />
              <span>أرقام الدعم: مخفية 🔒</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-turquoise" />
              <span>إخفاء أرقام الدعم</span>
            </>
          )}
        </button>

        {/* Stream Connection Indicator */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
            connectionStatus === "CONNECTED"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              connectionStatus === "CONNECTED" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
            }`}
          />
          <span>
            {connectionStatus === "CONNECTED" ? "متصل بالبث المباشر" : "موصل البث غير نشط"}
          </span>
        </div>

        <button
          onClick={handleToggleConnect}
          disabled={isConnecting}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-elevated hover:bg-white/10 border border-white/10 text-white transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? "animate-spin text-turquoise" : ""}`} />
          <span>{connectionStatus === "CONNECTED" ? "فصل الاتصال" : "بدء الاتصال بـ @mohra.2000"}</span>
        </button>
      </div>
    </header>
  );
}
