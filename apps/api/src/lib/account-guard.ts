// Archived trading accounts are kept for history only. Every route that writes trades, plans or
// rules checks the owning account's status and answers 409 with this message when it's archived.
export const ARCHIVED_ACCOUNT_ERROR = "This account is archived — reactivate it to make changes";

export function isArchived(status: string | null | undefined): boolean {
  return status === "archived";
}
