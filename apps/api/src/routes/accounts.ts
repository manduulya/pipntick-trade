import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";
import { db, tradingAccounts, trades } from "@pipntick/db";
import { getUserId } from "../lib/auth";
import { ensureUser } from "../lib/ensure-account";

type CreateAccountBody = {
  name: string;
  broker?: string;
  currency?: string;
  startingBalance?: number;
  createdAt?: string;
};

export async function accountRoutes(app: FastifyInstance) {
  app.get("/api/accounts", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    await ensureUser(userId);
    const accounts = await db.select().from(tradingAccounts).where(eq(tradingAccounts.userId, userId));
    return accounts;
  });

  app.post("/api/accounts", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const body = request.body as CreateAccountBody;
    if (!body?.name) return reply.code(400).send({ error: "name is required" });

    await ensureUser(userId);

    const [account] = await db
      .insert(tradingAccounts)
      .values({
        userId,
        name: body.name,
        broker: body.broker,
        currency: body.currency ?? "USD",
        startingBalance: body.startingBalance !== undefined ? String(body.startingBalance) : "0",
        isDefault: false,
      })
      .returning();

    return reply.code(201).send(account);
  });

  app.patch("/api/accounts/:id", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const { id } = request.params as { id: string };
    const body = request.body as Partial<CreateAccountBody>;

    const [existing] = await db
      .select()
      .from(tradingAccounts)
      .where(and(eq(tradingAccounts.id, id), eq(tradingAccounts.userId, userId)));
    if (!existing) return reply.code(404).send({ error: "Account not found" });

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

    const [updated] = await db
      .update(tradingAccounts)
      .set({
        name: body.name ?? existing.name,
        broker: body.broker !== undefined ? body.broker : existing.broker,
        currency: body.currency ?? existing.currency,
        startingBalance: body.startingBalance !== undefined ? String(body.startingBalance) : existing.startingBalance,
        createdAt,
        updatedAt: new Date(),
      })
      .where(eq(tradingAccounts.id, id))
      .returning();

    return updated;
  });

  app.delete("/api/accounts/:id", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const { id } = request.params as { id: string };

    const [existing] = await db
      .select({ id: tradingAccounts.id })
      .from(tradingAccounts)
      .where(and(eq(tradingAccounts.id, id), eq(tradingAccounts.userId, userId)));
    if (!existing) return reply.code(404).send({ error: "Account not found" });

    await db.delete(tradingAccounts).where(eq(tradingAccounts.id, id));
    return reply.code(204).send();
  });
}
