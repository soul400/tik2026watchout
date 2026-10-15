"use client";

import { useEffect, useState } from "react";
import { useSupportPrivacy } from "@/context/SupportPrivacyContext";

interface DigitalCounterProps {
  value: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  color?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  isSupportNumber?: boolean;
}

export function DigitalCounter({
  value,
  durationMs = 800,
  prefix = "",
  suffix = "",
  color = "text-white",
  className = "",
  size = "md",
  isSupportNumber = false,
}: DigitalCounterProps) {
  const { hideSupportNumbers } = useSupportPrivacy();
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = displayValue;
    const endValue = value;

    if (startValue === endValue) return;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
      const current = Math.floor(startValue + (endValue - startValue) * easeProgress);

      setDisplayValue(current);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };

    window.requestAnimationFrame(step);
  }, [value, durationMs]);

  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
    xl: "text-4xl",
  };

  if (isSupportNumber && hideSupportNumbers) {
    return (
      <span
        title="أرقام الدعم مخفية لحماية الخصوصية (انقر زر العين بالأعلى للإظهار)"
        className={`digital-counter font-mono font-bold tracking-widest inline-flex items-baseline ${sizeClasses[size]} ${color} ${className}`}
      >
        {prefix && <span className="text-xs font-normal opacity-70 ml-1">{prefix}</span>}
        <span className="tracking-widest">••••••</span>
        {suffix && <span className="text-xs font-normal opacity-70 mr-1">{suffix}</span>}
      </span>
    );
  }

  return (
    <span
      className={`digital-counter font-bold tracking-tight inline-flex items-baseline ${sizeClasses[size]} ${color} ${className}`}
    >
      {prefix && <span className="text-xs font-normal opacity-70 ml-1">{prefix}</span>}
      <span>{displayValue.toLocaleString()}</span>
      {suffix && <span className="text-xs font-normal opacity-70 mr-1">{suffix}</span>}
    </span>
  );
}
