import type { Candle, Trade } from "@pipntick/shared";
import { accountWallClockToUtc, type AccountClock } from "./time-format";

// Pure helpers for the Trade Review chart (dashboard/review). Trade times are stored as broker
// wall-clock digits (see trade-utils.ts), so they're converted to real instants with the account's
// timezone before being matched against candles, which are in real UTC.

export type TradeInstants = { entry: Date; exit: Date | null };

export function tradeInstants(trade: Pick<Trade, "entryTime" | "exitTime">, account: AccountClock): TradeInstants {
  return {
    entry: accountWallClockToUtc(trade.entryTime.slice(0, 16), account),
    exit: trade.exitTime ? accountWallClockToUtc(trade.exitTime.slice(0, 16), account) : null,
  };
}

/** The open time (unix seconds) of the candle containing `seconds`, or null outside the data. */
export function snapToCandle(candles: Candle[], seconds: number): number | null {
  if (candles.length === 0 || seconds < candles[0].time) return null;
  let lo = 0;
  let hi = candles.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (candles[mid].time <= seconds) lo = mid;
    else hi = mid - 1;
  }
  return candles[lo].time;
}

// ─── Does the trade match the market? ─────────────────────────────────────

const INTERVAL_SECONDS: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1d": 86_400 };

/**
 * How far outside the traded range a price may sit and still count as matching. Exact sources
 * (futures continuous contract, forex, crypto, stocks) get 0.1% — enough for feed differences
 * and the candle-boundary slack, tight enough that a trade read in the wrong timezone fails
 * (0.5% let a gold trade 8 hours off through). Stand-ins (gold futures for spot XAU, cash index
 * for an index CFD) can legitimately sit further apart, so they get 0.6%.
 */
export const PRICE_TOLERANCE = { exact: 0.001, approximate: 0.006 } as const;

export type TradeCheckProblem = {
  leg: "Entry" | "Exit";
  price: number;
  /** When the price should have traded (unix seconds). */
  time: number;
  /** What the market actually traded around then, or null when there's no data at that time. */
  range: { low: number; high: number } | null;
};

/**
 * Checks each leg's price against what actually traded around its time: the candle containing it
 * plus one neighbor on each side (trade times are to the minute, candles can be coarser). A leg
 * fails if there's no candle near its time (outside the data, or the market was closed) or its
 * price is outside that range by more than PRICE_TOLERANCE. Empty result = the trade matches.
 */
export function checkTradeAgainstCandles(
  trade: Pick<Trade, "entryPrice" | "exitPrice">,
  instants: TradeInstants,
  candles: Candle[],
  interval: string,
  approximate = false,
): TradeCheckProblem[] {
  const tolerance = approximate ? PRICE_TOLERANCE.approximate : PRICE_TOLERANCE.exact;
  const step = INTERVAL_SECONDS[interval] ?? 60;
  const legs: { leg: "Entry" | "Exit"; price: number; at: Date }[] = [{ leg: "Entry", price: Number(trade.entryPrice), at: instants.entry }];
  if (instants.exit && trade.exitPrice !== null) legs.push({ leg: "Exit", price: Number(trade.exitPrice), at: instants.exit });

  const problems: TradeCheckProblem[] = [];
  for (const { leg, price, at } of legs) {
    const t = Math.floor(at.getTime() / 1000);
    const snapped = snapToCandle(candles, t);
    // No candle containing the time, or the nearest one is stale (gap/market closed).
    if (snapped === null || t - snapped >= 2 * step) {
      problems.push({ leg, price, time: t, range: null });
      continue;
    }
    const k = candles.findIndex((c) => c.time === snapped);
    const near = candles.slice(Math.max(0, k - 1), k + 2);
    const low = Math.min(...near.map((c) => c.low));
    const high = Math.max(...near.map((c) => c.high));
    const slack = price * tolerance;
    if (price < low - slack || price > high + slack) problems.push({ leg, price, time: t, range: { low, high } });
  }
  return problems;
}

