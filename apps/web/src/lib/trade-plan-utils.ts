import type { PlanStatus, RuleSnapshotItem, TradeGrade, TradePlan } from "@pipntick/shared";
import { isRuleMet } from "@pipntick/shared";

// Derived-data helpers for the Trade Plan page. Plan days are plain local calendar days
// ("YYYY-MM-DD" in the browser's timezone) — they're planning buckets, not trade timestamps, so no
// broker-offset handling applies here (contrast trade-utils.ts).

export const GRADE_COLORS: Record<TradeGrade, { bg: string; fg: string }> = {
  F: { bg: "#f05252", fg: "#ffffff" },
  D: { bg: "#fb8c3c", fg: "#0a1206" },
  C: { bg: "#f5c542", fg: "#0a1206" },
  B: { bg: "#b9dc55", fg: "#0a1206" },
  A: { bg: "#7cc943", fg: "#0a1206" },
  "A++": { bg: "#2fe0a8", fg: "#0a1206" },
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar day as "YYYY-MM-DD". */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses a "YYYY-MM-DD" key back into a local-midnight Date. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The Sunday (local midnight) that starts the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export function addWeeks(d: Date, weeks: number): Date {
  return addDays(d, weeks * 7);
}

/** The 7 days (Sun–Sat) of the week starting at `weekStart`. */
export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** "Sep 20 – 26, 2026", "Sep 27 – Oct 3, 2026", or "Dec 27, 2026 – Jan 2, 2027". */
export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  if (weekStart.getFullYear() !== end.getFullYear()) {
    return `${month(weekStart)} ${weekStart.getDate()}, ${weekStart.getFullYear()} – ${month(end)} ${end.getDate()}, ${end.getFullYear()}`;
  }
  if (weekStart.getMonth() !== end.getMonth()) {
    return `${month(weekStart)} ${weekStart.getDate()} – ${month(end)} ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${month(weekStart)} ${weekStart.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
}

export function planProgress(rules: RuleSnapshotItem[]): { met: number; total: number; allMet: boolean } {
  const met = rules.filter(isRuleMet).length;
  const total = rules.length;
  return { met, total, allMet: total > 0 && met === total };
}

/** "7 plans · 4 logged · 1 skipped" */
export function weekSummary(plans: Pick<TradePlan, "status">[]): string {
  const count = (s: PlanStatus) => plans.filter((p) => p.status === s).length;
  return `${plans.length} ${plans.length === 1 ? "plan" : "plans"} · ${count("logged")} logged · ${count("skipped")} skipped`;
}

/**
 * Maps a plan's free-typed symbol to the Journal's instrument format. Plans accept "EURUSD" the way
 * traders type it, but the Journal (and getContractSize's forex/metal lot sizing) expects the
 * slashed "EUR/USD" form — so a 6-letter symbol matching a known slashed instrument is converted.
 */
export function toJournalSymbol(symbol: string, knownSymbols: readonly string[]): string {
  const s = symbol.trim().toUpperCase();
  if (/^[A-Z]{6}$/.test(s)) {
    const slashed = `${s.slice(0, 3)}/${s.slice(3)}`;
    if (knownSymbols.includes(slashed)) return slashed;
  }
  return s;
}

/** Plan answers in the shape PATCH /api/plans/:id accepts. */
export function toAnswers(rules: RuleSnapshotItem[]): { done: boolean; value: string | null }[] {
  return rules.map((r) => ({ done: r.done, value: r.value }));
}
