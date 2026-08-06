import { db } from "../client";
import { users, tradingAccounts, trades } from "../schema";

async function seed() {
  console.log("Seeding database...");

  const [user] = await db
    .insert(users)
    .values({
      id: "user_dev_001",
      email: "dev@pipntick.trade",
    })
    .returning();

  const [account] = await db
    .insert(tradingAccounts)
    .values({
      userId: user.id,
      name: "Dev Account",
      broker: "MT4 Demo",
      startingBalance: "10000",
      isDefault: true,
    })
    .returning();

  await db.insert(trades).values([
    {
      accountId: account.id,
      symbol: "EUR/USD",
      direction: "long",
      entryPrice: "1.0842",
      exitPrice: "1.0891",
      lotSize: "1.0",
      pnl: "225.00",
      entryTime: new Date("2026-03-29T08:10:00Z"),
      exitTime: new Date("2026-03-29T10:25:00Z"),
      session: "London",
      notes: "Clean breakout above resistance.",
    },
    {
      accountId: account.id,
      symbol: "GBP/USD",
      direction: "short",
      entryPrice: "1.2645",
      exitPrice: "1.2690",
      lotSize: "0.5",
      pnl: "-95.00",
      entryTime: new Date("2026-03-27T13:30:00Z"),
      exitTime: new Date("2026-03-27T14:18:00Z"),
      session: "New York",
      notes: "Fakeout, stopped out.",
    },
    {
      accountId: account.id,
      symbol: "NAS100",
      direction: "long",
      entryPrice: "17840",
      exitPrice: "17980",
      lotSize: "0.2",
      pnl: "510.00",
      entryTime: new Date("2026-03-26T14:00:00Z"),
      exitTime: new Date("2026-03-26T17:02:00Z"),
      session: "New York",
      notes: "Trend continuation after pullback.",
    },
  ]);

  console.log("Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
