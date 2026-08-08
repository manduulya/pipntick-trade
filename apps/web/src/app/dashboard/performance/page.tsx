"use client";

import { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import { useTrades } from "../../../lib/hooks";
import { useSelectedAccount } from "../../../lib/account-context";
import {
  computeCharts, computeDirectionRows, computeInstrumentRows, computePeriodStats,
  filterByPeriod, isClosed, periodLabel, periodOffsetFor, type Period,
} from "../../../lib/trade-utils";
import { ApiError } from "../../../lib/api";
import { useTheme } from "../../../lib/theme-context";
import { CHART_PALETTES } from "../../../lib/theme-colors";
import EmptyAccountsState from "../EmptyAccountsState";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtPnl(pnl: number) {
  const str = `$${Math.abs(pnl).toFixed(2)}`;
  return pnl >= 0 ? `+${str}` : `-${str}`;
}

function fmtAxisDollar(v: number) {
  const abs = Math.abs(v);
  const str = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${Math.round(abs)}`;
  return v < 0 ? `-${str}` : str;
}

// Renders as a plain HTML div (Recharts overlays the tooltip outside the SVG canvas), so
// var(--x) resolves normally here — unlike the chart primitives below, this doesn't need
// CHART_PALETTES.
const tooltipStyle = {
  backgroundColor: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-text-primary)",
  fontSize: 13,
  fontWeight: 600,
};

function PnlTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const color = val >= 0 ? "var(--color-green-primary)" : "var(--color-danger)";
  const sign  = val >= 0 ? "+" : "-";
  return (
    <div style={{ backgroundColor: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 12px" }}>
      <p style={{ color: "var(--color-text-primary)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600 }}>
        <span style={{ color: "var(--color-text-primary)" }}>P&L: </span>
        <span style={{ color }}>{sign}${Math.abs(val).toLocaleString()}</span>
      </p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PerformancePage() {
  const { data: trades, isLoading, isError, error } = useTrades();
  const { accounts, selectedAccount } = useSelectedAccount();
  const startingBalance = selectedAccount ? Number(selectedAccount.startingBalance) : 0;
  // Chart primitives below render as literal SVG attributes (stroke="...", fill="..."), which
  // don't resolve CSS custom properties the way a normal DOM `style` prop does — chartColors is
  // the theme-aware literal-hex source of truth for exactly those props. Everything else on this
  // page uses var(--x) directly.
  const { theme } = useTheme();
  const chartColors = CHART_PALETTES[theme];

  const [period, setPeriod] = useState<Period>("monthly");
  const [offset, setOffset] = useState(0);
  type SortKey = "symbol" | "trades" | "winRate" | "pnl";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    setOffset(0);
  }

  // Can't page back further than the period the account was created in, or forward past "now".
  const maxOffset = selectedAccount ? periodOffsetFor(period, new Date(selectedAccount.createdAt)) : 0;
  const canGoBack = offset < maxOffset;
  const canGoForward = offset > 0;

  const allClosed = useMemo(() => (trades ?? []).filter(isClosed), [trades]);
  const closed = useMemo(() => filterByPeriod(allClosed, period, offset), [allClosed, period, offset]);
  const ps = useMemo(() => computePeriodStats(closed, period, offset), [closed, period, offset]);
  const instRows = useMemo(() => {
    const rows = computeInstrumentRows(closed);
    return rows.sort((a, b) => {
      const mul = sortDir === "desc" ? -1 : 1;
      if (sortKey === "symbol") return mul * a.symbol.localeCompare(b.symbol);
      return mul * (a[sortKey] - b[sortKey]);
    });
  }, [closed, sortKey, sortDir]);
  const dirs = useMemo(() => computeDirectionRows(closed), [closed]);
  const { growthData, pnlData } = useMemo(
    () => computeCharts(allClosed, period, startingBalance, offset),
    [allClosed, period, startingBalance, offset],
  );

  const totalDirPnl = dirs[0].pnl + dirs[1].pnl;
  const longPct  = totalDirPnl !== 0 ? Math.round((dirs[0].pnl / totalDirPnl) * 100) : 50;
  const shortPct = 100 - longPct;
  const portfolioValue = startingBalance + (trades ?? []).filter(isClosed).reduce((s, t) => s + Number(t.pnl), 0);

  if (isLoading) {
    return <div className="h-full flex items-center justify-center text-xs" style={{ color: "var(--color-text-muted)" }}>Loading performance...</div>;
  }
  if (isError) {
    return (
      <div className="h-full flex items-center justify-center text-xs" style={{ color: "var(--color-danger)" }}>
        {error instanceof ApiError ? error.message : "Failed to load performance data."}
      </div>
    );
  }
  if (accounts.length === 0) {
    return <EmptyAccountsState />;
  }

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-y-auto">

      {/* Header */}
      <div className="shrink-0">
        <h1 className="text-base font-bold" style={{ color: "var(--color-text-primary)" }}>Performance</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Single global toggle — centered */}
      <div className="flex justify-center shrink-0">
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl" style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
          {(["weekly", "monthly", "yearly"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className="px-8 py-2 text-sm font-semibold rounded-xl capitalize hover:text-white cursor-pointer"
              style={{
                backgroundColor: period === p ? "var(--color-green-primary)" : "transparent",
                color: period === p ? "var(--color-bg-base)" : "var(--color-text-secondary)",
                boxShadow: period === p ? "0 0 16px rgba(123,193,59,0.35)" : "none",
                transition: "background-color 0.5s ease, color 0.5s ease, box-shadow 0.5s ease",
              }}
              onMouseEnter={(e) => {
                if (period !== p) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.backgroundColor = "rgba(123,193,59,0.2)";
                  el.style.color = "#d4f0a0";
                  el.style.boxShadow = "0 0 12px rgba(123,193,59,0.15)";
                }
              }}
              onMouseLeave={(e) => {
                if (period !== p) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.backgroundColor = "transparent";
                  el.style.color = "var(--color-text-secondary)";
                  el.style.boxShadow = "none";
                }
              }}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Period navigation — back to account creation, forward to the current period */}
      <div className="flex items-center justify-center gap-3 shrink-0">
        <button
          onClick={() => canGoBack && setOffset((o) => o + 1)}
          disabled={!canGoBack}
          className="p-1 rounded hover:opacity-70 cursor-pointer disabled:cursor-not-allowed disabled:hover:opacity-100"
          style={{ color: canGoBack ? "var(--color-text-secondary)" : "var(--color-text-disabled)" }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-xs font-semibold min-w-[140px] text-center" style={{ color: "var(--color-text-primary)" }}>
          {periodLabel(period, offset)}
        </span>
        <button
          onClick={() => canGoForward && setOffset((o) => o - 1)}
          disabled={!canGoForward}
          className="p-1 rounded hover:opacity-70 cursor-pointer disabled:cursor-not-allowed disabled:hover:opacity-100"
          style={{ color: canGoForward ? "var(--color-text-secondary)" : "var(--color-text-disabled)" }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Period stats — fixed portfolio value first, then period-driven */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {/* Portfolio value — always fixed */}
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
          <p className="text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>Portfolio Value</p>
          <p className="text-lg font-bold leading-tight" style={{ color: "var(--color-green-primary)" }}>${portfolioValue.toFixed(2)}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>all time</p>
        </div>

        {[
          { label: "P&L",          value: ps.pnl,          sub: `${period} total`,       color: ps.pnlPos ? "var(--color-green-primary)" : "var(--color-danger)" },
          { label: "Win Rate",     value: ps.winRate,       sub: ps.winRateSub,            color: "var(--color-green-primary)" },
          { label: "Profit Factor",value: ps.profitFactor,  sub: "gross profit / loss",   color: "var(--color-text-primary)" },
          { label: "Avg Win",      value: ps.avgWin,        sub: "per winning trade",      color: "var(--color-green-primary)" },
          { label: "Avg Loss",     value: ps.avgLoss,       sub: "per losing trade",       color: "var(--color-danger)" },
          { label: "Total Trades",       value: ps.trades,          sub: ps.tradesSub,          color: "var(--color-text-primary)" },
          { label: "Avg Trade Duration", value: ps.avgDuration,     sub: ps.avgDurationSub,     color: "var(--color-text-primary)" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl px-4 py-3" style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>{s.label}</p>
            <p className="text-lg font-bold leading-tight" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Portfolio Growth */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>Portfolio Growth</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={growthData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={chartColors.areaStroke} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={chartColors.areaStroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: chartColors.axisTick, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: chartColors.axisTick, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={fmtAxisDollar} width={36} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--color-text-primary)" }} itemStyle={{ color: "var(--color-green-primary)" }} formatter={(v) => [v == null ? "—" : `$${Number(v).toLocaleString()}`, "Portfolio"]} cursor={{ stroke: chartColors.gridStroke }} />
              <Area type="monotone" dataKey="value" stroke={chartColors.areaStroke} strokeWidth={2} fill="url(#growthGrad)" dot={false} activeDot={{ r: 4, fill: chartColors.areaStroke, stroke: chartColors.areaActiveDotStroke, strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* P&L Breakdown */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>P&L Breakdown</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pnlData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: chartColors.axisTick, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: chartColors.axisTick, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={40} />
              <Tooltip content={<PnlTooltip />} cursor={{ fill: chartColors.barCursorFill }} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]} isAnimationActive>
                {pnlData.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? chartColors.positive : chartColors.negative} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row: instruments + long/short */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Instruments */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>Performance by Instrument</h2>
          {/* Same density problem as the journal table (a 4-column grid mimicking a data table) —
              scroll horizontally below its min-width instead of cramming columns. */}
          <div className="overflow-x-auto">
          <div className="min-w-[480px]">
          <div className="grid grid-cols-4 pb-2 mb-1" style={{ borderBottom: "1px solid var(--color-border)" }}>
            {([
              { label: "Symbol",   key: "symbol"  },
              { label: "Trades",   key: "trades"  },
              { label: "Win Rate", key: "winRate" },
              { label: "P&L",      key: "pnl"     },
            ] as { label: string; key: SortKey }[]).map(({ label, key }) => {
              const active = sortKey === key;
              return (
                <button
                  key={key}
                  onClick={() => handleSort(key)}
                  className="flex items-center gap-1 text-xs font-medium text-left"
                  style={{ color: active ? "var(--color-green-primary)" : "var(--color-text-muted)", transition: "color 0.5s ease", cursor: "pointer" }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-secondary)"; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; }}
                >
                  {label}
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    {active && sortDir === "asc"
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    }
                  </svg>
                </button>
              );
            })}
          </div>
          {instRows.map((row) => (
            <div key={row.symbol} className="grid grid-cols-4 py-2" style={{ borderBottom: "1px solid rgba(26,45,74,0.5)" }}>
              <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>{row.symbol}</span>
              <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{row.trades}</span>
              <div className="flex items-center gap-1.5">
                <div className="w-10 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-border)" }}>
                  <div className="h-full rounded-full" style={{ width: `${row.winRate}%`, backgroundColor: row.winRate >= 50 ? "var(--color-green-primary)" : "var(--color-danger)" }} />
                </div>
                <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>{row.winRate}%</span>
              </div>
              <span className="text-xs font-semibold" style={{ color: row.pnl >= 0 ? "var(--color-green-primary)" : "var(--color-danger)" }}>
                {fmtPnl(row.pnl)}
              </span>
            </div>
          ))}
          </div>
          </div>
          {instRows.length === 0 && (
            <p className="text-xs py-6 text-center" style={{ color: "var(--color-text-muted)" }}>No closed trades in this period yet.</p>
          )}
        </div>

        {/* Long vs Short */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>Long vs Short</h2>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium" style={{ color: "var(--color-green-primary)" }}>Long {longPct}%</span>
              <span className="text-[10px] font-medium" style={{ color: "var(--color-danger)" }}>Short {shortPct}%</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden">
              <div style={{ width: `${longPct}%`, backgroundColor: "var(--color-green-primary)" }} />
              <div style={{ flex: 1, backgroundColor: "var(--color-danger)" }} />
            </div>
          </div>

          {dirs.map((d) => {
            const isLong = d.direction === "Long";
            const color  = isLong ? "var(--color-green-primary)" : "var(--color-danger)";
            return (
              <div
                key={d.direction}
                className="rounded-xl p-3 mb-2"
                style={{
                  backgroundColor: isLong ? "rgba(123,193,59,0.06)" : "rgba(239,68,68,0.06)",
                  border: isLong ? "1px solid rgba(123,193,59,0.2)" : "1px solid rgba(239,68,68,0.2)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold" style={{ color }}>
                    {isLong ? "▲" : "▼"} {d.direction}
                  </span>
                  <span className="text-sm font-bold" style={{ color }}>{fmtPnl(d.pnl)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <p className="text-[9px]" style={{ color: "var(--color-text-muted)" }}>Trades</p>
                    <p className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>{d.trades}</p>
                  </div>
                  <div>
                    <p className="text-[9px]" style={{ color: "var(--color-text-muted)" }}>Win Rate</p>
                    <p className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>{d.winRate}%</p>
                  </div>
                  <div>
                    <p className="text-[9px]" style={{ color: "var(--color-text-muted)" }}>Avg P&L</p>
                    <p className="text-xs font-semibold" style={{ color }}>{fmtPnl(d.avgPnl)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
