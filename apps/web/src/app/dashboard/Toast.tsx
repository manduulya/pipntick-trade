"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  // Portaled to document.body rather than rendered in place: several callers (e.g.
  // DayTradesModal) render this inside a modal card that has its own `transform` for its
  // fade+scale entrance animation, which makes that card a new containing block for
  // `position: fixed` descendants — the toast would center within the modal's box instead of the
  // true viewport. Same fix as DateTimePicker's popover for the same underlying reason.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div
        className="flex items-center gap-2 rounded-lg px-4 py-3"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid rgba(123,193,59,0.4)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          opacity: message ? 1 : 0,
          transform: message ? "scale(1)" : "scale(0.95)",
          transition: "opacity 0.25s ease, transform 0.25s ease",
        }}
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--color-green-primary)" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>{message ?? ""}</span>
      </div>
    </div>,
    document.body,
  );
}
