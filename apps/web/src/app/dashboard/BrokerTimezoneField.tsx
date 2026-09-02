"use client";

import { useEffect, useRef, useState } from "react";

// Shared by AddAccountModal and AccountSettingsModal. Was previously a bare `type="number"`
// input asking users to know their broker's raw UTC offset off the top of their head — most
// people know their broker's city/region, not "+2" vs "+3", so this lists offsets annotated
// with the city/region that commonly runs at each one (forex broker servers cluster heavily
// around Cyprus/EET, New York, and London). The underlying value stored is still just the UTC
// offset in hours (string, e.g. "2", "-5", "5.5") — same shape the account API already expects
// — this only changes how the user picks it.
//
// Same trigger+animated-panel dropdown as DateTimeFormatSelect.tsx (itself mirroring
// AccountSwitcher.tsx's dropdown) rather than a native <select>, so it matches the rest of the
// app's dropdown look instead of the browser's own unstyled list/scrollbar.

// Well-known broker/financial-hub locations, keyed by offset (hours from UTC). Only offsets
// with a common trading-relevant location get an annotation; every other half-hour offset in
// the -12..+14 range still gets a plain "UTC±H:MM" option so the full range stays selectable.
const KNOWN_LOCATIONS: Record<string, string> = {
  "-8": "Los Angeles",
  "-5": "New York (EST)",
  "-4": "New York (EDT) / Toronto",
  "0": "London (GMT)",
  "1": "London (BST) / Frankfurt (CET)",
  "2": "Cyprus / Athens (EET) — common MT4/5 broker default",
  "3": "Moscow / Cyprus (EEST, summer)",
  "4": "Dubai",
  "5.5": "Mumbai",
  "8": "Singapore / Hong Kong",
  "9": "Tokyo",
  "10": "Sydney (AEST)",
};

function formatOffset(offset: number): string {
  const sign = offset >= 0 ? "+" : "−";
  const abs = Math.abs(offset);
  const hours = Math.floor(abs);
  const minutes = Math.round((abs - hours) * 60);
  return `UTC${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const OFFSET_OPTIONS: { value: string; offsetLabel: string; location: string | null }[] = [];
for (let offset = -12; offset <= 14; offset += 0.5) {
  OFFSET_OPTIONS.push({
    value: String(offset),
    offsetLabel: formatOffset(offset),
    location: KNOWN_LOCATIONS[String(offset)] ?? null,
  });
}

export default function BrokerTimezoneField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
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

  const selected = OFFSET_OPTIONS.find((o) => o.value === value) ?? null;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Broker Server Timezone (optional)</label>
      <div className="relative" ref={rootRef}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="true"
          aria-expanded={open}
          className="focus-ring press-scale flex items-center gap-3 pl-3 pr-3 py-2 rounded-lg text-left w-full"
          style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex flex-col min-w-0 flex-1">
            {selected ? (
              <>
                <span className="text-xs font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{selected.offsetLabel}</span>
                {selected.location && (
                  <span className="text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>{selected.location}</span>
                )}
              </>
            ) : (
              <span className="text-xs font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>Not set / unsure</span>
            )}
          </div>
          <svg
            width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            style={{ color: "var(--color-text-secondary)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", flexShrink: 0 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Always mounted so both open and close can transition instead of snapping — same
            "unrolling out of the trigger" scale+translate as AccountSwitcher's/DateTimeFormatSelect's
            dropdowns. Internally scrollable (rather than a native <select> list) since the offset
            range spans -12..+14 in half-hour steps. */}
        <div
          className="thin-scrollbar absolute left-0 right-0 mt-1 rounded-lg overflow-y-auto z-20"
          style={{
            backgroundColor: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            maxHeight: 260,
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
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            aria-current={value === "" ? "true" : undefined}
            className="focus-ring press-scale flex items-center justify-between gap-3 w-full px-3 py-2.5 text-left"
            style={{ backgroundColor: value === "" ? "rgba(123,193,59,0.08)" : "transparent" }}
            onMouseEnter={(e) => { if (value !== "") e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={(e) => { if (value !== "") e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <span className="text-xs font-semibold truncate" style={{ color: value === "" ? "var(--color-green-primary)" : "var(--color-text-primary)" }}>
              Not set / unsure
            </span>
            {value === "" && (
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "var(--color-green-primary)", flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          {OFFSET_OPTIONS.map((opt) => {
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
                    {opt.offsetLabel}
                  </span>
                  {opt.location && (
                    <span className="text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>{opt.location}</span>
                  )}
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
      <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
        Pick your platform&apos;s server time zone (e.g. in MT4/5, right-click Market Watch → check server time). Trade date/time fields then read as this zone, and it&apos;s used to work out the trading session — leave as &quot;Not set&quot; to enter times in UTC.
      </p>
    </div>
  );
}
