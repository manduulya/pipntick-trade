import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { db, tradingAccounts, trades } from "@pipntick/db";
import { getContractSize } from "@pipntick/shared";
import { getUserId } from "../lib/auth.js";
import { resolveAccount, resolveAccountId } from "../lib/resolve-account.js";
import { ARCHIVED_ACCOUNT_ERROR, isArchived } from "../lib/account-guard.js";

type TradeDirection = "long" | "short";
type TradeSource = "manual" | "screenshot" | "mt4";

type CreateTradeBody = {
  accountId?: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  lotSize: number;
  entryTime: string;
  session?: string;
  source?: TradeSource;
  screenshotUrl?: string;
  // Clearable optionals. On PATCH: absent = keep, `null` = clear, value = set. On POST: `null` == absent.
  exitPrice?: number | null;
  exitTime?: string | null;
  notes?: string | null;
  /** Manual P&L override. Omit/`null` to auto-calculate from entry/exit/lot/contract size (+ swap/commission). */
  pnl?: number | null;
  /** Signed broker adjustments (negative = a cost). Folded into the auto-calculated pnl. */
  swap?: number | null;
  commission?: number | null;
  /** Trader's own "this was a mistake" flag. On PATCH: absent = keep. */
  isMistake?: boolean;
};

type UpdateTradeBody = Partial<CreateTradeBody>;

// A clearable numeric body field -> a plain number when set, or undefined when the caller sent
// nothing / an explicit null. Collapses "absent" and "cleared" for the POST path and for pnl math.
function optNum(v: number | null | undefined): number | undefined {
  return v == null ? undefined : v;
}

