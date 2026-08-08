"use client";

import { useState } from "react";
import type { TradingAccount } from "@pipntick/shared";
import { useDeleteTradingAccount } from "../../lib/hooks";
import { ApiError } from "../../lib/api";

export default function DeleteTradingAccountModal({
  account,
  onClose,
  onDeleted,
}: {
  account: TradingAccount;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useState(() => { requestAnimationFrame(() => setVisible(true)); });

  const [formError, setFormError] = useState<string | null>(null);
  const deleteAccount = useDeleteTradingAccount();

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  function handleConfirm() {
    setFormError(null);
    deleteAccount.mutate(account.id, {
      onSuccess: () => {
        onDeleted?.();
        handleClose();
      },
      onError: (err) => {
        setFormError(err instanceof ApiError ? err.message : "Failed to delete account.");
      },
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: visible ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(4px)" : "blur(0px)",
        transition: "background-color 0.3s ease, backdrop-filter 0.3s ease",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-danger)",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <h2 className="text-sm font-bold" style={{ color: "var(--color-danger)" }}>Delete Trading Account</h2>
          <button onClick={handleClose} className="hover:opacity-60 transition-opacity" style={{ color: "var(--color-text-muted)" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            Delete <span style={{ color: "var(--color-text-primary)" }}>&quot;{account.name}&quot;</span> and every trade recorded in it?
            This cannot be undone.
          </p>

          {formError && (
            <p className="text-[11px]" style={{ color: "var(--color-danger)" }}>{formError}</p>
          )}

          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg text-xs font-semibold py-2.5"
              style={{ backgroundColor: "transparent", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteAccount.isPending}
              onClick={handleConfirm}
              className="flex-1 rounded-lg text-xs font-semibold py-2.5 transition-opacity"
              style={{ backgroundColor: "var(--color-danger)", color: "var(--color-bg-base)", opacity: deleteAccount.isPending ? 0.6 : 1 }}
            >
              {deleteAccount.isPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
