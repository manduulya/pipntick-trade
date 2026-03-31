"use client";

import { useState } from "react";

// ── Mock data ──────────────────────────────────────────────────────────────────

const stats = [
  { label: "Total Portfolio", value: "$12,450.00", sub: "+$1,234.50 this month", positive: true  },
  { label: "Total P&L",       value: "+$3,812.30",  sub: "+44.2% all time",       positive: true  },
  { label: "Win Rate",        value: "68.4%",        sub: "32 wins / 15 losses",  positive: true  },
  { label: "Total Trades",    value: "47",           sub: "12 this month",        positive: null  },
];

type DayData = { trades: number; pnl: number };
const tradeCalendar: Record<number, DayData> = {
  1:  { trades: 3, pnl:  245.50 },  2:  { trades: 2, pnl: -120.00 },
  5:  { trades: 4, pnl:  380.00 },  6:  { trades: 1, pnl:   92.50 },
  8:  { trades: 3, pnl: -215.00 },  9:  { trades: 2, pnl:  175.00 },
  12: { trades: 5, pnl:  620.00 }, 13:  { trades: 2, pnl:  -88.50 },
  15: { trades: 3, pnl:  310.00 }, 16:  { trades: 4, pnl:  445.00 },
  19: { trades: 2, pnl: -165.00 }, 20:  { trades: 3, pnl:  290.00 },
  22: { trades: 1, pnl:   55.00 }, 26:  { trades: 4, pnl:  510.00 },
  27: { trades: 2, pnl:  -95.00 }, 29:  { trades: 3, pnl:  225.00 },
};


