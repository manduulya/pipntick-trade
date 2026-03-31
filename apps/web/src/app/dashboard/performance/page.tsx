"use client";

import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";

type Period = "weekly" | "monthly" | "yearly";

// ── Mock data per period ───────────────────────────────────────────────────────

const growthData: Record<Period, { label: string; value: number }[]> = {
  weekly: [
    { label: "Mon", value: 12000 }, { label: "Tue", value: 12180 },
    { label: "Wed", value: 12050 }, { label: "Thu", value: 12320 },
    { label: "Fri", value: 12450 },
  ],
  monthly: [
    { label: "Jan", value: 9800  }, { label: "Feb", value: 10200 },
    { label: "Mar", value: 9950  }, { label: "Apr", value: 10600 },
    { label: "May", value: 11200 }, { label: "Jun", value: 10900 },
    { label: "Jul", value: 11500 }, { label: "Aug", value: 11800 },
    { label: "Sep", value: 11400 }, { label: "Oct", value: 12000 },
    { label: "Nov", value: 11900 }, { label: "Dec", value: 12450 },
  ],
  yearly: [
    { label: "2022", value: 7200  }, { label: "2023", value: 9100  },
    { label: "2024", value: 10800 }, { label: "2025", value: 12450 },
  ],
};

const pnlData: Record<Period, { label: string; pnl: number }[]> = {
  weekly: [
    { label: "Mon", pnl:  245 }, { label: "Tue", pnl: -120 },
    { label: "Wed", pnl:  380 }, { label: "Thu", pnl:  175 },
    { label: "Fri", pnl: -88  },
  ],
  monthly: [
    { label: "Jan", pnl:  320 }, { label: "Feb", pnl: -150 },
    { label: "Mar", pnl:  510 }, { label: "Apr", pnl:  290 },
    { label: "May", pnl: -200 }, { label: "Jun", pnl:  440 },
    { label: "Jul", pnl:  615 }, { label: "Aug", pnl: -95  },
    { label: "Sep", pnl:  380 }, { label: "Oct", pnl:  520 },
    { label: "Nov", pnl: -110 }, { label: "Dec", pnl:  685 },
  ],
  yearly: [
    { label: "2022", pnl: 1200 }, { label: "2023", pnl: 1900 },
    { label: "2024", pnl: 1700 }, { label: "2025", pnl: 2450 },
  ],
};

type InstrumentRow = { symbol: string; trades: number; pnl: number; winRate: number };
const instrumentData: Record<Period, InstrumentRow[]> = {
  weekly: [
    { symbol: "EUR/USD", trades: 3, pnl:  245.50, winRate: 67 },
    { symbol: "NAS100",  trades: 2, pnl:  380.00, winRate: 100 },
    { symbol: "XAU/USD", trades: 2, pnl: -120.00, winRate: 50 },
    { symbol: "GBP/USD", trades: 1, pnl:   92.50, winRate: 100 },
    { symbol: "US30",    trades: 1, pnl:  -88.00, winRate: 0  },
  ],
  monthly: [
    { symbol: "EUR/USD", trades: 14, pnl:  1240.50, winRate: 71 },
    { symbol: "GBP/USD", trades:  9, pnl:   875.20, winRate: 67 },
    { symbol: "XAU/USD", trades:  8, pnl:  -320.00, winRate: 38 },
    { symbol: "NAS100",  trades:  7, pnl:  1580.00, winRate: 86 },
    { symbol: "US30",    trades:  5, pnl:   -95.40, winRate: 40 },
    { symbol: "USD/JPY", trades:  4, pnl:   532.00, winRate: 75 },
  ],
  yearly: [
    { symbol: "NAS100",  trades: 42, pnl:  4820.00, winRate: 83 },
    { symbol: "EUR/USD", trades: 38, pnl:  3240.50, winRate: 68 },
    { symbol: "GBP/USD", trades: 29, pnl:  2175.20, winRate: 62 },
    { symbol: "XAU/USD", trades: 24, pnl: -1120.00, winRate: 42 },
    { symbol: "USD/JPY", trades: 18, pnl:  1532.00, winRate: 72 },
    { symbol: "US30",    trades: 12, pnl:  -295.40, winRate: 42 },
  ],
};

