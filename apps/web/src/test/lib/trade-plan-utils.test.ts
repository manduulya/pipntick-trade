import { describe, expect, it } from "vitest";
import type { RuleSnapshotItem } from "@pipntick/shared";
import {
  addWeeks,
  formatWeekRange,
  fromDateKey,
  planProgress,
  startOfWeek,
  toAnswers,
  toDateKey,
  toJournalSymbol,
  weekDays,
  weekSummary,
} from "../../lib/trade-plan-utils";

const check = (done: boolean): RuleSnapshotItem => ({ text: "c", type: "check", options: [], done, value: null });
const choice = (value: string | null): RuleSnapshotItem => ({ text: "q", type: "choice", options: ["Up", "Down"], done: false, value });

describe("week helpers", () => {
  it("starts the week on Sunday", () => {
    expect(toDateKey(startOfWeek(new Date(2026, 8, 26)))).toBe("2026-09-20"); // Sat -> Sun 20th
    expect(toDateKey(startOfWeek(new Date(2026, 8, 20)))).toBe("2026-09-20"); // Sunday itself
  });

  it("lists the 7 days Sun–Sat and steps by whole weeks", () => {
    const start = new Date(2026, 8, 20);
    expect(weekDays(start).map(toDateKey)).toEqual([
      "2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26",
    ]);
    expect(toDateKey(addWeeks(start, 1))).toBe("2026-09-27");
    expect(toDateKey(addWeeks(start, -1))).toBe("2026-09-13");
  });

  it("round-trips date keys", () => {
    expect(toDateKey(fromDateKey("2026-03-08"))).toBe("2026-03-08");
  });

  it("formats week ranges within a month, across months and across years", () => {
    expect(formatWeekRange(new Date(2026, 8, 20))).toBe("Sep 20 – 26, 2026");
    expect(formatWeekRange(new Date(2026, 8, 27))).toBe("Sep 27 – Oct 3, 2026");
    expect(formatWeekRange(new Date(2026, 11, 27))).toBe("Dec 27, 2026 – Jan 2, 2027");
  });
});

describe("planProgress", () => {
  it("counts ticked checks and answered choices", () => {
    expect(planProgress([check(true), check(false), choice("Up"), choice(null)])).toEqual({ met: 2, total: 4, allMet: false });
    expect(planProgress([check(true), choice("Down")])).toEqual({ met: 2, total: 2, allMet: true });
  });

  it("never reports an empty checklist as all met", () => {
    expect(planProgress([])).toEqual({ met: 0, total: 0, allMet: false });
  });
});

describe("weekSummary", () => {
  it("counts plans by status", () => {
    expect(weekSummary([{ status: "logged" }, { status: "skipped" }, { status: "planned" }, { status: "logged" }])).toBe(
      "4 plans · 2 logged · 1 skipped",
    );
    expect(weekSummary([{ status: "planned" }])).toBe("1 plan · 0 logged · 0 skipped");
  });
});

describe("toJournalSymbol", () => {
  const known = ["EUR/USD", "XAU/USD", "NAS100"];
  it("slashes a known 6-letter pair", () => {
    expect(toJournalSymbol("eurusd", known)).toBe("EUR/USD");
    expect(toJournalSymbol("XAUUSD", known)).toBe("XAU/USD");
  });

  it("leaves everything else as typed (upper-cased)", () => {
    expect(toJournalSymbol("nas100", known)).toBe("NAS100");
    expect(toJournalSymbol("ABCDEF", known)).toBe("ABCDEF");
    expect(toJournalSymbol("EUR/USD", known)).toBe("EUR/USD");
  });
});

describe("toAnswers", () => {
  it("keeps only done/value", () => {
    expect(toAnswers([check(true), choice("Up")])).toEqual([
      { done: true, value: null },
      { done: false, value: "Up" },
    ]);
  });
});
