"use client";

import { useState } from "react";
import DeleteAccountModal from "./DeleteAccountModal";

export default function SettingsPage() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <div className="h-full overflow-y-auto p-8">
      <h1 className="text-lg font-bold mb-6" style={{ color: "#f0f0f0" }}>Settings</h1>

      <div
        className="max-w-lg rounded-xl p-5"
        style={{ backgroundColor: "#0b1220", border: "1px solid #e05252" }}
      >
        <h2 className="text-sm font-bold mb-1" style={{ color: "#e05252" }}>Danger Zone</h2>
        <p className="text-xs mb-4" style={{ color: "#8899aa" }}>
          Permanently delete your account, all trading accounts, and all trades. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="rounded-lg text-xs font-semibold px-4 py-2"
          style={{ backgroundColor: "transparent", border: "1px solid #e05252", color: "#e05252" }}
        >
          Delete Account
        </button>
      </div>

      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}
    </div>
  );
}
