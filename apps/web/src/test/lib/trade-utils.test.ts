import { describe, expect, it, vi } from "vitest";
import type { Trade } from "@pipntick/shared";
import {
  computeCharts,
  computeDashboardStats,
  computeDirectionRows,
  computeInstrumentRows,
  computeMonthCalendar,
  computePeriodStats,
  filterByPeriod,
  formatDuration,
  isClosed,
  periodLabel,
  periodOffsetFor,
  periodRange,
  pnlOf,
  toJournalRow,
} from "../../lib/trade-utils";

// Minimal builder — only the fields each test cares about need overriding.
function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "trade-1",
    accountId: "acct-1",
    symbol: "EUR/USD",
    direction: "long",
    status: "closed",
    entryPrice: "1.1000",
    exitPrice: "1.1050",
    lotSize: "1",
    pnl: "50.00",
    pnlManual: false,
    swap: null,
    commission: null,
    entryTime: "2026-03-15T10:00:00.000Z",
    exitTime: "2026-03-15T12:00:00.000Z",
    session: "London",
    source: "manual",
    screenshotUrl: null,
    notes: "",
    createdAt: "2026-03-15T10:00:00.000Z",
    updatedAt: "2026-03-15T10:00:00.000Z",
    ...overrides,
  };
}

describe("periodRange", () => {
  it("returns Sun-Sat for the week containing `from`", () => {
    // 2026-03-18 is a Wednesday.
    const { start, end } = periodRange("weekly", 0, new Date(2026, 2, 18));
    expect(start).toEqual(new Date(2026, 2, 15)); // Sunday
    expect(end).toEqual(new Date(2026, 2, 22)); // next Sunday (exclusive)
  });

  it("returns the 1st through the next month's 1st for monthly", () => {
    const { start, end } = periodRange("monthly", 0, new Date(2026, 2, 18));
    expect(start).toEqual(new Date(2026, 2, 1));
    expect(end).toEqual(new Date(2026, 3, 1));
  });

  it("returns Jan 1 - next Jan 1 for yearly", () => {
    const { start, end } = periodRange("yearly", 0, new Date(2026, 2, 18));
    expect(start).toEqual(new Date(2026, 0, 1));
    expect(end).toEqual(new Date(2027, 0, 1));
  });

  it("offset pages backward in whole periods", () => {
    const { start, end } = periodRange("monthly", 2, new Date(2026, 2, 18));
    expect(start).toEqual(new Date(2026, 0, 1)); // Jan
    expect(end).toEqual(new Date(2026, 1, 1)); // Feb
  });
});

describe("periodOffsetFor", () => {
  it("is 0 when the date falls in the same month as `from`", () => {
    expect(periodOffsetFor("monthly", new Date(2026, 2, 5), new Date(2026, 2, 20))).toBe(0);
  });

  it("counts whole months back for monthly", () => {
    expect(periodOffsetFor("monthly", new Date(2025, 11, 5), new Date(2026, 2, 20))).toBe(3);
  });

  it("counts whole years back for yearly", () => {
    expect(periodOffsetFor("yearly", new Date(2023, 5, 1), new Date(2026, 2, 20))).toBe(3);
  });

  it("never returns negative (a future date clamps to 0)", () => {
    expect(periodOffsetFor("monthly", new Date(2027, 0, 1), new Date(2026, 2, 20))).toBe(0);
  });
});

describe("periodLabel", () => {
  it("formats a monthly label as 'Month Year'", () => {
    expect(periodLabel("monthly", 0, new Date(2026, 2, 18))).toBe("March 2026");
  });

  it("formats a yearly label as just the year", () => {
    expect(periodLabel("yearly", 0, new Date(2026, 2, 18))).toBe("2026");
  });

  it("formats a weekly label spanning two months within the same year", () => {
    // Week of 2026-03-18 (Wed) is Mar 15 - Mar 21.
    expect(periodLabel("weekly", 0, new Date(2026, 2, 18))).toBe("Mar 15 - Mar 21, 2026");
  });
});

describe("filterByPeriod", () => {
  it("keeps only trades whose entryTime falls within the period", () => {
    const trades = [
      makeTrade({ id: "in", entryTime: new Date().toISOString() }),
      makeTrade({ id: "out", entryTime: "2000-01-01T00:00:00.000Z" }),
    ];
    const result = filterByPeriod(trades, "yearly", 0);
    expect(result.map((t) => t.id)).toEqual(["in"]);
  });

  it("includes a trade entered at UTC midnight on the 1st in that UTC month, even behind UTC", () => {
    const originalTZ = process.env.TZ;
    process.env.TZ = "America/New_York"; // UTC-4/-5
    vi.useFakeTimers();
    // Pinned mid-month so "now" isn't itself near a month boundary — this test is only about the
    // trade's own UTC wall-clock day, not about how "this month" is defined for the viewer.
    vi.setSystemTime(new Date("2026-08-15T12:00:00.000Z"));
    try {
      const trade = makeTrade({ entryTime: "2026-08-01T00:00:00.000Z", pnl: "10.00" });
      const result = filterByPeriod([trade], "monthly", 0);
      expect(result).toHaveLength(1);
    } finally {
      vi.useRealTimers();
      process.env.TZ = originalTZ;
    }
  });
});

