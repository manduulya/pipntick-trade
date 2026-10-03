import { describe, expect, it } from "vitest";
import { aggregateCandles, allowedIntervals, cacheTtlMs, parseYahooChart, pickWindow, toYahooTicker } from "../../lib/market-data";

const H = 3_600_000;
const D = 24 * H;

describe("toYahooTicker", () => {
  it("maps futures to continuous contracts, micros to their parent", () => {
    expect(toYahooTicker("MES")).toMatchObject({ ticker: "ES=F", approximate: false });
    expect(toYahooTicker("mgc")?.ticker).toBe("GC=F");
    expect(toYahooTicker("ZW")?.ticker).toBe("ZW=F");
    expect(toYahooTicker("6E")?.ticker).toBe("6E=F");
  });

  it("maps forex, metals, crypto, index CFDs and stocks", () => {
    expect(toYahooTicker("EUR/USD")?.ticker).toBe("EURUSD=X");
    expect(toYahooTicker("XAU/USD")).toMatchObject({ ticker: "GC=F", approximate: true });
    expect(toYahooTicker("BTC/USD")?.ticker).toBe("BTC-USD");
    expect(toYahooTicker("NAS100")).toMatchObject({ ticker: "^NDX", approximate: true });
    expect(toYahooTicker("AAPL")?.ticker).toBe("AAPL");
    expect(toYahooTicker("BRK.B")?.ticker).toBe("BRK-B");
  });

  it("returns null for things it can't chart", () => {
    expect(toYahooTicker("")).toBeNull();
    expect(toYahooTicker("NOT A SYMBOL!")).toBeNull();
  });
});

describe("interval selection (15m / 30m / 1h / 4h)", () => {
  const now = Date.parse("2026-10-02T16:00:00Z");

  it("offers 15m/30m for ~60 days and 1h/4h for ~2 years", () => {
    const recent = now - 2 * D;
    expect(allowedIntervals(recent, recent + H, now)).toEqual(["15m", "30m", "1h", "4h"]);
    const yearOld = now - 400 * D;
    expect(allowedIntervals(yearOld, yearOld + H, now)).toEqual(["1h", "4h"]);
    const ancient = now - 1000 * D;
    expect(allowedIntervals(ancient, ancient + H, now)).toEqual([]);
  });

  it("uses the requested interval, defaulting to 15m", () => {
    const entry = now - 2 * D;
    expect(pickWindow(entry, entry + H, now)?.interval).toBe("15m");
    expect(pickWindow(entry, entry + H, now, "4h")).toMatchObject({ interval: "4h", yahooInterval: "60m", aggregateSeconds: 14_400 });
  });

  it("falls back to the next coarser interval when history doesn't reach the trade", () => {
    const yearOld = now - 400 * D;
    expect(pickWindow(yearOld, yearOld + H, now, "15m")?.interval).toBe("1h");
    expect(pickWindow(now - 1000 * D, now - 1000 * D + H, now, "15m")).toBeNull();
  });

  it("pads the window around the trade and never past now", () => {
    const entry = now - 2 * D;
    const w = pickWindow(entry, entry + H, now, "15m")!;
    expect(w.from).toBeLessThan(entry);
    expect(w.to).toBeGreaterThan(entry + H);
    expect(pickWindow(now - H, now, now, "15m")!.to).toBeLessThanOrEqual(now);
  });
});

describe("aggregateCandles", () => {
  it("merges 1h bars into UTC-aligned 4h bars", () => {
    const h = (time: number, open: number, high: number, low: number, close: number) => ({ time, open, high, low, close });
    const out = aggregateCandles(
      [h(0, 10, 12, 9, 11), h(3600, 11, 15, 10, 14), h(7200, 14, 14, 8, 9), h(10800, 9, 10, 7, 8), h(14400, 8, 9, 6, 7)],
      14_400,
    );
    expect(out).toEqual([
      { time: 0, open: 10, high: 15, low: 7, close: 8 },
      { time: 14_400, open: 8, high: 9, low: 6, close: 7 },
    ]);
  });
});

describe("parseYahooChart", () => {
  it("drops null bars and sorts by time", () => {
    const candles = parseYahooChart({
      chart: {
        result: [
          {
            timestamp: [300, 100, 200],
            indicators: { quote: [{ open: [3, 1, null], high: [3.5, 1.5, 2], low: [2.5, 0.5, 1], close: [3.2, 1.2, 2] }] },
          },
        ],
      },
    });
    expect(candles).toEqual([
      { time: 100, open: 1, high: 1.5, low: 0.5, close: 1.2 },
      { time: 300, open: 3, high: 3.5, low: 2.5, close: 3.2 },
    ]);
    expect(parseYahooChart({ chart: { result: null } })).toEqual([]);
  });
});

describe("cacheTtlMs", () => {
  it("keeps finished history for a day and live windows for a minute", () => {
    const now = Date.now();
    expect(cacheTtlMs(now - 2 * H, now)).toBe(D);
    expect(cacheTtlMs(now - 60_000, now)).toBe(60_000);
  });
});
