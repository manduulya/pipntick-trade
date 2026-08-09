"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTimeFormat } from "../../../lib/time-format-context";
import { DATE_TIME_FORMAT_OPTIONS, formatDateTime, to12Hour, to24Hour, usesTwelveHour } from "../../../lib/time-format";

// Replaces the native <input type="datetime-local"> so the trigger can be a real toggle: native
// pickers only expose showPicker() to open, there's no matching close call, so clicking the
// browser's own calendar icon a second time just reopens it instead of dismissing it. This owns
// its own open/closed state instead, entirely under our control. It also displays and edits time
// in whatever format the user picked in Settings (12h/24h, date order) rather than always 24h.
//
// Value shape matches <input type="datetime-local"> exactly ("YYYY-MM-DDTHH:mm", always 24h
// internally regardless of display format, or "" for unset) so it drops in wherever that was used
// without touching the surrounding form's state shape.
export default function DateTimePicker({
  value,
  onChange,
  min,
  max,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Same "YYYY-MM-DDTHH:mm" shape as value. Days outside [min, max] are greyed out and
   * unselectable in the calendar grid; the exact hour/minute bound on the boundary day itself
   * isn't enforced here — the caller's own submit-time validation catches that. */
  min?: string;
  max?: string;
  style?: React.CSSProperties;
}) {
  const { timeFormat } = useTimeFormat();
  const twelveHour = usesTwelveHour(timeFormat);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const PANEL_WIDTH = 232;
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const [datePart, timePart] = value ? (value.split("T") as [string, string]) : ["", ""];

  const today = new Date();
  const todayDatePart = `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}-${pad(today.getUTCDate())}`;

  const [viewedYear, setViewedYear] = useState(() => (datePart ? Number(datePart.slice(0, 4)) : today.getUTCFullYear()));
  const [viewedMonth, setViewedMonth] = useState(() => (datePart ? Number(datePart.slice(5, 7)) - 1 : today.getUTCMonth()));
  const [hourInput, setHourInput] = useState("");
  const [minuteInput, setMinuteInput] = useState("");
  // Only meaningful when twelveHour is true — the stored value is always 24h internally
  // regardless of display format, same "HH:mm" shape <input type="datetime-local"> used.
  const [period, setPeriod] = useState<"AM" | "PM">("AM");

  // Refresh the calendar's viewed month and the time buffer from the current value (and current
  // format) every time the popover opens — not continuously, so it doesn't fight the user
  // mid-edit or a format switch made elsewhere (Settings) while this was closed.
  useEffect(() => {
    if (!open) return;
    const d = datePart ? new Date(`${datePart}T00:00:00Z`) : today;
    setViewedYear(d.getUTCFullYear());
    setViewedMonth(d.getUTCMonth());
    const [h, m] = timePart ? timePart.split(":") : ["", ""];
    if (h !== "" && twelveHour) {
      const { hour12, period: p } = to12Hour(Number(h));
      setHourInput(String(hour12));
      setPeriod(p);
    } else {
      setHourInput(h ?? "");
    }
    setMinuteInput(m ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The panel is portaled to document.body (see the render below) rather than living inside this
  // component's own DOM subtree, so it has to be positioned manually from the trigger's actual
  // screen position instead of relying on `position: absolute` + a `relative` ancestor. Recomputed
  // on scroll/resize too, so it stays pinned under the trigger instead of drifting off if the
  // surrounding modal scrolls while open. Clamped so it can't run off the right edge of the
  // viewport on a narrow screen.
  useEffect(() => {
    if (!open) return;
    function updatePosition() {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({
        top: rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8),
      });
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  // Portaling out of this component's own subtree means containerRef.contains(...) alone no
  // longer covers clicks inside the panel (it's a child of document.body now, not of the
  // `.relative` wrapper below) — a click inside the calendar/time inputs would otherwise register
  // as "outside" and close the panel instantly. Checking both refs fixes that.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function pad(n: number) {
    return String(n).padStart(2, "0");
  }

  function dayDatePart(day: number) {
    return `${viewedYear}-${pad(viewedMonth + 1)}-${pad(day)}`;
  }

  const minDatePart = min?.split("T")[0];
  const maxDatePart = max?.split("T")[0];

  function isDisabled(day: number) {
    const d = dayDatePart(day);
    if (minDatePart && d < minDatePart) return true;
    if (maxDatePart && d > maxDatePart) return true;
    return false;
  }

  function selectDay(day: number) {
    onChange(`${dayDatePart(day)}T${timePart || "00:00"}`);
  }

  // Commits whatever's currently in the hour/minute/period buffer, clamped and zero-padded into
  // 24h storage — but that padding/conversion only affects what's sent upstream, never what's
  // shown in the input the user is actively typing into (bound to hourInput/minuteInput instead),
  // so a mid-keystroke "9" doesn't get stomped back to "09" before the second digit lands.
  function commitTime(h: string, m: string, p: "AM" | "PM" = period) {
    if (h === "" && m === "") return;
    const hour24 = twelveHour
      ? to24Hour(Math.min(12, Math.max(1, Number(h || "12"))), p)
      : Math.min(23, Math.max(0, Number(h || "0")));
    const mm = pad(Math.min(59, Math.max(0, Number(m || "0"))));
    onChange(`${datePart || todayDatePart}T${pad(hour24)}:${mm}`);
  }

  function digitsOnly(raw: string, maxLen: number) {
    return raw.replace(/\D/g, "").slice(0, maxLen);
  }

  // Enter inside a form submits it by default — fine for the outer "Add Trade" button, not for a
  // digit still being typed into the time buffer.
  function preventEnterSubmit(e: React.KeyboardEvent) {
    if (e.key === "Enter") e.preventDefault();
  }

  const monthName = new Date(Date.UTC(viewedYear, viewedMonth, 1)).toLocaleString("default", { month: "long", timeZone: "UTC" });
  const firstDay = new Date(Date.UTC(viewedYear, viewedMonth, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(viewedYear, viewedMonth + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const displayValue = datePart ? formatDateTime(`${datePart}T${timePart || "00:00"}`, timeFormat) : "";
  const placeholder = DATE_TIME_FORMAT_OPTIONS.find((o) => o.value === timeFormat)?.pattern ?? "";

  const timeInputStyle: React.CSSProperties = {
    backgroundColor: "var(--color-bg-base)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text-primary)",
    borderRadius: 6,
    fontSize: 11,
    textAlign: "center",
    width: 30,
    padding: "3px 0",
    outline: "none",
  };

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center justify-between w-full text-left" style={style}>
        <span style={{ color: displayValue ? undefined : "var(--color-text-disabled)" }}>
          {displayValue || placeholder}
        </span>
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>

      {open && coords && createPortal(
        <div
          ref={panelRef}
          className="fixed z-50 rounded-lg p-3 flex flex-col gap-2"
          style={{
            top: coords.top,
            left: coords.left,
            backgroundColor: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            width: PANEL_WIDTH,
          }}
        >
          {/* Month header */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewedMonth((m) => { if (m === 0) { setViewedYear((y) => y - 1); return 11; } return m - 1; })}
              className="p-0.5 rounded hover:opacity-70"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>{monthName} {viewedYear}</span>
            <button
              type="button"
              onClick={() => setViewedMonth((m) => { if (m === 11) { setViewedYear((y) => y + 1); return 0; } return m + 1; })}
              className="p-0.5 rounded hover:opacity-70"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="text-center text-[9px] font-medium" style={{ color: "var(--color-text-muted)" }}>{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={`b-${i}`} />;
              const disabled = isDisabled(day);
              const selected = datePart === dayDatePart(day);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectDay(day)}
                  className="text-[10px] rounded py-1 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: selected ? "var(--color-green-primary)" : "transparent",
                    color: disabled ? "var(--color-text-disabled)" : selected ? "var(--color-on-primary)" : "var(--color-text-secondary)",
                    opacity: disabled ? 0.5 : 1,
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Time */}
          <div className="flex items-center gap-1.5 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
            <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Time</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder={twelveHour ? "H" : "HH"}
              value={hourInput}
              onKeyDown={preventEnterSubmit}
              onChange={(e) => { const v = digitsOnly(e.target.value, 2); setHourInput(v); commitTime(v, minuteInput); }}
              style={timeInputStyle}
            />
            <span style={{ color: "var(--color-text-muted)" }}>:</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="MM"
              value={minuteInput}
              onKeyDown={preventEnterSubmit}
              onChange={(e) => { const v = digitsOnly(e.target.value, 2); setMinuteInput(v); commitTime(hourInput, v); }}
              style={timeInputStyle}
            />
            {twelveHour && (
              <button
                type="button"
                onClick={() => { const next = period === "AM" ? "PM" : "AM"; setPeriod(next); commitTime(hourInput, minuteInput, next); }}
                className="text-[10px] font-semibold rounded px-1.5 py-1"
                style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
              >
                {period}
              </button>
            )}
            <span className="text-[9px]" style={{ color: "var(--color-text-muted)" }}>UTC</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto text-[10px] font-semibold px-2 py-1 rounded hover:opacity-70"
              style={{ color: "var(--color-green-primary)" }}
            >
              Done
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
