"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, Bot, ShieldCheck, Activity, RefreshCw } from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "user" | "copilot";
  text: string;
  timestamp: string;
  source?: string;
  isError?: boolean;
}

export function LivePulseCopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "copilot",
      text: "مرحباً بك! أنا **LivePulse Copilot**، المساعد التحليلي التكتيكي للغرفة. مستند كلياً إلى بيانات السيرفر اللحظية والدفتر الذكي المحاسبي. كيف يمكنني مساعدتك؟",
      timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const quickPrompts = [
    "📡 ما هي حالة اتصال وسيرفر البث؟",
    "🎒 ما هو رصيد الأدوات التكتيكية وسلامة الدفتر؟",
    "⚔️ كيف كانت نتيجة آخر نزال وجولة؟",
    "⏱️ ما هي نصيحة التوقيت والريتم (STQI)؟",
    "👑 من هم أعلى الداعمين في البث؟",
  ];

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || isLoading) return;

    const userMsgId = `user_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: textToSend, tenantId: "default-tenant" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل الاتصال بالمساعد الذكي.");
      }

      const copilotMsg: ChatMessage = {
        id: `copilot_${Date.now()}`,
        sender: "copilot",
        text: data.answer,
        timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        source: data.source,
      };
      setMessages((prev) => [...prev, copilotMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "copilot",
          text: `⚠️ عذراً: ${err.message || "حدث خطأ غير متوقع."}`,
          timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-turquoise/90 to-blue-600/90 hover:from-turquoise hover:to-blue-600 text-white shadow-2xl shadow-turquoise/25 backdrop-blur-md border border-white/20 transition-all duration-200 transform hover:scale-105 active:scale-95 group"
        aria-label="LivePulse Copilot"
      >
        <div className="relative">
          <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400"></span>
        </div>
        <span className="font-bold text-sm tracking-wide">LivePulse Copilot</span>
      </button>

      {/* Floating Chat Modal / Drawer */}
      {isOpen && (
        <div className="fixed bottom-20 left-6 z-50 w-[92vw] sm:w-[440px] h-[580px] max-h-[80vh] flex flex-col bg-[#0b101b]/95 border border-white/15 rounded-3xl shadow-2xl shadow-black/80 backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-white/5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-turquoise/15 border border-turquoise/30 flex items-center justify-center text-turquoise">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">LivePulse Copilot</h3>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    LIVE
                  </span>
                </div>
                <p className="text-[11px] text-secondaryText flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-turquoise" />
                  مستند لبيانات السيرفر • قراءة فقط (Read-Only)
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-secondaryText hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-white/10">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.sender === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                    m.sender === "user"
                      ? "bg-turquoise/20 text-white border border-turquoise/30 rounded-br-sm"
                      : m.isError
                      ? "bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-bl-sm"
                      : "bg-white/5 text-gray-200 border border-white/10 rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
                <div className="flex items-center gap-2 mt-1 px-1">
                  <span className="text-[10px] text-secondaryText font-mono">
                    {m.timestamp}
                  </span>
                  {m.source && (
                    <span className="text-[9px] font-mono text-turquoise/70">
                      • {m.source === "deterministic_engine" ? "محرك داخلي دقيق" : "نموذج ذكاء موثق"}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-turquoise bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 w-fit">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>جاري استعلام مؤشرات الغرفة والخادم...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02] flex gap-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(qp)}
                disabled={isLoading}
                className="shrink-0 text-[11px] font-medium text-secondaryText hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded-full transition-colors whitespace-nowrap"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white/5 border-t border-white/10">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="اسأل المساعد عن الجولات، الأدوات، أو التوقيت..."
                className="flex-1 bg-background/80 border border-white/15 focus:border-turquoise rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-secondaryText/60 outline-none transition-colors"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!inputQuery.trim() || isLoading}
                className="w-10 h-10 rounded-xl bg-turquoise hover:bg-turquoise/80 disabled:opacity-40 text-black flex items-center justify-center transition-all shrink-0"
              >
                <Send className="w-4 h-4 rtl:-scale-x-100" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
