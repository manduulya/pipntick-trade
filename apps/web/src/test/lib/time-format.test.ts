import { describe, expect, it } from "vitest";
import {
  accountWallClockToUtc,
  accountZoneLabel,
  brokerWallClockToUtc,
  timeZoneOffsetMinutes,
  utcToAccountWallClock,
  zonedWallClockToUtc,
  formatDate,
  formatDateTime,
  formatUtcOffsetLabel,
  resolveInitialTimeFormat,
  to12Hour,
  to24Hour,
  usesTwelveHour,
} from "../../lib/time-format";

describe("IANA timezones (daylight saving)", () => {
  it("knows New York's summer and winter offsets", () => {
    expect(timeZoneOffsetMinutes(new Date("2026-09-28T15:00:00Z"), "America/New_York")).toBe(-240);
    expect(timeZoneOffsetMinutes(new Date("2026-12-10T15:00:00Z"), "America/New_York")).toBe(-300);
  });

  it("converts a New York wall-clock to UTC in both seasons", () => {
    // The MES exit that the fixed UTC−5 offset wrongly flagged as "in the future".
    expect(zonedWallClockToUtc("2026-09-28T10:38", "America/New_York").toISOString()).toBe("2026-09-28T14:38:00.000Z");
    expect(zonedWallClockToUtc("2026-12-10T10:38", "America/New_York").toISOString()).toBe("2026-12-10T15:38:00.000Z");
  });

  it("handles the daylight-saving edges", () => {
    // Fall back (Nov 1 2026, 01:30 happens twice) -> first occurrence, still EDT.
    expect(zonedWallClockToUtc("2026-11-01T01:30", "America/New_York").toISOString()).toBe("2026-11-01T05:30:00.000Z");
    // Spring forward (Mar 8 2026, 02:30 doesn't exist) -> lands on a real instant in the gap's neighborhood.
    const gap = zonedWallClockToUtc("2026-03-08T02:30", "America/New_York").toISOString();
    expect(["2026-03-08T06:30:00.000Z", "2026-03-08T07:30:00.000Z"]).toContain(gap);
    expect(zonedWallClockToUtc("2026-07-01T12:00", "UTC").toISOString()).toBe("2026-07-01T12:00:00.000Z");
  });

  it("uses the account's timezone, falling back to the legacy fixed offset", () => {
    expect(accountWallClockToUtc("2026-09-28T10:38", { brokerTimezone: "America/New_York", brokerUtcOffsetMinutes: -300 }).toISOString())
      .toBe("2026-09-28T14:38:00.000Z");
    expect(accountWallClockToUtc("2026-09-28T10:38", { brokerTimezone: null, brokerUtcOffsetMinutes: -300 }).toISOString())
      .toBe("2026-09-28T15:38:00.000Z");
    expect(accountWallClockToUtc("2026-09-28T10:38", null).toISOString()).toBe("2026-09-28T10:38:00.000Z");
  });

  it("round-trips an instant back to the account's wall clock", () => {
    const ny = { brokerTimezone: "America/New_York" };
    expect(utcToAccountWallClock(new Date("2026-09-28T14:38:00Z"), ny)).toBe("2026-09-28T10:38");
    expect(utcToAccountWallClock(new Date("2026-09-28T14:38:00Z"), { brokerUtcOffsetMinutes: 120 })).toBe("2026-09-28T16:38");
  });

  it("labels the form fields with the offset for the date being entered", () => {
    const ny = { brokerTimezone: "America/New_York" };
    expect(accountZoneLabel(ny, "2026-09-28T10:38")).toBe("New York, UTC−4");
    expect(accountZoneLabel(ny, "2026-12-10T10:38")).toBe("New York, UTC−5");
    expect(accountZoneLabel({ brokerUtcOffsetMinutes: -300 })).toBe("UTC−5");
  });
});

describe("resolveInitialTimeFormat", () => {
  it("defaults to us-24h when nothing is stored", () => {
    expect(resolveInitialTimeFormat(null)).toBe("us-24h");
  });

  it("defaults when the stored value isn't a known preset", () => {
    expect(resolveInitialTimeFormat("garbage")).toBe("us-24h");
  });

  it("respects a valid stored preset", () => {
    expect(resolveInitialTimeFormat("intl-12h")).toBe("intl-12h");
  });
});

describe("to12Hour / to24Hour", () => {
  it("converts midnight to 12 AM", () => {
    expect(to12Hour(0)).toEqual({ hour12: 12, period: "AM" });
  });

  it("converts noon to 12 PM", () => {
    expect(to12Hour(12)).toEqual({ hour12: 12, period: "PM" });
  });

  it("converts an afternoon hour to PM", () => {
    expect(to12Hour(14)).toEqual({ hour12: 2, period: "PM" });
  });

  it("round-trips through to24Hour", () => {
    for (let h = 0; h < 24; h++) {
      const { hour12, period } = to12Hour(h);
      expect(to24Hour(hour12, period)).toBe(h);
    }
  });
});

