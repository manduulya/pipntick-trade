"use client";

import { useState, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Impact = "high" | "medium" | "low";
type Tab = "calendar" | "news";
type ImpactFilter = "all" | Impact;

type EconomicEvent = {
  id: string;
  time: string;
  currency: string;
  impact: Impact;
  event: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
};

type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  category: "forex" | "stocks" | "commodities" | "crypto" | "macro";
};

// ── Trading sessions ──────────────────────────────────────────────────────────

type SessionDef = {
  name: string;
  tz: string;
  // Local market open/close hours (e.g. 8 = 8am in the session's own timezone).
  // UTC equivalents are computed at runtime via getUTCOffset so DST is handled
  // automatically — no hardcoded UTC values that break twice a year.
  localOpen: number;
  localClose: number;
  color: string;
};

const SESSIONS: SessionDef[] = [
  { name: "Sydney",   tz: "Australia/Sydney",  localOpen: 8,  localClose: 17, color: "#60a5fa" },
  { name: "Tokyo",    tz: "Asia/Tokyo",         localOpen: 9,  localClose: 18, color: "#c084fc" },
  { name: "London",   tz: "Europe/London",      localOpen: 8,  localClose: 17, color: "#7bc13b" },
  { name: "New York", tz: "America/New_York",   localOpen: 8,  localClose: 17, color: "#fb923c" },
];

/**
 * Returns the current UTC offset in hours for a given IANA timezone.
 * Uses the built-in Intl API — automatically correct for DST, no external API needed.
 * e.g. London BST → +1, London GMT → 0, New York EDT → -4, New York EST → -5
 */
function getUTCOffset(tz: string, date: Date): number {
  const offsetStr = new Intl.DateTimeFormat("en", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT";

  // offsetStr is "GMT", "GMT+1", "GMT-4", "GMT+5:30", etc.
  const match = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) return 0;
  const sign = match[1] === "+" ? 1 : -1;
  return sign * (parseInt(match[2]) + parseInt(match[3] ?? "0") / 60);
}

/** Convert a session's local open/close to UTC fractional hours for a given date. */
function sessionUTCHours(s: SessionDef, date: Date): { open: number; close: number } {
  const offset = getUTCOffset(s.tz, date);
  // UTC = local - offset; wrap into [0, 48) so crossing midnight works
  const open  = ((s.localOpen  - offset) % 24 + 24) % 24;
  const close = ((s.localClose - offset) % 24 + 24) % 24;
  // If close <= open the session crosses UTC midnight — represent as close + 24
  return { open, close: close <= open ? close + 24 : close };
}

function utcFrac(d: Date) {
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

function isActive(s: SessionDef, frac: number, date: Date): boolean {
  const { open, close } = sessionUTCHours(s, date);
  if (close <= 24) return frac >= open && frac < close;
  return frac >= open || frac < close - 24; // crosses midnight
}

function localTime(tz: string, d: Date): string {
  return d.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });
}

// Hour labels shown on the timeline ruler (UTC)
const RULER_HOURS = [0, 4, 8, 12, 16, 20, 24];

