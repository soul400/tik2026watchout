"use client";

import React from "react";
import { useSupportPrivacy } from "@/context/SupportPrivacyContext";
import { Lock } from "lucide-react";

interface SupportValueProps {
  value: number | string;
  suffix?: string;
  prefix?: string;
  className?: string;
  showLockIcon?: boolean;
}

export function SupportValue({
  value,
  suffix = "",
  prefix = "",
  className = "",
  showLockIcon = false,
}: SupportValueProps) {
  const { hideSupportNumbers } = useSupportPrivacy();

  const formattedNum =
    typeof value === "number"
      ? value.toLocaleString()
      : isNaN(Number(value))
      ? value
      : Number(value).toLocaleString();

  if (hideSupportNumbers) {
    return (
      <span
        title="أرقام الدعم مخفية لحماية الخصوصية (انقر زر العين بالأعلى للإظهار)"
        className={`inline-flex items-center gap-1 font-mono tracking-wider select-none opacity-80 ${className}`}
      >
        {prefix && <span className="opacity-70 text-xs ml-0.5">{prefix}</span>}
        <span className="text-secondaryText bg-white/5 px-2 py-0.5 rounded border border-white/10 font-bold tracking-widest text-[0.85em]">
          ••••••
        </span>
        {suffix && <span className="text-xs opacity-70 mr-0.5">{suffix}</span>}
        {showLockIcon && <Lock className="w-3 h-3 text-amber-400 opacity-80" />}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-baseline ${className}`}>
      {prefix && <span className="opacity-70 text-xs ml-0.5">{prefix}</span>}
      <span>{formattedNum}</span>
      {suffix && <span className="text-xs opacity-70 mr-0.5">{suffix}</span>}
    </span>
  );
}
