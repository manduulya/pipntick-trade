"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { AccountStatus, TradingAccount } from "@pipntick/shared";
import { ACCOUNT_STATUSES } from "@pipntick/shared";
import { useAccountTrades, useUpdateAccount } from "../../lib/hooks";
import { useSelectedAccount } from "../../lib/account-context";
import { DefaultStar } from "./AccountSwitcher";
import { useTimeFormat } from "../../lib/time-format-context";
import { formatDate } from "../../lib/time-format";
import { ApiError } from "../../lib/api";
import { useLockBodyScroll } from "../../lib/use-lock-body-scroll";
import DeleteTradingAccountModal from "./DeleteTradingAccountModal";
import BrokerTimezoneField from "./BrokerTimezoneField";

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

export default function AccountSettingsModal({
  account,
  onClose,
}: {
  account: TradingAccount;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useState(() => { requestAnimationFrame(() => setVisible(true)); });
  useLockBodyScroll();

  const { timeFormat } = useTimeFormat();
  const [name, setName] = useState(account.name);
  const [broker, setBroker] = useState(account.broker ?? "");
  const [currency, setCurrency] = useState(account.currency);
  const [startingBalance, setStartingBalance] = useState(account.startingBalance);
  const [createdAt, setCreatedAt] = useState(account.createdAt.slice(0, 10));
  const [brokerUtcOffsetHours, setBrokerUtcOffsetHours] = useState(
    account.brokerUtcOffsetMinutes != null ? String(account.brokerUtcOffsetMinutes / 60) : "",
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Local calendar date, to match the local-date semantics of <input type="date">'s value
  // (toISOString() would give the UTC date, which is off by a day in some timezones).
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const updateAccount = useUpdateAccount();
  // Status/default changes save immediately (separate from the details form's Save button).
  const statusMutation = useUpdateAccount();
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const { accounts } = useSelectedAccount();
  const archived = account.status === "archived";
  // Who inherits the default if this (default) account is archived — mirrors handOffDefault in
  // apps/api/src/routes/accounts.ts: the oldest other non-archived account.
  const defaultHeir = useMemo(
    () =>
      accounts
        .filter((a) => a.id !== account.id && a.status !== "archived")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null,
    [accounts, account.id],
  );

  function changeStatus(status: AccountStatus) {
    if (status === account.status) return;
    setStatusNotice(null);
    statusMutation.mutate(
      { id: account.id, input: { status } },
      {
        onSuccess: () => {
          if (status === "archived" && account.isDefault) {
            setStatusNotice(defaultHeir ? `“${defaultHeir.name}” is now your default account.` : "You have no other usable account, so there's no default now.");
          } else if (status === "archived") {
            setStatusNotice("Archived — its history stays viewable, read-only.");
          } else if (account.status === "archived") {
            setStatusNotice("Reactivated — you can add and edit trades again.");
          }
        },
        onError: (err) => setStatusNotice(err instanceof ApiError ? err.message : "Couldn't change the status."),
      },
    );
  }

  function makeDefault() {
    setStatusNotice(null);
    statusMutation.mutate(
      { id: account.id, input: { isDefault: true } },
      { onError: (err) => setStatusNotice(err instanceof ApiError ? err.message : "Couldn't set the default.") },
    );
  }
  const { data: accountTrades, isLoading: tradesLoading } = useAccountTrades(account.id);

  const earliestTradeDate = useMemo(() => {
    if (!accountTrades || accountTrades.length === 0) return null;
    return accountTrades.reduce((min, t) => (t.entryTime < min ? t.entryTime : min), accountTrades[0].entryTime).slice(0, 10);
  }, [accountTrades]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Account name is required.");
      return;
    }
    if (!createdAt) {
      setFormError("Account created date is required.");
      return;
    }
    if (createdAt > today) {
      setFormError("Account created date cannot be in the future.");
      return;
    }
    if (earliestTradeDate && createdAt > earliestTradeDate) {
      setFormError(
        `This account has a trade recorded on ${formatDate(earliestTradeDate, timeFormat)}. Choose a created date on or before that, or delete the conflicting trade first.`,
      );
      return;
    }

    updateAccount.mutate(
      {
        id: account.id,
        input: {
          name: trimmedName,
          broker: broker.trim() || undefined,
          currency: currency.trim() || undefined,
          startingBalance: startingBalance !== "" ? Number(startingBalance) : undefined,
          createdAt: new Date(createdAt).toISOString(),
          brokerUtcOffsetMinutes: brokerUtcOffsetHours.trim() === "" ? null : Math.round(Number(brokerUtcOffsetHours) * 60),
        },
      },
      {
        onSuccess: () => handleClose(),
        onError: (err) => {
          setFormError(err instanceof ApiError ? err.message : "Failed to update account.");
        },
      },
    );
  }

  return createPortal(
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
          border: "1px solid var(--color-border)",
          maxHeight: "90vh",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <h2 className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Account Settings</h2>
          <button onClick={handleClose} className="hover:opacity-60 transition-opacity" style={{ color: "var(--color-text-muted)" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="thin-scrollbar flex flex-col gap-3 px-5 py-4 overflow-y-auto">
          {/* Status + default — applied immediately on click. */}
          <div className="flex flex-col gap-2.5 rounded-lg p-3" style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Status</span>
              <div className="flex gap-[3px] p-[3px] rounded-lg" style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }} role="group" aria-label="Account status">
                {ACCOUNT_STATUSES.map((s) => {
                  const on = account.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => changeStatus(s)}
                      disabled={statusMutation.isPending}
                      aria-pressed={on}
                      className="focus-ring px-3 py-1.5 rounded-md text-[11px] capitalize"
                      style={{
                        fontWeight: on ? 800 : 600,
                        backgroundColor: on ? "var(--color-border)" : "transparent",
                        color: on ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                        cursor: statusMutation.isPending ? "wait" : "pointer",
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              {account.status === "active" && "Trading this account now."}
              {account.status === "inactive" && "Paused — still listed and editable, shown below your active accounts."}
              {archived && "Finished — tucked into the Archived group. Its history stays viewable but read-only until you reactivate it."}
              {account.status !== "archived" && account.isDefault && (
                <> Archiving it moves the default to {defaultHeir ? `“${defaultHeir.name}”` : "no account (you have no other usable one)"}.</>
              )}
            </p>
            <div className="flex items-center justify-between gap-3 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
              <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Default account</span>
              {account.isDefault ? (
                <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "#f5c542" }}>
                  <DefaultStar size={12} /> Default
                </span>
              ) : (
                <button
                  type="button"
                  onClick={makeDefault}
                  disabled={archived || statusMutation.isPending}
                  title={archived ? "Reactivate this account to make it the default" : undefined}
                  className="focus-ring rounded-md px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    border: "1px solid var(--color-border)",
                    color: archived ? "var(--color-text-disabled)" : "var(--color-text-primary)",
                    cursor: archived ? "not-allowed" : "pointer",
                  }}
                >
                  Set as default
                </button>
              )}
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              The default account opens automatically when you sign in on a new device.
            </p>
            {statusNotice && (
              <p className="text-[11px]" style={{ color: statusMutation.isError ? "var(--color-danger)" : "var(--color-green-primary)" }}>
                {statusNotice}
              </p>
            )}
          </div>

          {/* Archived accounts are read-only (the API rejects edits with 409) — only Status changes. */}
          <fieldset disabled={archived} className="contents">
          <div className="flex flex-col gap-1">
            <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Account Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Broker</label>
            <input type="text" placeholder="(optional)" value={broker} onChange={(e) => setBroker(e.target.value)} style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Currency</label>
              <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Starting Balance</label>
              <input type="number" step="any" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Account Created Date</label>
            <input type="date" max={today} value={createdAt} onChange={(e) => setCreatedAt(e.target.value)} style={inputStyle} />
            {earliestTradeDate && (
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Earliest trade on record: {formatDate(earliestTradeDate, timeFormat)} — created date can&apos;t be set after this.
              </p>
            )}
          </div>
          <BrokerTimezoneField value={brokerUtcOffsetHours} onChange={setBrokerUtcOffsetHours} />
          </fieldset>

          {formError && (
            <p className="text-[11px]" style={{ color: "var(--color-danger)" }}>{formError}</p>
          )}

          {archived ? (
            <p className="mt-2 text-[11px] text-center" style={{ color: "var(--color-text-muted)" }}>
              Details are read-only while the account is archived.
            </p>
          ) : (
            <button
              type="submit"
              disabled={updateAccount.isPending || tradesLoading}
              className="mt-2 rounded-lg text-xs font-semibold py-2.5 transition-opacity"
              style={{ backgroundColor: "var(--color-green-primary)", color: "var(--color-bg-base)", opacity: updateAccount.isPending || tradesLoading ? 0.6 : 1 }}
            >
              {updateAccount.isPending ? "Saving..." : tradesLoading ? "Loading..." : "Save Changes"}
            </button>
          )}

          <div className="mt-2 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
            <p className="text-[10px] mb-2" style={{ color: "var(--color-text-muted)" }}>Danger Zone</p>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full rounded-lg text-xs font-semibold py-2.5"
              style={{ backgroundColor: "transparent", border: "1px solid var(--color-danger)", color: "var(--color-danger)" }}
            >
              Delete This Account
            </button>
          </div>
        </form>
      </div>

      {showDeleteConfirm && (
        <DeleteTradingAccountModal
          account={account}
          onClose={() => setShowDeleteConfirm(false)}
          onDeleted={onClose}
          onArchiveInstead={
            archived
              ? undefined
              : () => {
                  setShowDeleteConfirm(false);
                  changeStatus("archived");
                }
          }
        />
      )}
    </div>,
    document.body,
  );
}
