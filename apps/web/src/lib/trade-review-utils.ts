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

export type ChartMarker = {
  time: number;
  position: "belowBar" | "aboveBar";
  shape: "arrowUp" | "arrowDown" | "circle";
  color: string;
  text: string;
};

const GREEN = "#7cc943";
const RED = "#f05252";
const NEUTRAL = "#c9d1dc";

/**
 * Entry and exit markers: a long enters with ▲ below the bar, a short with ▼ above; the exit is a
 * circle colored by the trade's outcome. Points outside the loaded candles are skipped.
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
      position: long ? "belowBar" : "aboveBar",
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
        position: long ? "aboveBar" : "belowBar",
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
