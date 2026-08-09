// Trades are only ever entered/stored to the minute (packages/db schema, TradeForm's
// DateTimePicker) with a 4-digit year, so these presets stop at minutes — seconds would always
// read ":00" and would just be noise here.
export type DateTimeFormat = "us-24h" | "us-12h" | "intl-24h" | "intl-12h" | "iso8601";

export const TIME_FORMAT_STORAGE_KEY = "pipntick_date_time_format";

const DEFAULT_FORMAT: DateTimeFormat = "us-24h";

// label: shown in the Settings dropdown. pattern: the literal token string, used both as a second
// line under the label there and as the DateTimePicker's empty-state placeholder. Padding is tied
// to hour style rather than an independent choice — 24h reads fully zero-padded (the near-universal
// "military time" convention), 12h reads with an unpadded hour (the near-universal casual
// convention, "1:48 PM" not "01:48 PM") and an unpadded date to match.
export const DATE_TIME_FORMAT_OPTIONS: { value: DateTimeFormat; label: string; pattern: string }[] = [
  { value: "us-24h", label: "US, 24-hour", pattern: "MM/dd/yyyy HH:mm" },
  { value: "us-12h", label: "US, 12-hour", pattern: "M/d/yyyy h:mm a" },
  { value: "intl-24h", label: "International, 24-hour", pattern: "dd/MM/yyyy HH:mm" },
  { value: "intl-12h", label: "International, 12-hour", pattern: "d/M/yyyy h:mm a" },
  { value: "iso8601", label: "ISO 8601 (unambiguous)", pattern: "yyyy-MM-dd HH:mm" },
];

/**
 * Given whatever was in localStorage (if anything), decide which format to use. An explicit
 * stored choice wins; otherwise default to "us-24h" — matches the "(UTC)" 24h labeling already
 * used on the trade entry forms. Pure function so it's unit-testable, same pattern as
 * resolveInitialTheme in theme.ts.
 */
export function resolveInitialTimeFormat(stored: string | null): DateTimeFormat {
  return stored !== null && DATE_TIME_FORMAT_OPTIONS.some((o) => o.value === stored) ? (stored as DateTimeFormat) : DEFAULT_FORMAT;
}

/** Splits a 0-23 hour into 12h parts for display/editing. */
export function to12Hour(hour24: number): { hour12: number; period: "AM" | "PM" } {
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, period };
}

/** Inverse of to12Hour — folds a 1-12 hour + AM/PM back into 0-23 for storage. */
export function to24Hour(hour12: number, period: "AM" | "PM"): number {
  const h = hour12 % 12;
  return period === "PM" ? h + 12 : h;
}

/** Whether a given format displays a 12-hour clock (with AM/PM) rather than 24-hour. */
export function usesTwelveHour(format: DateTimeFormat): boolean {
  return format === "us-12h" || format === "intl-12h";
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function formatDatePart(y: number, mo: number, d: number, format: DateTimeFormat): string {
  switch (format) {
    case "us-24h":
    case "us-12h":
      return `${format === "us-24h" ? pad2(mo) : mo}/${format === "us-24h" ? pad2(d) : d}/${y}`;
    case "intl-24h":
    case "intl-12h":
      return `${format === "intl-24h" ? pad2(d) : d}/${format === "intl-24h" ? pad2(mo) : mo}/${y}`;
    case "iso8601":
      return `${y}-${pad2(mo)}-${pad2(d)}`;
  }
}

/** Formats a stored "YYYY-MM-DD" (date only, no time-of-day) per the user's chosen format's date
 * order/padding — e.g. "2026-08-09" -> "08/09/2026" (us-24h) or "9/8/2026" (intl-12h) — ignoring
 * its hour style entirely since there's no time component here. Used for read-only date-only
 * displays (Journal table, delete-trade confirmations, account settings) — never for editable
 * native `<input type="date">` values, which must stay real ISO regardless of display preference. */
export function formatDate(value: string, format: DateTimeFormat): string {
  if (!value) return "";
  const [y, mo, d] = value.split("-").map(Number);
  return formatDatePart(y, mo, d, format);
}

/** Formats a stored "YYYY-MM-DDTHH:mm" (always 24h, always zero-padded internally) per the user's
 * chosen display format, e.g. "2026-08-09T13:48" -> "08/09/2026 13:48" (us-24h),
 * "8/9/2026 1:48 PM" (us-12h), or "2026-08-09 13:48" (iso8601). */
export function formatDateTime(value: string, format: DateTimeFormat): string {
  if (!value) return "";
  const [datePart, timePart] = value.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = (timePart ?? "00:00").split(":").map(Number);
  const mm2 = pad2(mi);
  const datePiece = formatDatePart(y, mo, d, format);

  switch (format) {
    case "us-24h":
    case "intl-24h":
      return `${datePiece} ${pad2(h)}:${mm2}`;
    case "iso8601":
      return `${datePiece} ${pad2(h)}:${mm2}`;
    case "us-12h":
    case "intl-12h": {
      const { hour12, period } = to12Hour(h);
      return `${datePiece} ${hour12}:${mm2} ${period}`;
    }
  }
}
