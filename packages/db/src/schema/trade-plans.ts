import { date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tradingAccounts } from "./accounts";
import { tradeDirectionEnum, trades } from "./trades";

export const ruleTypeEnum = pgEnum("rule_type", ["check", "choice"]);
export const planStatusEnum = pgEnum("plan_status", ["planned", "logged", "skipped"]);
export const tradeGradeEnum = pgEnum("trade_grade", ["F", "D", "C", "B", "A", "A++"]);

/** One item of a plan's frozen checklist — see `trade_plans.rules_snapshot`. */
export type RuleSnapshotRow = {
  text: string;
  type: "check" | "choice";
  options: string[];
  done: boolean;
  value: string | null;
};

// The account's pre-trade checklist ("My Rules"). One ordered set per trading account, replaced
// wholesale on save (PUT /api/rules).
export const tradingRules = pgTable(
  "trading_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => tradingAccounts.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    type: ruleTypeEnum("type").notNull().default("check"),
    options: jsonb("options").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("trading_rules_account_idx").on(t.accountId)],
);

// A planned trade on the weekly Trade Plan board. `rulesSnapshot` is a copy of the account's rules
// taken when the plan was created, so later rule edits never change an existing plan.
export const tradePlans = pgTable(
  "trade_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => tradingAccounts.id, { onDelete: "cascade" }),
    planDate: date("plan_date", { mode: "string" }).notNull(),
    symbol: text("symbol").notNull().default(""),
    direction: tradeDirectionEnum("direction").notNull().default("long"),
    grade: tradeGradeEnum("grade"),
    status: planStatusEnum("status").notNull().default("planned"),
    rulesSnapshot: jsonb("rules_snapshot").$type<RuleSnapshotRow[]>().notNull().default([]),
    journalTradeId: uuid("journal_trade_id").references(() => trades.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("trade_plans_account_date_idx").on(t.accountId, t.planDate)],
);
