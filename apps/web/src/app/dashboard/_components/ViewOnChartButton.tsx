"use client";

import { useRouter } from "next/navigation";

// Opens a trade in Trade Review (/dashboard/review). View-only, so it's shown even for archived
// (read-only) accounts. Used by the Journal's expanded row and the calendar day view.
export default function ViewOnChartButton({ tradeId, onNavigate }: { tradeId: string; onNavigate?: () => void }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onNavigate?.();
        router.push(`/dashboard/review?trade=${tradeId}`);
      }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80"
      style={{ backgroundColor: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.3)", color: "#22d3ee" }}
    >
      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v3M7 17v3M17 7v3M17 18v2" />
        <rect x="5" y="7" width="4" height="10" rx="1" />
        <rect x="15" y="10" width="4" height="8" rx="1" />
      </svg>
      View on chart
    </button>
  );
}
