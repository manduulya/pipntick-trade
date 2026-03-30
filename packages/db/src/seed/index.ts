import { db } from "../client";
import { users, portfolios } from "../schema";

async function seed() {
  console.log("Seeding database...");

  const [user] = await db
    .insert(users)
    .values({
      id: "user_dev_001",
      email: "dev@pipntick.trade",
    })
    .returning();

  await db.insert(portfolios).values({
    userId: user.id,
    name: "Dev Portfolio",
  });

  console.log("Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