describe("usesTwelveHour", () => {
  it("is false for 24h presets", () => {
    expect(usesTwelveHour("us-24h")).toBe(false);
    expect(usesTwelveHour("intl-24h")).toBe(false);
    expect(usesTwelveHour("iso8601")).toBe(false);
  });

  it("is true for 12h presets", () => {
    expect(usesTwelveHour("us-12h")).toBe(true);
    expect(usesTwelveHour("intl-12h")).toBe(true);
  });
});

describe("formatDateTime", () => {
  const value = "2026-08-09T13:48";

  it("returns empty string for an empty value", () => {
    expect(formatDateTime("", "us-24h")).toBe("");
  });

  it("formats us-24h (padded, MDY order, zero-padded 24h)", () => {
    expect(formatDateTime(value, "us-24h")).toBe("08/09/2026 13:48");
  });

  it("formats us-12h (unpadded, MDY order, unpadded 12h)", () => {
    expect(formatDateTime(value, "us-12h")).toBe("8/9/2026 1:48 PM");
  });

  it("formats intl-24h (padded, DMY order, zero-padded 24h)", () => {
    expect(formatDateTime(value, "intl-24h")).toBe("09/08/2026 13:48");
  });

  it("formats intl-12h (unpadded, DMY order, unpadded 12h)", () => {
    expect(formatDateTime(value, "intl-12h")).toBe("9/8/2026 1:48 PM");
  });

  it("formats iso8601 (YMD order, hyphenated, zero-padded 24h)", () => {
    expect(formatDateTime(value, "iso8601")).toBe("2026-08-09 13:48");
  });

  it("shows 12 AM for midnight in a 12h preset", () => {
    expect(formatDateTime("2026-08-09T00:00", "intl-12h")).toBe("9/8/2026 12:00 AM");
  });

  it("zero-pads a single-digit hour in 24h presets", () => {
    expect(formatDateTime("2026-08-09T09:05", "us-24h")).toBe("08/09/2026 09:05");
  });
});

describe("formatDate", () => {
  const value = "2026-08-09";

  it("returns empty string for an empty value", () => {
    expect(formatDate("", "us-24h")).toBe("");
  });

  it("formats us-24h (padded, MDY order)", () => {
    expect(formatDate(value, "us-24h")).toBe("08/09/2026");
  });

  it("formats us-12h (unpadded, MDY order)", () => {
    expect(formatDate(value, "us-12h")).toBe("8/9/2026");
  });

  it("formats intl-24h (padded, DMY order)", () => {
    expect(formatDate(value, "intl-24h")).toBe("09/08/2026");
  });

  it("formats intl-12h (unpadded, DMY order)", () => {
    expect(formatDate(value, "intl-12h")).toBe("9/8/2026");
  });

  it("formats iso8601 (YMD order, hyphenated)", () => {
    expect(formatDate(value, "iso8601")).toBe("2026-08-09");
  });

  it("agrees with formatDateTime's date portion for the same preset", () => {
    for (const format of ["us-24h", "us-12h", "intl-24h", "intl-12h", "iso8601"] as const) {
      const dateOnly = formatDate(value, format);
      const dateTime = formatDateTime(`${value}T13:48`, format);
      expect(dateTime.startsWith(dateOnly)).toBe(true);
    }
  });
});

describe("formatUtcOffsetLabel", () => {
  it("returns plain UTC for a zero / unset offset", () => {
    expect(formatUtcOffsetLabel(0)).toBe("UTC");
  });

  it("formats whole-hour offsets", () => {
    expect(formatUtcOffsetLabel(120)).toBe("UTC+2");
    expect(formatUtcOffsetLabel(-300)).toBe("UTC−5");
  });

  it("formats half-hour offsets", () => {
    expect(formatUtcOffsetLabel(330)).toBe("UTC+5:30");
    expect(formatUtcOffsetLabel(-210)).toBe("UTC−3:30");
  });
});

describe("brokerWallClockToUtc", () => {
  it("subtracts the offset to get the real instant", () => {
    // 15:21 on a UTC+2 broker clock is 13:21 UTC
    expect(brokerWallClockToUtc("2026-09-02T15:21", 120).toISOString()).toBe("2026-09-02T13:21:00.000Z");
  });

  it("is the identity for a zero offset", () => {
    expect(brokerWallClockToUtc("2026-09-02T15:21", 0).toISOString()).toBe("2026-09-02T15:21:00.000Z");
  });

  it("handles a negative offset and day rollover", () => {
    // 01:30 on a UTC-5 broker clock is 06:30 UTC the same day
    expect(brokerWallClockToUtc("2026-09-02T01:30", -300).toISOString()).toBe("2026-09-02T06:30:00.000Z");
    // 23:30 on a UTC+2 clock rolls forward past midnight UTC
    expect(brokerWallClockToUtc("2026-09-02T23:30", 120).toISOString()).toBe("2026-09-02T21:30:00.000Z");
  });
});
