import { and, eq } from "drizzle-orm";
import { db, tradingAccounts } from "@pipntick/db";
import { getDefaultAccount } from "./ensure-account.js";

/**
 * The caller's requested account if they own it, else their default account, else null. Returns
 * the status too so write routes can refuse archived accounts without another query.
 */
export async function resolveAccount(userId: string, requestedAccountId?: string) {
  if (requestedAccountId) {
    const [account] = await db
      .select({ id: tradingAccounts.id, status: tradingAccounts.status })
      .from(tradingAccounts)
      .where(and(eq(tradingAccounts.id, requestedAccountId), eq(tradingAccounts.userId, userId)));
    return account ?? null;
  }
  const account = await getDefaultAccount(userId);
  return account ? { id: account.id, status: account.status } : null;
}

/** Id-only form of resolveAccount, for read routes. */
export async function resolveAccountId(userId: string, requestedAccountId?: string) {
  return (await resolveAccount(userId, requestedAccountId))?.id ?? null;
}
