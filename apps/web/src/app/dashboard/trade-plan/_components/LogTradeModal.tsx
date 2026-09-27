"use client";

import { useEffect, useState } from "react";
import type { ParsedTradeScreenshot, TradePlan } from "@pipntick/shared";
import { TradeForm } from "../../_components/TradeForm";
import { useUpdatePlan } from "../../../../lib/hooks";
import { useLockBodyScroll } from "../../../../lib/use-lock-body-scroll";
import { toJournalSymbol } from "../../../../lib/trade-plan-utils";
import { CURATED_INSTRUMENTS } from "../../../../lib/instruments";

const KNOWN_SYMBOLS = CURATED_INSTRUMENTS.map((i) => i.symbol);

// "Log to Journal" from a Trade Plan tile: the regular Add Trade form, prefilled with the plan's
// symbol and direction. Once the trade is created the plan is marked Logged and linked to it via
// journalTradeId. Closing without saving leaves the plan Planned. Same modal chrome as Journal's
// AddTradeModal (no click-outside-to-close, since the form holds manually entered data).
export default function LogTradeModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: TradePlan;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const updatePlan = useUpdatePlan();
  const [visible, setVisible] = useState(false);
  useLockBodyScroll();

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  const prefill: ParsedTradeScreenshot = {
    symbol: plan.symbol ? toJournalSymbol(plan.symbol, KNOWN_SYMBOLS) : null,
    direction: plan.direction,
    entryPrice: null,
    exitPrice: null,
    lotSize: null,
    entryDateTime: null,
    exitDateTime: null,
    pnl: null,
    swap: null,
    commission: null,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: visible ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(4px)" : "blur(0px)",
        transition: "background-color 0.3s ease, backdrop-filter 0.3s ease",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Log trade to Journal"
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          maxHeight: "90vh",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="flex flex-col">
            <h2 className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Log to Journal</h2>
            <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              {plan.symbol || "New plan"} · {plan.direction === "long" ? "Long" : "Short"}
              {plan.grade ? ` · Grade ${plan.grade}` : ""}
            </span>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close" className="hover:opacity-60 transition-opacity" style={{ color: "var(--color-text-muted)" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <TradeForm
            prefill={prefill}
            onCreated={(trade) =>
              updatePlan.mutate({
                next: { ...plan, status: "logged", journalTradeId: trade.id },
                input: { status: "logged", journalTradeId: trade.id },
              })
            }
            onSaved={onSaved}
            onDone={handleClose}
          />
        </div>
      </div>
    </div>
  );
}
