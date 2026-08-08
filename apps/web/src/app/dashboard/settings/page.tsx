"use client";

import { useState } from "react";
import { useTheme } from "../../../lib/theme-context";
import DeleteAccountModal from "./DeleteAccountModal";

export default function SettingsPage() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <div className="h-full overflow-y-auto p-8">
      <h1 className="text-lg font-bold mb-6" style={{ color: "var(--color-text-primary)" }}>Settings</h1>

      <div
        className="max-w-lg rounded-xl p-5 mb-4 flex items-center justify-between gap-4"
        style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Color theme:</h2>
        <div
          className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl"
          style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}
        >
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              aria-pressed={theme === t}
              className="focus-ring press-scale px-6 py-2 text-sm font-semibold rounded-xl capitalize cursor-pointer"
              style={{
                backgroundColor: theme === t ? "var(--color-green-primary)" : "transparent",
                color: theme === t ? "var(--color-on-primary)" : "var(--color-text-secondary)",
                boxShadow: theme === t ? "0 0 16px rgba(123,193,59,0.35)" : "none",
                transition: "background-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease",
              }}
              onMouseEnter={(e) => { if (theme !== t) e.currentTarget.style.color = "var(--color-text-primary)"; }}
              onMouseLeave={(e) => { if (theme !== t) e.currentTarget.style.color = "var(--color-text-secondary)"; }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div
        className="max-w-lg rounded-xl p-5"
        style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-danger)" }}
      >
        <h2 className="text-sm font-bold mb-1" style={{ color: "var(--color-danger)" }}>Danger Zone</h2>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-secondary)" }}>
          Permanently delete your account, all trading accounts, and all trades. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="rounded-lg text-xs font-semibold px-4 py-2"
          style={{ backgroundColor: "transparent", border: "1px solid var(--color-danger)", color: "var(--color-danger)" }}
        >
          Delete Account
        </button>
      </div>

      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}
    </div>
  );
}
