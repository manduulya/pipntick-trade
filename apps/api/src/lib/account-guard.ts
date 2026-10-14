// Archived trading accounts are kept for history only. Every route that writes trades, plans or
// rules checks the owning account's status and answers 409 with this message when it's archived.
export const ARCHIVED_ACCOUNT_ERROR = "This account is archived — reactivate it to make changes";

import { ASSET_CLASSES, symbolFitsClass, type AssetClass } from "@pipntick/shared";

export function isArchived(status: string | null | undefined): boolean {
  return status === "archived";
}

/** 400 message for a symbol outside the account's asset class, or null when it fits (or the
 * account has no class, e.g. a minimal test fixture). Used by trade and plan writes. */
export function symbolClassError(symbol: string, assetClass: AssetClass | null | undefined): string | null {
  if (!assetClass || symbolFitsClass(symbol, assetClass)) return null;
  const label = ASSET_CLASSES[assetClass].label;
  return `${symbol} isn't a ${label.toLowerCase()} instrument — this account trades ${label}`;
}
