import { boolean, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const tradingAccounts = pgTable("trading_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Default"),
  broker: text("broker"),
  currency: text("currency").notNull().default("USD"),
  startingBalance: numeric("starting_balance", { precision: 18, scale: 2 }).notNull().default("0"),
  isDefault: boolean("is_default").notNull().default(true),
  // Broker platform's server timezone, expressed as an offset from UTC in minutes (e.g. 180 for
  // UTC+3, a common MT4/5 server timezone). Null = unset/unknown. Screenshot OCR transcribes
  // trade times verbatim in whatever timezone the broker platform displays them in (see
  // ParsedTradeScreenshot's doc comment) — this offset lets TradeForm convert that literal
  // broker-local time to a true UTC instant before it lands in the (UTC-labeled) form fields,
  // instead of treating the OCR digits as UTC as-is.
  brokerUtcOffsetMinutes: integer("broker_utc_offset_minutes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