describe("isClosed", () => {
  it("is true only for closed status with a non-null pnl", () => {
    expect(isClosed(makeTrade({ status: "closed", pnl: "10.00" }))).toBe(true);
    expect(isClosed(makeTrade({ status: "open", pnl: null }))).toBe(false);
    expect(isClosed(makeTrade({ status: "closed", pnl: null }))).toBe(false);
  });
});

describe("pnlOf", () => {
  it("parses the numeric string", () => {
    expect(pnlOf(makeTrade({ pnl: "-12.34" }))).toBeCloseTo(-12.34);
  });

  it("treats a null pnl as 0", () => {
    expect(pnlOf(makeTrade({ pnl: null }))).toBe(0);
  });
});

describe("formatDuration", () => {
  it("formats hours and zero-padded minutes", () => {
    expect(formatDuration("2026-03-15T10:00:00.000Z", "2026-03-15T12:05:00.000Z")).toBe("2h 05m");
  });

  it("returns an em dash when there's no exit time", () => {
    expect(formatDuration("2026-03-15T10:00:00.000Z", null)).toBe("—");
  });

  it("returns an em dash when exit is not after entry", () => {
    expect(formatDuration("2026-03-15T10:00:00.000Z", "2026-03-15T09:00:00.000Z")).toBe("—");
  });
});

describe("toJournalRow", () => {
  it("combines swap + commission into fees when either is present", () => {
    const row = toJournalRow(makeTrade({ swap: "-1.50", commission: "-2.00" }));
    expect(row.fees).toBeCloseTo(-3.5);
  });

  it("treats a missing swap as 0 when only commission is present", () => {
    const row = toJournalRow(makeTrade({ swap: null, commission: "-2.00" }));
    expect(row.fees).toBeCloseTo(-2);
  });

  it("leaves fees null when neither swap nor commission was recorded", () => {
    const row = toJournalRow(makeTrade({ swap: null, commission: null }));
    expect(row.fees).toBeNull();
  });

  it("falls back session to an em dash when unset", () => {
    const row = toJournalRow(makeTrade({ session: null }));
    expect(row.session).toBe("—");
  });
});

describe("computePeriodStats", () => {
  it("returns zeroed placeholders for an empty trade list", () => {
    const stats = computePeriodStats([], "monthly", 0);
    expect(stats.pnl).toBe("+$0.00");
    expect(stats.winRate).toBe("0%");
    expect(stats.profitFactor).toBe("—"); // no losses -> division-by-zero guard
    expect(stats.avgWin).toBe("$0.00");
    expect(stats.avgLoss).toBe("$0.00");
    expect(stats.trades).toBe("0");
    expect(stats.avgDuration).toBe("—");
  });

  it("computes win rate, profit factor, and averages over a mixed set", () => {
    const trades = [
      makeTrade({ id: "w1", pnl: "100.00" }),
      makeTrade({ id: "w2", pnl: "50.00" }),
      makeTrade({ id: "l1", pnl: "-50.00" }),
    ];
    const stats = computePeriodStats(trades, "monthly", 0);
    expect(stats.pnl).toBe("+$100.00");
    expect(stats.pnlPos).toBe(true);
    expect(stats.winRate).toBe("67%"); // 2/3 rounded
    expect(stats.winRateSub).toBe("2 wins / 1 losses");
    expect(stats.profitFactor).toBe("3.00"); // 150 gross profit / 50 gross loss
    expect(stats.avgWin).toBe("+$75.00");
    expect(stats.avgLoss).toBe("-$50.00");
    expect(stats.trades).toBe("3");
  });

  it("guards profit factor against division by zero when there are no losses", () => {
    const trades = [makeTrade({ pnl: "10.00" })];
    expect(computePeriodStats(trades, "monthly", 0).profitFactor).toBe("—");
  });
});

