import { Info } from "lucide-react";
import { DataConfidenceLedger } from "@/lib/confidence-ledger";

interface Props {
  state: "VERIFIED" | "PARTIAL" | "ESTIMATED" | "OUTDATED" | "INSUFFICIENT_DATA";
  methodology?: string;
}

export function ConfidenceBadge({ state, methodology }: Props) {
  const badge = DataConfidenceLedger.getConfidenceBadge(state);

  return (
    <div
      title={methodology || badge.label}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${badge.color} cursor-help transition-all`}
    >
      <Info className="w-3 h-3 shrink-0" />
      <span>{badge.label}</span>
    </div>
  );
}
