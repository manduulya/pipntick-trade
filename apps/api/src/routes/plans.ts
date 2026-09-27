import type { FastifyInstance } from "fastify";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, tradePlans, trades, tradingAccounts, tradingRules } from "@pipntick/db";
import type { RuleSnapshotItem, TradeGrade, UpdatePlanInput } from "@pipntick/shared";
import { TRADE_GRADES } from "@pipntick/shared";
import { getUserId } from "../lib/auth.js";
import { resolveAccount, resolveAccountId } from "../lib/resolve-account.js";
import { ARCHIVED_ACCOUNT_ERROR, isArchived } from "../lib/account-guard.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SYMBOL = 20;

export function isValidDateKey(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Applies submitted answers onto a plan's frozen snapshot. Only `done` (checks) and `value`
 * (choices) are taken from the client — rule text/type/options always come from the stored
 * snapshot, so editing answers can never rewrite what the plan was checked against.
 */
export function applyAnswers(
  snapshot: RuleSnapshotItem[],
  answers: unknown,
): { snapshot: RuleSnapshotItem[] } | { error: string } {
  if (!Array.isArray(answers) || answers.length !== snapshot.length) {
    return { error: "answers must match the plan's checklist length" };
  }
  const next: RuleSnapshotItem[] = [];
  for (let i = 0; i < snapshot.length; i++) {
    const rule = snapshot[i];
    const a = answers[i] as { done?: unknown; value?: unknown } | null;
    if (!a || typeof a !== "object") return { error: "Each answer must be an object" };
    if (rule.type === "check") {
      if (typeof a.done !== "boolean") return { error: `Answer ${i + 1}: done must be a boolean` };
      next.push({ ...rule, done: a.done, value: null });
    } else {
      if (a.value !== null && (typeof a.value !== "string" || !rule.options.includes(a.value))) {
        return { error: `Answer ${i + 1}: value must be one of the rule's options` };
      }
      next.push({ ...rule, done: false, value: a.value });
    }
  }
  return { snapshot: next };
}

async function findOwnedPlan(userId: string, id: string) {
  const [row] = await db
    .select({ plan: tradePlans, accountStatus: tradingAccounts.status })
    .from(tradePlans)
    .innerJoin(tradingAccounts, eq(tradePlans.accountId, tradingAccounts.id))
    .where(and(eq(tradePlans.id, id), eq(tradingAccounts.userId, userId)));
  return row ?? null;
}

export async function planRoutes(app: FastifyInstance) {
  app.get("/api/plans", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const query = request.query as { accountId?: string; from?: string; to?: string };
    if (!isValidDateKey(query.from) || !isValidDateKey(query.to)) {
      return reply.code(400).send({ error: "from and to are required as YYYY-MM-DD" });
    }
    const accountId = await resolveAccountId(userId, query.accountId);
    if (!accountId) return reply.code(404).send({ error: "Account not found" });

    return db
      .select()
      .from(tradePlans)
      .where(and(eq(tradePlans.accountId, accountId), gte(tradePlans.planDate, query.from), lte(tradePlans.planDate, query.to)))
      .orderBy(asc(tradePlans.planDate), asc(tradePlans.createdAt));
  });

  app.post("/api/plans", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const body = request.body as { accountId?: string; planDate?: unknown } | undefined;
    if (!isValidDateKey(body?.planDate)) {
      return reply.code(400).send({ error: "planDate is required as YYYY-MM-DD" });
    }
    const account = await resolveAccount(userId, body.accountId);
    if (!account) return reply.code(404).send({ error: "Account not found" });
    if (isArchived(account.status)) return reply.code(409).send({ error: ARCHIVED_ACCOUNT_ERROR });
    const accountId = account.id;

    // Freeze the account's current rules into the plan. Done server-side so the snapshot always
    // reflects the real rule set at creation time.
    const rules = await db
      .select()
      .from(tradingRules)
      .where(eq(tradingRules.accountId, accountId))
      .orderBy(asc(tradingRules.position));
    const rulesSnapshot: RuleSnapshotItem[] = rules.map((r) => ({
      text: r.text,
      type: r.type,
      options: r.type === "choice" ? [...r.options] : [],
      done: false,
      value: null,
    }));

    const [plan] = await db.insert(tradePlans).values({ accountId, planDate: body.planDate, rulesSnapshot }).returning();
    return reply.code(201).send(plan);
  });

  app.patch("/api/plans/:id", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as UpdatePlanInput;

    const owned = await findOwnedPlan(userId, id);
    if (!owned) return reply.code(404).send({ error: "Plan not found" });
    if (isArchived(owned.accountStatus)) return reply.code(409).send({ error: ARCHIVED_ACCOUNT_ERROR });
    const current = owned.plan;

    // Skipped/logged plans are read-only: the only change accepted is reopening them (status back
    // to "planned", which the UI's Undo sends together with journalTradeId: null).
    if (current.status !== "planned" && body.status !== "planned") {
      const edits = [body.planDate, body.symbol, body.direction, body.grade, body.answers, body.journalTradeId];
      const statusChange = body.status !== undefined && body.status !== current.status;
      if (edits.some((v) => v !== undefined) || statusChange) {
        return reply.code(400).send({ error: `This plan is ${current.status} — undo it before making changes` });
      }
    }

    let symbol = current.symbol;
    if (body.symbol !== undefined) {
      if (typeof body.symbol !== "string") return reply.code(400).send({ error: "symbol must be a string" });
      symbol = body.symbol.trim().toUpperCase();
      if (symbol.length > MAX_SYMBOL) return reply.code(400).send({ error: `symbol must be at most ${MAX_SYMBOL} characters` });
    }

    let direction = current.direction;
    if (body.direction !== undefined) {
      if (body.direction !== "long" && body.direction !== "short") return reply.code(400).send({ error: "direction must be 'long' or 'short'" });
      direction = body.direction;
    }

    let grade: TradeGrade | null = current.grade;
    if (body.grade !== undefined) {
      if (body.grade !== null && !TRADE_GRADES.includes(body.grade)) return reply.code(400).send({ error: "Invalid grade" });
      grade = body.grade;
    }

    let status = current.status;
    if (body.status !== undefined) {
      if (!["planned", "logged", "skipped"].includes(body.status)) return reply.code(400).send({ error: "Invalid status" });
      status = body.status;
    }
    if (status === "logged" && !grade) {
      return reply.code(400).send({ error: "Grade the setup before logging it" });
    }

    let planDate = current.planDate;
    if (body.planDate !== undefined && body.planDate !== current.planDate) {
      if (!isValidDateKey(body.planDate)) return reply.code(400).send({ error: "planDate must be YYYY-MM-DD" });
      // A skipped or logged plan is a record of what happened on that day — only open plans move.
      if (status !== "planned") return reply.code(400).send({ error: "Only planned trades can be moved to another day" });
      planDate = body.planDate;
    }

    let journalTradeId = current.journalTradeId;
    if (body.journalTradeId !== undefined) {
      if (body.journalTradeId !== null) {
        if (typeof body.journalTradeId !== "string") return reply.code(400).send({ error: "journalTradeId must be a string" });
        const [trade] = await db
          .select({ id: trades.id })
          .from(trades)
          .where(and(eq(trades.id, body.journalTradeId), eq(trades.accountId, current.accountId)));
        if (!trade) return reply.code(400).send({ error: "journalTradeId must be a trade in the same account" });
      }
      journalTradeId = body.journalTradeId;
    }

    let rulesSnapshot = current.rulesSnapshot;
    if (body.answers !== undefined) {
      const result = applyAnswers(current.rulesSnapshot, body.answers);
      if ("error" in result) return reply.code(400).send({ error: result.error });
      rulesSnapshot = result.snapshot;
    }

    const [updated] = await db
      .update(tradePlans)
      .set({ planDate, symbol, direction, grade, status, journalTradeId, rulesSnapshot, updatedAt: new Date() })
      .where(eq(tradePlans.id, id))
      .returning();
    return updated;
  });

  app.delete("/api/plans/:id", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const { id } = request.params as { id: string };
    const owned = await findOwnedPlan(userId, id);
    if (!owned) return reply.code(404).send({ error: "Plan not found" });
    if (isArchived(owned.accountStatus)) return reply.code(409).send({ error: ARCHIVED_ACCOUNT_ERROR });

    await db.delete(tradePlans).where(eq(tradePlans.id, id));
    return reply.code(204).send();
  });
}
