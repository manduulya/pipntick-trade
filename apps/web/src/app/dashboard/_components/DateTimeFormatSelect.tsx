"use client";

import { useEffect, useRef, useState } from "react";
import { DATE_TIME_FORMAT_OPTIONS, formatDateTime, type DateTimeFormat } from "../../../lib/time-format";

// Same trigger+animated-panel dropdown pattern as AccountSwitcher.tsx — always-mounted panel
// (scaleY + opacity + visibility, not `{open && ...}`) so both opening and closing transition
// instead of snapping, click-outside + Escape to dismiss, current selection highlighted.
export default function DateTimeFormatSelect({
  value,
  onChange,
  /** "YYYY-MM-DDTHH:mm" instant used to render each option's live example. */
  previewValue,
}: {
  value: DateTimeFormat;
  onChange: (format: DateTimeFormat) => void;
  previewValue: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Escape closes the dropdown and returns focus to the trigger — keyboard users otherwise have
  // no way to dismiss it short of tabbing all the way through every option.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    if (open) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const selected = DATE_TIME_FORMAT_OPTIONS.find((o) => o.value === value) ?? DATE_TIME_FORMAT_OPTIONS[0];

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="focus-ring press-scale flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg text-left"
        style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)", minWidth: 260 }}
      >
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{formatDateTime(previewValue, selected.value)}</span>
          <span className="text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>{selected.label}</span>
        </div>
        <svg
          width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          style={{ color: "var(--color-text-secondary)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", flexShrink: 0 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Always mounted so both open and close can transition instead of snapping — same
          "unrolling out of the trigger" scale+translate as AccountSwitcher's dropdown. */}
      <div
        className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-20"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          transformOrigin: "top center",
          transform: open ? "scaleY(1) translateY(0)" : "scaleY(0.85) translateY(-8px)",
          opacity: open ? 1 : 0,
          visibility: open ? "visible" : "hidden",
          pointerEvents: open ? "auto" : "none",
          transition: open
            ? "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease"
            : "transform 0.15s ease, opacity 0.15s ease, visibility 0s linear 0.15s",
        }}
      >
        {DATE_TIME_FORMAT_OPTIONS.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              aria-current={active ? "true" : undefined}
              className="focus-ring press-scale flex items-center justify-between gap-3 w-full px-3 py-2.5 text-left"
              style={{ backgroundColor: active ? "rgba(123,193,59,0.08)" : "transparent" }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold truncate" style={{ color: active ? "var(--color-green-primary)" : "var(--color-text-primary)" }}>
                  {formatDateTime(previewValue, opt.value)}
                </span>
                <span className="text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>
                  {opt.label}
                </span>
              </div>
              {active && (
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "var(--color-green-primary)", flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
