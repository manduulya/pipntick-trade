import { sql } from "drizzle-orm";
import { boolean, integer, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

// active = trading it now; inactive = paused (still editable); archived = finished, kept read-only
// for history (the API rejects writes to archived accounts — see apps/api/src/lib/account-guard.ts).
export const accountStatusEnum = pgEnum("account_status", ["active", "inactive", "archived"]);

export const tradingAccounts = pgTable("trading_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Default"),
  broker: text("broker"),
  currency: text("currency").notNull().default("USD"),
  startingBalance: numeric("starting_balance", { precision: 18, scale: 2 }).notNull().default("0"),
  // At most one per user (partial unique index below); never an archived account. Kept in sync
  // by the accounts routes — see handOffDefault in apps/api/src/routes/accounts.ts.
  isDefault: boolean("is_default").notNull().default(false),
  status: accountStatusEnum("status").notNull().default("active"),
  // Broker platform's server timezone, expressed as an offset from UTC in minutes (e.g. 180 for
  // UTC+3, a common MT4/5 server timezone). Null = unset/unknown. Screenshot OCR transcribes
  // trade times verbatim in whatever timezone the broker platform displays them in (see
  // ParsedTradeScreenshot's doc comment) — this offset lets TradeForm convert that literal
  // broker-local time to a true UTC instant before it lands in the (UTC-labeled) form fields,
  // instead of treating the OCR digits as UTC as-is.
  brokerUtcOffsetMinutes: integer("broker_utc_offset_minutes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("trading_accounts_one_default_per_user").on(t.userId).where(sql`${t.isDefault}`),
]);
