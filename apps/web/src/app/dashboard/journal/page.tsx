"use client";

import React, { useState, useRef, useEffect } from "react";

type Trade = {
  id: number;
  date: string;
  instrument: string;
  direction: "Long" | "Short";
  entryPrice: number;
  exitPrice: number;
  lotSize: number;
  pnl: number;
  session: string;
  duration: string;
  notes: string;
};

const trades: Trade[] = [
  { id: 1,  date: "2026-03-29", instrument: "EUR/USD", direction: "Long",  entryPrice: 1.0842, exitPrice: 1.0891, lotSize: 1.0, pnl:  225.00, session: "London",           duration: "2h 15m", notes: "Clean breakout above resistance." },
  { id: 2,  date: "2026-03-27", instrument: "GBP/USD", direction: "Short", entryPrice: 1.2645, exitPrice: 1.2690, lotSize: 0.5, pnl:  -95.00, session: "New York",         duration: "0h 48m", notes: "Fakeout, stopped out." },
  { id: 3,  date: "2026-03-26", instrument: "NAS100",  direction: "Long",  entryPrice: 17840,  exitPrice: 17980,  lotSize: 0.2, pnl:  510.00, session: "New York",         duration: "3h 02m", notes: "Trend continuation after pullback." },
  { id: 4,  date: "2026-03-22", instrument: "EUR/USD", direction: "Long",  entryPrice: 1.0801, exitPrice: 1.0814, lotSize: 0.5, pnl:   55.00, session: "London",           duration: "1h 10m", notes: "" },
  { id: 5,  date: "2026-03-20", instrument: "XAU/USD", direction: "Long",  entryPrice: 3012.4, exitPrice: 3041.2, lotSize: 0.1, pnl:  290.00, session: "London / New York", duration: "1h 55m", notes: "Gold bounce off key support." },
  { id: 6,  date: "2026-03-19", instrument: "US30",    direction: "Short", entryPrice: 41200,  exitPrice: 41282,  lotSize: 0.1, pnl: -165.00, session: "New York",         duration: "0h 35m", notes: "Against the trend, bad trade." },
  { id: 7,  date: "2026-03-16", instrument: "NAS100",  direction: "Long",  entryPrice: 17620,  exitPrice: 17890,  lotSize: 0.2, pnl:  445.00, session: "New York",         duration: "4h 20m", notes: "Held through news, paid off." },
  { id: 8,  date: "2026-03-15", instrument: "GBP/USD", direction: "Long",  entryPrice: 1.2580, exitPrice: 1.2635, lotSize: 0.5, pnl:  310.00, session: "London",           duration: "2h 40m", notes: "Strong momentum play." },
  { id: 9,  date: "2026-03-13", instrument: "EUR/USD", direction: "Short", entryPrice: 1.0920, exitPrice: 1.0938, lotSize: 0.5, pnl:  -88.50, session: "Tokyo",            duration: "1h 05m", notes: "Low liquidity session, spreads wide." },
  { id: 10, date: "2026-03-12", instrument: "XAU/USD", direction: "Long",  entryPrice: 2980.0, exitPrice: 3042.0, lotSize: 0.1, pnl:  620.00, session: "London",           duration: "3h 30m", notes: "Best trade of the month." },
  { id: 11, date: "2026-03-09", instrument: "USD/JPY", direction: "Short", entryPrice: 149.85, exitPrice: 149.50, lotSize: 0.5, pnl:  175.00, session: "Tokyo",            duration: "1h 45m", notes: "Clean rejection at resistance." },
  { id: 12, date: "2026-03-08", instrument: "EUR/USD", direction: "Short", entryPrice: 1.0875, exitPrice: 1.0918, lotSize: 0.5, pnl: -215.00, session: "New York",         duration: "0h 55m", notes: "NFP spike, got caught." },
];

type EntryMethod = "manual" | "screenshot" | "csv";
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
  if (mins >= 480 && mins < 780)  return "London";
  if (mins >= 780 && mins < 1020) return "London / New York";
  if (mins >= 1020 && mins < 1320) return "New York";
  if (mins >= 0   && mins < 540)  return "Tokyo";
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

