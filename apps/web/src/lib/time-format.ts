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

/** A broker-server UTC offset in minutes -> a short label for the trade-form date fields.
 * 0 -> "UTC", 120 -> "UTC+2", -300 -> "UTC−5", 330 -> "UTC+5:30". */
export function formatUtcOffsetLabel(offsetMinutes: number): string {
  if (!offsetMinutes) return "UTC";
  const sign = offsetMinutes > 0 ? "+" : "−";
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${pad2(m)}` : ""}`;
}

/** Given a broker wall-clock "YYYY-MM-DDTHH:mm" (as typed into the trade form) and the account's
 * broker-server UTC offset in minutes, return the real UTC instant it refers to. e.g. "15:21" at
 * offset 120 (UTC+2) -> 13:21 UTC. Used for the "not in the future" / account-start checks and
 * the session lookup, all of which reason in real/UTC time; storage and display keep the raw
 * broker wall-clock digits (see lib/trade-utils.ts). */
export function brokerWallClockToUtc(value: string, offsetMinutes: number): Date {
  return new Date(new Date(`${value}:00Z`).getTime() - offsetMinutes * 60_000);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// ─── IANA timezones (daylight-saving aware) ───────────────────────────────
// Accounts can carry an IANA zone (`brokerTimezone`, e.g. "America/New_York"). Unlike the legacy
// fixed offset it follows daylight saving, so a September New York trade reads as UTC−4 and a
// December one as UTC−5. Pure Intl, no date library.

/** The zone's UTC offset in minutes at a given instant, e.g. America/New_York in July -> -240. */
export function timeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/**
 * A wall-clock "YYYY-MM-DDTHH:mm" in an IANA zone -> the real instant. Two passes so times near a
 * daylight-saving switch use the offset in force at the result. An ambiguous fall-back time
 * resolves to its first occurrence; a non-existent spring-forward time shifts by the gap.
 */
export function zonedWallClockToUtc(value: string, timeZone: string): Date {
  const wall = new Date(`${value}:00Z`).getTime();
  const first = timeZoneOffsetMinutes(new Date(wall), timeZone);
  let instant = wall - first * 60_000;
  const second = timeZoneOffsetMinutes(new Date(instant), timeZone);
  if (second !== first) instant = wall - second * 60_000;
  return new Date(instant);
}

/** The account fields that decide how its trade wall-clock times map to real time. */
export type AccountClock = { brokerTimezone?: string | null; brokerUtcOffsetMinutes?: number | null } | null | undefined;

/** Broker wall-clock -> real instant for an account: its IANA zone if set, else the legacy fixed
 * offset (0/unset = plain UTC). Use this, not brokerWallClockToUtc, for anything account-aware. */
export function accountWallClockToUtc(value: string, account: AccountClock): Date {
  return account?.brokerTimezone
    ? zonedWallClockToUtc(value, account.brokerTimezone)
    : brokerWallClockToUtc(value, account?.brokerUtcOffsetMinutes ?? 0);
}

/** Inverse: a real instant -> the account's broker wall-clock "YYYY-MM-DDTHH:mm". */
export function utcToAccountWallClock(instant: Date, account: AccountClock): string {
  const offset = account?.brokerTimezone
    ? timeZoneOffsetMinutes(instant, account.brokerTimezone)
    : account?.brokerUtcOffsetMinutes ?? 0;
  const shifted = new Date(instant.getTime() + offset * 60_000);
  return Number.isNaN(shifted.getTime()) ? "" : shifted.toISOString().slice(0, 16);
}

/** "America/New_York" -> "New York". */
export function timeZoneCity(timeZone: string): string {
  return (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
}

/** Label for the trade form's date fields, e.g. "New York, UTC−4" — the offset in force at
 * `atValue` (a wall-clock being entered) or now — or the legacy "UTC−5" for fixed-offset accounts. */
export function accountZoneLabel(account: AccountClock, atValue?: string): string {
  if (!account?.brokerTimezone) return formatUtcOffsetLabel(account?.brokerUtcOffsetMinutes ?? 0);
  const at = atValue ? zonedWallClockToUtc(atValue, account.brokerTimezone) : new Date();
  const instant = Number.isNaN(at.getTime()) ? new Date() : at;
  return `${timeZoneCity(account.brokerTimezone)}, ${formatUtcOffsetLabel(timeZoneOffsetMinutes(instant, account.brokerTimezone))}`;
}

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
