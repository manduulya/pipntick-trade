"use client";

import React, { useState, useRef, useEffect } from "react";
import type { CreateTradeInput, Trade } from "@pipntick/shared";
import { getContractSize } from "@pipntick/shared";
import { useTrades, useCreateTrade, useUpdateTrade, useDeleteTrade } from "../../../lib/hooks";
import { useSelectedAccount } from "../../../lib/account-context";
import { toJournalRow, type JournalRow } from "../../../lib/trade-utils";
import { ApiError } from "../../../lib/api";
import EmptyAccountsState from "../EmptyAccountsState";
import InstrumentInput from "../InstrumentInput";
import Toast from "../Toast";

type EntryMethod = "manual" | "screenshot";
type SortKey = "date" | "instrument" | "direction" | "pnl" | "duration";
type SortDir = "asc" | "desc";

const inputStyle: React.CSSProperties = {
  backgroundColor: "#05090f",
  border: "1px solid #1a2d4a",
  color: "#f0f0f0",
  borderRadius: 6,
  fontSize: 12,
  padding: "7px 10px",
  outline: "none",
  width: "100%",
};

function detectSession(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const mins = h * 60 + m;
  if (mins >= 480 && mins < 780) return "London";
  if (mins >= 780 && mins < 1020) return "London / New York";
  if (mins >= 1020 && mins < 1320) return "New York";
  if (mins >= 0 && mins < 540) return "Tokyo";
  return "Sydney";
}

function UploadZone({ accept, label, hint }: { accept: string; label: string; hint: string }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile]         = useState<File | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
        className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-all"
        style={{ border: `2px dashed ${dragging ? "#7bc13b" : "#1a2d4a"}`, backgroundColor: dragging ? "rgba(123,193,59,0.05)" : "#05090f", padding: "32px 16px" }}
      >
        <input type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: dragging ? "#7bc13b" : "#1a2d4a" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <p className="text-xs font-medium" style={{ color: dragging ? "#7bc13b" : "#8899aa" }}>{file ? file.name : label}</p>
        <p className="text-[10px]" style={{ color: "#4a5d70" }}>{hint}</p>
      </label>
      {file && (
        <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(123,193,59,0.08)", border: "1px solid rgba(123,193,59,0.2)" }}>
          <span className="text-[11px] truncate" style={{ color: "#a3e05a" }}>{file.name}</span>
          <button onClick={() => setFile(null)} className="ml-2 shrink-0 hover:opacity-60" style={{ color: "#4a5d70" }}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
      <button type="button" className="neon-btn w-full rounded-lg py-2 text-xs font-semibold" disabled={!file} style={{ opacity: file ? 1 : 0.4 }}>Upload & Parse</button>
    </div>
  );
}