type DirectionRow = { direction: string; trades: number; pnl: number; winRate: number; avgPnl: number };
const directionData: Record<Period, DirectionRow[]> = {
  weekly: [
    { direction: "Long",  trades: 6, pnl:  592.00, winRate: 67, avgPnl:  98.67 },
    { direction: "Short", trades: 3, pnl: -120.00, winRate: 33, avgPnl: -40.00 },
  ],
  monthly: [
    { direction: "Long",  trades: 29, pnl: 2840.50, winRate: 72, avgPnl:  97.95 },
    { direction: "Short", trades: 18, pnl:  971.80, winRate: 61, avgPnl:  53.99 },
  ],
  yearly: [
    { direction: "Long",  trades: 98, pnl:  9240.50, winRate: 71, avgPnl:  94.29 },
    { direction: "Short", trades: 65, pnl:  3171.80, winRate: 58, avgPnl:  48.80 },
  ],
};

type PeriodStats = {
  pnl: string; pnlPos: boolean;
  winRate: string; winRateSub: string;
  profitFactor: string;
  avgWin: string; avgLoss: string;
  trades: string; tradesSub: string;
  avgDuration: string; avgDurationSub: string;
};
const periodStats: Record<Period, PeriodStats> = {
  weekly: {
    pnl: "+$592.00", pnlPos: true,
    winRate: "67%", winRateSub: "6 wins / 3 losses",
    profitFactor: "1.84",
    avgWin: "+$180.50", avgLoss: "-$104.00",
    trades: "9", tradesSub: "this week",
    avgDuration: "1h 24m", avgDurationSub: "avg hold time",
  },
  monthly: {
    pnl: "+$3,812.30", pnlPos: true,
    winRate: "68.4%", winRateSub: "32 wins / 15 losses",
    profitFactor: "2.08",
    avgWin: "+$245.80", avgLoss: "-$118.40",
    trades: "47", tradesSub: "this month",
    avgDuration: "2h 08m", avgDurationSub: "avg hold time",
  },
  yearly: {
    pnl: "+$12,412.30", pnlPos: true,
    winRate: "69.3%", winRateSub: "115 wins / 51 losses",
    profitFactor: "2.41",
    avgWin: "+$261.20", avgLoss: "-$108.60",
    trades: "163", tradesSub: "this year",
    avgDuration: "1h 52m", avgDurationSub: "avg hold time",
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtPnl(pnl: number) {
  const abs = Math.abs(pnl);
  const str = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`;
  return pnl >= 0 ? `+${str}` : `-${str}`;
}

const tooltipStyle = {
  backgroundColor: "#0f1a2e",
  border: "1px solid #1a2d4a",
  borderRadius: 8,
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 600,
};

function PnlTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const color = val >= 0 ? "#a3e05a" : "#f87171";
  const sign  = val >= 0 ? "+" : "-";
  return (
    <div style={{ backgroundColor: "#0f1a2e", border: "1px solid #1a2d4a", borderRadius: 8, padding: "8px 12px" }}>
      <p style={{ color: "#ffffff", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600 }}>
        <span style={{ color: "#ffffff" }}>P&L: </span>
        <span style={{ color }}>{sign}${Math.abs(val).toLocaleString()}</span>
      </p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PerformancePage() {
  const [period, setPeriod] = useState<Period>("monthly");
  type SortKey = "symbol" | "trades" | "winRate" | "pnl";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const ps = periodStats[period];
  const instRows = [...instrumentData[period]].sort((a, b) => {
    const mul = sortDir === "desc" ? -1 : 1;
    if (sortKey === "symbol") return mul * a.symbol.localeCompare(b.symbol);
    return mul * (a[sortKey] - b[sortKey]);
  });
  const dirs    = directionData[period];
  const totalPnl = dirs[0].pnl + dirs[1].pnl;
  const longPct  = Math.round((dirs[0].pnl / totalPnl) * 100);
  const shortPct = 100 - longPct;

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-y-auto">

      {/* Header */}
      <div className="shrink-0">
        <h1 className="text-base font-bold" style={{ color: "#f0f0f0" }}>Performance</h1>
        <p className="text-xs mt-0.5" style={{ color: "#4a5d70" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Single global toggle — centered */}
      <div className="flex justify-center shrink-0">
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl" style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}>
          {(["weekly", "monthly", "yearly"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-8 py-2 text-sm font-semibold rounded-xl capitalize hover:text-white cursor-pointer"
              style={{
                backgroundColor: period === p ? "#7bc13b" : "transparent",
                color: period === p ? "#05090f" : "#8899aa",
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
                  el.style.color = "#8899aa";
                  el.style.boxShadow = "none";
                }
              }}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Period stats — fixed portfolio value first, then period-driven */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {/* Portfolio value — always fixed */}
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}>
          <p className="text-xs font-medium mb-1" style={{ color: "#4a5d70" }}>Portfolio Value</p>
          <p className="text-lg font-bold leading-tight" style={{ color: "#7bc13b" }}>$12,450.00</p>
          <p className="text-xs mt-0.5" style={{ color: "#4a5d70" }}>all time</p>
        </div>

        {[
          { label: "P&L",          value: ps.pnl,          sub: `${period} total`,       color: ps.pnlPos ? "#7bc13b" : "#ef4444" },
          { label: "Win Rate",     value: ps.winRate,       sub: ps.winRateSub,            color: "#7bc13b" },
          { label: "Profit Factor",value: ps.profitFactor,  sub: "gross profit / loss",   color: "#f0f0f0" },
          { label: "Avg Win",      value: ps.avgWin,        sub: "per winning trade",      color: "#7bc13b" },
          { label: "Avg Loss",     value: ps.avgLoss,       sub: "per losing trade",       color: "#ef4444" },
          { label: "Total Trades",       value: ps.trades,          sub: ps.tradesSub,          color: "#f0f0f0" },
          { label: "Avg Trade Duration", value: ps.avgDuration,     sub: ps.avgDurationSub,     color: "#f0f0f0" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl px-4 py-3" style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}>
            <p className="text-xs font-medium mb-1" style={{ color: "#4a5d70" }}>{s.label}</p>
            <p className="text-lg font-bold leading-tight" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "#4a5d70" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Portfolio Growth */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#f0f0f0" }}>Portfolio Growth</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={growthData[period]} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7bc13b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#7bc13b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#4a5d70", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#4a5d70", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={36} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#ffffff" }} itemStyle={{ color: "#a3e05a" }} formatter={(v) => [`$${Number(v).toLocaleString()}`, "Portfolio"]} cursor={{ stroke: "#1a2d4a" }} />
              <Area type="monotone" dataKey="value" stroke="#7bc13b" strokeWidth={2} fill="url(#growthGrad)" dot={false} activeDot={{ r: 4, fill: "#7bc13b", stroke: "#05090f", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* P&L Breakdown */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#f0f0f0" }}>P&L Breakdown</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pnlData[period]} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#4a5d70", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#4a5d70", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={40} />
              <Tooltip content={<PnlTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]} isAnimationActive>
                {pnlData[period].map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? "#7bc13b" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row: instruments + long/short */}
      <div className="grid grid-cols-2 gap-3">

        {/* Instruments */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "#f0f0f0" }}>Performance by Instrument</h2>
          <div className="grid grid-cols-4 pb-2 mb-1" style={{ borderBottom: "1px solid #1a2d4a" }}>
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
                  style={{ color: active ? "#7bc13b" : "#4a5d70", transition: "color 0.5s ease", cursor: "pointer" }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#8899aa"; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#4a5d70"; }}
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
              <span className="text-xs font-semibold" style={{ color: "#f0f0f0" }}>{row.symbol}</span>
              <span className="text-xs" style={{ color: "#8899aa" }}>{row.trades}</span>
              <div className="flex items-center gap-1.5">
                <div className="w-10 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#1a2d4a" }}>
                  <div className="h-full rounded-full" style={{ width: `${row.winRate}%`, backgroundColor: row.winRate >= 50 ? "#7bc13b" : "#ef4444" }} />
                </div>
                <span className="text-[10px]" style={{ color: "#8899aa" }}>{row.winRate}%</span>
              </div>
              <span className="text-xs font-semibold" style={{ color: row.pnl >= 0 ? "#a3e05a" : "#f87171" }}>
                {fmtPnl(row.pnl)}
              </span>
            </div>
          ))}
        </div>

        {/* Long vs Short */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "#f0f0f0" }}>Long vs Short</h2>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium" style={{ color: "#a3e05a" }}>Long {longPct}%</span>
              <span className="text-[10px] font-medium" style={{ color: "#f87171" }}>Short {shortPct}%</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden">
              <div style={{ width: `${longPct}%`, backgroundColor: "#7bc13b" }} />
              <div style={{ flex: 1, backgroundColor: "#ef4444" }} />
            </div>
          </div>

          {dirs.map((d) => {
            const isLong = d.direction === "Long";
            const color  = isLong ? "#a3e05a" : "#f87171";
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
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[9px]" style={{ color: "#4a5d70" }}>Trades</p>
                    <p className="text-xs font-semibold" style={{ color: "#f0f0f0" }}>{d.trades}</p>
                  </div>
                  <div>
                    <p className="text-[9px]" style={{ color: "#4a5d70" }}>Win Rate</p>
                    <p className="text-xs font-semibold" style={{ color: "#f0f0f0" }}>{d.winRate}%</p>
                  </div>
                  <div>
                    <p className="text-[9px]" style={{ color: "#4a5d70" }}>Avg P&L</p>
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
