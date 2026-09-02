import type { Trade } from "@pipntick/shared";

export type Period = "weekly" | "monthly" | "yearly";

// entryTime/exitTime are entered and stored as literal wall-clock digits in the account's
// broker-server timezone (TradeForm appends "Z" to whatever the user typed — see its date-field
// labels, and `brokerWallClockToUtc` for the few checks that do need a real instant) — not a
// timezone-aware instant tied to wherever the trade happened. Calendar/period bucketing needs to
// group by *that* wall-clock date, not by whatever local date the underlying UTC instant happens
// to fall on for the viewer's browser: a trade entered as "2026-08-04T00:00Z" is midnight Aug 3
// local in any timezone behind UTC, so reading it with plain local getters (getDate(), getMonth(),
// ...) silently shifts it back a day for most of the Americas. Reconstructing a Date from the UTC
// fields makes its *local* getters return the original wall-clock digits instead, so all the
// local-getter-based bucketing below (periodRange's boundaries, computeCharts' bucket keys, etc.)
// lines up correctly. Never use this for elapsed-time arithmetic (formatDuration, avgDuration) —
// those need the real instant.
export function utcWallClock(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}

// ISO-like "YYYY-MM-DDTHH:mm:ss" -> "YYYY-MM-DDTHH:mm" (the <input type="datetime-local"> value
// shape). A plain slice, not a Date round-trip, so the stored wall-clock digits are preserved as-is.
export function toDatetimeLocal(value: string | null | undefined): string {
  return value ? value.slice(0, 16) : "";
}

// Maps an "HH:mm" **UTC** time-of-day to the forex session that's active then. Callers hold a
// broker wall-clock time, so convert with `brokerWallClockToUtc` before calling — the boundaries
// here are UTC hours (London 08:00-13:00, London/NY overlap 13:00-17:00, NY 17:00-22:00, Tokyo
// 00:00-09:00, Sydney otherwise).
export function detectSession(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const mins = h * 60 + m;
  if (mins >= 480 && mins < 780)  return "London";
  if (mins >= 780 && mins < 1020) return "London / New York";
  if (mins >= 1020 && mins < 1320) return "New York";
  if (mins >= 0   && mins < 540)  return "Tokyo";
  return "Sydney";
}

