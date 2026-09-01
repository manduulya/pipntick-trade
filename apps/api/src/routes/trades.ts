import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { db, tradingAccounts, trades } from "@pipntick/db";
import { getContractSize } from "@pipntick/shared";
import { getUserId } from "../lib/auth.js";
import { getDefaultAccount } from "../lib/ensure-account.js";

type TradeDirection = "long" | "short";
type TradeSource = "manual" | "screenshot" | "mt4";

type CreateTradeBody = {
  accountId?: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice?: number;
  lotSize: number;
  entryTime: string;
  exitTime?: string;
  session?: string;
  notes?: string;
  source?: TradeSource;
  screenshotUrl?: string;
  /** Manual P&L override. Omit to auto-calculate from entry/exit/lot/contract size (+ swap/commission). */
  pnl?: number;
  /** Signed broker adjustments (negative = a cost). Folded into the auto-calculated pnl. */
  swap?: number;
  commission?: number;
};

type UpdateTradeBody = Partial<CreateTradeBody>;

async function resolveAccountId(userId: string, requestedAccountId?: string) {
  if (requestedAccountId) {
    const [account] = await db
      .select()
      .from(tradingAccounts)
      .where(and(eq(tradingAccounts.id, requestedAccountId), eq(tradingAccounts.userId, userId)));
    return account?.id ?? null;
  }
  const account = await getDefaultAccount(userId);
  return account?.id ?? null;
}

// Clock-skew grace for the "not in the future" checks below: a trade timestamped "just now" on
// the client shouldn't 400 because the client's and this server's clocks differ by a few seconds.
const FUTURE_TOLERANCE_MS = 2 * 60_000;

export function computePnl(
  direction: TradeDirection,
  entryPrice: number,
  exitPrice: number,
  lotSize: number,
  symbol: string,
  swap: number = 0,
  commission: number = 0,
) {
  const diff = direction === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;
  return diff * lotSize * getContractSize(symbol) + swap + commission;
}

