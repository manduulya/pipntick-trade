"use client";

import { useState } from "react";
import AddAccountModal from "./AddAccountModal";

export default function EmptyAccountsState() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-4">
      <p className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>You have 0 trading accounts</p>
      <p className="text-xs max-w-xs" style={{ color: "#8899aa" }}>
        Add a trading account to start logging trades and tracking performance.
      </p>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="mt-2 rounded-lg text-xs font-semibold px-4 py-2.5"
        style={{ backgroundColor: "#7bc13b", color: "#05090f" }}
      >
        Add Trading Account
      </button>

      {showModal && <AddAccountModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