function fmtPnl(pnl: number) {
  const abs = Math.abs(pnl);
  const str = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`;
  return pnl >= 0 ? `+${str}` : `-${str}`;
}

// ── Calendar ───────────────────────────────────────────────────────────────────

function MonthlyCalendar() {
  const now   = new Date();
  const [offset, setOffset] = useState(0);

  const viewed      = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year        = viewed.getFullYear();
  const month       = viewed.getMonth();
  const monthName   = viewed.toLocaleString("default", { month: "long" });
  const firstDay    = viewed.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isCurrentMonth = offset === 0;
  const today       = isCurrentMonth ? now.getDate() : -1;

  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset((o) => o - 1)} className="p-0.5 rounded hover:opacity-70 cursor-pointer" style={{ color: "#8899aa" }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xs font-semibold" style={{ color: "#f0f0f0" }}>{monthName} {year}</h2>
          <button onClick={() => setOffset((o) => o + 1)} className="p-0.5 rounded hover:opacity-70 cursor-pointer" style={{ color: "#8899aa" }}>
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

          const data    = isCurrentMonth ? tradeCalendar[day] : undefined;
          const isWin   = data && data.pnl > 0;
          const isLoss  = data && data.pnl < 0;
          const isToday = day === today;

          const bg       = isWin  ? "rgba(123,193,59,0.18)" : isLoss ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.03)";
          const border   = isWin  ? "1px solid rgba(123,193,59,0.55)" : isLoss ? "1px solid rgba(239,68,68,0.55)" : "1px solid rgba(255,255,255,0.05)";
          const pnlColor = isWin  ? "#a3e05a" : isLoss ? "#f87171" : "#4a5d70";

          return (
            <div
              key={day}
              className="flex flex-col px-1 pt-1 pb-1 rounded-md cursor-pointer transition-opacity hover:opacity-80"
              style={{
                width: 108, height: 108,
                backgroundColor: bg, border,
                outline: isToday ? "1.5px solid #00d4ff" : "none",
                boxShadow: isToday ? "0 0 8px rgba(0,212,255,0.4), inset 0 0 8px rgba(0,212,255,0.05)" : undefined,
                outlineOffset: "1px",
              }}
            >
              <span className="text-sm font-bold leading-none" style={{ color: "#2a3d55" }}>{day}</span>
              {data && (
                <>
                  <span className="text-sm font-bold mt-auto leading-none" style={{ color: pnlColor }}>{fmtPnl(data.pnl)}</span>
                  <span className="text-[11px] font-semibold leading-none mt-1" style={{ color: "#f0f0f0" }}>{data.trades} trades</span>
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

type EntryMethod = "manual" | "screenshot" | "csv";

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
  {
    id: "csv",
    label: "CSV",
    icon: (
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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

// UTC hour ranges for each session
function detectSession(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const mins = h * 60 + m;
  // Sydney:   21:00–06:00 UTC
  // Tokyo:    00:00–09:00 UTC
  // London:   08:00–17:00 UTC
  // New York: 13:00–22:00 UTC
  // Overlaps go to the more dominant session
  if (mins >= 480 && mins < 780)  return "London";          // 08:00–13:00
  if (mins >= 780 && mins < 1020) return "London / New York"; // 13:00–17:00
  if (mins >= 1020 && mins < 1320) return "New York";        // 17:00–22:00
  if (mins >= 0   && mins < 540)  return "Tokyo";            // 00:00–09:00
  return "Sydney";                                           // 22:00–00:00
}

function ManualEntry() {
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [entryTime, setEntryTime] = useState("");
  const session = detectSession(entryTime);

  return (
    <div className="flex flex-col gap-2.5">
      <input type="text" placeholder="Instrument (e.g. EUR/USD)" style={inputStyle} />

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
          <input type="number" placeholder="0.00" style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px]" style={{ color: "#4a5d70" }}>Exit Price</label>
          <input type="number" placeholder="0.00" style={inputStyle} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px]" style={{ color: "#4a5d70" }}>Entry Time (UTC)</label>
          <input
            type="time"
            value={entryTime}
            onChange={(e) => setEntryTime(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px]" style={{ color: "#4a5d70" }}>Exit Time (UTC)</label>
          <input type="time" style={inputStyle} />
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

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px]" style={{ color: "#4a5d70" }}>Lot Size</label>
          <input type="number" placeholder="0.01" style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px]" style={{ color: "#4a5d70" }}>P&L ($)</label>
          <input type="number" placeholder="0.00" style={inputStyle} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px]" style={{ color: "#4a5d70" }}>Date</label>
        <input type="date" style={inputStyle} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px]" style={{ color: "#4a5d70" }}>Notes</label>
        <textarea placeholder="Trade notes, setup, emotions..." rows={3} style={{ ...inputStyle, resize: "none" }} />
      </div>

      <button type="button" className="neon-btn w-full rounded-lg py-2 text-xs font-semibold">
        Add Trade
      </button>
    </div>
  );
}

function UploadZone({ accept, label, hint }: { accept: string; label: string; hint: string }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile]         = useState<File | null>(null);

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

      <button type="button" className="neon-btn w-full rounded-lg py-2 text-xs font-semibold" disabled={!file} style={{ opacity: file ? 1 : 0.4 }}>
        Upload & Parse
      </button>
    </div>
  );
}

function TradeEntryPanel() {
  const [method, setMethod] = useState<EntryMethod>("manual");

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden" style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}>
      {/* Tabs */}
      <div className="shrink-0 flex gap-0 px-3 pt-3 pb-0">
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
        {method === "manual"     && <ManualEntry />}
        {method === "screenshot" && (
          <UploadZone
            accept="image/*"
            label="Drop screenshot here or click to browse"
            hint="PNG, JPG, WEBP — AI will extract trade data"
          />
        )}
        {method === "csv" && (
          <UploadZone
            accept=".csv"
            label="Drop CSV file here or click to browse"
            hint="MT4/MT5 export format supported"
          />
        )}
      </div>
    </div>
  );
}


// ── Dashboard Page ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
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
          <MonthlyCalendar />
        </div>
        <div className="flex-1" style={{ minWidth: 260 }}>
          <TradeEntryPanel />
        </div>
      </div>

    </div>
  );
}