export async function tradeRoutes(app: FastifyInstance) {
  app.get("/api/trades", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const query = request.query as { accountId?: string };
    const accountId = await resolveAccountId(userId, query.accountId);
    if (!accountId) return reply.code(404).send({ error: "Account not found" });

    return db.select().from(trades).where(eq(trades.accountId, accountId)).orderBy(desc(trades.entryTime));
  });

  app.post("/api/trades", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const body = request.body as CreateTradeBody;
    if (!body?.symbol || !body?.direction || body.entryPrice === undefined || body.lotSize === undefined || !body.entryTime) {
      return reply.code(400).send({ error: "symbol, direction, entryPrice, lotSize, entryTime are required" });
    }
    if (body.exitTime && new Date(body.exitTime) < new Date(body.entryTime)) {
      return reply.code(400).send({ error: "exitTime cannot be earlier than entryTime" });
    }
    const futureCutoff = Date.now() + FUTURE_TOLERANCE_MS;
    if (new Date(body.entryTime).getTime() > futureCutoff) {
      return reply.code(400).send({ error: "entryTime cannot be in the future" });
    }
    if (body.exitTime && new Date(body.exitTime).getTime() > futureCutoff) {
      return reply.code(400).send({ error: "exitTime cannot be in the future" });
    }

    const accountId = await resolveAccountId(userId, body.accountId);
    if (!accountId) return reply.code(404).send({ error: "Account not found" });

    const manualPnl = body.pnl !== undefined;
    const pnl = manualPnl
      ? body.pnl!
      : body.exitPrice !== undefined
        ? computePnl(body.direction, body.entryPrice, body.exitPrice, body.lotSize, body.symbol, body.swap, body.commission)
        : null;

    const [trade] = await db
      .insert(trades)
      .values({
        accountId,
        symbol: body.symbol,
        direction: body.direction,
        status: body.exitPrice !== undefined ? "closed" : "open",
        entryPrice: String(body.entryPrice),
        exitPrice: body.exitPrice !== undefined ? String(body.exitPrice) : null,
        lotSize: String(body.lotSize),
        pnl: pnl !== null ? String(pnl) : null,
        pnlManual: manualPnl,
        swap: body.swap !== undefined ? String(body.swap) : null,
        commission: body.commission !== undefined ? String(body.commission) : null,
        entryTime: new Date(body.entryTime),
        exitTime: body.exitTime ? new Date(body.exitTime) : null,
        session: body.session,
        notes: body.notes,
        source: body.source ?? "manual",
        screenshotUrl: body.screenshotUrl,
      })
      .returning();

    return reply.code(201).send(trade);
  });

  app.patch("/api/trades/:id", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const { id } = request.params as { id: string };
    const body = request.body as UpdateTradeBody;

    const [existing] = await db
      .select({ trade: trades })
      .from(trades)
      .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
      .where(and(eq(trades.id, id), eq(tradingAccounts.userId, userId)));

    if (!existing) return reply.code(404).send({ error: "Trade not found" });
    const current = existing.trade;

    const effectiveEntryTime = body.entryTime ? new Date(body.entryTime) : current.entryTime;
    const effectiveExitTime = body.exitTime ? new Date(body.exitTime) : current.exitTime;
    if (effectiveExitTime && effectiveExitTime < effectiveEntryTime) {
      return reply.code(400).send({ error: "exitTime cannot be earlier than entryTime" });
    }
    // Only guard times the client is actually changing — an untouched past timestamp on a
    // notes-only patch must still pass.
    const futureCutoff = Date.now() + FUTURE_TOLERANCE_MS;
    if (body.entryTime && effectiveEntryTime.getTime() > futureCutoff) {
      return reply.code(400).send({ error: "entryTime cannot be in the future" });
    }
    if (body.exitTime && effectiveExitTime && effectiveExitTime.getTime() > futureCutoff) {
      return reply.code(400).send({ error: "exitTime cannot be in the future" });
    }

    const symbol = body.symbol ?? current.symbol;
    const direction = body.direction ?? current.direction;
    const entryPrice = body.entryPrice ?? Number(current.entryPrice);
    const exitPrice = body.exitPrice ?? (current.exitPrice !== null ? Number(current.exitPrice) : undefined);
    const lotSize = body.lotSize ?? Number(current.lotSize);
    const swap = body.swap ?? (current.swap !== null ? Number(current.swap) : undefined);
    const commission = body.commission ?? (current.commission !== null ? Number(current.commission) : undefined);
    const manualPnl = body.pnl !== undefined;
    const pnl = manualPnl
      ? body.pnl!
      : exitPrice !== undefined
        ? computePnl(direction, entryPrice, exitPrice, lotSize, symbol, swap, commission)
        : null;

    const [updated] = await db
      .update(trades)
      .set({
        symbol,
        direction,
        status: exitPrice !== undefined ? "closed" : "open",
        entryPrice: String(entryPrice),
        exitPrice: exitPrice !== undefined ? String(exitPrice) : null,
        lotSize: String(lotSize),
        pnl: pnl !== null ? String(pnl) : null,
        pnlManual: manualPnl,
        swap: swap !== undefined ? String(swap) : null,
        commission: commission !== undefined ? String(commission) : null,
        entryTime: body.entryTime ? new Date(body.entryTime) : current.entryTime,
        exitTime: body.exitTime ? new Date(body.exitTime) : current.exitTime,
        session: body.session ?? current.session,
        notes: body.notes ?? current.notes,
        screenshotUrl: body.screenshotUrl ?? current.screenshotUrl,
        updatedAt: new Date(),
      })
      .where(eq(trades.id, id))
      .returning();

    return updated;
  });

  app.delete("/api/trades/:id", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const { id } = request.params as { id: string };

    const [existing] = await db
      .select({ id: trades.id })
      .from(trades)
      .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
      .where(and(eq(trades.id, id), eq(tradingAccounts.userId, userId)));

    if (!existing) return reply.code(404).send({ error: "Trade not found" });

    await db.delete(trades).where(eq(trades.id, id));
    return reply.code(204).send();
  });
}
