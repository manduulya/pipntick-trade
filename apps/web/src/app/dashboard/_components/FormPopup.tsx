"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

// Small popup on top of the trade form (e.g. "Stop loss, targets & fees"). The fields inside stay
// bound to the form's own state, so edits apply as you type; Done (or Esc / backdrop) just closes.

export default function FormPopup({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-label={title}
        className="w-full max-w-sm rounded-2xl flex flex-col gap-3 p-5"
        style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div>
          <h3 className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>{title}</h3>
          {description && <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>{description}</p>}
        </div>
        {children}
        <div className="flex justify-end pt-1">
          {/* Inline styles + mouse handlers (the app's usual hover pattern) so the button's look
              never depends on a stylesheet reload. */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-semibold"
            style={{
              backgroundColor: "var(--color-green-primary)",
              color: "var(--color-bg-base)",
              cursor: "pointer",
              transition: "opacity 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
