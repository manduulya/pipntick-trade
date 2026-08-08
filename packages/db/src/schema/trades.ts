import { boolean, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tradingAccounts } from "./accounts";

export const tradeDirectionEnum = pgEnum("trade_direction", ["long", "short"]);
export const tradeStatusEnum = pgEnum("trade_status", ["open", "closed"]);
export const tradeSourceEnum = pgEnum("trade_source", ["manual", "screenshot", "mt4"]);

export const trades = pgTable("trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => tradingAccounts.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  direction: tradeDirectionEnum("direction").notNull(),
  status: tradeStatusEnum("status").notNull().default("closed"),
  entryPrice: numeric("entry_price", { precision: 18, scale: 8 }).notNull(),
  exitPrice: numeric("exit_price", { precision: 18, scale: 8 }),
  lotSize: numeric("lot_size", { precision: 18, scale: 8 }).notNull(),
  pnl: numeric("pnl", { precision: 18, scale: 2 }),
  pnlManual: boolean("pnl_manual").notNull().default(false),
  // Signed broker adjustments (negative = a cost, matching how brokers display them), folded
  // into pnl at write time — see computePnl in apps/api/src/routes/trades.ts.
  swap: numeric("swap", { precision: 18, scale: 2 }),
  commission: numeric("commission", { precision: 18, scale: 2 }),
  entryTime: timestamp("entry_time").notNull(),
  exitTime: timestamp("exit_time"),
  session: text("session"),
  source: tradeSourceEnum("source").notNull().default("manual"),
  screenshotUrl: text("screenshot_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
