"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { TradingAccount } from "@pipntick/shared";
import { useAccountTrades, useUpdateAccount } from "../../lib/hooks";
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

          {formError && (
            <p className="text-[11px]" style={{ color: "var(--color-danger)" }}>{formError}</p>
          )}

          <button
            type="submit"
            disabled={updateAccount.isPending || tradesLoading}
            className="mt-2 rounded-lg text-xs font-semibold py-2.5 transition-opacity"
            style={{ backgroundColor: "var(--color-green-primary)", color: "var(--color-bg-base)", opacity: updateAccount.isPending || tradesLoading ? 0.6 : 1 }}
          >
            {updateAccount.isPending ? "Saving..." : tradesLoading ? "Loading..." : "Save Changes"}
          </button>

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
        />
      )}
    </div>,
    document.body,
  );
}