function SessionsWidget() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const frac = utcFrac(now);
  const nowPct = (frac / 24) * 100;

  const localLabel = now.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  const localTZ = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value ?? "Local";

  const activeSessions = SESSIONS.filter((s) => isActive(s, frac, now));

  return (
    <div
      className="rounded-xl p-4 shrink-0"
      style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>Trading Sessions</h2>
          <span className="text-xs px-2 py-0.5 rounded-md font-mono" style={{ backgroundColor: "#07101e", color: "#4a5d70", border: "1px solid #1a2d4a" }}>
            {localLabel} {localTZ}
          </span>
        </div>
        {/* Active session badges */}
        <div className="flex items-center gap-2">
          {activeSessions.length === 0 ? (
            <span className="text-xs" style={{ color: "#4a5d70" }}>No active sessions</span>
          ) : (
            activeSessions.map((s) => (
              <span
                key={s.name}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                style={{
                  backgroundColor: `${s.color}18`,
                  color: s.color,
                  border: `1px solid ${s.color}40`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: s.color }} />
                {s.name}
                <span className="font-normal opacity-70">{localTime(s.tz, now)}</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative" style={{ paddingBottom: 4 }}>
        {/* Ruler */}
        <div className="relative h-4 mb-1">
          {RULER_HOURS.map((h) => (
            <span
              key={h}
              className="absolute text-[10px] -translate-x-1/2"
              style={{ left: `${(h / 24) * 100}%`, color: "#2a3d50" }}
            >
              {h === 0 || h === 24 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`}
            </span>
          ))}
        </div>

        {/* Session rows */}
        <div className="flex flex-col gap-1.5" style={{ position: "relative" }}>
          {SESSIONS.map((s) => {
            const active = isActive(s, frac, now);
            const { open, close } = sessionUTCHours(s, now);
            // Build bar segment(s) — sessions crossing UTC midnight need two segments
            const segments: { left: number; width: number }[] = [];
            if (close <= 24) {
              segments.push({ left: (open / 24) * 100, width: ((close - open) / 24) * 100 });
            } else {
              segments.push({ left: (open / 24) * 100, width: ((24 - open) / 24) * 100 });
              segments.push({ left: 0, width: ((close - 24) / 24) * 100 });
            }

            return (
              <div key={s.name} className="relative h-7 rounded-md" style={{ backgroundColor: "#07101e" }}>
                {segments.map((seg, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full rounded-md flex items-center overflow-hidden"
                    style={{
                      left: `${seg.left}%`,
                      width: `${seg.width}%`,
                      backgroundColor: active ? s.color : `${s.color}40`,
                      transition: "background-color 0.4s",
                    }}
                  >
                    {/* Label inside first bar segment */}
                    {i === 0 && (
                      <span
                        className="px-2 text-xs font-semibold whitespace-nowrap"
                        style={{ color: active ? "#05090f" : `${s.color}99` }}
                      >
                        {s.name}
                        <span className="ml-2 font-normal">{localTime(s.tz, now)}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          {/* "Now" vertical line — overlays all rows */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: `${nowPct}%`,
              width: 2,
              backgroundColor: "#7bc13b",
              boxShadow: "0 0 6px rgba(123,193,59,0.6)",
              zIndex: 10,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Mock data (swap with Finnhub /calendar/economic for live data) ─────────────
// Finnhub: GET https://finnhub.io/api/v1/calendar/economic?from=YYYY-MM-DD&to=YYYY-MM-DD&token=YOUR_API_KEY

const economicEvents: EconomicEvent[] = [
  { id: "1",  time: "1:00am",  currency: "JPY", impact: "medium", event: "Housing Starts y/y",             actual: "-4.9%",  forecast: "-4.5%",  previous: "-0.4%"  },
  { id: "2",  time: "2:00am",  currency: "EUR", impact: "medium", event: "German Import Prices m/m",       actual: "0.3%",   forecast: "0.7%",   previous: "1.1%"   },
  { id: "3",  time: "2:00am",  currency: "EUR", impact: "medium", event: "German Retail Sales m/m",        actual: "-0.6%",  forecast: "0.3%",   previous: "-1.1%"  },
  { id: "4",  time: "2:00am",  currency: "GBP", impact: "medium", event: "Current Account",                actual: "-18.4B", forecast: "-24.0B", previous: "-10.7B" },
  { id: "5",  time: "2:00am",  currency: "GBP", impact: "low",    event: "Final GDP q/q",                  actual: "0.1%",   forecast: "0.1%",   previous: "0.1%"   },
  { id: "6",  time: "2:00am",  currency: "GBP", impact: "low",    event: "Nationwide HPI m/m",             actual: "0.9%",   forecast: "0.0%",   previous: "0.3%"   },
  { id: "7",  time: "2:00am",  currency: "GBP", impact: "medium", event: "Revised Business Investment q/q",actual: "-2.5%",  forecast: "-2.7%",  previous: "-2.7%"  },
  { id: "8",  time: "2:45am",  currency: "EUR", impact: "medium", event: "French Consumer Spending m/m",   actual: "-1.4%",  forecast: "-0.3%",  previous: "0.4%"   },
  { id: "9",  time: "2:45am",  currency: "EUR", impact: "low",    event: "French Prelim CPI m/m",          actual: "0.9%",   forecast: "0.9%",   previous: "0.6%"   },
  { id: "10", time: "3:55am",  currency: "EUR", impact: "low",    event: "German Unemployment Change",     actual: "0K",     forecast: "2K",     previous: "1K"     },
  { id: "11", time: "5:00am",  currency: "EUR", impact: "high",   event: "Core CPI Flash Estimate y/y",    actual: "2.3%",   forecast: "2.4%",   previous: "2.4%"   },
  { id: "12", time: "5:00am",  currency: "EUR", impact: "high",   event: "CPI Flash Estimate y/y",         actual: "2.5%",   forecast: "2.6%",   previous: "1.9%"   },
  { id: "13", time: "5:00am",  currency: "EUR", impact: "low",    event: "Italian Prelim CPI m/m",         actual: "0.5%",   forecast: "0.6%",   previous: "0.7%"   },
  { id: "14", time: "8:30am",  currency: "CAD", impact: "high",   event: "GDP m/m",                        actual: null,     forecast: "0.0%",   previous: "0.2%"   },
  { id: "15", time: "9:00am",  currency: "USD", impact: "low",    event: "HPI m/m",                        actual: null,     forecast: "0.1%",   previous: "0.1%"   },
  { id: "16", time: "9:00am",  currency: "USD", impact: "low",    event: "S&P/CS Composite-20 HPI y/y",    actual: null,     forecast: "1.4%",   previous: "1.4%"   },
  { id: "17", time: "9:45am",  currency: "USD", impact: "medium", event: "Chicago PMI",                    actual: null,     forecast: "54.8",   previous: "57.7"   },
  { id: "18", time: "10:00am", currency: "USD", impact: "high",   event: "JOLTS Job Openings",             actual: null,     forecast: "6.89M",  previous: "6.95M"  },
  { id: "19", time: "10:00am", currency: "USD", impact: "medium", event: "CB Consumer Confidence",         actual: null,     forecast: "87.8",   previous: "91.2"   },
  { id: "20", time: "12:00pm", currency: "USD", impact: "low",    event: "FOMC Member Goolsbee Speaks",    actual: null,     forecast: null,     previous: null     },
  { id: "21", time: "1:10pm",  currency: "USD", impact: "low",    event: "FOMC Member Schmid Speaks",      actual: null,     forecast: null,     previous: null     },
  { id: "22", time: "3:00pm",  currency: "USD", impact: "low",    event: "FOMC Member Barr Speaks",        actual: null,     forecast: null,     previous: null     },
  { id: "23", time: "4:30pm",  currency: "USD", impact: "low",    event: "API Weekly Statistical Bulletin",actual: null,     forecast: null,     previous: null     },
  { id: "24", time: "5:10pm",  currency: "USD", impact: "low",    event: "FOMC Member Bowman Speaks",      actual: null,     forecast: null,     previous: null     },
  { id: "25", time: "5:45pm",  currency: "NZD", impact: "low",    event: "Building Consents m/m",          actual: null,     forecast: null,     previous: "1.9%"   },
  { id: "26", time: "7:50pm",  currency: "JPY", impact: "medium", event: "Tankan Manufacturing Index",     actual: null,     forecast: "16",     previous: "15"     },
  { id: "27", time: "7:50pm",  currency: "JPY", impact: "medium", event: "Tankan Non-Manufacturing Index", actual: null,     forecast: "33",     previous: "34"     },
  { id: "28", time: "8:30pm",  currency: "AUD", impact: "medium", event: "Building Approvals m/m",         actual: null,     forecast: "6.0%",   previous: "-7.2%"  },
  { id: "29", time: "8:30pm",  currency: "JPY", impact: "low",    event: "Final Manufacturing PMI",        actual: null,     forecast: "51.6",   previous: "51.4"   },
  { id: "30", time: "9:45pm",  currency: "CNY", impact: "medium", event: "Caixin Manufacturing PMI",       actual: null,     forecast: "51.6",   previous: "52.1"   },
];

// Mock news (swap with Alpha Vantage NEWS_SENTIMENT or Marketaux for live data)
// Alpha Vantage: GET https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=YOUR_KEY
const newsArticles: NewsArticle[] = [
  {
    id: "n1",
    title: "Fed officials signal patience on rate cuts as inflation stays sticky",
    summary: "Multiple Federal Reserve officials reiterated a wait-and-see approach to monetary policy on Monday, citing persistent inflation pressures and a resilient labor market.",
    source: "Reuters",
    publishedAt: "2 hours ago",
    category: "macro",
  },
  {
    id: "n2",
    title: "EUR/USD slides below 1.0800 after soft Eurozone CPI data",
    summary: "The euro weakened against the dollar after flash CPI data came in below expectations at 2.5%, fueling speculation that the ECB could cut rates sooner than expected.",
    source: "FXStreet",
    publishedAt: "3 hours ago",
    category: "forex",
  },
  {
    id: "n3",
    title: "Gold holds near $2,300 as tariff fears lift safe-haven demand",
    summary: "Gold prices remained elevated near multi-month highs as investors sought safe havens amid renewed concerns over U.S. tariff policy and global trade uncertainty.",
    source: "Bloomberg",
    publishedAt: "4 hours ago",
    category: "commodities",
  },
  {
    id: "n4",
    title: "S&P 500 futures dip ahead of key JOLTS jobs data",
    summary: "U.S. equity index futures edged lower in early trading as investors braced for the JOLTS Job Openings report, with the labor market remaining a key driver of Fed policy.",
    source: "CNBC",
    publishedAt: "5 hours ago",
    category: "stocks",
  },
  {
    id: "n5",
    title: "GBP/USD steadies as UK GDP meets expectations at 0.1%",
    summary: "Sterling stabilized after the UK's final Q4 GDP reading matched the preliminary estimate of 0.1%, offering little surprise to markets already pricing in a dovish BoE path.",
    source: "DailyFX",
    publishedAt: "6 hours ago",
    category: "forex",
  },
  {
    id: "n6",
    title: "Bitcoin consolidates above $85K as macro uncertainty weighs on risk assets",
    summary: "Bitcoin traded in a tight range above $85,000 as market participants assessed the broader macro backdrop ahead of month-end repositioning and key U.S. economic data.",
    source: "CoinDesk",
    publishedAt: "7 hours ago",
    category: "crypto",
  },
  {
    id: "n7",
    title: "CAD braces for GDP print — loonie at risk if data disappoints",
    summary: "The Canadian dollar faces a pivotal test as monthly GDP data is due at 8:30am ET. Economists forecast flat growth at 0.0%, following a 0.2% expansion in the prior month.",
    source: "ForexLive",
    publishedAt: "8 hours ago",
    category: "forex",
  },
  {
    id: "n8",
    title: "Oil prices retreat as EIA reports surprise inventory build",
    summary: "Crude oil futures fell over 1% after API data showed a larger-than-expected build in U.S. crude inventories, adding to demand concerns amid slowing global economic growth.",
    source: "OilPrice.com",
    publishedAt: "9 hours ago",
    category: "commodities",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const IMPACT_COLOR: Record<Impact, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#eab308",
};

const IMPACT_BG: Record<Impact, string> = {
  high:   "rgba(239,68,68,0.12)",
  medium: "rgba(245,158,11,0.12)",
  low:    "rgba(234,179,8,0.10)",
};

const CATEGORY_COLOR: Record<NewsArticle["category"], string> = {
  forex:       "#7bc13b",
  stocks:      "#60a5fa",
  commodities: "#f59e0b",
  crypto:      "#a78bfa",
  macro:       "#f87171",
};

function isBeat(actual: string | null, forecast: string | null): boolean | null {
  if (!actual || !forecast) return null;
  const a = parseFloat(actual.replace(/[^-\d.]/g, ""));
  const f = parseFloat(forecast.replace(/[^-\d.]/g, ""));
  if (isNaN(a) || isNaN(f)) return null;
  return a >= f;
}

// Whether a time string (e.g. "8:30am") has already passed today
function isPast(time: string): boolean {
  const now = new Date();
  const match = time.match(/(\d+):(\d+)(am|pm)/i);
  if (!match) return false;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3].toLowerCase();
  if (ampm === "pm" && h !== 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  const eventMinutes = h * 60 + m;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= eventMinutes;
}

function isUpNext(time: string): boolean {
  const now = new Date();
  const match = time.match(/(\d+):(\d+)(am|pm)/i);
  if (!match) return false;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3].toLowerCase();
  if (ampm === "pm" && h !== 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  const eventMinutes = h * 60 + m;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return eventMinutes > nowMinutes && eventMinutes - nowMinutes <= 30;
}

const CURRENCIES = ["All", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "NZD", "CNY", "CHF"];

// ── Sub-components ─────────────────────────────────────────────────────────────

function ImpactBadge({ impact }: { impact: Impact }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: IMPACT_COLOR[impact] }}
      />
      <span className="text-xs capitalize" style={{ color: IMPACT_COLOR[impact], fontWeight: 500 }}>
        {impact}
      </span>
    </div>
  );
}

function ActualValue({ actual, forecast }: { actual: string | null; forecast: string | null }) {
  if (!actual) return <span style={{ color: "#4a5d70" }}>—</span>;
  const beat = isBeat(actual, forecast);
  const color = beat === null ? "#f0f0f0" : beat ? "#7bc13b" : "#ef4444";
  return (
    <span className="font-semibold" style={{ color }}>
      {actual}
      {beat !== null && (
        <span className="ml-1 text-[10px]">{beat ? "▲" : "▼"}</span>
      )}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const [tab, setTab] = useState<Tab>("calendar");
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
  const [currencyFilter, setCurrencyFilter] = useState("All");
  const [dateOffset, setDateOffset] = useState(0); // 0 = today, -1 = yesterday, +1 = tomorrow

  const today = new Date();
  const displayDate = new Date(today);
  displayDate.setDate(today.getDate() + dateOffset);

  const dateLabel = displayDate.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  const isToday = dateOffset === 0;

  const filteredEvents = economicEvents.filter((e) => {
    if (impactFilter !== "all" && e.impact !== impactFilter) return false;
    if (currencyFilter !== "All" && e.currency !== currencyFilter) return false;
    return true;
  });

  // Group by time block for visual separation
  let lastTime = "";

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-bold" style={{ color: "#f0f0f0" }}>Market News</h1>
          <p className="text-xs mt-0.5" style={{ color: "#4a5d70" }}>
            Economic calendar & financial news
          </p>
        </div>

        {/* Tab switcher */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl"
          style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}
        >
          {(["calendar", "news"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-5 py-1.5 text-sm font-semibold rounded-lg capitalize cursor-pointer"
              style={{
                backgroundColor: tab === t ? "#7bc13b" : "transparent",
                color:           tab === t ? "#05090f" : "#8899aa",
                transition:      "background-color 0.3s, color 0.3s",
              }}
              onMouseEnter={(e) => {
                if (tab !== t) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.backgroundColor = "rgba(123,193,59,0.1)";
                  el.style.color = "#d4f0a0";
                }
              }}
              onMouseLeave={(e) => {
                if (tab !== t) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.backgroundColor = "transparent";
                  el.style.color = "#8899aa";
                }
              }}
            >
              {t === "calendar" ? "Economic Calendar" : "Market News"}
            </button>
          ))}
        </div>
      </div>

      {/* Sessions widget — always visible */}
      <SessionsWidget />

      {/* ── ECONOMIC CALENDAR TAB ──────────────────────────────────────────────── */}
      {tab === "calendar" && (
        <>
          {/* Controls row */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">

            {/* Date navigation */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}
            >
              <button
                onClick={() => setDateOffset((d) => d - 1)}
                className="w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ color: "#8899aa", transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f0f0f0")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#8899aa")}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-semibold min-w-[180px] text-center" style={{ color: isToday ? "#7bc13b" : "#f0f0f0" }}>
                {isToday ? `Today — ${dateLabel}` : dateLabel}
              </span>
              <button
                onClick={() => setDateOffset((d) => d + 1)}
                className="w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ color: "#8899aa", transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f0f0f0")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#8899aa")}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {dateOffset !== 0 && (
                <button
                  onClick={() => setDateOffset(0)}
                  className="ml-1 px-2 py-0.5 rounded-md text-xs font-medium cursor-pointer"
                  style={{ backgroundColor: "rgba(123,193,59,0.15)", color: "#7bc13b", border: "1px solid rgba(123,193,59,0.3)" }}
                >
                  Today
                </button>
              )}
            </div>

            {/* Impact filter */}
            <div
              className="flex items-center gap-1 p-1 rounded-xl"
              style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}
            >
              {(["all", "high", "medium", "low"] as ImpactFilter[]).map((f) => {
                const active = impactFilter === f;
                const color  = f === "all" ? "#7bc13b" : IMPACT_COLOR[f as Impact];
                return (
                  <button
                    key={f}
                    onClick={() => setImpactFilter(f)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer"
                    style={{
                      backgroundColor: active ? (f === "all" ? "rgba(123,193,59,0.12)" : IMPACT_BG[f as Impact]) : "transparent",
                      color:           active ? color : "#8899aa",
                      border:          active ? `1px solid ${color}40` : "1px solid transparent",
                      transition:      "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.color = "#f0f0f0";
                        el.style.backgroundColor = "rgba(255,255,255,0.04)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.color = "#8899aa";
                        el.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    {f !== "all" && (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: IMPACT_COLOR[f as Impact] }}
                      />
                    )}
                    {f === "all" ? "All Impact" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                );
              })}
            </div>

            {/* Currency filter */}
            <div className="flex items-center gap-1 flex-wrap">
              {CURRENCIES.map((c) => {
                const active = currencyFilter === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCurrencyFilter(c)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer"
                    style={{
                      backgroundColor: active ? "rgba(123,193,59,0.12)" : "#0b1220",
                      color:           active ? "#7bc13b" : "#4a5d70",
                      border:          active ? "1px solid rgba(123,193,59,0.3)" : "1px solid #1a2d4a",
                      transition:      "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.color = "#8899aa";
                        el.style.backgroundColor = "rgba(255,255,255,0.04)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.color = "#4a5d70";
                        el.style.backgroundColor = "#0b1220";
                      }
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats summary */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            {[
              {
                label: "High Impact",
                value: filteredEvents.filter((e) => e.impact === "high").length,
                color: "#ef4444",
                bg: "rgba(239,68,68,0.08)",
                border: "rgba(239,68,68,0.2)",
              },
              {
                label: "Medium Impact",
                value: filteredEvents.filter((e) => e.impact === "medium").length,
                color: "#f59e0b",
                bg: "rgba(245,158,11,0.08)",
                border: "rgba(245,158,11,0.2)",
              },
              {
                label: "Low Impact",
                value: filteredEvents.filter((e) => e.impact === "low").length,
                color: "#eab308",
                bg: "rgba(234,179,8,0.08)",
                border: "rgba(234,179,8,0.2)",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <div>
                  <p className="text-xs" style={{ color: "#8899aa" }}>{s.label}</p>
                  <p className="text-xl font-bold leading-tight" style={{ color: s.color }}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Calendar table */}
          <div
            className="rounded-xl overflow-hidden flex-1"
            style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a", minHeight: 0 }}
          >
            {/* Table header */}
            <div
              className="grid text-xs font-semibold px-4 py-2.5 sticky top-0"
              style={{
                gridTemplateColumns: "90px 70px 110px 1fr 90px 90px 90px",
                backgroundColor: "#07101e",
                borderBottom: "1px solid #1a2d4a",
                color: "#4a5d70",
              }}
            >
              <span>Time</span>
              <span>Currency</span>
              <span>Impact</span>
              <span>Event</span>
              <span className="text-right">Actual</span>
              <span className="text-right">Forecast</span>
              <span className="text-right">Previous</span>
            </div>

            {/* Rows */}
            <div>
              {filteredEvents.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm" style={{ color: "#4a5d70" }}>No events match your filters.</p>
                </div>
              ) : (
                filteredEvents.map((event) => {
                  const showTime = event.time !== lastTime;
                  lastTime = event.time;
                  const past    = isToday && isPast(event.time) && event.actual !== null;
                  const upNext  = isToday && !past && isUpNext(event.time);

                  return (
                    <div
                      key={event.id}
                      className="grid items-center px-4 py-2.5"
                      style={{
                        gridTemplateColumns: "90px 70px 110px 1fr 90px 90px 90px",
                        borderBottom: "1px solid rgba(26,45,74,0.5)",
                        backgroundColor: upNext ? "rgba(123,193,59,0.04)" : "transparent",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = "rgba(255,255,255,0.02)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = upNext ? "rgba(123,193,59,0.04)" : "transparent";
                      }}
                    >
                      {/* Time */}
                      <div className="flex items-center gap-1.5">
                        {upNext && (
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                            style={{ backgroundColor: "#7bc13b" }}
                          />
                        )}
                        <span
                          className="text-xs font-medium"
                          style={{ color: showTime ? (upNext ? "#7bc13b" : "#8899aa") : "transparent" }}
                        >
                          {event.time}
                        </span>
                      </div>

                      {/* Currency */}
                      <span
                        className="text-xs font-bold"
                        style={{ color: "#f0f0f0" }}
                      >
                        {event.currency}
                      </span>

                      {/* Impact */}
                      <ImpactBadge impact={event.impact} />

                      {/* Event name */}
                      <span
                        className="text-xs pr-4"
                        style={{ color: past ? "#8899aa" : "#d4e4f0" }}
                      >
                        {event.event}
                      </span>

                      {/* Actual */}
                      <div className="text-xs text-right">
                        <ActualValue actual={event.actual} forecast={event.forecast} />
                      </div>

                      {/* Forecast */}
                      <span className="text-xs text-right" style={{ color: "#4a5d70" }}>
                        {event.forecast ?? "—"}
                      </span>

                      {/* Previous */}
                      <span className="text-xs text-right" style={{ color: "#4a5d70" }}>
                        {event.previous ?? "—"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* API notice */}
          <p className="text-[11px] shrink-0" style={{ color: "#2a3d50" }}>
            Data source: Finnhub Economic Calendar API (finnhub.io) — Add your free API key to enable live data.
          </p>
        </>
      )}

      {/* ── MARKET NEWS TAB ───────────────────────────────────────────────────── */}
      {tab === "news" && (
        <>
          {/* Category filters */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {(["all", "forex", "stocks", "commodities", "crypto", "macro"] as const).map((cat) => {
              const isAll = cat === "all";
              const color = isAll ? "#7bc13b" : CATEGORY_COLOR[cat as NewsArticle["category"]];
              return (
                <button
                  key={cat}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer"
                  style={{
                    backgroundColor: isAll ? "rgba(123,193,59,0.12)" : "rgba(255,255,255,0.04)",
                    color:           isAll ? color : "#8899aa",
                    border:          isAll ? "1px solid rgba(123,193,59,0.3)" : "1px solid #1a2d4a",
                    transition:      "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.color = color;
                    el.style.backgroundColor = `${color}18`;
                    el.style.borderColor = `${color}40`;
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    if (cat === "all") {
                      el.style.color = "#7bc13b";
                      el.style.backgroundColor = "rgba(123,193,59,0.12)";
                      el.style.borderColor = "rgba(123,193,59,0.3)";
                    } else {
                      el.style.color = "#8899aa";
                      el.style.backgroundColor = "rgba(255,255,255,0.04)";
                      el.style.borderColor = "#1a2d4a";
                    }
                  }}
                >
                  {cat === "all" ? "All News" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              );
            })}
          </div>

          {/* News grid */}
          <div className="grid grid-cols-2 gap-3">
            {newsArticles.map((article) => {
              const catColor = CATEGORY_COLOR[article.category];
              return (
                <div
                  key={article.id}
                  className="rounded-xl p-4 flex flex-col gap-2 cursor-pointer"
                  style={{
                    backgroundColor: "#0b1220",
                    border: "1px solid #1a2d4a",
                    transition: "border-color 0.2s, background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.borderColor = "#2a4060";
                    el.style.backgroundColor = "#0f1a2e";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.borderColor = "#1a2d4a";
                    el.style.backgroundColor = "#0b1220";
                  }}
                >
                  {/* Category + time */}
                  <div className="flex items-center justify-between">
                    <span
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase"
                      style={{
                        backgroundColor: `${catColor}18`,
                        color: catColor,
                        border: `1px solid ${catColor}30`,
                      }}
                    >
                      {article.category}
                    </span>
                    <span className="text-[11px]" style={{ color: "#4a5d70" }}>
                      {article.publishedAt}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold leading-snug" style={{ color: "#f0f0f0" }}>
                    {article.title}
                  </h3>

                  {/* Summary */}
                  <p className="text-xs leading-relaxed" style={{ color: "#6a7d90" }}>
                    {article.summary}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-medium" style={{ color: "#4a5d70" }}>
                      {article.source}
                    </span>
                    <span
                      className="text-xs font-medium flex items-center gap-1"
                      style={{ color: "#7bc13b" }}
                    >
                      Read more
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* API notice */}
          <p className="text-[11px] shrink-0" style={{ color: "#2a3d50" }}>
            Data source: Alpha Vantage News Sentiment API — Add your free API key to enable live headlines.
          </p>
        </>
      )}
    </div>
  );
}