describe("computeInstrumentRows", () => {
  it("groups by symbol and computes per-symbol win rate", () => {
    const trades = [
      makeTrade({ symbol: "EUR/USD", pnl: "10.00" }),
      makeTrade({ symbol: "EUR/USD", pnl: "-5.00" }),
      makeTrade({ symbol: "GBP/USD", pnl: "20.00" }),
    ];
    const rows = computeInstrumentRows(trades);
    const eurusd = rows.find((r) => r.symbol === "EUR/USD")!;
    expect(eurusd.trades).toBe(2);
    expect(eurusd.pnl).toBeCloseTo(5);
    expect(eurusd.winRate).toBe(50);

    const gbpusd = rows.find((r) => r.symbol === "GBP/USD")!;
    expect(gbpusd.trades).toBe(1);
    expect(gbpusd.winRate).toBe(100);
  });
});

describe("computeDirectionRows", () => {
  it("always includes both long and short, even with zero trades", () => {
    const rows = computeDirectionRows([makeTrade({ direction: "long", pnl: "10.00" })]);
    expect(rows).toHaveLength(2);
    const short = rows.find((r) => r.direction === "Short")!;
    expect(short.trades).toBe(0);
    expect(short.winRate).toBe(0);
    expect(short.avgPnl).toBe(0);
  });
});

describe("computeDashboardStats", () => {
  it("counts trades in the current calendar month", () => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 5).toISOString();
    const trades = [
      makeTrade({ id: "a", entryTime: thisMonth, pnl: "10.00" }),
      makeTrade({ id: "b", entryTime: "2000-01-01T00:00:00.000Z", pnl: "-5.00" }),
    ];
    const stats = computeDashboardStats(trades);
    expect(stats.totalPnl).toBeCloseTo(5);
    expect(stats.winRate).toBe(50);
    expect(stats.totalTrades).toBe(2);
    expect(stats.tradesThisMonth).toBe(1);
  });
});

describe("computeMonthCalendar", () => {
  it("buckets trades by day-of-month and skips trades without a pnl", () => {
    const trades = [
      makeTrade({ entryTime: "2026-03-05T10:00:00.000Z", pnl: "10.00" }),
      makeTrade({ entryTime: "2026-03-05T14:00:00.000Z", pnl: "5.00" }),
      makeTrade({ entryTime: "2026-03-06T10:00:00.000Z", pnl: null }), // open, excluded
      makeTrade({ entryTime: "2026-04-05T10:00:00.000Z", pnl: "99.00" }), // wrong month, excluded
    ];
    const calendar = computeMonthCalendar(trades, 2026, 2); // March = month index 2
    expect(calendar[5]).toEqual({ trades: 2, pnl: 15 });
    expect(calendar[6]).toBeUndefined();
  });

  // entryTime is entered and stored as literal UTC wall-clock digits (TradeForm appends "Z" to
  // whatever was typed, regardless of the trader's real timezone), not a timezone-aware instant.
  // A trade entered as midnight UTC on the 4th is 8pm on the 3rd in any timezone behind UTC, so
  // reading it with plain local Date getters used to silently shift it back a day for most of the
  // Americas. Runs under a real timezone offset (not just UTC, which is this machine's default and
  // wouldn't have caught the bug) to prove the fix actually corrects for it.
  it("buckets a trade by its UTC wall-clock day even in a timezone behind UTC", () => {
    const originalTZ = process.env.TZ;
    process.env.TZ = "America/New_York"; // UTC-4/-5
    try {
      const trade = makeTrade({ entryTime: "2026-08-04T00:00:00.000Z", pnl: "15.00" });
      const calendar = computeMonthCalendar([trade], 2026, 7); // August = month index 7
      expect(calendar[4]).toEqual({ trades: 1, pnl: 15 });
      expect(calendar[3]).toBeUndefined();
    } finally {
      process.env.TZ = originalTZ;
    }
  });
});

describe("computeCharts", () => {
  it("carries prior pnl into the baseline and leaves future buckets null", () => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const priorTrade = makeTrade({
      id: "prior",
      entryTime: new Date(thisMonthStart.getTime() - 86400000).toISOString(), // last day of prior month
      pnl: "100.00",
    });
    const { growthData } = computeCharts([priorTrade], "monthly", 1000, 0);

    // Baseline should include the prior trade's pnl even though it's outside this period.
    const firstRealValue = growthData.find((p) => p.value !== null)!;
    expect(firstRealValue.value).toBeGreaterThanOrEqual(1100);

    // Any bucket dated after "today" within the current month should be null.
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (now.getDate() < daysInMonth) {
      expect(growthData[growthData.length - 1].value).toBeNull();
    }
  });

  it("produces one bucket per day for a monthly view and one per month for a yearly view", () => {
    const { growthData: monthly } = computeCharts([], "monthly", 0, 1);
    const { growthData: yearly } = computeCharts([], "yearly", 0, 1);
    expect(yearly).toHaveLength(12);
    expect(monthly.length).toBeGreaterThanOrEqual(28);
    expect(monthly.length).toBeLessThanOrEqual(31);
  });
});