// Grace window for the "not in the future" checks below. The web client stores trade times as
// broker-server wall-clock digits (labeled UTC) and does the precise, offset-aware future check
// itself; this endpoint doesn't know the account's broker timezone, so its own check has to
// tolerate any real-world UTC offset (max UTC+14) plus a little clock skew. It stays useful as a
// coarse backstop against a wildly-wrong date (wrong year/month).
const FUTURE_TOLERANCE_MS = 14 * 60 * 60_000 + 5 * 60_000;

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
    if (body.isMistake !== undefined && typeof body.isMistake !== "boolean") {
      return reply.code(400).send({ error: "isMistake must be a boolean" });
    }
    const futureCutoff = Date.now() + FUTURE_TOLERANCE_MS;
    if (new Date(body.entryTime).getTime() > futureCutoff) {
      return reply.code(400).send({ error: "entryTime cannot be in the future" });
    }
    if (body.exitTime && new Date(body.exitTime).getTime() > futureCutoff) {
      return reply.code(400).send({ error: "exitTime cannot be in the future" });
    }

    const account = await resolveAccount(userId, body.accountId);
    if (!account) return reply.code(404).send({ error: "Account not found" });
    if (isArchived(account.status)) return reply.code(409).send({ error: ARCHIVED_ACCOUNT_ERROR });
    const accountId = account.id;

    const exitPrice = optNum(body.exitPrice);
    const swap = optNum(body.swap);
    const commission = optNum(body.commission);
    const overridePnl = optNum(body.pnl);
    const manualPnl = overridePnl !== undefined;
    const pnl = manualPnl
      ? overridePnl
      : exitPrice !== undefined
        ? computePnl(body.direction, body.entryPrice, exitPrice, body.lotSize, body.symbol, swap, commission)
        : null;

    const [trade] = await db
      .insert(trades)
      .values({
        accountId,
        symbol: body.symbol,
        direction: body.direction,
        status: exitPrice !== undefined ? "closed" : "open",
        entryPrice: String(body.entryPrice),
        exitPrice: exitPrice !== undefined ? String(exitPrice) : null,
        lotSize: String(body.lotSize),
        pnl: pnl !== null ? String(pnl) : null,
        pnlManual: manualPnl,
        swap: swap !== undefined ? String(swap) : null,
        commission: commission !== undefined ? String(commission) : null,
        entryTime: new Date(body.entryTime),
        exitTime: body.exitTime ? new Date(body.exitTime) : null,
        session: body.session,
        notes: body.notes ?? null,
        isMistake: body.isMistake ?? false,
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
      .select({ trade: trades, accountStatus: tradingAccounts.status })
      .from(trades)
      .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
      .where(and(eq(trades.id, id), eq(tradingAccounts.userId, userId)));

    if (!existing) return reply.code(404).send({ error: "Trade not found" });
    if (isArchived(existing.accountStatus)) return reply.code(409).send({ error: ARCHIVED_ACCOUNT_ERROR });
    const current = existing.trade;

    // Per-field merge rule for the clearable optionals: key absent in the body -> keep what's
    // stored; `null` -> clear it; a value -> set it. (`??` can't express this — it treats an
    // explicit null the same as absent, which is why a cleared swap/commission/exit used to
    // "stick" at its old value.)
    const symbol = body.symbol ?? current.symbol;
    const direction = body.direction ?? current.direction;
    const entryPrice = body.entryPrice ?? Number(current.entryPrice);
    const lotSize = body.lotSize ?? Number(current.lotSize);

    const currentNum = (v: string | null) => (v !== null ? Number(v) : undefined);
    const exitPrice =
      body.exitPrice === undefined ? currentNum(current.exitPrice) : optNum(body.exitPrice);
    const swap = body.swap === undefined ? currentNum(current.swap) : optNum(body.swap);
    const commission =
      body.commission === undefined ? currentNum(current.commission) : optNum(body.commission);
    const notes = body.notes === undefined ? current.notes : body.notes;
    if (body.isMistake !== undefined && typeof body.isMistake !== "boolean") {
      return reply.code(400).send({ error: "isMistake must be a boolean" });
    }
    const isMistake = body.isMistake === undefined ? current.isMistake : body.isMistake;
    const entryTime = body.entryTime ? new Date(body.entryTime) : current.entryTime;
    const exitTime =
      body.exitTime === undefined ? current.exitTime : body.exitTime ? new Date(body.exitTime) : null;

    if (exitTime && exitTime < entryTime) {
      return reply.code(400).send({ error: "exitTime cannot be earlier than entryTime" });
    }
    // Only guard times the client is actually sending — an untouched past timestamp must still pass.
    const futureCutoff = Date.now() + FUTURE_TOLERANCE_MS;
    if (body.entryTime && entryTime.getTime() > futureCutoff) {
      return reply.code(400).send({ error: "entryTime cannot be in the future" });
    }
    if (body.exitTime && exitTime && exitTime.getTime() > futureCutoff) {
      return reply.code(400).send({ error: "exitTime cannot be in the future" });
    }

    // pnl: a number => manual override; `null` => drop the override and recompute; absent => leave
    // the override state as-is (keep the stored manual value, or recompute if it wasn't manual).
    let manualPnl: boolean;
    let pnl: number | null;
    if (typeof body.pnl === "number") {
      manualPnl = true;
      pnl = body.pnl;
    } else {
      manualPnl = body.pnl === null ? false : current.pnlManual;
      pnl =
        manualPnl && body.pnl === undefined
          ? currentNum(current.pnl) ?? null
          : exitPrice !== undefined
            ? computePnl(direction, entryPrice, exitPrice, lotSize, symbol, swap, commission)
            : null;
    }

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
        entryTime,
        exitTime,
        session: body.session ?? current.session,
        notes,
        isMistake,
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
      .select({ id: trades.id, accountStatus: tradingAccounts.status })
      .from(trades)
      .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
      .where(and(eq(trades.id, id), eq(tradingAccounts.userId, userId)));

    if (!existing) return reply.code(404).send({ error: "Trade not found" });
    if (isArchived(existing.accountStatus)) return reply.code(409).send({ error: ARCHIVED_ACCOUNT_ERROR });

    await db.delete(trades).where(eq(trades.id, id));
    return reply.code(204).send();
  });
}
