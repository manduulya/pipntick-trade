"use client";

import { useSelectedAccount } from "../../lib/account-context";
import { useUpdateAccount } from "../../lib/hooks";
import { ApiError } from "../../lib/api";

// Shown above every dashboard page while an archived account is selected: its history is viewable
// but read-only (the API rejects writes with 409), with a one-click way back to editable.
export default function ArchivedAccountBanner() {
  const { selectedAccount, readOnly } = useSelectedAccount();
  const updateAccount = useUpdateAccount();

  if (!readOnly || !selectedAccount) return null;

  return (
    <div
      role="status"
      className="shrink-0 flex items-center gap-3 flex-wrap px-4 py-2 text-xs"
      style={{ backgroundColor: "var(--color-bg-surface)", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
    >
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 11h6M3 4h18v3H3z" />
      </svg>
      <span className="flex-1 min-w-0">
        <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>{selectedAccount.name}</span> is archived.
        You can view its history, but nothing can be added or edited.
      </span>
      {updateAccount.isError && (
        <span style={{ color: "var(--color-danger)" }}>
          {updateAccount.error instanceof ApiError ? updateAccount.error.message : "Couldn't reactivate."}
        </span>
      )}
      <button
        type="button"
        onClick={() => updateAccount.mutate({ id: selectedAccount.id, input: { status: "active" } })}
        disabled={updateAccount.isPending}
        className="focus-ring press-scale shrink-0 rounded-md px-3 py-1 font-semibold"
        style={{ border: "1px solid var(--color-green-primary)", color: "var(--color-green-primary)", opacity: updateAccount.isPending ? 0.6 : 1 }}
      >
        {updateAccount.isPending ? "Reactivating…" : "Reactivate"}
      </button>
    </div>
  );
}
