import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db, tradingAccounts, trades } from "@pipntick/db";
import type { AccountStatus } from "@pipntick/shared";
import { ACCOUNT_STATUSES } from "@pipntick/shared";
import { getUserId } from "../lib/auth.js";
import { ensureUser } from "../lib/ensure-account.js";

type CreateAccountBody = {
  name: string;
  broker?: string;
  currency?: string;
  startingBalance?: number;
  createdAt?: string;
  brokerUtcOffsetMinutes?: number | null;
};

type UpdateAccountBody = Partial<CreateAccountBody> & { status?: AccountStatus; isDefault?: unknown };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Switcher order: default first, then active → inactive → archived, oldest first within each. */
const STATUS_ORDER = sql`case ${tradingAccounts.status} when 'active' then 0 when 'inactive' then 1 else 2 end`;

/**
 * Gives the user's default to their oldest non-archived account (other than `excludeId`), if any.
 * Called when the current default is archived or deleted — the default must never be archived, and
 * a user with no usable account simply has no default.
 */
export async function handOffDefault(tx: Tx, userId: string, excludeId: string) {
  const [next] = await tx
    .select({ id: tradingAccounts.id })
    .from(tradingAccounts)
    .where(and(eq(tradingAccounts.userId, userId), ne(tradingAccounts.id, excludeId), ne(tradingAccounts.status, "archived")))
    .orderBy(asc(tradingAccounts.createdAt))
    .limit(1);
  if (next) await tx.update(tradingAccounts).set({ isDefault: true }).where(eq(tradingAccounts.id, next.id));
}