function AnimatedContent({ method, children }: { method: EntryMethod; children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (innerRef.current) {
      setHeight(innerRef.current.scrollHeight);
    }
  }, [method]);

  return (
    <div
      style={{
        overflow: "hidden",
        height: height !== undefined ? height : "auto",
        transition: "height 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

// ISO -> "YYYY-MM-DDTHH:mm" (the <input type="datetime-local"> value shape). A plain slice,
// not a Date round-trip, so the stored UTC wall-clock digits are preserved as-is.
function toDatetimeLocal(iso: string | null): string {
  return iso ? iso.slice(0, 16) : "";
}

function ManualEntryForm({ trade, onDone, onSaved }: { trade?: Trade; onDone: () => void; onSaved: (message: string) => void }) {
  const isEdit = !!trade;
  const createTrade = useCreateTrade();
  const updateTrade = useUpdateTrade();
  const mutation = isEdit ? updateTrade : createTrade;

  const [direction, setDirection] = useState<"long" | "short">(trade?.direction ?? "long");
  const [symbol, setSymbol] = useState(trade?.symbol ?? "");
  const [entryPrice, setEntryPrice] = useState(trade?.entryPrice ?? "");
  const [exitPrice, setExitPrice] = useState(trade?.exitPrice ?? "");
  const [entryDateTime, setEntryDateTime] = useState(toDatetimeLocal(trade?.entryTime ?? null));
  const [exitDateTime, setExitDateTime] = useState(toDatetimeLocal(trade?.exitTime ?? null));
  const [lotSize, setLotSize] = useState(trade?.lotSize ?? "");
  const [swap, setSwap] = useState(trade?.swap ?? "");
  const [commission, setCommission] = useState(trade?.commission ?? "");
  const [notes, setNotes] = useState(trade?.notes ?? "");
  const [pnlOverride, setPnlOverride] = useState(trade?.pnlManual ?? false);
  const [manualPnl, setManualPnl] = useState(trade?.pnl ?? "");
  const session = detectSession(entryDateTime.slice(11, 16));

  const computedPnl =
    entryPrice !== "" && exitPrice !== "" && lotSize !== ""
      ? (direction === "long" ? Number(exitPrice) - Number(entryPrice) : Number(entryPrice) - Number(exitPrice)) *
          Number(lotSize) *
          getContractSize(symbol) +
        (swap !== "" ? Number(swap) : 0) +
        (commission !== "" ? Number(commission) : 0)
      : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol || !entryPrice || !lotSize || !entryDateTime) return;

    const input: CreateTradeInput = {
      symbol,
      direction,
      entryPrice: Number(entryPrice),
      lotSize: Number(lotSize),
      entryTime: new Date(`${entryDateTime}:00Z`).toISOString(),
      session: session || undefined,
      notes: notes || undefined,
    };
    if (exitPrice) input.exitPrice = Number(exitPrice);
    if (exitDateTime) input.exitTime = new Date(`${exitDateTime}:00Z`).toISOString();
    if (swap) input.swap = Number(swap);
    if (commission) input.commission = Number(commission);
    if (pnlOverride && manualPnl !== "") input.pnl = Number(manualPnl);

    if (isEdit) {
      updateTrade.mutate({ id: trade.id, input }, {
        onSuccess: () => { onSaved("Trade updated successfully"); onDone(); },
      });
    } else {
      createTrade.mutate(input, {
        onSuccess: () => { onSaved("Trade added successfully"); onDone(); },
      });
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <InstrumentInput value={symbol} onChange={setSymbol} style={inputStyle} />
      <div className="flex rounded-lg p-0.5 gap-0.5" style={{ backgroundColor: "#05090f", border: "1px solid #1a2d4a" }}>
        {(["long", "short"] as const).map((d) => (
          <button key={d} type="button" onClick={() => setDirection(d)} className="flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all"
            style={{
              backgroundColor: direction === d ? (d === "long" ? "rgba(123,193,59,0.2)" : "rgba(239,68,68,0.2)") : "transparent",
              color: direction === d ? (d === "long" ? "#a3e05a" : "#f87171") : "#4a5d70",
              border: direction === d ? `1px solid ${d === "long" ? "rgba(123,193,59,0.4)" : "rgba(239,68,68,0.4)"}` : "1px solid transparent",
            }}>
            {d === "long" ? "▲ Long" : "▼ Short"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "#4a5d70" }}>Entry Price</label><input type="number" step="any" placeholder="0.00" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} style={inputStyle} /></div>
        <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "#4a5d70" }}>Exit Price</label><input type="number" step="any" placeholder="0.00 (optional)" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} style={inputStyle} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "#4a5d70" }}>Entry Date & Time (UTC)</label><input type="datetime-local" value={entryDateTime} onChange={(e) => setEntryDateTime(e.target.value)} style={inputStyle} /></div>
        <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "#4a5d70" }}>Exit Date & Time (UTC)</label><input type="datetime-local" value={exitDateTime} onChange={(e) => setExitDateTime(e.target.value)} style={inputStyle} /></div>
      </div>
      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "#05090f", border: "1px solid #1a2d4a" }}>
        <span className="text-[10px]" style={{ color: "#4a5d70" }}>Session</span>
        <span className="text-[11px] font-semibold" style={{ color: session ? "#7bc13b" : "#2a3d55" }}>{session || "— enter entry time"}</span>
      </div>
      <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "#4a5d70" }}>Lot Size</label><input type="number" step="any" placeholder="0.01" value={lotSize} onChange={(e) => setLotSize(e.target.value)} style={inputStyle} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "#4a5d70" }}>Swap</label><input type="number" step="any" placeholder="0.00 (optional)" value={swap} onChange={(e) => setSwap(e.target.value)} style={inputStyle} /></div>
        <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "#4a5d70" }}>Commission / Charges</label><input type="number" step="any" placeholder="0.00 (optional)" value={commission} onChange={(e) => setCommission(e.target.value)} style={inputStyle} /></div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-[10px]" style={{ color: "#4a5d70" }}>P&L</label>
          <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{ color: "#4a5d70" }}>
            <input type="checkbox" checked={pnlOverride} onChange={(e) => setPnlOverride(e.target.checked)} className="cursor-pointer" />
            Override
          </label>
        </div>
        {pnlOverride ? (
          <input type="number" step="any" placeholder="0.00" value={manualPnl} onChange={(e) => setManualPnl(e.target.value)} style={inputStyle} />
        ) : (
          <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "#05090f", border: "1px solid #1a2d4a" }}>
            <span className="text-[10px]" style={{ color: "#4a5d70" }}>Auto-calculated</span>
            <span className="text-[11px] font-semibold" style={{ color: computedPnl === null ? "#2a3d55" : computedPnl >= 0 ? "#7bc13b" : "#f87171" }}>
              {computedPnl === null ? "— enter exit price" : `${computedPnl >= 0 ? "+" : ""}$${Math.abs(computedPnl).toFixed(2)}`}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "#4a5d70" }}>Notes</label><textarea placeholder="Trade notes, setup, emotions..." rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, resize: "none" }} /></div>
      {mutation.isError && (
        <p className="text-[11px]" style={{ color: "#f87171" }}>
          {mutation.error instanceof ApiError ? mutation.error.message : `Failed to ${isEdit ? "save" : "add"} trade.`}
        </p>
      )}
      <button type="submit" className="neon-btn w-full rounded-lg py-2.5 text-sm font-semibold" disabled={mutation.isPending} style={{ opacity: mutation.isPending ? 0.6 : 1 }}>
        {mutation.isPending ? (isEdit ? "Saving..." : "Adding...") : isEdit ? "Save Changes" : "Add Trade"}
      </button>
    </form>
  );
}

