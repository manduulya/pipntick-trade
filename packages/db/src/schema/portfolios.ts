import { numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const portfolios = pgTable("portfolios", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull().default("Default"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const positions = pgTable("positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  portfolioId: uuid("portfolio_id")
    .notNull()
    .references(() => portfolios.id),
  symbol: text("symbol").notNull(),
  quantity: numeric("quantity", { precision: 18, scale: 8 }).notNull(),
  avgCost: numeric("avg_cost", { precision: 18, scale: 8 }).notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
