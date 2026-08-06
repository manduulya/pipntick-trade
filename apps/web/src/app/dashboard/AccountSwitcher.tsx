"use client";

import { useEffect, useRef, useState } from "react";
import type { TradingAccount } from "@pipntick/shared";
import { useSelectedAccount } from "../../lib/account-context";
import AddAccountModal from "./AddAccountModal";
import AccountSettingsModal from "./AccountSettingsModal";

export default function AccountSwitcher() {
  const { accounts, accountsLoading, selectedAccount, setSelectedAccountId } = useSelectedAccount();
  const [open, setOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<TradingAccount | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (accountsLoading) {
    return (
      <div className="mb-4 px-2">
        <div className="h-12 rounded-lg animate-pulse" style={{ backgroundColor: "#0b1220" }} />
      </div>
    );
  }

  return (
    <div className="mb-4 px-2 relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-left"
        style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}
      >
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-semibold truncate" style={{ color: "#f0f0f0" }}>
            {selectedAccount?.name ?? "Select account"}
          </span>
          {selectedAccount && (
            <span className="text-[10px] truncate" style={{ color: "#4a5d70" }}>
              {[selectedAccount.broker, selectedAccount.currency].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
        <svg
          width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          style={{ color: "#8899aa", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-2 right-2 mt-1 rounded-lg overflow-hidden z-20"
          style={{ backgroundColor: "#0b1220", border: "1px solid #1a2d4a" }}
        >
          {accounts.map((account) => {
            const active = account.id === selectedAccount?.id;
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
                  className="flex flex-col flex-1 min-w-0 px-3 py-2 text-left"
                >
                  <span className="text-xs font-medium truncate" style={{ color: active ? "#7bc13b" : "#f0f0f0" }}>
                    {account.name}
                  </span>
                  <span className="text-[10px] truncate" style={{ color: "#4a5d70" }}>
                    {[account.broker, account.currency].filter(Boolean).join(" · ")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSettingsTarget(account); setOpen(false); }}
                  title="Account settings"
                  className="shrink-0 p-2 mr-1 rounded-md"
                  style={{ color: "#4a5d70" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#f0f0f0"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#4a5d70"; }}
                >
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => { setShowAddModal(true); setOpen(false); }}
            className="flex items-center gap-1.5 w-full px-3 py-2.5 text-left text-xs font-medium"
            style={{ borderTop: "1px solid #1a2d4a", color: "#7bc13b" }}
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add account
          </button>
        </div>
      )}

      {showAddModal && <AddAccountModal onClose={() => setShowAddModal(false)} />}
      {settingsTarget && <AccountSettingsModal account={settingsTarget} onClose={() => setSettingsTarget(null)} />}
    </div>
  );
}
