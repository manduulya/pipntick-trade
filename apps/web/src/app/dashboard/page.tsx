"use client";

import { useMemo, useState } from "react";
import type { ParsedTradeScreenshot, Trade } from "@pipntick/shared";
import { useParseTradeScreenshot, useTrades } from "../../lib/hooks";
import { useSelectedAccount } from "../../lib/account-context";
import { computeDashboardStats, computeMonthCalendar, isClosed, utcWallClock } from "../../lib/trade-utils";
import { ApiError } from "../../lib/api";
import { useTheme } from "../../lib/theme-context";
import EmptyAccountsState from "./EmptyAccountsState";
import Toast from "./Toast";
import { TradeForm, type EntryMethod, entryTabs } from "./_components/TradeForm";
import DayTradesModal from "./_components/DayTradesModal";

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
  onDayClick,
}: {
  calendar: Record<number, { trades: number; pnl: number }>;
  offset: number;
  onOffsetChange: (updater: (o: number) => number) => void;
  accountCreatedAt: string;
  /** Only called for days that actually have trades — empty days aren't clickable. */
  onDayClick: (year: number, month: number, day: number) => void;
}) {
  const { theme } = useTheme();
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
    <div className="rounded-xl p-3" style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => canGoPrev && onOffsetChange((o) => o - 1)}
            disabled={!canGoPrev}
            className="p-0.5 rounded hover:opacity-70 cursor-pointer disabled:cursor-not-allowed disabled:hover:opacity-100"
            style={{ color: canGoPrev ? "var(--color-text-secondary)" : "var(--color-text-disabled)" }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>{monthName} {year}</h2>
          <button onClick={() => onOffsetChange((o) => o + 1)} className="p-0.5 rounded hover:opacity-70 cursor-pointer" style={{ color: "var(--color-text-secondary)" }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "var(--color-green-primary)" }} />
            <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Profit</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "var(--color-danger)" }} />
            <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Loss</span>
          </div>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-[10px] font-medium pb-1" style={{ color: "var(--color-text-muted)" }}>{d}</div>
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

          // Neutral/disabled cells were a low-opacity WHITE overlay — invisible by design against
          // a dark background, but that means literally invisible against light mode's light
          // background instead of faint. Flip the overlay color (not just opacity) per theme so
          // it stays a visible tint either way.
          const overlay = theme === "light" ? "0,0,0" : "255,255,255";
          const bg       = isWin  ? "rgba(123,193,59,0.18)" : isLoss ? "rgba(239,68,68,0.18)" : `rgba(${overlay},0.05)`;
          const border   = isWin  ? "1px solid rgba(123,193,59,0.55)" : isLoss ? "1px solid rgba(239,68,68,0.55)" : `1px solid rgba(${overlay},0.1)`;
          const pnlColor = isWin  ? "var(--color-green-neon)" : isLoss ? "var(--color-danger)" : "var(--color-text-muted)";

          const clickable = !!data;

          return (
            <button
              key={day}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onDayClick(year, month, day)}
              className={`flex flex-col px-1 pt-1 pb-1 rounded-md transition-opacity aspect-square text-left ${isBeforeCreation ? "cursor-not-allowed" : clickable ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
              style={{
                backgroundColor: isBeforeCreation ? `rgba(${overlay},0.03)` : bg,
                border: isBeforeCreation ? `1px solid rgba(${overlay},0.06)` : border,
                opacity: isBeforeCreation ? 0.4 : 1,
                outline: isToday ? "1.5px solid #00d4ff" : "none",
                boxShadow: isToday ? "0 0 8px rgba(0,212,255,0.4), inset 0 0 8px rgba(0,212,255,0.05)" : undefined,
                outlineOffset: "1px",
              }}
            >
              <span className="text-[11px] sm:text-sm font-bold leading-none" style={{ color: "var(--color-text-disabled)" }}>{day}</span>
              {data && (
                <>
                  <span className="text-[11px] sm:text-sm font-bold mt-auto leading-none truncate" style={{ color: pnlColor }}>{fmtPnl(data.pnl)}</span>
                  <span className="text-[9px] sm:text-[11px] font-semibold leading-none mt-1 truncate" style={{ color: "var(--color-text-primary)" }}>{data.trades} {data.trades === 1 ? "trade" : "trades"}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Trade Entry Panel ──────────────────────────────────────────────────────────

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
          border: `2px dashed ${dragging ? "var(--color-green-primary)" : "var(--color-border)"}`,
          backgroundColor: dragging ? "rgba(123,193,59,0.05)" : "var(--color-bg-base)",
          padding: "32px 16px",
        }}
      >
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }}
        />
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: dragging ? "var(--color-green-primary)" : "var(--color-border)" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <p className="text-xs font-medium" style={{ color: dragging ? "var(--color-green-primary)" : "var(--color-text-secondary)" }}>
          {file ? file.name : label}
        </p>
        <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{hint}</p>
      </label>

      {file && (
        <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(123,193,59,0.08)", border: "1px solid rgba(123,193,59,0.2)" }}>
          <span className="text-[11px] truncate" style={{ color: "var(--color-green-neon)" }}>{file.name}</span>
          <button onClick={() => setFile(null)} className="ml-2 shrink-0 hover:opacity-60" style={{ color: "var(--color-text-muted)" }}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {error && (
        <p className="text-[11px]" style={{ color: "var(--color-danger)" }}>{error}</p>
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

function TradeEntryPanel({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => void }) {
  const { theme } = useTheme();
  // White-tint hover overlay only reads as a highlight against a dark surface — flip to a dark
  // tint in light mode, where it'd otherwise be invisible.
  const hoverOverlay = theme === "light" ? "0,0,0" : "255,255,255";
  const [method, setMethod] = useState<EntryMethod>("manual");
  const [prefill, setPrefill] = useState<ParsedTradeScreenshot | null>(null);
  const [prefillKey, setPrefillKey] = useState(0);

  function handleParsed(parsed: ParsedTradeScreenshot) {
    setPrefill(parsed);
    setPrefillKey((k) => k + 1);
    setMethod("manual");
  }

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden" style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 flex items-center justify-between">
        <h2 className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Add Trade</h2>
        <button onClick={onClose} className="hover:opacity-60 transition-opacity" style={{ color: "var(--color-text-muted)" }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
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
                color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
                backgroundColor: active ? "var(--color-bg-base)" : "transparent",
                borderTop: active ? "1px solid var(--color-border)" : "1px solid transparent",
                borderLeft: active ? "1px solid var(--color-border)" : "1px solid transparent",
                borderRight: active ? "1px solid var(--color-border)" : "1px solid transparent",
                borderBottom: active ? "1px solid var(--color-bg-base)" : "1px solid transparent",
                marginBottom: active ? "-1px" : "0",
                cursor: "pointer",
                transition: "color 0.3s ease, background-color 0.3s ease",
              }}
              onMouseEnter={(e) => { if (!active) { const el = e.currentTarget; el.style.color = "var(--color-text-secondary)"; el.style.backgroundColor = `rgba(${hoverOverlay},0.03)`; } }}
              onMouseLeave={(e) => { if (!active) { const el = e.currentTarget; el.style.color = "var(--color-text-muted)"; el.style.backgroundColor = "transparent"; } }}
            >
              <span style={{ color: active ? "var(--color-green-primary)" : "var(--color-text-muted)" }}>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: "var(--color-border)", flexShrink: 0 }} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {method === "manual"     && <TradeForm key={prefillKey} prefill={prefill} onSaved={onSaved} onDone={onClose} />}
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

// Wraps TradeEntryPanel as a modal — same fade+scale transition shape as every other modal in
// the app (AddAccountModal etc.). Used at every breakpoint; there's no inline desktop variant.
function AddTradeModal({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => void }) {
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
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full max-w-md"
        style={{
          height: "80vh",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        <TradeEntryPanel onClose={handleClose} onSaved={onSaved} />
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
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{ year: number; month: number; day: number } | null>(null);
  // Owned here rather than inside AddTradeModal/TradeEntryPanel: the modal closes itself the
  // moment a trade is saved now, so a toast living inside it would unmount along with it before
  // its own 3s auto-dismiss timer ever finished — same "lift state to survive the modal" pattern
  // Journal already uses.
  const [toast, setToast] = useState<string | null>(null);

  const closed = useMemo(() => (trades ?? []).filter(isClosed), [trades]);
  const dashboardStats = useMemo(() => computeDashboardStats(closed), [closed]);
  const portfolioValue = startingBalance + dashboardStats.totalPnl;

  const now = new Date();
  const viewed = new Date(now.getFullYear(), now.getMonth() + calendarOffset, 1);
  const calendar = useMemo(
    () => computeMonthCalendar(trades ?? [], viewed.getFullYear(), viewed.getMonth()),
    [trades, viewed],
  );

  // Same bucketing rule as computeMonthCalendar (UTC wall-clock day, closed trades only) so this
  // list always matches the count shown on the calendar tile that opened it.
  const selectedDayTrades = useMemo<Trade[]>(() => {
    if (!selectedDay) return [];
    return (trades ?? []).filter((t) => {
      if (t.pnl === null) return false;
      const d = utcWallClock(t.entryTime);
      return d.getFullYear() === selectedDay.year && d.getMonth() === selectedDay.month && d.getDate() === selectedDay.day;
    });
  }, [trades, selectedDay]);

  const stats = [
    { label: "Total Portfolio", value: `$${portfolioValue.toFixed(2)}`, sub: "starting balance + all-time P&L", positive: dashboardStats.totalPnl >= 0 },
    { label: "Total P&L",       value: `${dashboardStats.totalPnl >= 0 ? "+" : ""}$${Math.abs(dashboardStats.totalPnl).toFixed(2)}`, sub: "all time", positive: dashboardStats.totalPnl >= 0 },
    { label: "Win Rate",        value: `${dashboardStats.winRate}%`, sub: `${closed.length} closed trades`, positive: dashboardStats.winRate >= 50 },
    { label: "Total Trades",    value: String(dashboardStats.totalTrades), sub: `${dashboardStats.tradesThisMonth} this month`, positive: null as boolean | null },
  ];

  if (isLoading) {
    return <div className="h-full flex items-center justify-center text-xs" style={{ color: "var(--color-text-muted)" }}>Loading dashboard...</div>;
  }
  if (isError) {
    return (
      <div className="h-full flex items-center justify-center text-xs" style={{ color: "var(--color-danger)" }}>
        {error instanceof ApiError ? error.message : "Failed to load dashboard data."}
      </div>
    );
  }
  if (accounts.length === 0) {
    return <EmptyAccountsState />;
  }

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-y-auto">
      {/* Header. QuoteBar floats top-right at lg+ (dashboard/layout.tsx) and owns that corner, so
          Add Trade can't sit flush against the page's right edge there — instead it's inline
          right after the title at lg+, and only moves to the row's right side (opposite the
          title+date block) below lg, where QuoteBar doesn't float and there's no collision. */}
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-3 lg:justify-start">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold" style={{ color: "var(--color-text-primary)" }}>Dashboard</h1>
            <button
              type="button"
              onClick={() => setShowAddTrade(true)}
              className="neon-btn hidden lg:flex shrink-0 items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
            >
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Trade
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowAddTrade(true)}
            className="neon-btn lg:hidden shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold"
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Trade
          </button>
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl px-4 py-3" style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
            <p className="text-[10px] font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>{s.label}</p>
            <p className="text-lg font-bold leading-tight" style={{ color: s.positive === true ? "var(--color-green-primary)" : s.positive === false ? "var(--color-danger)" : "var(--color-text-primary)" }}>
              {s.value}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Calendar — Add Trade (header, above) now opens as a modal at every breakpoint, rather
          than eating half this row as a permanently inline panel. */}
      <div className="w-full lg:max-w-[800px] shrink-0">
        <MonthlyCalendar
          calendar={calendar}
          offset={calendarOffset}
          onOffsetChange={setCalendarOffset}
          accountCreatedAt={selectedAccount?.createdAt ?? new Date(0).toISOString()}
          onDayClick={(year, month, day) => setSelectedDay({ year, month, day })}
        />
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
      {showAddTrade && <AddTradeModal onClose={() => setShowAddTrade(false)} onSaved={setToast} />}
      {selectedDay && (
        <DayTradesModal
          trades={selectedDayTrades}
          year={selectedDay.year}
          month={selectedDay.month}
          day={selectedDay.day}
          onClose={() => setSelectedDay(null)}
        />
      )}

    </div>
  );
}
