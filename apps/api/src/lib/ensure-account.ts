import { asc, desc, eq } from "drizzle-orm";
import { clerkClient } from "@clerk/fastify";
import { db, tradingAccounts, users } from "@pipntick/db";

export async function ensureUser(userId: string) {
  const [existing] = await db.select().from(users).where(eq(users.id, userId));
  if (existing) return existing;

  let email = `${userId}@unknown.local`;
  if (process.env.CLERK_SECRET_KEY) {
    const clerkUser = await clerkClient.users.getUser(userId);
    email = clerkUser.emailAddresses[0]?.emailAddress ?? email;
  }

  const [created] = await db.insert(users).values({ id: userId, email }).returning();
  return created;
}

export async function getDefaultAccount(userId: string) {
  const [existing] = await db
    .select()
    .from(tradingAccounts)
    .where(eq(tradingAccounts.userId, userId))
    .orderBy(desc(tradingAccounts.isDefault), asc(tradingAccounts.createdAt))
    .limit(1);
  return existing ?? null;
}
