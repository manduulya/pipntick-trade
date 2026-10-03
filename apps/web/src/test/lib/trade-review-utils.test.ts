import { describe, expect, it } from "vitest";
import type { Candle } from "@pipntick/shared";
import {
  buildTradeMarkers,
  chartTimeZone,
  checkTradeAgainstCandles,
  formatChartTime,
  pricePrecision,
  snapToCandle,
  tradeInstants,
} from "../../lib/trade-review-utils";

const bar = (time: number): Candle => ({ time, open: 1, high: 2, low: 0.5, close: 1.5 });
const candles = [bar(1000), bar(1300), bar(1600), bar(1900)];

describe("tradeInstants", () => {
  it("converts broker wall-clock times with the account's timezone", () => {
    const t = { entryTime: "2026-09-28T09:35:00.000Z", exitTime: "2026-09-28T10:38:00.000Z" };
    const ny = tradeInstants(t, { brokerTimezone: "America/New_York" });
    expect(ny.entry.toISOString()).toBe("2026-09-28T13:35:00.000Z");
    expect(ny.exit?.toISOString()).toBe("2026-09-28T14:38:00.000Z");
    expect(tradeInstants({ ...t, exitTime: null }, null).exit).toBeNull();
  });
});

describe("snapToCandle", () => {
  it("returns the candle containing the time", () => {
    expect(snapToCandle(candles, 1450)).toBe(1300);
    expect(snapToCandle(candles, 1600)).toBe(1600);
    expect(snapToCandle(candles, 5000)).toBe(1900);
  });

  it("returns null before the data or with no data", () => {
    expect(snapToCandle(candles, 500)).toBeNull();
    expect(snapToCandle([], 1000)).toBeNull();
  });
});

describe("buildTradeMarkers", () => {
  const instants = { entry: new Date(1350 * 1000), exit: new Date(1700 * 1000) };

  it("marks a long entry below the bar and a losing exit in red", () => {
    const markers = buildTradeMarkers({ direction: "long", pnl: "-131.25", entryPrice: "7761.75", exitPrice: "7756.5" }, instants, candles);
    expect(markers).toEqual([
      { time: 1300, position: "atPriceBottom", price: 7761.75, shape: "arrowUp", color: "#7cc943", text: "Long 7761.75" },
      { time: 1600, position: "atPriceMiddle", price: 7756.5, shape: "circle", color: "#f05252", text: "Exit 7756.5" },
    ]);
  });

  it("marks a short entry above the bar and skips the exit for an open trade", () => {
    const markers = buildTradeMarkers(
      { direction: "short", pnl: null, entryPrice: "100", exitPrice: null },
      { entry: instants.entry, exit: null },
      candles,
    );
    expect(markers).toEqual([{ time: 1300, position: "atPriceTop", price: 100, shape: "arrowDown", color: "#f05252", text: "Short 100" }]);
  });
});

describe("checkTradeAgainstCandles", () => {
  // 15m gold candles trading ~4386-4410 around the entry and ~4318-4330 around the exit.
  const gold = (time: number, low: number, high: number): Candle => ({ time, open: low, high, low, close: high });
  const candles15 = [
    gold(9000, 4386, 4400), gold(9900, 4390, 4410), gold(10800, 4388, 4405),
    gold(90000, 4318, 4326), gold(90900, 4320, 4330), gold(91800, 4319, 4328),
  ];
  const instants = { entry: new Date(10000 * 1000), exit: new Date(91000 * 1000) };

  it("accepts a trade whose prices traded at those times (within tolerance)", () => {
    expect(checkTradeAgainstCandles({ entryPrice: "4401.5", exitPrice: "4325" }, instants, candles15, "15m")).toEqual([]);
    // Slightly outside the range but within 0.5% (front-month vs traded contract) still passes.
    expect(checkTradeAgainstCandles({ entryPrice: "4420", exitPrice: "4325" }, instants, candles15, "15m")).toEqual([]);
  });

  it("flags prices that never traded around then (the dummy MGC 4500 → 4600 trade)", () => {
    const problems = checkTradeAgainstCandles({ entryPrice: "4500", exitPrice: "4600" }, instants, candles15, "15m");
    expect(problems).toEqual([
      { leg: "Entry", price: 4500, time: 10000, range: { low: 4386, high: 4410 } },
      { leg: "Exit", price: 4600, time: 91000, range: { low: 4318, high: 4330 } },
    ]);
  });

  it("flags a time with no market data near it", () => {
    const closed = { entry: new Date(50000 * 1000), exit: null }; // between the two clusters (market closed)
    expect(checkTradeAgainstCandles({ entryPrice: "4390", exitPrice: null }, closed, candles15, "15m")).toEqual([
      { leg: "Entry", price: 4390, time: 50000, range: null },
    ]);
    expect(checkTradeAgainstCandles({ entryPrice: "4390", exitPrice: null }, { entry: new Date(100), exit: null }, candles15, "15m")[0].range)
      .toBeNull();
  });
});

describe("chart display helpers", () => {
  it("shows times in the account zone, mapping legacy whole-hour offsets to Etc zones", () => {
    expect(chartTimeZone({ brokerTimezone: "America/Chicago" })).toBe("America/Chicago");
    expect(chartTimeZone({ brokerUtcOffsetMinutes: -300 })).toBe("Etc/GMT+5");
    expect(chartTimeZone({ brokerUtcOffsetMinutes: 120 })).toBe("Etc/GMT-2");
    expect(chartTimeZone({ brokerUtcOffsetMinutes: 330 })).toBe("UTC");
    expect(chartTimeZone(null)).toBe("UTC");
  });

  it("formats candle times in the zone", () => {
    const t = Date.parse("2026-09-28T14:38:00Z") / 1000;
    expect(formatChartTime(t, "America/New_York", false)).toBe("10:38");
    expect(formatChartTime(t, "America/New_York", true)).toBe("Sep 28, 10:38");
  });

  it("uses forex precision for small prices", () => {
    expect(pricePrecision(1.13714)).toBe(5);
    expect(pricePrecision(7761.75)).toBe(2);
  });
});
