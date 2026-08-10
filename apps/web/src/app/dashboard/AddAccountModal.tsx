"use client";

import { useState } from "react";
import { useCreateAccount } from "../../lib/hooks";
import { useSelectedAccount } from "../../lib/account-context";
import { ApiError } from "../../lib/api";

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

export default function AddAccountModal({ onClose }: { onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useState(() => { requestAnimationFrame(() => setVisible(true)); });

  // Local calendar date, to match the local-date semantics of <input type="date">'s value
  // (toISOString() would give the UTC date, which is off by a day in some timezones).
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const [name, setName] = useState("");
  const [broker, setBroker] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [startingBalance, setStartingBalance] = useState("");
  const [createdAt, setCreatedAt] = useState(today);
  const [brokerUtcOffsetHours, setBrokerUtcOffsetHours] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createAccount = useCreateAccount();
  const { setSelectedAccountId } = useSelectedAccount();

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

    createAccount.mutate(
      {
        name: trimmedName,
        broker: broker.trim() || undefined,
        currency: currency.trim() || undefined,
        startingBalance: startingBalance ? Number(startingBalance) : undefined,
        createdAt: new Date(createdAt).toISOString(),
        brokerUtcOffsetMinutes: brokerUtcOffsetHours.trim() === "" ? null : Math.round(Number(brokerUtcOffsetHours) * 60),
      },
      {
        onSuccess: (account) => {
          setSelectedAccountId(account.id);
          handleClose();
        },
        onError: (err) => {
          setFormError(err instanceof ApiError ? err.message : "Failed to create account.");
        },
      },
    );
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
          border: "1px solid var(--color-border)",
          maxHeight: "90vh",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <h2 className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Add Trading Account</h2>
          <button onClick={handleClose} className="hover:opacity-60 transition-opacity" style={{ color: "var(--color-text-muted)" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-5 py-4 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Account Name</label>
            <input type="text" placeholder="e.g. Prop Firm Challenge" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Broker</label>
            <input type="text" placeholder="e.g. FTMO (optional)" value={broker} onChange={(e) => setBroker(e.target.value)} style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Currency</label>
              <input type="text" placeholder="USD" value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Starting Balance</label>
              <input type="number" step="any" placeholder="0.00" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Account Created Date</label>
            <input type="date" max={today} value={createdAt} onChange={(e) => setCreatedAt(e.target.value)} style={inputStyle} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Broker Server Timezone (UTC offset, optional)</label>
            <input type="number" step="0.5" placeholder="e.g. 3 for UTC+3" value={brokerUtcOffsetHours} onChange={(e) => setBrokerUtcOffsetHours(e.target.value)} style={inputStyle} />
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Check your platform&apos;s server time (e.g. in MT4/5, Market Watch). Used to auto-convert screenshot-imported trade times to UTC — leave blank if unsure.
            </p>
          </div>

          {formError && (
            <p className="text-[11px]" style={{ color: "var(--color-danger)" }}>{formError}</p>
          )}

          <button
            type="submit"
            disabled={createAccount.isPending}
            className="mt-2 rounded-lg text-xs font-semibold py-2.5 transition-opacity"
            style={{
              backgroundColor: "var(--color-green-primary)",
              color: "var(--color-bg-base)",
              opacity: createAccount.isPending ? 0.6 : 1,
            }}
          >
            {createAccount.isPending ? "Creating..." : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
