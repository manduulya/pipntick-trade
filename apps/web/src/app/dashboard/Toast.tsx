"use client";

import { useEffect } from "react";

export default function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex items-center gap-2 rounded-lg px-4 py-3 pointer-events-none"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: "1px solid rgba(123,193,59,0.4)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        opacity: message ? 1 : 0,
        transform: message ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity 0.25s ease, transform 0.25s ease",
      }}
    >
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--color-green-primary)" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>{message ?? ""}</span>
    </div>
  );
}
