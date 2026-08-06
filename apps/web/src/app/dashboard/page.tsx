"use client";

import { useMemo, useState } from "react";
import type { CreateTradeInput, ParsedTradeScreenshot } from "@pipntick/shared";
import { useCreateTrade, useParseTradeScreenshot, useTrades } from "../../lib/hooks";
import { useSelectedAccount } from "../../lib/account-context";
import { computeDashboardStats, computeMonthCalendar, isClosed } from "../../lib/trade-utils";
import { ApiError } from "../../lib/api";
import EmptyAccountsState from "./EmptyAccountsState";
import InstrumentInput from "./InstrumentInput";
import Toast from "./Toast";

function fmtPnl(pnl: number) {
  const str = `$${Math.abs(pnl).toFixed(2)}`;
  return pnl >= 0 ? `+${str}` : `-${str}`;
}

// ── Calendar ───────────────────────────────────────────────────────────────────

function MonthlyCalendar({
  calendar,
  offset,
  onOffsetChange,
  accountCreatedAt,
}: {
  calendar: Record<number, { trades: number; pnl: number }>;
  offset: number;
  onOffsetChange: (updater: (o: number) => number) => void;
  accountCreatedAt: string;
}) {
  const now = new Date();

  const viewed      = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year        = viewed.getFullYear();
  const month       = viewed.getMonth();
  const monthName   = viewed.toLocaleString("default", { month: "long" });
  const firstDay    = viewed.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isCurrentMonth = offset === 0;
  const today       = isCurrentMonth ? now.getDate() : -1;

  // accountCreatedAt is stored as a UTC-midnight instant for a calendar day (see AccountSettingsModal),
  // so its calendar day must be read with UTC getters — local getters would shift it a day in
  // timezones behind UTC, since e.g. "2026-06-23T00:00:00Z" is still "2026-06-22" in local time there.
  const created      = new Date(accountCreatedAt);
  const createdYear  = created.getUTCFullYear();
  const createdMonth = created.getUTCMonth();
  const createdDay   = created.getUTCDate();
  const canGoPrev    = year > createdYear || (year === createdYear && month > createdMonth);

  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => canGoPrev && onOffsetChange((o) => o - 1)}
            disabled={!canGoPrev}
            className="p-0.5 rounded hover:opacity-70 cursor-pointer disabled:cursor-not-allowed disabled:hover:opacity-100"
            style={{ color: canGoPrev ? "#8899aa" : "#2a3d55" }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xs font-semibold" style={{ color: "#f0f0f0" }}>{monthName} {year}</h2>
          <button onClick={() => onOffsetChange((o) => o + 1)} className="p-0.5 rounded hover:opacity-70 cursor-pointer" style={{ color: "#8899aa" }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#7bc13b" }} />
            <span className="text-[10px]" style={{ color: "#4a5d70" }}>Profit</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#ef4444" }} />
            <span className="text-[10px]" style={{ color: "#4a5d70" }}>Loss</span>
          </div>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-[10px] font-medium pb-1" style={{ color: "#4a5d70" }}>{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`b-${i}`} />;

          const isBeforeCreation =
            year < createdYear || (year === createdYear && (month < createdMonth || (month === createdMonth && day < createdDay)));
          const data    = !isBeforeCreation ? calendar[day] : undefined;
          const isWin   = data && data.pnl > 0;
          const isLoss  = data && data.pnl < 0;
          const isToday = day === today;

          const bg       = isWin  ? "rgba(123,193,59,0.18)" : isLoss ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.03)";
          const border   = isWin  ? "1px solid rgba(123,193,59,0.55)" : isLoss ? "1px solid rgba(239,68,68,0.55)" : "1px solid rgba(255,255,255,0.05)";
          const pnlColor = isWin  ? "#a3e05a" : isLoss ? "#f87171" : "#4a5d70";

          return (
            <div
              key={day}
              className={`flex flex-col px-1 pt-1 pb-1 rounded-md transition-opacity ${isBeforeCreation ? "cursor-not-allowed" : "cursor-pointer hover:opacity-80"}`}
              style={{
                width: 108, height: 108,
                backgroundColor: isBeforeCreation ? "rgba(255,255,255,0.015)" : bg,
                border: isBeforeCreation ? "1px solid rgba(255,255,255,0.03)" : border,
                opacity: isBeforeCreation ? 0.4 : 1,
                outline: isToday ? "1.5px solid #00d4ff" : "none",
                boxShadow: isToday ? "0 0 8px rgba(0,212,255,0.4), inset 0 0 8px rgba(0,212,255,0.05)" : undefined,
                outlineOffset: "1px",
              }}
            >
              <span className="text-sm font-bold leading-none" style={{ color: "#2a3d55" }}>{day}</span>
              {data && (
                <>
                  <span className="text-sm font-bold mt-auto leading-none" style={{ color: pnlColor }}>{fmtPnl(data.pnl)}</span>
                  <span className="text-[11px] font-semibold leading-none mt-1" style={{ color: "#f0f0f0" }}>{data.trades} {data.trades === 1 ? "trade" : "trades"}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Trade Entry Panel ──────────────────────────────────────────────────────────

type EntryMethod = "manual" | "screenshot";

const entryTabs: { id: EntryMethod; label: string; icon: React.ReactNode }[] = [
  {
    id: "manual",
    label: "Manual",
    icon: (
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    id: "screenshot",
    label: "Screenshot",
    icon: (
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

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
  if (mins >= 480 && mins < 780)  return "London";
  if (mins >= 780 && mins < 1020) return "London / New York";
  if (mins >= 1020 && mins < 1320) return "New York";
  if (mins >= 0   && mins < 540)  return "Tokyo";
  return "Sydney";
}

// ISO-like "YYYY-MM-DDTHH:mm:ss" -> "YYYY-MM-DDTHH:mm" (the <input type="datetime-local"> value
// shape). A plain slice, not a Date round-trip, so the UTC wall-clock digits are preserved as-is.
function toDatetimeLocal(value: string | null | undefined): string {
  return value ? value.slice(0, 16) : "";
}

function ManualEntry({ prefill }: { prefill?: ParsedTradeScreenshot | null }) {
  const createTrade = useCreateTrade();

  const [direction, setDirection] = useState<"long" | "short">(prefill?.direction ?? "long");
  const [symbol, setSymbol] = useState(prefill?.symbol ?? "");
  const [entryPrice, setEntryPrice] = useState(prefill?.entryPrice != null ? String(prefill.entryPrice) : "");
  const [exitPrice, setExitPrice] = useState(prefill?.exitPrice != null ? String(prefill.exitPrice) : "");
  const [entryDateTime, setEntryDateTime] = useState(toDatetimeLocal(prefill?.entryDateTime));
  const [exitDateTime, setExitDateTime] = useState(toDatetimeLocal(prefill?.exitDateTime));
  const [lotSize, setLotSize] = useState(prefill?.lotSize != null ? String(prefill.lotSize) : "");
  const [swap, setSwap] = useState(prefill?.swap != null ? String(prefill.swap) : "");
  const [commission, setCommission] = useState(prefill?.commission != null ? String(prefill.commission) : "");
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const session = detectSession(entryDateTime.slice(11, 16));

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

    createTrade.mutate(input, {
      onSuccess: () => {
        setSymbol(""); setEntryPrice(""); setExitPrice("");
        setEntryDateTime(""); setExitDateTime(""); setLotSize("");
        setSwap(""); setCommission(""); setNotes("");
        setToast("Trade added successfully");
      },
    });
  }

  return (
    <form className="flex flex-col gap-2.5" onSubmit={handleSubmit}>
      <Toast message={toast} onDismiss={() => setToast(null)} />
      <InstrumentInput value={symbol} onChange={setSymbol} style={inputStyle} />

      <div className="flex rounded-lg p-0.5 gap-0.5" style={{ backgroundColor: "#05090f", border: "1px solid #1a2d4a" }}>
        {(["long", "short"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className="flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all"
            style={{
              backgroundColor: direction === d ? (d === "long" ? "rgba(123,193,59,0.2)" : "rgba(239,68,68,0.2)") : "transparent",
              color: direction === d ? (d === "long" ? "#a3e05a" : "#f87171") : "#4a5d70",
              border: direction === d ? `1px solid ${d === "long" ? "rgba(123,193,59,0.4)" : "rgba(239,68,68,0.4)"}` : "1px solid transparent",
            }}
          >
            {d === "long" ? "▲ Long" : "▼ Short"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px]" style={{ color: "#4a5d70" }}>Entry Price</label>
          <input type="number" step="any" placeholder="0.00" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px]" style={{ color: "#4a5d70" }}>Exit Price</label>
          <input type="number" step="any" placeholder="0.00 (optional)" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px]" style={{ color: "#4a5d70" }}>Entry Date & Time (UTC)</label>
          <input
            type="datetime-local"
            value={entryDateTime}
            onChange={(e) => setEntryDateTime(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px]" style={{ color: "#4a5d70" }}>Exit Date & Time (UTC)</label>
          <input type="datetime-local" value={exitDateTime} onChange={(e) => setExitDateTime(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {/* Auto-detected session */}
      <div
        className="flex items-center justify-between rounded-lg px-3 py-2"
        style={{ backgroundColor: "#05090f", border: "1px solid #1a2d4a" }}
      >
        <span className="text-[10px]" style={{ color: "#4a5d70" }}>Session</span>
        <span
          className="text-[11px] font-semibold"
          style={{ color: session ? "#7bc13b" : "#2a3d55" }}
        >
          {session || "— enter entry time"}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px]" style={{ color: "#4a5d70" }}>Lot Size</label>
        <input type="number" step="any" placeholder="0.01" value={lotSize} onChange={(e) => setLotSize(e.target.value)} style={inputStyle} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px]" style={{ color: "#4a5d70" }}>Swap</label>
          <input type="number" step="any" placeholder="0.00 (optional)" value={swap} onChange={(e) => setSwap(e.target.value)} style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px]" style={{ color: "#4a5d70" }}>Commission / Charges</label>
          <input type="number" step="any" placeholder="0.00 (optional)" value={commission} onChange={(e) => setCommission(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px]" style={{ color: "#4a5d70" }}>Notes</label>
        <textarea placeholder="Trade notes, setup, emotions..." rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, resize: "none" }} />
      </div>

      {createTrade.isError && (
        <p className="text-[11px]" style={{ color: "#f87171" }}>
          {createTrade.error instanceof ApiError ? createTrade.error.message : "Failed to add trade."}
        </p>
      )}

      <button type="submit" className="neon-btn w-full rounded-lg py-2 text-xs font-semibold" disabled={createTrade.isPending} style={{ opacity: createTrade.isPending ? 0.6 : 1 }}>
        {createTrade.isPending ? "Adding..." : "Add Trade"}
      </button>
    </form>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function UploadZone({
  accept,
  label,
  hint,
  onParsed,
}: {
  accept: string;
  label: string;
  hint: string;
  onParsed?: (parsed: ParsedTradeScreenshot) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile]         = useState<File | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const parseScreenshot = useParseTradeScreenshot();

  async function handleUpload() {
    if (!file || !onParsed) return;
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const parsed = await parseScreenshot.mutateAsync(dataUrl);
      onParsed(parsed);
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to analyze screenshot.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) setFile(f);
        }}
        className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-all"
        style={{
          border: `2px dashed ${dragging ? "#7bc13b" : "#1a2d4a"}`,
          backgroundColor: dragging ? "rgba(123,193,59,0.05)" : "#05090f",
          padding: "32px 16px",
        }}
      >
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }}
        />
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: dragging ? "#7bc13b" : "#1a2d4a" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <p className="text-xs font-medium" style={{ color: dragging ? "#7bc13b" : "#8899aa" }}>
          {file ? file.name : label}
        </p>
        <p className="text-[10px]" style={{ color: "#4a5d70" }}>{hint}</p>
      </label>

      {file && (
        <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(123,193,59,0.08)", border: "1px solid rgba(123,193,59,0.2)" }}>
          <span className="text-[11px] truncate" style={{ color: "#a3e05a" }}>{file.name}</span>
          <button onClick={() => setFile(null)} className="ml-2 shrink-0 hover:opacity-60" style={{ color: "#4a5d70" }}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {error && (
        <p className="text-[11px]" style={{ color: "#f87171" }}>{error}</p>
      )}

      <button
        type="button"
        onClick={handleUpload}
        className="neon-btn w-full rounded-lg py-2 text-xs font-semibold"
        disabled={!file || !onParsed || parseScreenshot.isPending}
        style={{ opacity: file && onParsed ? 1 : 0.4 }}
      >
        {parseScreenshot.isPending ? "Analyzing..." : "Upload & Parse"}
      </button>
    </div>
  );
}

function TradeEntryPanel() {
  const [method, setMethod] = useState<EntryMethod>("manual");
  const [prefill, setPrefill] = useState<ParsedTradeScreenshot | null>(null);
  const [prefillKey, setPrefillKey] = useState(0);

  function handleParsed(parsed: ParsedTradeScreenshot) {
    setPrefill(parsed);
    setPrefillKey((k) => k + 1);
    setMethod("manual");
  }

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden" style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}>
      {/* Header */}
      <div className="shrink-0 px-3 pt-3">
        <h2 className="text-sm font-bold" style={{ color: "#f0f0f0" }}>Add Trade</h2>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex gap-0 px-3 pt-2 pb-0">
        {entryTabs.map((tab) => {
          const active = method === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setMethod(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-lg"
              style={{
                color: active ? "#f0f0f0" : "#4a5d70",
                backgroundColor: active ? "#05090f" : "transparent",
                borderTop: active ? "1px solid #1a2d4a" : "1px solid transparent",
                borderLeft: active ? "1px solid #1a2d4a" : "1px solid transparent",
                borderRight: active ? "1px solid #1a2d4a" : "1px solid transparent",
                borderBottom: active ? "1px solid #05090f" : "1px solid transparent",
                marginBottom: active ? "-1px" : "0",
                cursor: "pointer",
                transition: "color 0.3s ease, background-color 0.3s ease",
              }}
              onMouseEnter={(e) => { if (!active) { const el = e.currentTarget; el.style.color = "#8899aa"; el.style.backgroundColor = "rgba(255,255,255,0.03)"; } }}
              onMouseLeave={(e) => { if (!active) { const el = e.currentTarget; el.style.color = "#4a5d70"; el.style.backgroundColor = "transparent"; } }}
            >
              <span style={{ color: active ? "#7bc13b" : "#4a5d70" }}>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: "#1a2d4a", flexShrink: 0 }} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {method === "manual"     && <ManualEntry key={prefillKey} prefill={prefill} />}
        {method === "screenshot" && (
          <UploadZone
            accept="image/*"
            label="Drop screenshot here or click to browse"
            hint="PNG, JPG, WEBP — trade data is read from the image"
            onParsed={handleParsed}
          />
        )}
      </div>
    </div>
  );
}


// ── Dashboard Page ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: trades, isLoading, isError, error } = useTrades();
  const { accounts, selectedAccount } = useSelectedAccount();
  const startingBalance = selectedAccount ? Number(selectedAccount.startingBalance) : 0;

  const [calendarOffset, setCalendarOffset] = useState(0);

  const closed = useMemo(() => (trades ?? []).filter(isClosed), [trades]);
  const dashboardStats = useMemo(() => computeDashboardStats(closed), [closed]);
  const portfolioValue = startingBalance + dashboardStats.totalPnl;

  const now = new Date();
  const viewed = new Date(now.getFullYear(), now.getMonth() + calendarOffset, 1);
  const calendar = useMemo(
    () => computeMonthCalendar(trades ?? [], viewed.getFullYear(), viewed.getMonth()),
    [trades, viewed],
  );

  const stats = [
    { label: "Total Portfolio", value: `$${portfolioValue.toFixed(2)}`, sub: "starting balance + all-time P&L", positive: dashboardStats.totalPnl >= 0 },
    { label: "Total P&L",       value: `${dashboardStats.totalPnl >= 0 ? "+" : ""}$${Math.abs(dashboardStats.totalPnl).toFixed(2)}`, sub: "all time", positive: dashboardStats.totalPnl >= 0 },
    { label: "Win Rate",        value: `${dashboardStats.winRate}%`, sub: `${closed.length} closed trades`, positive: dashboardStats.winRate >= 50 },
    { label: "Total Trades",    value: String(dashboardStats.totalTrades), sub: `${dashboardStats.tradesThisMonth} this month`, positive: null as boolean | null },
  ];

  if (isLoading) {
    return <div className="h-full flex items-center justify-center text-xs" style={{ color: "#4a5d70" }}>Loading dashboard...</div>;
  }
  if (isError) {
    return (
      <div className="h-full flex items-center justify-center text-xs" style={{ color: "#f87171" }}>
        {error instanceof ApiError ? error.message : "Failed to load dashboard data."}
      </div>
    );
  }
  if (accounts.length === 0) {
    return <EmptyAccountsState />;
  }

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-hidden">
      {/* Header */}
      <div className="shrink-0">
        <h1 className="text-base font-bold" style={{ color: "#f0f0f0" }}>Dashboard</h1>
        <p className="text-xs mt-0.5" style={{ color: "#4a5d70" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl px-4 py-3" style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}>
            <p className="text-[10px] font-medium mb-1" style={{ color: "#4a5d70" }}>{s.label}</p>
            <p className="text-lg font-bold leading-tight" style={{ color: s.positive === true ? "#7bc13b" : s.positive === false ? "#ef4444" : "#f0f0f0" }}>
              {s.value}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "#4a5d70" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Main: calendar | entry panel */}
      <div className="flex gap-3 shrink-0">
        <div style={{ width: 800 }}>
          <MonthlyCalendar
            calendar={calendar}
            offset={calendarOffset}
            onOffsetChange={setCalendarOffset}
            accountCreatedAt={selectedAccount?.createdAt ?? new Date(0).toISOString()}
          />
        </div>
        <div className="flex-1" style={{ minWidth: 260 }}>
          <TradeEntryPanel />
        </div>
      </div>

    </div>
  );
}
