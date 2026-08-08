import type { FastifyInstance } from "fastify";
import { and, eq, gte } from "drizzle-orm";
import { db, tradingAccounts, trades } from "@pipntick/db";
import { getUserId } from "../lib/auth";
import { getDefaultAccount } from "../lib/ensure-account";

type Period = "weekly" | "monthly" | "yearly";
const PERIODS: Period[] = ["weekly", "monthly", "yearly"];

function periodStart(period: Period): Date {
  const start = new Date();
  if (period === "weekly") start.setUTCDate(start.getUTCDate() - 7);
  else if (period === "monthly") start.setUTCMonth(start.getUTCMonth() - 1);
  else start.setUTCFullYear(start.getUTCFullYear() - 1);
  return start;
}

/** Shape of a `trades` row as returned by drizzle (numeric columns as strings, timestamps as Date) — the
 * subset this aggregation actually reads. */
export type PerformanceTradeRow = {
  pnl: string | null;
  direction: "long" | "short";
  symbol: string;
  entryTime: Date;
  exitTime: Date | null;
};

export type PerformanceSummary = {
  period: Period;
  pnl: number;
  winRate: number;
  profitFactor: number | null;
  avgWin: number;
  avgLoss: number;
  totalTrades: number;
  avgDurationMinutes: number;
  byInstrument: { symbol: string; trades: number; pnl: number; winRate: number }[];
  byDirection: { direction: "long" | "short"; trades: number; pnl: number; winRate: number; avgPnl: number }[];
};

// Pure aggregation over already-fetched rows (account + closed + period window already applied
// by the caller's query) so it's unit-testable without a database.
export function computePerformanceSummary(rows: PerformanceTradeRow[], period: Period): PerformanceSummary {
  const closed = rows.filter((t) => t.pnl !== null);
  const pnlOf = (t: (typeof closed)[number]) => Number(t.pnl);

  const totalPnl = closed.reduce((sum, t) => sum + pnlOf(t), 0);
  const wins = closed.filter((t) => pnlOf(t) > 0);
  const losses = closed.filter((t) => pnlOf(t) < 0);
  const grossProfit = wins.reduce((sum, t) => sum + pnlOf(t), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + pnlOf(t), 0));

  const withDuration = closed.filter((t) => t.exitTime);
  const avgDurationMinutes = withDuration.length
    ? Math.round(
        withDuration.reduce((sum, t) => sum + (t.exitTime!.getTime() - t.entryTime.getTime()) / 60000, 0) /
          withDuration.length,
      )
    : 0;

  const byInstrumentMap = new Map<string, { trades: number; pnl: number; wins: number }>();
  for (const t of closed) {
    const entry = byInstrumentMap.get(t.symbol) ?? { trades: 0, pnl: 0, wins: 0 };
    entry.trades += 1;
    entry.pnl += pnlOf(t);
    if (pnlOf(t) > 0) entry.wins += 1;
    byInstrumentMap.set(t.symbol, entry);
  }
  const byInstrument = [...byInstrumentMap.entries()].map(([symbol, v]) => ({
    symbol,
    trades: v.trades,
    pnl: v.pnl,
    winRate: v.trades ? Math.round((v.wins / v.trades) * 100) : 0,
  }));

  const byDirection = (["long", "short"] as const).map((direction) => {
    const dirTrades = closed.filter((t) => t.direction === direction);
    const dirPnl = dirTrades.reduce((sum, t) => sum + pnlOf(t), 0);
    const dirWins = dirTrades.filter((t) => pnlOf(t) > 0).length;
    return {
      direction,
      trades: dirTrades.length,
      pnl: dirPnl,
      winRate: dirTrades.length ? Math.round((dirWins / dirTrades.length) * 100) : 0,
      avgPnl: dirTrades.length ? dirPnl / dirTrades.length : 0,
    };
  });

  return {
    period,
    pnl: totalPnl,
    winRate: closed.length ? Math.round((wins.length / closed.length) * 100) : 0,
    profitFactor: grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : null,
    avgWin: wins.length ? grossProfit / wins.length : 0,
    avgLoss: losses.length ? -(grossLoss / losses.length) : 0,
    totalTrades: closed.length,
    avgDurationMinutes,
    byInstrument,
    byDirection,
  };
}

export async function performanceRoutes(app: FastifyInstance) {
  app.get("/api/performance", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const query = request.query as { accountId?: string; period?: string };
    const period: Period = PERIODS.includes(query.period as Period) ? (query.period as Period) : "monthly";

    let accountId = query.accountId;
    if (accountId) {
      const [account] = await db
        .select()
        .from(tradingAccounts)
        .where(and(eq(tradingAccounts.id, accountId), eq(tradingAccounts.userId, userId)));
      if (!account) return reply.code(404).send({ error: "Account not found" });
    } else {
      const account = await getDefaultAccount(userId);
      if (!account) return reply.code(404).send({ error: "Account not found" });
      accountId = account.id;
    }

    const rows = await db
      .select()
      .from(trades)
      .where(and(eq(trades.accountId, accountId), eq(trades.status, "closed"), gte(trades.entryTime, periodStart(period))));

    return computePerformanceSummary(rows, period);
  });
}
