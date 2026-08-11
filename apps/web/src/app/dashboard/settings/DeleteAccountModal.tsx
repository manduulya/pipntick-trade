"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useDeleteAccount } from "../../../lib/hooks";
import { ApiError } from "../../../lib/api";
import { useLockBodyScroll } from "../../../lib/use-lock-body-scroll";

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-base)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text-primary)",
  borderRadius: 6,
  fontSize: 12,
  padding: "7px 10px",
  outline: "none",
  width: "100%",
};

export default function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useState(() => { requestAnimationFrame(() => setVisible(true)); });
  useLockBodyScroll();

  const [confirmText, setConfirmText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const deleteAccount = useDeleteAccount();
  const { signOut } = useClerk();
  const router = useRouter();

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  function handleConfirm() {
    setFormError(null);
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        signOut(() => router.push("/"));
      },
      onError: (err) => {
        setFormError(err instanceof ApiError ? err.message : "Failed to delete account.");
      },
    });
  }

  const canConfirm = confirmText === "DELETE" && !deleteAccount.isPending;

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
          maxHeight: "90vh",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <h2 className="text-sm font-bold" style={{ color: "var(--color-danger)" }}>Delete Account</h2>
          <button onClick={handleClose} className="hover:opacity-60 transition-opacity" style={{ color: "var(--color-text-muted)" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4 overflow-y-auto">
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            This permanently deletes your account, every trading account you own, and every trade in them.
            This action cannot be undone.
          </p>

          <div className="flex flex-col gap-1">
            <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
              Type <span style={{ color: "var(--color-text-primary)" }}>DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              style={inputStyle}
              autoComplete="off"
            />
          </div>

          {formError && (
            <p className="text-[11px]" style={{ color: "var(--color-danger)" }}>{formError}</p>
          )}

          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="mt-2 rounded-lg text-xs font-semibold py-2.5 transition-opacity"
            style={{
              backgroundColor: "var(--color-danger)",
              color: "var(--color-bg-base)",
              opacity: canConfirm ? 1 : 0.4,
              cursor: canConfirm ? "pointer" : "not-allowed",
            }}
          >
            {deleteAccount.isPending ? "Deleting..." : "Permanently Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