// Calendar-aligned, not a rolling window: "weekly" is Sun-Sat of a given week, "monthly" is the
// 1st through the last day of a given month, "yearly" is Jan 1 - Dec 31 of a given year.
// `offset` counts periods back from `from` (0 = the period containing `from`, 1 = the previous
// period, etc.) so callers can page backward/forward through history.
export function periodRange(period: Period, offset: number = 0, from: Date = new Date()): { start: Date; end: Date } {
  if (period === "weekly") {
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate() - from.getDay() - offset * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    return { start, end };
  }
  if (period === "monthly") {
    const start = new Date(from.getFullYear(), from.getMonth() - offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return { start, end };
  }
  const start = new Date(from.getFullYear() - offset, 0, 1);
  const end = new Date(start.getFullYear() + 1, 0, 1);
  return { start, end };
}

// How many periods back `date` falls from `from` — used to cap back-navigation at the account's
// creation period (can't page earlier than the period the account was created in).
export function periodOffsetFor(period: Period, date: Date, from: Date = new Date()): number {
  if (period === "weekly") {
    const fromWeekStart = new Date(from.getFullYear(), from.getMonth(), from.getDate() - from.getDay());
    const dateWeekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
    return Math.max(0, Math.round((fromWeekStart.getTime() - dateWeekStart.getTime()) / (7 * 86400000)));
  }
  if (period === "monthly") {
    return Math.max(0, (from.getFullYear() - date.getFullYear()) * 12 + (from.getMonth() - date.getMonth()));
  }
  return Math.max(0, from.getFullYear() - date.getFullYear());
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function periodLabel(period: Period, offset: number = 0, from: Date = new Date()): string {
  const { start, end } = periodRange(period, offset, from);
  if (period === "weekly") {
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
    const fmt = (d: Date) => `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
    return start.getFullYear() === last.getFullYear() ? `${fmt(start)} - ${fmt(last)}, ${last.getFullYear()}` : `${fmt(start)}, ${start.getFullYear()} - ${fmt(last)}, ${last.getFullYear()}`;
  }
  if (period === "monthly") return `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
  return `${start.getFullYear()}`;
}

export function filterByPeriod(trades: Trade[], period: Period, offset: number = 0): Trade[] {
  const { start, end } = periodRange(period, offset);
  return trades.filter((t) => {
    const d = utcWallClock(t.entryTime);
    return d >= start && d < end;
  });
}

export function isClosed(t: Trade): boolean {
  return t.status === "closed" && t.pnl !== null;
}

export function pnlOf(t: Trade): number {
  return t.pnl !== null ? Number(t.pnl) : 0;
}

export function formatDuration(entryTime: string, exitTime: string | null): string {
  if (!exitTime) return "—";
  const ms = new Date(exitTime).getTime() - new Date(entryTime).getTime();
  if (ms <= 0) return "—";
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function directionLabel(direction: Trade["direction"]): "Long" | "Short" {
  return direction === "long" ? "Long" : "Short";
}

// ---- Journal ----

export type JournalRow = {
  id: string;
  date: string;
  instrument: string;
  direction: "Long" | "Short";
  entryPrice: number;
  exitPrice: number | null;
  lotSize: number;
  pnl: number | null;
  /** Swap + commission combined (signed — negative is a cost). Null if neither was recorded. */
  fees: number | null;
  session: string;
  duration: string;
  notes: string;
};

export function toJournalRow(t: Trade): JournalRow {
  // Loose checks (`!= null`) catch both `null` and `undefined` — the latter shows up if the
  // API response predates these fields (e.g. a server that hasn't picked up the schema change).
  const swapNum = t.swap != null ? Number(t.swap) : null;
  const commissionNum = t.commission != null ? Number(t.commission) : null;
  const fees = swapNum !== null || commissionNum !== null ? (swapNum ?? 0) + (commissionNum ?? 0) : null;
  return {
    id: t.id,
    date: t.entryTime.slice(0, 10),
    instrument: t.symbol,
    direction: directionLabel(t.direction),
    entryPrice: Number(t.entryPrice),
    exitPrice: t.exitPrice !== null ? Number(t.exitPrice) : null,
    lotSize: Number(t.lotSize),
    pnl: t.pnl !== null ? Number(t.pnl) : null,
    fees,
    session: t.session ?? "—",
    duration: formatDuration(t.entryTime, t.exitTime),
    notes: t.notes ?? "",
  };
}

// ---- Performance ----

export type PeriodStats = {
  pnl: string;
  pnlPos: boolean;
  winRate: string;
  winRateSub: string;
  profitFactor: string;
  avgWin: string;
  avgLoss: string;
  trades: string;
  tradesSub: string;
  avgDuration: string;
  avgDurationSub: string;
};

export type InstrumentRow = { symbol: string; trades: number; pnl: number; winRate: number };
export type DirectionRow = { direction: "Long" | "Short"; trades: number; pnl: number; winRate: number; avgPnl: number };
// value is null for days that haven't happened yet (within the current period) — recharts
// leaves a gap for null points instead of drawing a flat/misleading line through them.
export type ChartPoint = { label: string; value: number | null };
export type PnlPoint = { label: string; pnl: number };

function fmtCurrency(n: number): string {
  const str = `$${Math.abs(n).toFixed(2)}`;
  return n >= 0 ? `+${str}` : `-${str}`;
}

function fmtDurationMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function computePeriodStats(closed: Trade[], period: Period, offset: number = 0): PeriodStats {
  const wins = closed.filter((t) => pnlOf(t) > 0);
  const losses = closed.filter((t) => pnlOf(t) < 0);
  const totalPnl = closed.reduce((s, t) => s + pnlOf(t), 0);
  const grossProfit = wins.reduce((s, t) => s + pnlOf(t), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + pnlOf(t), 0));
  const withDuration = closed.filter((t) => t.exitTime);
  const avgDurationMinutes = withDuration.length
    ? withDuration.reduce(
        (s, t) => s + (new Date(t.exitTime!).getTime() - new Date(t.entryTime).getTime()) / 60000,
        0,
      ) / withDuration.length
    : 0;

  return {
    pnl: fmtCurrency(totalPnl),
    pnlPos: totalPnl >= 0,
    winRate: closed.length ? `${Math.round((wins.length / closed.length) * 100)}%` : "0%",
    winRateSub: `${wins.length} wins / ${losses.length} losses`,
    profitFactor: grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : "—",
    avgWin: wins.length ? fmtCurrency(grossProfit / wins.length) : "$0.00",
    avgLoss: losses.length ? fmtCurrency(-(grossLoss / losses.length)) : "$0.00",
    trades: String(closed.length),
    tradesSub: periodLabel(period, offset),
    avgDuration: withDuration.length ? fmtDurationMinutes(avgDurationMinutes) : "—",
    avgDurationSub: "avg hold time",
  };
}

export function computeInstrumentRows(closed: Trade[]): InstrumentRow[] {
  const map = new Map<string, { trades: number; pnl: number; wins: number }>();
  for (const t of closed) {
    const entry = map.get(t.symbol) ?? { trades: 0, pnl: 0, wins: 0 };
    entry.trades += 1;
    entry.pnl += pnlOf(t);
    if (pnlOf(t) > 0) entry.wins += 1;
    map.set(t.symbol, entry);
  }
  return [...map.entries()].map(([symbol, v]) => ({
    symbol,
    trades: v.trades,
    pnl: v.pnl,
    winRate: v.trades ? Math.round((v.wins / v.trades) * 100) : 0,
  }));
}

export function computeDirectionRows(closed: Trade[]): DirectionRow[] {
  return (["long", "short"] as const).map((direction) => {
    const dirTrades = closed.filter((t) => t.direction === direction);
    const dirPnl = dirTrades.reduce((s, t) => s + pnlOf(t), 0);
    const dirWins = dirTrades.filter((t) => pnlOf(t) > 0).length;
    return {
      direction: directionLabel(direction),
      trades: dirTrades.length,
      pnl: dirPnl,
      winRate: dirTrades.length ? Math.round((dirWins / dirTrades.length) * 100) : 0,
      avgPnl: dirTrades.length ? dirPnl / dirTrades.length : 0,
    };
  });
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// `allClosed` should be every closed trade on the account (not pre-filtered to the viewed
// period) — the growth line needs full history to compute the correct running balance at the
// start of the viewed period, otherwise navigating to a past period would wrongly reset the
// chart back to the raw starting balance instead of what the portfolio actually was then.
export function computeCharts(
  allClosed: Trade[],
  period: Period,
  startingBalance: number,
  offset: number = 0,
): { growthData: ChartPoint[]; pnlData: PnlPoint[] } {
  const { start } = periodRange(period, offset);
  type Bucket = { key: string; label: string; date: Date };
  const buckets: Bucket[] = [];

  if (period === "yearly") {
    for (let m = 0; m < 12; m++) {
      buckets.push({ key: `${start.getFullYear()}-${m}`, label: MONTH_LABELS[m], date: new Date(start.getFullYear(), m, 1) });
    }
  } else if (period === "monthly") {
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(start.getFullYear(), start.getMonth(), day);
      buckets.push({ key: d.toDateString(), label: `${d.getMonth() + 1}/${d.getDate()}`, date: d });
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      buckets.push({ key: d.toDateString(), label: DAY_LABELS[d.getDay()], date: d });
    }
  }

  const pnlByBucket = new Map<string, number>(buckets.map((b) => [b.key, 0]));
  let baseline = startingBalance;
  for (const t of allClosed) {
    const d = utcWallClock(t.entryTime);
    if (d < start) {
      baseline += pnlOf(t);
      continue;
    }
    const key = period === "yearly" ? `${d.getFullYear()}-${d.getMonth()}` : d.toDateString();
    if (pnlByBucket.has(key)) {
      pnlByBucket.set(key, (pnlByBucket.get(key) ?? 0) + pnlOf(t));
    }
  }

  // Buckets whose date is after today haven't happened yet — always false for a past period
  // (offset > 0), since every bucket there already predates now.
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let running = baseline;
  const growthData: ChartPoint[] = [];
  const pnlData: PnlPoint[] = [];
  for (const b of buckets) {
    const isFuture = period === "yearly"
      ? b.date.getFullYear() === now.getFullYear() && b.date.getMonth() > now.getMonth()
      : b.date.getTime() > todayStart.getTime();
    const bucketPnl = pnlByBucket.get(b.key) ?? 0;
    if (!isFuture) running += bucketPnl;
    growthData.push({ label: b.label, value: isFuture ? null : running });
    pnlData.push({ label: b.label, pnl: bucketPnl });
  }
  return { growthData, pnlData };
}

// ---- Dashboard ----

export function computeDashboardStats(allClosed: Trade[]) {
  const totalPnl = allClosed.reduce((s, t) => s + pnlOf(t), 0);
  const wins = allClosed.filter((t) => pnlOf(t) > 0).length;
  const now = new Date();
  const tradesThisMonth = allClosed.filter((t) => {
    const d = utcWallClock(t.entryTime);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  return {
    totalPnl,
    winRate: allClosed.length ? Math.round((wins / allClosed.length) * 100) : 0,
    totalTrades: allClosed.length,
    tradesThisMonth,
  };
}

export function computeMonthCalendar(
  trades: Trade[],
  year: number,
  month: number,
): Record<number, { trades: number; pnl: number }> {
  const result: Record<number, { trades: number; pnl: number }> = {};
  for (const t of trades) {
    if (t.pnl === null) continue;
    const d = utcWallClock(t.entryTime);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const day = d.getDate();
    const entry = result[day] ?? { trades: 0, pnl: 0 };
    entry.trades += 1;
    entry.pnl += pnlOf(t);
    result[day] = entry;
  }
  return result;
}