function AddTradeModal({ onClose }: { onClose: () => void }) {
  const [method, setMethod]     = useState<EntryMethod>("manual");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [entryTime, setEntryTime] = useState("");
  const session = detectSession(entryTime);

  const tabs = [
    { id: "manual" as EntryMethod, label: "Manual", icon: <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
    { id: "screenshot" as EntryMethod, label: "Screenshot", icon: <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { id: "csv" as EntryMethod, label: "CSV", icon: <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
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
          <h2 className="text-sm font-bold" style={{ color: "#f0f0f0" }}>Add Trade</h2>
          <button onClick={handleClose} className="hover:opacity-60 transition-opacity" style={{ color: "#4a5d70" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
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
        <div style={{ height: 1, backgroundColor: "#1a2d4a", flexShrink: 0 }} />

        {/* Content — animated height */}
        <AnimatedContent method={method}>
        <div className="p-5 flex flex-col gap-3">
          {method === "manual" && (
            <>
              <input type="text" placeholder="Instrument (e.g. EUR/USD)" style={inputStyle} />
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
                <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "#4a5d70" }}>Entry Price</label><input type="number" placeholder="0.00" style={inputStyle} /></div>
                <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "#4a5d70" }}>Exit Price</label><input type="number" placeholder="0.00" style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "#4a5d70" }}>Entry Time (UTC)</label><input type="time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} style={inputStyle} /></div>
                <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "#4a5d70" }}>Exit Time (UTC)</label><input type="time" style={inputStyle} /></div>
              </div>
              <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "#05090f", border: "1px solid #1a2d4a" }}>
                <span className="text-[10px]" style={{ color: "#4a5d70" }}>Session</span>
                <span className="text-[11px] font-semibold" style={{ color: session ? "#7bc13b" : "#2a3d55" }}>{session || "— enter entry time"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "#4a5d70" }}>Lot Size</label><input type="number" placeholder="0.01" style={inputStyle} /></div>
                <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "#4a5d70" }}>P&L ($)</label><input type="number" placeholder="0.00" style={inputStyle} /></div>
              </div>
              <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "#4a5d70" }}>Date</label><input type="date" style={inputStyle} /></div>
              <div className="flex flex-col gap-1"><label className="text-[10px]" style={{ color: "#4a5d70" }}>Notes</label><textarea placeholder="Trade notes, setup, emotions..." rows={3} style={{ ...inputStyle, resize: "none" }} /></div>
              <button type="button" className="neon-btn w-full rounded-lg py-2.5 text-sm font-semibold" onClick={handleClose}>Add Trade</button>
            </>
          )}
          {method === "screenshot" && <UploadZone accept="image/*" label="Drop screenshot here or click to browse" hint="PNG, JPG, WEBP — AI will extract trade data" />}
          {method === "csv"        && <UploadZone accept=".csv"    label="Drop CSV file here or click to browse"    hint="MT4/MT5 export format supported" />}
        </div>
        </AnimatedContent>
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
  { label: "Notes",      key: null         },
];

export default function JournalPage() {
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<"all" | "long" | "short" | "win" | "loss">("all");
  const [sortKey, setSortKey]   = useState<SortKey>("date");
  const [sortDir, setSortDir]   = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  function handleSort(key: SortKey | null) {
    if (!key) return;
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const rows = trades
    .filter((t) => {
      const q = search.toLowerCase();
      const matchSearch = !q || t.instrument.toLowerCase().includes(q) || t.session.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q);
      const matchFilter =
        filter === "all"   ? true :
        filter === "long"  ? t.direction === "Long" :
        filter === "short" ? t.direction === "Short" :
        filter === "win"   ? t.pnl > 0 :
        t.pnl < 0;
      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      const mul = sortDir === "desc" ? -1 : 1;
      if (sortKey === "date")       return mul * a.date.localeCompare(b.date);
      if (sortKey === "instrument") return mul * a.instrument.localeCompare(b.instrument);
      if (sortKey === "direction")  return mul * a.direction.localeCompare(b.direction);
      if (sortKey === "pnl")        return mul * (a.pnl - b.pnl);
      if (sortKey === "duration")   return mul * a.duration.localeCompare(b.duration);
      return 0;
    });

  const totalPnl = rows.reduce((s, t) => s + t.pnl, 0);
  const wins     = rows.filter((t) => t.pnl > 0).length;

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
          <span className="text-xs" style={{ color: "#4a5d70" }}>{rows.length} trades</span>
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
              {rows.map((t) => {
                const isWin = t.pnl > 0;
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
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#8899aa" }}>{t.exitPrice}</td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#8899aa" }}>{t.lotSize}</td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#8899aa" }}>{t.duration}</td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#8899aa" }}>{t.session}</td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: isWin ? "#a3e05a" : "#f87171" }}>
                        {isWin ? "+" : ""}${Math.abs(t.pnl).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 max-w-[180px] truncate" style={{ color: "#4a5d70" }}>{t.notes || "—"}</td>
                    </tr>
                    {isOpen && (
                      <tr style={{ backgroundColor: "rgba(123,193,59,0.03)", borderBottom: "1px solid rgba(26,45,74,0.5)" }}>
                        <td colSpan={10} className="px-6 py-3">
                          <p className="text-xs" style={{ color: "#8899aa" }}>
                            <span className="font-semibold" style={{ color: "#f0f0f0" }}>Notes: </span>
                            {t.notes || "No notes for this trade."}
                          </p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-xs" style={{ color: "#4a5d70" }}>
                    No trades match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && <AddTradeModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
