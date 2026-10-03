import type { Candle, CandleInterval } from "@pipntick/shared";
import { FUTURES_CONTRACTS } from "@pipntick/shared";

// Historical candles for the Trade Review chart, from Yahoo Finance's public chart endpoint.
// It's free and needs no key, but it's unofficial (no SLA, may rate-limit cloud IPs) — this is the
// ONLY module that knows about Yahoo, so moving to a paid feed (e.g. Databento for exact CME
// contracts) means replacing this file, not the route or the chart.

const YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const DAY = 86_400_000;

// ─── Symbols ──────────────────────────────────────────────────────────────

// Micro futures chart their parent's continuous contract (same price scale, far more history).
const MICRO_PARENT: Record<string, string> = {
  MES: "ES", MNQ: "NQ", MYM: "YM", M2K: "RTY", MGC: "GC", SIL: "SI", MHG: "HG", MCL: "CL", M6E: "6E", MBT: "BTC", MET: "ETH",
};
// Index CFD names -> the cash index.
const INDEX_CFDS: Record<string, string> = { US30: "^DJI", NAS100: "^NDX", SPX500: "^GSPC", GER40: "^GDAXI", UK100: "^FTSE" };
const CRYPTO = new Set(["BTC", "ETH", "XRP", "SOL", "ADA", "DOGE", "LTC", "BNB", "DOT", "AVAX"]);

export type TickerInfo = { ticker: string; approximate: boolean; note?: string };

/**
 * App symbol -> Yahoo ticker, or null when there's no free source for it. Futures use Yahoo's
 * continuous front-month contract ("ES=F"), so around a rollover candles can be a few ticks off
 * the exact contract traded; spot metals map to their futures and are flagged approximate.
 */
export function toYahooTicker(symbol: string): TickerInfo | null {
  const s = symbol.trim().toUpperCase();
  if (!s) return null;

  if (s in FUTURES_CONTRACTS) {
    const root = MICRO_PARENT[s] ?? s;
    return { ticker: `${root}=F`, approximate: false, note: "continuous front-month contract" };
  }
  if (s in INDEX_CFDS) return { ticker: INDEX_CFDS[s], approximate: true, note: "cash index (your CFD may differ slightly)" };

  const pair = /^([A-Z]{3,4})\/([A-Z]{3})$/.exec(s);
  if (pair) {
    const [, base, quote] = pair;
    if (base === "XAU") return { ticker: "GC=F", approximate: true, note: "gold futures in place of spot gold" };
    if (base === "XAG") return { ticker: "SI=F", approximate: true, note: "silver futures in place of spot silver" };
    if (CRYPTO.has(base)) return { ticker: `${base}-${quote}`, approximate: false };
    return { ticker: `${base}${quote}=X`, approximate: false };
  }

  // US stocks/ETFs (BRK.B -> BRK-B).
  if (/^[A-Z][A-Z.-]{0,6}$/.test(s)) return { ticker: s.replace(/\./g, "-"), approximate: false };
  return null;
}

// ─── Intervals ────────────────────────────────────────────────────────────

const INTERVALS: { key: CandleInterval; yahoo: string; seconds: number; maxAgeDays: number }[] = [
  { key: "1m", yahoo: "1m", seconds: 60, maxAgeDays: 7 },
  { key: "5m", yahoo: "5m", seconds: 300, maxAgeDays: 59 },
  { key: "15m", yahoo: "15m", seconds: 900, maxAgeDays: 59 },
  { key: "1h", yahoo: "60m", seconds: 3600, maxAgeDays: 729 },
  { key: "1d", yahoo: "1d", seconds: 86_400, maxAgeDays: Number.POSITIVE_INFINITY },
];
const MAX_AUTO_CANDLES = 400;
const PAD_CANDLES = 40;

export type CandleWindow = { interval: CandleInterval; yahooInterval: string; from: number; to: number };

/** The window around a trade for one interval: padded by max(trade duration, 40 candles). */
function windowFor(i: (typeof INTERVALS)[number], entryMs: number, exitMs: number, nowMs: number) {
  const pad = Math.max(exitMs - entryMs, PAD_CANDLES * i.seconds * 1000);
  return { from: entryMs - pad, to: Math.min(exitMs + pad, nowMs) };
}

