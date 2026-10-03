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

// Yahoo has no 4h bars, so 4h is fetched as 1h and aggregated (`aggregate`), buckets aligned to UTC.
const INTERVALS: { key: CandleInterval; yahoo: string; seconds: number; maxAgeDays: number; aggregate?: number }[] = [
  { key: "15m", yahoo: "15m", seconds: 900, maxAgeDays: 59 },
  { key: "30m", yahoo: "30m", seconds: 1800, maxAgeDays: 59 },
  { key: "1h", yahoo: "60m", seconds: 3600, maxAgeDays: 729 },
  { key: "4h", yahoo: "60m", seconds: 14_400, maxAgeDays: 729, aggregate: 4 },
];
const PAD_CANDLES = 40;

export type CandleWindow = { interval: CandleInterval; yahooInterval: string; from: number; to: number; aggregateSeconds?: number };

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
 * Picks the interval + window to fetch. If the requested interval's history no longer reaches the
 * trade (15m/30m only go back ~60 days), falls back to the next coarser one that does. Returns
 * null when even the coarsest (4h, ~2 years) can't reach it.
 */
export function pickWindow(entryMs: number, exitMs: number, nowMs: number, requested: CandleInterval = "15m"): CandleWindow | null {
  const allowed = allowedIntervals(entryMs, exitMs, nowMs);
  const from = INTERVALS.findIndex((i) => i.key === requested);
  const choice = INTERVALS.slice(Math.max(0, from)).find((i) => allowed.includes(i.key));
  if (!choice) return null;
  const w = windowFor(choice, entryMs, exitMs, nowMs);
  return {
    interval: choice.key,
    yahooInterval: choice.yahoo,
    from: w.from,
    to: w.to,
    ...(choice.aggregate ? { aggregateSeconds: choice.seconds } : {}),
  };
}

/** Merges finer candles into `bucketSeconds` bars aligned to UTC (e.g. 1h -> 4h at 00/04/08…). */
export function aggregateCandles(candles: Candle[], bucketSeconds: number): Candle[] {
  const out: Candle[] = [];
  for (const c of candles) {
    const bucket = Math.floor(c.time / bucketSeconds) * bucketSeconds;
    const last = out[out.length - 1];
    if (last && last.time === bucket) {
      last.high = Math.max(last.high, c.high);
      last.low = Math.min(last.low, c.low);
      last.close = c.close;
    } else {
      out.push({ time: bucket, open: c.open, high: c.high, low: c.low, close: c.close });
    }
  }
  return out;
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
  const key = `${ticker}|${w.interval}|${p1}|${p2}`;
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
  const parsed = parseYahooChart(json);
  const candles = w.aggregateSeconds ? aggregateCandles(parsed, w.aggregateSeconds) : parsed;

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { expires: nowMs + cacheTtlMs(w.to, nowMs), candles });
  return candles;
}