export type ChartMarker = {
  time: number;
  /** Placed at the trade's actual price, not the candle's high/low. */
  position: "atPriceBottom" | "atPriceTop" | "atPriceMiddle";
  price: number;
  shape: "arrowUp" | "arrowDown" | "circle";
  color: string;
  text: string;
};

const GREEN = "#7cc943";
const RED = "#f05252";
const NEUTRAL = "#c9d1dc";

/**
 * Entry and exit markers, drawn at the trade's actual prices: a long enters with ▲ (pointing up at
 * the price from below), a short with ▼ from above; the exit is a circle colored by the trade's
 * outcome. Points outside the loaded candles are skipped.
 */
export function buildTradeMarkers(
  trade: Pick<Trade, "direction" | "pnl" | "entryPrice" | "exitPrice">,
  instants: TradeInstants,
  candles: Candle[],
): ChartMarker[] {
  const markers: ChartMarker[] = [];
  const long = trade.direction === "long";
  const entryTime = snapToCandle(candles, Math.floor(instants.entry.getTime() / 1000));
  if (entryTime !== null) {
    markers.push({
      time: entryTime,
      position: long ? "atPriceBottom" : "atPriceTop",
      price: Number(trade.entryPrice),
      shape: long ? "arrowUp" : "arrowDown",
      color: long ? GREEN : RED,
      text: `${long ? "Long" : "Short"} ${Number(trade.entryPrice)}`,
    });
  }
  if (instants.exit && trade.exitPrice !== null) {
    const exitTime = snapToCandle(candles, Math.floor(instants.exit.getTime() / 1000));
    if (exitTime !== null) {
      const pnl = trade.pnl !== null ? Number(trade.pnl) : null;
      markers.push({
        time: exitTime,
        position: "atPriceMiddle",
        price: Number(trade.exitPrice),
        shape: "circle",
        color: pnl === null ? NEUTRAL : pnl >= 0 ? GREEN : RED,
        text: `Exit ${Number(trade.exitPrice)}`,
      });
    }
  }
  // The chart requires markers in time order.
  return markers.sort((a, b) => a.time - b.time);
}

/**
 * The IANA zone to show chart times in, matching how the account's trades were entered: its
 * timezone, or for a legacy whole-hour fixed offset the equivalent "Etc/GMT±N" zone (note Etc's
 * inverted sign: UTC−5 is "Etc/GMT+5"), else UTC.
 */
export function chartTimeZone(account: AccountClock): string {
  if (account?.brokerTimezone) return account.brokerTimezone;
  const offset = account?.brokerUtcOffsetMinutes ?? 0;
  if (offset && offset % 60 === 0) return `Etc/GMT${offset < 0 ? "+" : "-"}${Math.abs(offset) / 60}`;
  return "UTC";
}

/**
 * The time range to open the chart on: the trade plus ~30 candles either side, so a coarse
 * interval (1h/1d, whose fetched window spans days) still opens on the trade instead of the
 * whole window. Null if the trade has no valid entry.
 */
export function tradeFocusRange(instants: TradeInstants, interval: string): { from: number; to: number } | null {
  const step = INTERVAL_SECONDS[interval] ?? 60;
  const entry = Math.floor(instants.entry.getTime() / 1000);
  if (Number.isNaN(entry)) return null;
  const exit = instants.exit ? Math.floor(instants.exit.getTime() / 1000) : entry;
  return { from: entry - 30 * step, to: exit + 30 * step };
}

/** Price precision for the axis: 5 decimals for forex-style quotes, 2 otherwise. */
export function pricePrecision(price: number): number {
  return Math.abs(price) < 10 ? 5 : 2;
}

/** Axis/crosshair label for a candle time in the given zone. */
export function formatChartTime(seconds: number, timeZone: string | null, withDate: boolean): string {
  const opts: Intl.DateTimeFormatOptions = withDate
    ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
    : { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: timeZone ?? "UTC" }).format(new Date(seconds * 1000));
}
