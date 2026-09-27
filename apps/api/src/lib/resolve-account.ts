import { and, eq } from "drizzle-orm";
import { db, tradingAccounts } from "@pipntick/db";
import { getDefaultAccount } from "./ensure-account.js";

/** The caller's requested account id if they own it, else their default account's id, else null. */
export async function resolveAccountId(userId: string, requestedAccountId?: string) {
  if (requestedAccountId) {
    const [account] = await db
      .select()
      .from(tradingAccounts)
      .where(and(eq(tradingAccounts.id, requestedAccountId), eq(tradingAccounts.userId, userId)));
    return account?.id ?? null;
  }
  const account = await getDefaultAccount(userId);
  return account?.id ?? null;
}
