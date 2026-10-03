import { describe, expect, it } from "vitest";
import { allowedIntervals, cacheTtlMs, parseYahooChart, pickWindow, toYahooTicker } from "../../lib/market-data";

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

describe("interval selection", () => {
  const now = Date.parse("2026-10-02T16:00:00Z");

  it("offers 1m only for recent trades and daily always", () => {
    const recent = now - 2 * D;
    expect(allowedIntervals(recent, recent + H, now)).toEqual(["1m", "5m", "15m", "1h", "1d"]);
    const monthOld = now - 30 * D;
    expect(allowedIntervals(monthOld, monthOld + H, now)).toEqual(["5m", "15m", "1h", "1d"]);
    const yearOld = now - 400 * D;
    expect(allowedIntervals(yearOld, yearOld + H, now)).toEqual(["1h", "1d"]);
    const ancient = now - 1000 * D;
    expect(allowedIntervals(ancient, ancient + H, now)).toEqual(["1d"]);
  });

  it("auto picks the finest interval that keeps the window small", () => {
    const entry = now - 2 * D;
    expect(pickWindow(entry, entry + H, now)?.interval).toBe("1m"); // ~1h trade: 1m fits
    expect(pickWindow(entry, entry + 10 * H, now)?.interval).toBe("5m"); // 10h trade: 1m too many candles
    const old = now - 30 * D;
    expect(pickWindow(old, old + H, now)?.interval).toBe("5m");
  });

  it("pads the window around the trade and never past now", () => {
    const entry = now - 2 * D;
    const w = pickWindow(entry, entry + H, now, "5m")!;
    expect(w.from).toBeLessThan(entry);
    expect(w.to).toBeGreaterThan(entry + H);
    const open = pickWindow(now - H, now, now, "5m")!;
    expect(open.to).toBeLessThanOrEqual(now);
  });

  it("refuses an explicit interval beyond its history limit", () => {
    const old = now - 30 * D;
    expect(pickWindow(old, old + H, now, "1m")).toBeNull();
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
