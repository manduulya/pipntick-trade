import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { db, tradingRules } from "@pipntick/db";
import { getUserId } from "../lib/auth.js";
import { resolveAccountId } from "../lib/resolve-account.js";

type RuleType = "check" | "choice";
type RuleBody = { text?: unknown; type?: unknown; options?: unknown };
type NormalizedRule = { text: string; type: RuleType; options: string[] };

export const MAX_RULES = 50;
export const MAX_RULE_TEXT = 200;
const MAX_OPTION_TEXT = 60;

/**
 * Validates and normalizes a submitted rule set. Rules with empty text are dropped (the drawer
 * relies on this — "Save rules" discards blank rows); `check` rules lose any options; `choice`
 * options are trimmed and de-duplicated and must number at least two. Returns an error message
 * for anything else malformed.
 */
export function normalizeRules(body: unknown): { rules: NormalizedRule[] } | { error: string } {
  if (!Array.isArray(body)) return { error: "Body must be an array of rules" };

  const rules: NormalizedRule[] = [];
  for (const raw of body as RuleBody[]) {
    if (!raw || typeof raw !== "object") return { error: "Each rule must be an object" };
    const text = typeof raw.text === "string" ? raw.text.trim() : "";
    if (!text) continue;
    if (text.length > MAX_RULE_TEXT) return { error: `Rule text must be at most ${MAX_RULE_TEXT} characters` };
    if (raw.type !== "check" && raw.type !== "choice") return { error: "Rule type must be 'check' or 'choice'" };

    if (raw.type === "check") {
      rules.push({ text, type: "check", options: [] });
      continue;
    }
    if (!Array.isArray(raw.options)) return { error: `"${text}": options must be an array` };
    const options: string[] = [];
    for (const o of raw.options) {
      if (typeof o !== "string") return { error: `"${text}": options must be strings` };
      const v = o.trim();
      if (!v) continue;
      if (v.length > MAX_OPTION_TEXT) return { error: `"${text}": options must be at most ${MAX_OPTION_TEXT} characters` };
      if (!options.includes(v)) options.push(v);
    }
    if (options.length < 2) return { error: `"${text}": multiple choice needs at least 2 options` };
    rules.push({ text, type: "choice", options });
  }

  if (rules.length > MAX_RULES) return { error: `At most ${MAX_RULES} rules` };
  return { rules };
}

export async function ruleRoutes(app: FastifyInstance) {
  app.get("/api/rules", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const query = request.query as { accountId?: string };
    const accountId = await resolveAccountId(userId, query.accountId);
    if (!accountId) return reply.code(404).send({ error: "Account not found" });

    return db.select().from(tradingRules).where(eq(tradingRules.accountId, accountId)).orderBy(asc(tradingRules.position));
  });

  // Replaces the account's whole rule set — the drawer edits it as one list and saves it at once.
  // Existing plans are unaffected: they carry their own snapshot (see trade_plans.rules_snapshot).
  app.put("/api/rules", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const query = request.query as { accountId?: string };
    const accountId = await resolveAccountId(userId, query.accountId);
    if (!accountId) return reply.code(404).send({ error: "Account not found" });

    const result = normalizeRules(request.body);
    if ("error" in result) return reply.code(400).send({ error: result.error });

    const saved = await db.transaction(async (tx) => {
      await tx.delete(tradingRules).where(eq(tradingRules.accountId, accountId));
      if (result.rules.length === 0) return [];
      return tx
        .insert(tradingRules)
        .values(result.rules.map((r, position) => ({ accountId, position, ...r })))
        .returning();
    });

    return saved.sort((a, b) => a.position - b.position);
  });
}