export async function accountRoutes(app: FastifyInstance) {
  app.get("/api/accounts", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    await ensureUser(userId);
    return db
      .select()
      .from(tradingAccounts)
      .where(eq(tradingAccounts.userId, userId))
      .orderBy(desc(tradingAccounts.isDefault), STATUS_ORDER, asc(tradingAccounts.createdAt));
  });

  app.post("/api/accounts", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const body = request.body as CreateAccountBody;
    if (!body?.name) return reply.code(400).send({ error: "name is required" });

    // A brand-new account has no trades yet, so unlike the PATCH path there's no earliest-trade
    // conflict to check against — just that the date itself is valid and not in the future.
    let createdAt: Date | undefined;
    if (body.createdAt !== undefined) {
      const parsed = new Date(body.createdAt);
      if (Number.isNaN(parsed.getTime())) return reply.code(400).send({ error: "createdAt is not a valid date" });
      if (parsed.getTime() > Date.now()) return reply.code(400).send({ error: "createdAt cannot be in the future" });
      createdAt = parsed;
    }

    await ensureUser(userId);

    // The user's first (usable) account becomes their default.
    const [currentDefault] = await db
      .select({ id: tradingAccounts.id })
      .from(tradingAccounts)
      .where(and(eq(tradingAccounts.userId, userId), eq(tradingAccounts.isDefault, true)))
      .limit(1);

    const [account] = await db
      .insert(tradingAccounts)
      .values({
        userId,
        name: body.name,
        broker: body.broker,
        currency: body.currency ?? "USD",
        startingBalance: body.startingBalance !== undefined ? String(body.startingBalance) : "0",
        isDefault: !currentDefault,
        brokerUtcOffsetMinutes: body.brokerUtcOffsetMinutes ?? null,
        ...(createdAt !== undefined ? { createdAt } : {}),
      })
      .returning();

    return reply.code(201).send(account);
  });

  app.patch("/api/accounts/:id", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as UpdateAccountBody;

    const [existing] = await db
      .select()
      .from(tradingAccounts)
      .where(and(eq(tradingAccounts.id, id), eq(tradingAccounts.userId, userId)));
    if (!existing) return reply.code(404).send({ error: "Account not found" });

    if (body.status !== undefined && !ACCOUNT_STATUSES.includes(body.status)) {
      return reply.code(400).send({ error: "status must be active, inactive or archived" });
    }
    const status = body.status ?? existing.status;

    if (body.isDefault !== undefined && body.isDefault !== true) {
      return reply.code(400).send({ error: "To change the default, make another account the default instead" });
    }
    const makeDefault = body.isDefault === true;
    if (makeDefault && status === "archived") {
      return reply.code(400).send({ error: "An archived account can't be the default" });
    }

    // Archived accounts are read-only: the only accepted change is reactivating them (optionally
    // with other edits in the same request).
    const detailEdits = [body.name, body.broker, body.currency, body.startingBalance, body.createdAt, body.brokerUtcOffsetMinutes];
    if (existing.status === "archived" && status === "archived" && detailEdits.some((v) => v !== undefined)) {
      return reply.code(409).send({ error: "This account is archived — reactivate it to make changes" });
    }

    let createdAt = existing.createdAt;
    if (body.createdAt !== undefined) {
      const parsed = new Date(body.createdAt);
      if (Number.isNaN(parsed.getTime())) return reply.code(400).send({ error: "createdAt is not a valid date" });
      if (parsed.getTime() > Date.now()) return reply.code(400).send({ error: "createdAt cannot be in the future" });

      const [earliestTrade] = await db
        .select({ entryTime: trades.entryTime })
        .from(trades)
        .where(eq(trades.accountId, id))
        .orderBy(asc(trades.entryTime))
        .limit(1);
      if (earliestTrade && parsed.getTime() > earliestTrade.entryTime.getTime()) {
        return reply.code(400).send({
          error: `This account has a trade recorded on ${earliestTrade.entryTime.toISOString().slice(0, 10)}. Choose a created date on or before that, or delete the conflicting trade first.`,
        });
      }

      createdAt = parsed;
    }

    const updated = await db.transaction(async (tx) => {
      const archiving = status === "archived";
      // Clear any other default before claiming it — the partial unique index allows only one.
      if (makeDefault && !existing.isDefault) {
        await tx
          .update(tradingAccounts)
          .set({ isDefault: false })
          .where(and(eq(tradingAccounts.userId, userId), eq(tradingAccounts.isDefault, true)));
      }

      let isDefault = makeDefault || (existing.isDefault && !archiving);
      if (!isDefault && !archiving) {
        // Reactivating when the user has no usable default (e.g. everything was archived): this
        // account takes it.
        const [anyDefault] = await tx
          .select({ id: tradingAccounts.id })
          .from(tradingAccounts)
          .where(and(eq(tradingAccounts.userId, userId), eq(tradingAccounts.isDefault, true), ne(tradingAccounts.id, id)))
          .limit(1);
        isDefault = !anyDefault;
      }

      const [row] = await tx
        .update(tradingAccounts)
        .set({
          name: body.name ?? existing.name,
          broker: body.broker !== undefined ? body.broker : existing.broker,
          currency: body.currency ?? existing.currency,
          startingBalance: body.startingBalance !== undefined ? String(body.startingBalance) : existing.startingBalance,
          brokerUtcOffsetMinutes:
            body.brokerUtcOffsetMinutes !== undefined ? body.brokerUtcOffsetMinutes : existing.brokerUtcOffsetMinutes,
          createdAt,
          status,
          isDefault,
          updatedAt: new Date(),
        })
        .where(eq(tradingAccounts.id, id))
        .returning();

      if (archiving && existing.isDefault) await handOffDefault(tx, userId, id);
      return row;
    });

    return updated;
  });

  app.delete("/api/accounts/:id", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const { id } = request.params as { id: string };

    const [existing] = await db
      .select({ id: tradingAccounts.id, isDefault: tradingAccounts.isDefault })
      .from(tradingAccounts)
      .where(and(eq(tradingAccounts.id, id), eq(tradingAccounts.userId, userId)));
    if (!existing) return reply.code(404).send({ error: "Account not found" });

    await db.transaction(async (tx) => {
      await tx.delete(tradingAccounts).where(eq(tradingAccounts.id, id));
      if (existing.isDefault) await handOffDefault(tx, userId, id);
    });
    return reply.code(204).send();
  });
}
