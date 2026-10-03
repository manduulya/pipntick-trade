"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatUtcOffsetLabel, timeZoneCity, timeZoneOffsetMinutes } from "../../lib/time-format";

// Shared by AddAccountModal and AccountSettingsModal. Picks the broker platform's clock as an
// IANA timezone (e.g. "America/New_York") rather than a fixed UTC offset, so daylight saving is
// handled automatically — a fixed "UTC−5" silently became wrong every March for New York brokers.
// Legacy accounts that only have a fixed offset show it as the current value until a zone is picked.
//
// Same trigger+animated-panel dropdown as DateTimeFormatSelect.tsx / AccountSwitcher.tsx rather
// than a native <select>, so it matches the rest of the app.

// Common broker / trading-hub clocks, listed first. Anything else is reachable via search.
const COMMON_ZONES: { zone: string; note: string }[] = [
  { zone: "America/New_York", note: "New York (ET) — CME futures, US brokers" },
  { zone: "America/Chicago", note: "Chicago (CT)" },
  { zone: "America/Los_Angeles", note: "Los Angeles (PT)" },
  { zone: "Europe/London", note: "London" },
  { zone: "Europe/Berlin", note: "Frankfurt (CET)" },
  { zone: "Europe/Athens", note: "Athens / Cyprus (EET) — common MT4/5 server time" },
  { zone: "Europe/Moscow", note: "Moscow" },
  { zone: "Asia/Dubai", note: "Dubai" },
  { zone: "Asia/Kolkata", note: "Mumbai" },
  { zone: "Asia/Singapore", note: "Singapore" },
  { zone: "Asia/Hong_Kong", note: "Hong Kong" },
  { zone: "Asia/Tokyo", note: "Tokyo" },
  { zone: "Asia/Ulaanbaatar", note: "Ulaanbaatar" },
  { zone: "Australia/Sydney", note: "Sydney" },
  { zone: "UTC", note: "UTC (no daylight saving)" },
];

function allZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
}

/** "UTC−4" for the zone right now. */
function currentOffsetLabel(zone: string): string {
  try {
    return formatUtcOffsetLabel(timeZoneOffsetMinutes(new Date(), zone));
  } catch {
    return "";
  }
}

export default function BrokerTimezoneField({
  value,
  legacyOffsetMinutes = null,
  onChange,
}: {
  /** IANA zone, or "" for not set. */
  value: string;
  /** The account's old fixed offset, shown when no zone has been picked yet. */
  legacyOffsetMinutes?: number | null;
  onChange: (zone: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Escape closes the dropdown and returns focus to the trigger.
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

  useEffect(() => {
    if (open) requestAnimationFrame(() => searchRef.current?.focus());
    else setQuery("");
  }, [open]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMON_ZONES;
    const common = COMMON_ZONES.filter((z) => z.zone.toLowerCase().includes(q) || z.note.toLowerCase().includes(q));
    const others = allZones()
      .filter((z) => z.toLowerCase().replace(/_/g, " ").includes(q) && !common.some((c) => c.zone === z))
      .slice(0, 40)
      .map((zone) => ({ zone, note: zone.replace(/_/g, " ") }));
    return [...common, ...others];
  }, [query]);

  const selectedNote = COMMON_ZONES.find((z) => z.zone === value)?.note ?? (value ? value.replace(/_/g, " ") : null);

  function pick(zone: string) {
    onChange(zone);
    setOpen(false);
  }

  function optionRow(zone: string, note: string, active: boolean) {
    return (
      <button
        key={zone || "__none"}
        type="button"
        onClick={() => pick(zone)}
        aria-current={active ? "true" : undefined}
        className="focus-ring press-scale flex items-center justify-between gap-3 w-full px-3 py-2.5 text-left"
        style={{ backgroundColor: active ? "rgba(123,193,59,0.08)" : "transparent" }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)"; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold truncate" style={{ color: active ? "var(--color-green-primary)" : "var(--color-text-primary)" }}>
            {zone ? note : "Not set / unsure"}
          </span>
          {zone && (
            <span className="text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>
              {zone} · now {currentOffsetLabel(zone)}
            </span>
          )}
        </div>
        {active && (
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "var(--color-green-primary)", flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Broker Timezone (optional)</label>
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
            {value ? (
              <>
                <span className="text-xs font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{selectedNote ?? timeZoneCity(value)}</span>
                <span className="text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>{value} · now {currentOffsetLabel(value)}</span>
              </>
            ) : legacyOffsetMinutes ? (
              <>
                <span className="text-xs font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                  Fixed {formatUtcOffsetLabel(legacyOffsetMinutes)} (no daylight saving)
                </span>
                <span className="text-[10px] truncate" style={{ color: "#f5a524" }}>Pick your broker&apos;s timezone so summer/winter time is handled</span>
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

        {/* Always mounted so open and close can both transition. */}
        <div
          className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-20 flex flex-col"
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
          <div className="p-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a city or timezone…"
              aria-label="Search timezones"
              className="focus-ring w-full text-xs rounded-md px-2.5 py-1.5"
              style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", outline: "none" }}
            />
          </div>
          <div className="thin-scrollbar overflow-y-auto" style={{ maxHeight: 240 }}>
            {!query && optionRow("", "", value === "")}
            {options.map((o) => optionRow(o.zone, o.note, o.zone === value))}
            {options.length === 0 && (
              <p className="text-[11px] px-3 py-3" style={{ color: "var(--color-text-muted)" }}>No timezone matches &ldquo;{query}&rdquo;.</p>
            )}
          </div>
        </div>
      </div>
      <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
        The timezone your platform shows trade times in (MT4/5: check the server time in Market Watch; CME futures platforms usually use New York or Chicago). Daylight saving is handled automatically. Leave as &quot;Not set&quot; to enter times in UTC.
      </p>
    </div>
  );
}
