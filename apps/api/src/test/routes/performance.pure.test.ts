import { describe, expect, it } from "vitest";
import { computePerformanceSummary, type PerformanceTradeRow } from "../../routes/performance";

function row(overrides: Partial<PerformanceTradeRow> = {}): PerformanceTradeRow {
  return {
    pnl: "10.00",
    direction: "long",
    symbol: "EUR/USD",
    entryTime: new Date("2026-03-15T10:00:00.000Z"),
    exitTime: new Date("2026-03-15T12:00:00.000Z"),
    ...overrides,
  };
}

describe("computePerformanceSummary", () => {
  it("returns safe zeroed values for an empty input (no division by zero)", () => {
    const summary = computePerformanceSummary([], "monthly");
    expect(summary).toMatchObject({
      period: "monthly",
      pnl: 0,
      winRate: 0,
      profitFactor: null,
      avgWin: 0,
      avgLoss: 0,
      totalTrades: 0,
      avgDurationMinutes: 0,
      byInstrument: [],
    });
    expect(summary.byDirection).toHaveLength(2); // always both long and short
  });

  it("excludes rows with a null pnl (still-open trades that slipped through the query)", () => {
    const summary = computePerformanceSummary([row({ pnl: null })], "weekly");
    expect(summary.totalTrades).toBe(0);
  });

  it("computes total pnl, win rate, and profit factor over a mixed set", () => {
    const rows = [
      row({ pnl: "100.00" }),
      row({ pnl: "50.00" }),
      row({ pnl: "-50.00" }),
    ];
    const summary = computePerformanceSummary(rows, "monthly");
    expect(summary.pnl).toBe(100);
    expect(summary.winRate).toBe(67); // 2/3 rounded
    expect(summary.profitFactor).toBe(3); // 150 gross profit / 50 gross loss
    expect(summary.avgWin).toBeCloseTo(75);
    expect(summary.avgLoss).toBeCloseTo(-50);
    expect(summary.totalTrades).toBe(3);
  });

  it("guards profitFactor against division by zero when there are no losses", () => {
    const summary = computePerformanceSummary([row({ pnl: "10.00" })], "monthly");
    expect(summary.profitFactor).toBeNull();
  });

  it("averages duration only over trades that actually have an exitTime", () => {
    const rows = [
      row({ entryTime: new Date("2026-03-15T10:00:00Z"), exitTime: new Date("2026-03-15T11:00:00Z") }), // 60 min
      row({ entryTime: new Date("2026-03-15T10:00:00Z"), exitTime: new Date("2026-03-15T10:30:00Z") }), // 30 min
    ];
    const summary = computePerformanceSummary(rows, "monthly");
    expect(summary.avgDurationMinutes).toBe(45);
  });

  it("groups pnl and win rate by instrument", () => {
    const rows = [
      row({ symbol: "EUR/USD", pnl: "10.00" }),
      row({ symbol: "EUR/USD", pnl: "-5.00" }),
      row({ symbol: "GBP/USD", pnl: "20.00" }),
    ];
    const summary = computePerformanceSummary(rows, "monthly");
    const eurusd = summary.byInstrument.find((i) => i.symbol === "EUR/USD")!;
    expect(eurusd.trades).toBe(2);
    expect(eurusd.pnl).toBeCloseTo(5);
    expect(eurusd.winRate).toBe(50);
  });

  it("always includes both long and short in byDirection, even with zero trades", () => {
    const summary = computePerformanceSummary([row({ direction: "long", pnl: "10.00" })], "monthly");
    const short = summary.byDirection.find((d) => d.direction === "short")!;
    expect(short.trades).toBe(0);
    expect(short.winRate).toBe(0);
    expect(short.avgPnl).toBe(0);
    const long = summary.byDirection.find((d) => d.direction === "long")!;
    expect(long.trades).toBe(1);
    expect(long.avgPnl).toBeCloseTo(10);
  });
});
