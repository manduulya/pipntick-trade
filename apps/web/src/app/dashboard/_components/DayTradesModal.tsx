"use client";

import { useState } from "react";
import type { Trade } from "@pipntick/shared";
import { toJournalRow } from "../../../lib/trade-utils";
import { useTimeFormat } from "../../../lib/time-format-context";
import { formatDate, formatDateTime } from "../../../lib/time-format";
import { TradeForm } from "./TradeForm";
import DeleteTradeModal from "./DeleteTradeModal";
import Toast from "../Toast";
import { useLockBodyScroll } from "../../../lib/use-lock-body-scroll";

// Opened from a MonthlyCalendar day cell that has trades recorded — same journal-style detail
// fields as the Journal table/expanded row, just scoped to one day instead of the whole account.
// Edit/Delete reuse the same shared TradeForm and DeleteTradeModal Journal uses, so both stay in
// sync automatically (React Query invalidation on mutate refreshes the `trades` this list was
// filtered from, which flows back in as a new `trades` prop).
export default function DayTradesModal({
  trades,
  year,
  month,
  day,
  onClose,
}: {
  trades: Trade[];
  year: number;
  month: number;
  day: number;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useState(() => { requestAnimationFrame(() => setVisible(true)); });
  useLockBodyScroll();

  const { timeFormat } = useTimeFormat();
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [deletingTrade, setDeletingTrade] = useState<Trade | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const dateLabel = formatDate(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, timeFormat);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: visible ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(4px)" : "blur(0px)",
        transition: "background-color 0.3s ease, backdrop-filter 0.3s ease",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          maxHeight: "85vh",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>{dateLabel}</h2>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              {trades.length} {trades.length === 1 ? "trade" : "trades"}
            </p>
          </div>
          <button onClick={handleClose} className="hover:opacity-60 transition-opacity" style={{ color: "var(--color-text-muted)" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-3">
          <Toast message={toast} onDismiss={() => setToast(null)} />
          {trades.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: "var(--color-text-muted)" }}>No trades left for this day.</p>
          ) : (
            trades.map((t) => {
              const row = toJournalRow(t);
              const isWin = row.pnl !== null && row.pnl >= 0;
              return (
                <div key={t.id} className="rounded-xl p-3" style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold truncate" style={{ color: "var(--color-text-primary)" }}>{row.instrument}</span>
                      <span
                        className="shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold"
                        style={{
                          backgroundColor: row.direction === "Long" ? "rgba(123,193,59,0.15)" : "rgba(239,68,68,0.15)",
                          color: row.direction === "Long" ? "var(--color-green-neon)" : "var(--color-danger)",
                        }}
                      >
                        {row.direction === "Long" ? "▲" : "▼"} {row.direction}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-bold" style={{ color: row.pnl === null ? "var(--color-text-muted)" : isWin ? "var(--color-green-neon)" : "var(--color-danger)" }}>
                      {row.pnl === null ? "open" : `${isWin ? "+" : ""}$${Math.abs(row.pnl).toFixed(2)}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-[11px] mb-2">
                    <div><span style={{ color: "var(--color-text-muted)" }}>Entry: </span><span style={{ color: "var(--color-text-secondary)" }}>{row.entryPrice}</span></div>
                    <div><span style={{ color: "var(--color-text-muted)" }}>Exit: </span><span style={{ color: "var(--color-text-secondary)" }}>{row.exitPrice ?? "—"}</span></div>
                    <div><span style={{ color: "var(--color-text-muted)" }}>Lot size: </span><span style={{ color: "var(--color-text-secondary)" }}>{row.lotSize}</span></div>
                    <div><span style={{ color: "var(--color-text-muted)" }}>Entry time: </span><span style={{ color: "var(--color-text-secondary)" }}>{formatDateTime(t.entryTime.slice(0, 16), timeFormat)}</span></div>
                    <div><span style={{ color: "var(--color-text-muted)" }}>Exit time: </span><span style={{ color: "var(--color-text-secondary)" }}>{t.exitTime ? formatDateTime(t.exitTime.slice(0, 16), timeFormat) : "—"}</span></div>
                    <div><span style={{ color: "var(--color-text-muted)" }}>Duration: </span><span style={{ color: "var(--color-text-secondary)" }}>{row.duration}</span></div>
                    <div><span style={{ color: "var(--color-text-muted)" }}>Session: </span><span style={{ color: "var(--color-text-secondary)" }}>{row.session}</span></div>
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>Fees: </span>
                      <span style={{ color: row.fees === null ? "var(--color-text-secondary)" : row.fees < 0 ? "var(--color-danger)" : "var(--color-green-neon)" }}>
                        {row.fees === null ? "—" : `${row.fees >= 0 ? "+" : "-"}$${Math.abs(row.fees).toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  {row.notes && (
                    <p className="text-[11px] mb-2" style={{ color: "var(--color-text-secondary)" }}>
                      <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>Notes: </span>
                      {row.notes}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingTrade(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80"
                      style={{ backgroundColor: "rgba(123,193,59,0.12)", border: "1px solid rgba(123,193,59,0.3)", color: "var(--color-green-neon)" }}
                    >
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingTrade(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80"
                      style={{ backgroundColor: "rgba(224,82,82,0.1)", border: "1px solid rgba(224,82,82,0.3)", color: "var(--color-danger)" }}
                    >
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {editingTrade && <EditTradeModal trade={editingTrade} onClose={() => setEditingTrade(null)} onSaved={setToast} />}
      {deletingTrade && <DeleteTradeModal trade={deletingTrade} onClose={() => setDeletingTrade(null)} onSaved={setToast} />}
    </div>
  );
}

// Editing never needs the Manual/Screenshot tabs Journal's AddTradeModal has (those only apply to
// a fresh create), so this is a much smaller purpose-built wrapper around the shared TradeForm
// rather than reusing that tabbed modal here.
function EditTradeModal({ trade, onClose, onSaved }: { trade: Trade; onClose: () => void; onSaved: (message: string) => void }) {
  const [visible, setVisible] = useState(false);
  useState(() => { requestAnimationFrame(() => setVisible(true)); });

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: visible ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(4px)" : "blur(0px)",
        transition: "background-color 0.3s ease, backdrop-filter 0.3s ease",
      }}
      // Deliberately no click-outside-to-close: this form holds a lot of manually entered data,
      // so an accidental backdrop click shouldn't discard it. Close is via the × button only.
    >
      <div
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
          <h2 className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Edit Trade</h2>
          <button onClick={handleClose} className="hover:opacity-60 transition-opacity" style={{ color: "var(--color-text-muted)" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <TradeForm trade={trade} onDone={handleClose} onSaved={onSaved} />
        </div>
      </div>
    </div>
  );
}
