"use client";

import { useEffect, useRef, useState } from "react";
import type { TradingAccount } from "@pipntick/shared";
import { useSelectedAccount } from "../../lib/account-context";
import AddAccountModal from "./AddAccountModal";
import AccountSettingsModal from "./AccountSettingsModal";

const ARCHIVED_OPEN_KEY = "pipntick_archived_accounts_open";

export function DefaultStar({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#f5c542" aria-label="Default account" role="img" className="shrink-0">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}

export function StatusPill({ status }: { status: TradingAccount["status"] }) {
  if (status === "active") return null;
  const archived = status === "archived";
  return (
    <span
      className="shrink-0 rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide"
      style={{
        border: `1px solid ${archived ? "var(--color-border)" : "rgba(245,165,36,0.45)"}`,
        color: archived ? "var(--color-text-muted)" : "#f5a524",
      }}
    >
      {archived ? "Archived" : "Inactive"}
    </span>
  );
}

export default function AccountSwitcher() {
  const { accounts, accountsLoading, selectedAccount, setSelectedAccountId } = useSelectedAccount();
  const [open, setOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<TradingAccount | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      setArchivedOpen(localStorage.getItem(ARCHIVED_OPEN_KEY) === "1");
    } catch {}
  }, []);

  function toggleArchived() {
    setArchivedOpen((v) => {
      try {
        localStorage.setItem(ARCHIVED_OPEN_KEY, v ? "0" : "1");
      } catch {}
      return !v;
    });
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Escape closes the dropdown and returns focus to the trigger — keyboard users otherwise have
  // no way to dismiss it short of tabbing all the way through every account row.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    if (open) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (accountsLoading) {
    return (
      <div className="mb-4 px-2">
        <div className="h-12 rounded-lg animate-pulse" style={{ backgroundColor: "var(--color-bg-surface)" }} />
      </div>
    );
  }

  // The API already orders default → active → inactive → archived; split archived into its own
  // collapsible group at the bottom.
  const current = accounts.filter((a) => a.status !== "archived");
  const archived = accounts.filter((a) => a.status === "archived");

  function renderRow(account: TradingAccount) {
    const active = account.id === selectedAccount?.id;
    const muted = account.status !== "active";
    return (
      <div
        key={account.id}
        className="flex items-center"
        style={{ backgroundColor: active ? "rgba(123,193,59,0.08)" : "transparent" }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)"; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        <button
          type="button"
          onClick={() => { setSelectedAccountId(account.id); setOpen(false); }}
          aria-current={active ? "true" : undefined}
          className="focus-ring press-scale flex flex-col flex-1 min-w-0 px-3 py-2.5 text-left"
          style={{ opacity: muted && !active ? 0.7 : 1 }}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-medium truncate" style={{ color: active ? "var(--color-green-primary)" : "var(--color-text-primary)" }}>
              {account.name}
            </span>
            {account.isDefault && <DefaultStar />}
            <StatusPill status={account.status} />
          </span>
          <span className="text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>
            {[account.broker, account.currency].filter(Boolean).join(" · ")}
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setSettingsTarget(account); setOpen(false); }}
          title="Account settings"
          aria-label={`Settings for ${account.name}`}
          className="focus-ring press-scale shrink-0 p-2.5 mr-1 rounded-md"
          style={{ color: "var(--color-text-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-primary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; }}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 px-2 relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="focus-ring press-scale flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-left"
        style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex flex-col min-w-0 flex-1">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
              {selectedAccount?.name ?? "Select account"}
            </span>
            {selectedAccount?.isDefault && <DefaultStar />}
            {selectedAccount && <StatusPill status={selectedAccount.status} />}
          </span>
          {selectedAccount && (
            <span className="text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>
              {[selectedAccount.broker, selectedAccount.currency].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
        <svg
          width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          style={{ color: "var(--color-text-secondary)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Always mounted (not `{open && ...}`) so both open and close can transition instead of
          snapping instantly — visibility/pointer-events keep it inert and out of the tab order
          while closed. Scales down from the top edge so it reads as unrolling out of the trigger
          button, like pulling a tile down, rather than just fading in place. */}
      <div
        className="absolute left-2 right-2 mt-1 rounded-lg overflow-hidden z-20"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          transformOrigin: "top center",
          transform: open ? "scaleY(1) translateY(0)" : "scaleY(0.85) translateY(-8px)",
          opacity: open ? 1 : 0,
          visibility: open ? "visible" : "hidden",
          pointerEvents: open ? "auto" : "none",
          transition: open
            ? "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease"
            : "transform 0.15s ease, opacity 0.15s ease, visibility 0s linear 0.15s",
        }}
      >
        <div className="thin-scrollbar max-h-[60vh] overflow-y-auto">
          {current.map(renderRow)}

          {archived.length > 0 && (
            <>
              <button
                type="button"
                onClick={toggleArchived}
                aria-expanded={archivedOpen}
                className="focus-ring flex items-center gap-1.5 w-full px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider"
                style={{ borderTop: current.length ? "1px solid var(--color-border)" : undefined, color: "var(--color-text-muted)" }}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 11h6M3 4h18v3H3z" />
                </svg>
                <span className="flex-1">Archived ({archived.length})</span>
                <svg
                  width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}
                  style={{ transform: archivedOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {/* Same animated grid-row fold as the Trade Plan tiles (.plan-fold in globals.css). */}
              <div className="plan-fold" style={{ gridTemplateRows: archivedOpen ? "1fr" : "0fr" }} inert={!archivedOpen}>
                <div className="min-h-0 overflow-hidden">{archived.map(renderRow)}</div>
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setShowAddModal(true); setOpen(false); }}
          className="focus-ring press-scale flex items-center gap-1.5 w-full px-3 py-2.5 text-left text-xs font-medium"
          style={{ borderTop: "1px solid var(--color-border)", color: "var(--color-green-primary)" }}
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add account
        </button>
      </div>

      {showAddModal && <AddAccountModal onClose={() => setShowAddModal(false)} />}
      {settingsTarget && (
        <AccountSettingsModal
          // Re-read from the live list so status/default edits made in the modal show immediately.
          account={accounts.find((a) => a.id === settingsTarget.id) ?? settingsTarget}
          onClose={() => setSettingsTarget(null)}
        />
      )}
    </div>
  );
}