/** Intervals whose history limit (Yahoo's) still covers this trade's window. */
export function allowedIntervals(entryMs: number, exitMs: number, nowMs: number): CandleInterval[] {
  return INTERVALS.filter((i) => nowMs - windowFor(i, entryMs, exitMs, nowMs).from <= i.maxAgeDays * DAY).map((i) => i.key);
}

/**
 * Picks the interval + window to fetch. "auto" = the finest allowed interval that keeps the
 * window at or under ~400 candles. Returns null for an explicit interval that's out of range.
 */
export function pickWindow(
  entryMs: number,
  exitMs: number,
  nowMs: number,
  requested: CandleInterval | "auto" = "auto",
): CandleWindow | null {
  const allowed = INTERVALS.filter((i) => allowedIntervals(entryMs, exitMs, nowMs).includes(i.key));
  let choice: (typeof INTERVALS)[number] | undefined;
  if (requested === "auto") {
    choice =
      allowed.find((i) => {
        const w = windowFor(i, entryMs, exitMs, nowMs);
        return (w.to - w.from) / (i.seconds * 1000) <= MAX_AUTO_CANDLES;
      }) ?? allowed[allowed.length - 1];
  } else {
    choice = allowed.find((i) => i.key === requested);
  }
  if (!choice) return null;
  const w = windowFor(choice, entryMs, exitMs, nowMs);
  return { interval: choice.key, yahooInterval: choice.yahoo, from: w.from, to: w.to };
}

// ─── Fetch + parse ────────────────────────────────────────────────────────

type YahooChart = {
  chart?: {
    result?: { timestamp?: number[]; indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }[] } }[] | null;
    error?: { code?: string; description?: string } | null;
  };
};

/** Yahoo's chart JSON -> candles (unix seconds UTC), dropping incomplete/null bars. */
export function parseYahooChart(json: YahooChart): Candle[] {
  const r = json.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const q = r?.indicators?.quote?.[0];
  if (!q) return [];
  const candles: Candle[] = [];
  for (let k = 0; k < ts.length; k++) {
    const open = q.open?.[k];
    const high = q.high?.[k];
    const low = q.low?.[k];
    const close = q.close?.[k];
    if (open == null || high == null || low == null || close == null) continue;
    candles.push({ time: ts[k], open, high, low, close });
  }
  return candles.sort((a, b) => a.time - b.time);
}

export class MarketDataError extends Error {}

// Small in-memory cache: history that ended over an hour ago doesn't change, so it's kept for a
// day; windows touching the present only for a minute. Capped (oldest evicted first).
const cache = new Map<string, { expires: number; candles: Candle[] }>();
const CACHE_MAX = 500;

export function cacheTtlMs(windowTo: number, nowMs: number): number {
  return nowMs - windowTo > 3_600_000 ? DAY : 60_000;
}

export function clearCandleCache() {
  cache.clear();
}

export async function fetchCandles(ticker: string, w: CandleWindow, nowMs = Date.now()): Promise<Candle[]> {
  // Round the window to the interval so near-identical requests share a cache entry.
  const step = INTERVALS.find((i) => i.key === w.interval)!.seconds;
  const p1 = Math.floor(w.from / 1000 / step) * step;
  const p2 = Math.ceil(w.to / 1000 / step) * step;
  const key = `${ticker}|${w.yahooInterval}|${p1}|${p2}`;
  const hit = cache.get(key);
  if (hit && hit.expires > nowMs) return hit.candles;

  const url = `${YAHOO_URL}${encodeURIComponent(ticker)}?period1=${p1}&period2=${p2}&interval=${w.yahooInterval}&includePrePost=false`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  } catch (err) {
    throw new MarketDataError(`Yahoo request failed: ${(err as Error).message}`);
  }
  if (!res.ok) throw new MarketDataError(`Yahoo responded ${res.status}`);
  const json = (await res.json()) as YahooChart;
  if (json.chart?.error) throw new MarketDataError(`Yahoo error: ${json.chart.error.description ?? json.chart.error.code}`);
  const candles = parseYahooChart(json);

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { expires: nowMs + cacheTtlMs(w.to, nowMs), candles });
  return candles;
}