function AddTradeModal({ trade, onClose, onSaved }: { trade?: Trade; onClose: () => void; onSaved: (message: string) => void }) {
  const isEdit = !!trade;
  const [method, setMethod] = useState<EntryMethod>("manual");

  const tabs = [
    { id: "manual" as EntryMethod, label: "Manual", icon: <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
    { id: "screenshot" as EntryMethod, label: "Screenshot", icon: <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
  ];

  const [visible, setVisible] = useState(false);
  useState(() => { requestAnimationFrame(() => setVisible(true)); });

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: visible ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(4px)" : "blur(0px)",
        transition: "background-color 0.3s ease, backdrop-filter 0.3s ease",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: "#0b1220",
          border: "1px solid #1a2d4a",
          maxHeight: "90vh",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid #1a2d4a" }}>
          <h2 className="text-sm font-bold" style={{ color: "#f0f0f0" }}>{isEdit ? "Edit Trade" : "Add Trade"}</h2>
          <button onClick={handleClose} className="hover:opacity-60 transition-opacity" style={{ color: "#4a5d70" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        {!isEdit && (
        <div className="flex gap-0 px-5 pt-3 shrink-0">
          {tabs.map((tab) => {
            const active = method === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMethod(tab.id)}
                className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold transition-all rounded-t-lg"
                style={{
                  color: active ? "#f0f0f0" : "#4a5d70",
                  backgroundColor: active ? "#05090f" : "transparent",
                  borderTop: active ? "1px solid #1a2d4a" : "1px solid transparent",
                  borderLeft: active ? "1px solid #1a2d4a" : "1px solid transparent",
                  borderRight: active ? "1px solid #1a2d4a" : "1px solid transparent",
                  borderBottom: active ? "1px solid #05090f" : "1px solid transparent",
                  marginBottom: active ? "-1px" : "0",
                }}
              >
                <span style={{ color: active ? "#7bc13b" : "#4a5d70" }}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>
        )}
        {!isEdit && <div style={{ height: 1, backgroundColor: "#1a2d4a", flexShrink: 0 }} />}

        {/* Content — animated height */}
        <AnimatedContent method={isEdit ? "manual" : method}>
        <div className="p-5 flex flex-col gap-3">
          {(isEdit || method === "manual") && <ManualEntryForm trade={trade} onDone={handleClose} onSaved={onSaved} />}
          {!isEdit && method === "screenshot" && <UploadZone accept="image/*" label="Drop screenshot here or click to browse" hint="PNG, JPG, WEBP — AI will extract trade data" />}
        </div>
        </AnimatedContent>
      </div>
    </div>
  );
}

function DeleteTradeModal({ trade, onClose }: { trade: Trade; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useState(() => { requestAnimationFrame(() => setVisible(true)); });

  const [formError, setFormError] = useState<string | null>(null);
  const deleteTrade = useDeleteTrade();

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  function handleConfirm() {
    setFormError(null);
    deleteTrade.mutate(trade.id, {
      onSuccess: handleClose,
      onError: (err) => {
        setFormError(err instanceof ApiError ? err.message : "Failed to delete trade.");
      },
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: visible ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(4px)" : "blur(0px)",
        transition: "background-color 0.3s ease, backdrop-filter 0.3s ease",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: "#0b1220",
          border: "1px solid #e05252",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #1a2d4a" }}>
          <h2 className="text-sm font-bold" style={{ color: "#e05252" }}>Delete Trade</h2>
          <button onClick={handleClose} className="hover:opacity-60 transition-opacity" style={{ color: "#4a5d70" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <p className="text-xs leading-relaxed" style={{ color: "#8899aa" }}>
            Delete the <span style={{ color: "#f0f0f0" }}>{trade.symbol}</span> trade from {trade.entryTime.slice(0, 10)}?
            This cannot be undone.
          </p>

          {formError && (
            <p className="text-[11px]" style={{ color: "#e05252" }}>{formError}</p>
          )}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg text-xs font-semibold py-2.5"
              style={{ backgroundColor: "transparent", border: "1px solid #1a2d4a", color: "#8899aa" }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteTrade.isPending}
              onClick={handleConfirm}
              className="flex-1 rounded-lg text-xs font-semibold py-2.5 transition-opacity"
              style={{ backgroundColor: "#e05252", color: "#05090f", opacity: deleteTrade.isPending ? 0.6 : 1 }}
            >
              {deleteTrade.isPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const COLS: { label: string; key: SortKey | null }[] = [
  { label: "Date",       key: "date"       },
  { label: "Instrument", key: "instrument" },
  { label: "Direction",  key: "direction"  },
  { label: "Entry",      key: null         },
  { label: "Exit",       key: null         },
  { label: "Lot",        key: null         },
  { label: "Duration",   key: "duration"   },
  { label: "Session",    key: null         },
  { label: "P&L",        key: "pnl"        },
  { label: "Fees",       key: null         },
  { label: "Notes",      key: null         },
];

export default function JournalPage() {
  const { data, isLoading, isError, error } = useTrades();
  const { accounts } = useSelectedAccount();
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<"all" | "long" | "short" | "win" | "loss">("all");
  const [sortKey, setSortKey]   = useState<SortKey>("date");
  const [sortDir, setSortDir]   = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [deletingTrade, setDeletingTrade] = useState<Trade | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function handleSort(key: SortKey | null) {
    if (!key) return;
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const trades: JournalRow[] = (data ?? []).map(toJournalRow);

  const rows = trades
    .filter((t) => {
      const q = search.toLowerCase();
      const matchSearch = !q || t.instrument.toLowerCase().includes(q) || t.session.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q);
      const matchFilter =
        filter === "all"   ? true :
        filter === "long"  ? t.direction === "Long" :
        filter === "short" ? t.direction === "Short" :
        filter === "win"   ? (t.pnl ?? 0) > 0 :
        (t.pnl ?? 0) < 0;
      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      const mul = sortDir === "desc" ? -1 : 1;
      if (sortKey === "date")       return mul * a.date.localeCompare(b.date);
      if (sortKey === "instrument") return mul * a.instrument.localeCompare(b.instrument);
      if (sortKey === "direction")  return mul * a.direction.localeCompare(b.direction);
      if (sortKey === "pnl")        return mul * ((a.pnl ?? 0) - (b.pnl ?? 0));
      if (sortKey === "duration")   return mul * a.duration.localeCompare(b.duration);
      return 0;
    });

  const totalPnl = rows.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const wins     = rows.filter((t) => (t.pnl ?? 0) > 0).length;

  if (!isLoading && !isError && accounts.length === 0) {
    return <EmptyAccountsState />;
  }

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-hidden">
      {/* Header */}
      <div className="shrink-0">
        <h1 className="text-base font-bold" style={{ color: "#f0f0f0" }}>Journal</h1>
        <p className="text-xs mt-0.5" style={{ color: "#4a5d70" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#4a5d70" }}>
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search instrument, session, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 pr-3 py-1.5 text-xs rounded-lg outline-none"
            style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a", color: "#f0f0f0", width: 260 }}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}>
          {(["all", "long", "short", "win", "loss"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1 text-xs font-medium rounded-md capitalize"
              style={{
                backgroundColor: filter === f ? "#1a2d4a" : "transparent",
                color: filter === f ? "#f0f0f0" : "#4a5d70",
                cursor: "pointer",
                transition: "background-color 0.3s ease, color 0.3s ease",
              }}
              onMouseEnter={(e) => { if (filter !== f) { const el = e.currentTarget; el.style.backgroundColor = "rgba(255,255,255,0.05)"; el.style.color = "#8899aa"; } }}
              onMouseLeave={(e) => { if (filter !== f) { const el = e.currentTarget; el.style.backgroundColor = "transparent"; el.style.color = "#4a5d70"; } }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Add Trade */}
        <button
          onClick={() => setShowModal(true)}
          className="neon-btn flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Trade
        </button>

        {/* Summary */}
        <div className="ml-auto flex items-center gap-4">
          <span className="text-xs" style={{ color: "#4a5d70" }}>{rows.length} {rows.length === 1 ? "trade" : "trades"}</span>
          <span className="text-xs" style={{ color: "#4a5d70" }}>{rows.length ? Math.round((wins / rows.length) * 100) : 0}% win rate</span>
          <span className="text-xs font-semibold" style={{ color: totalPnl >= 0 ? "#a3e05a" : "#f87171" }}>
            {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toFixed(2)} total P&L
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 rounded-xl overflow-hidden min-h-0" style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}>
        <div className="overflow-y-auto h-full">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0" style={{ backgroundColor: "#0b1220", borderBottom: "1px solid #1a2d4a" }}>
              <tr>
                {COLS.map(({ label, key }) => (
                  <th
                    key={label}
                    onClick={() => handleSort(key)}
                    className="px-4 py-3 text-left font-medium"
                    style={{
                      color: key && sortKey === key ? "#7bc13b" : "#4a5d70",
                      cursor: key ? "pointer" : "default",
                      whiteSpace: "nowrap",
                      transition: "color 0.3s ease",
                    }}
                    onMouseEnter={(e) => { if (key && sortKey !== key) (e.currentTarget as HTMLTableCellElement).style.color = "#8899aa"; }}
                    onMouseLeave={(e) => { if (key && sortKey !== key) (e.currentTarget as HTMLTableCellElement).style.color = "#4a5d70"; }}
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      {key && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          {sortKey === key && sortDir === "asc"
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          }
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-xs" style={{ color: "#4a5d70" }}>Loading trades...</td></tr>
              )}
              {isError && (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-xs" style={{ color: "#f87171" }}>
                  {error instanceof ApiError ? error.message : "Failed to load trades."}
                </td></tr>
              )}
              {!isLoading && !isError && rows.map((t) => {
                const isWin = (t.pnl ?? 0) > 0;
                const isOpen = expanded === t.id;
                return (
                  <React.Fragment key={t.id}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : t.id)}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: "1px solid rgba(26,45,74,0.5)" }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "rgba(255,255,255,0.02)"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                    >
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#8899aa" }}>{t.date}</td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: "#f0f0f0" }}>{t.instrument}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className="px-2 py-0.5 rounded text-[11px] font-semibold"
                          style={{
                            backgroundColor: t.direction === "Long" ? "rgba(123,193,59,0.15)" : "rgba(239,68,68,0.15)",
                            color: t.direction === "Long" ? "#a3e05a" : "#f87171",
                          }}
                        >
                          {t.direction === "Long" ? "▲" : "▼"} {t.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#8899aa" }}>{t.entryPrice}</td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#8899aa" }}>{t.exitPrice ?? "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#8899aa" }}>{t.lotSize}</td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#8899aa" }}>{t.duration}</td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#8899aa" }}>{t.session}</td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: t.pnl === null ? "#4a5d70" : isWin ? "#a3e05a" : "#f87171" }}>
                        {t.pnl === null ? "open" : `${isWin ? "+" : ""}$${Math.abs(t.pnl).toFixed(2)}`}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: t.fees === null ? "#4a5d70" : t.fees < 0 ? "#f87171" : "#a3e05a" }}>
                        {t.fees === null ? "—" : `${t.fees >= 0 ? "+" : "-"}$${Math.abs(t.fees).toFixed(2)}`}
                      </td>
                      <td className="px-4 py-3 max-w-[180px] truncate" style={{ color: "#4a5d70" }}>{t.notes || "—"}</td>
                    </tr>
                    {isOpen && (
                      <tr style={{ backgroundColor: "rgba(123,193,59,0.03)", borderBottom: "1px solid rgba(26,45,74,0.5)" }}>
                        <td colSpan={11} className="px-6 py-3">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-xs" style={{ color: "#8899aa" }}>
                              <span className="font-semibold" style={{ color: "#f0f0f0" }}>Notes: </span>
                              {t.notes || "No notes for this trade."}
                            </p>
                            <div className="shrink-0 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const full = data?.find((d) => d.id === t.id);
                                  if (full) setEditingTrade(full);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80"
                                style={{ backgroundColor: "rgba(123,193,59,0.12)", border: "1px solid rgba(123,193,59,0.3)", color: "#a3e05a" }}
                              >
                                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const full = data?.find((d) => d.id === t.id);
                                  if (full) setDeletingTrade(full);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80"
                                style={{ backgroundColor: "rgba(224,82,82,0.1)", border: "1px solid rgba(224,82,82,0.3)", color: "#e05252" }}
                              >
                                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v13a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z" />
                                </svg>
                                Delete
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {!isLoading && !isError && rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-xs" style={{ color: "#4a5d70" }}>
                    No trades match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && <AddTradeModal onClose={() => setShowModal(false)} onSaved={setToast} />}
      {editingTrade && <AddTradeModal trade={editingTrade} onClose={() => setEditingTrade(null)} onSaved={setToast} />}
      {deletingTrade && <DeleteTradeModal trade={deletingTrade} onClose={() => setDeletingTrade(null)} />}
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
