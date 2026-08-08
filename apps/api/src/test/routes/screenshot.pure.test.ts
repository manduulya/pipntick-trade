import { describe, expect, it } from "vitest";
import { parseTradeCardText } from "../../routes/screenshot";

describe("parseTradeCardText", () => {
  it("parses a mobile card layout (entry->exit adjacent, single date pair)", () => {
    const text = `
      EURUSD+ buy 0.50
      1.10234 → 1.10534
      +150.00
      2026.03.15 10:00:00 → 2026.03.15 12:30:00
    `;
    const result = parseTradeCardText(text);
    expect(result.symbol).toBe("EUR/USD");
    expect(result.direction).toBe("long");
    expect(result.lotSize).toBe(0.5);
    expect(result.entryPrice).toBeCloseTo(1.10234);
    expect(result.exitPrice).toBeCloseTo(1.10534);
    expect(result.pnl).toBeCloseTo(150.0);
    expect(result.entryDateTime).toBe("2026-03-15T10:00:00");
    expect(result.exitDateTime).toBe("2026-03-15T12:30:00");
  });

  it("parses a sell/short card and tolerates a dash instead of an arrow", () => {
    const text = `GBPUSD sell 1.00\n1.25000 - 1.24500\n-500.00`;
    const result = parseTradeCardText(text);
    expect(result.direction).toBe("short");
    expect(result.exitPrice).toBeCloseTo(1.245);
    expect(result.pnl).toBeCloseTo(-500.0);
  });

  it("parses a desktop history-table row with a ticket number and separate columns", () => {
    const text = `
      EURUSD 123456789 buy 1.00
      1.10000
      2026.03.10 09:00:00 2026.03.10 15:00:00 1.10500 250.00
    `;
    const result = parseTradeCardText(text);
    expect(result.symbol).toBe("EUR/USD");
    expect(result.direction).toBe("long");
    expect(result.entryPrice).toBeCloseTo(1.1);
    expect(result.entryDateTime).toBe("2026-03-10T09:00:00");
    expect(result.exitDateTime).toBe("2026-03-10T15:00:00");
    expect(result.exitPrice).toBeCloseTo(1.105);
    expect(result.pnl).toBeCloseTo(250.0);
  });

  it("parses labeled swap and charges regardless of layout", () => {
    const text = `EURUSD buy 1.00\n1.10000 → 1.10500\n50.00\nSwap: -1.20\nCharges: -3.50`;
    const result = parseTradeCardText(text);
    expect(result.swap).toBeCloseTo(-1.2);
    expect(result.commission).toBeCloseTo(-3.5);
  });

  it("leaves everything null for unrecognized text rather than guessing", () => {
    const result = parseTradeCardText("this is not a trade card at all");
    expect(result.symbol).toBeNull();
    expect(result.direction).toBeNull();
    expect(result.entryPrice).toBeNull();
    expect(result.exitPrice).toBeNull();
    expect(result.entryDateTime).toBeNull();
    expect(result.exitDateTime).toBeNull();
    expect(result.pnl).toBeNull();
  });

  it("leaves exitDateTime null for a still-open card (price pair shown as live price, single timestamp)", () => {
    const text = `EURUSD buy 1.00\n1.10000 → 1.10800\n+80.00\n2026.03.15 10:00:00`;
    const result = parseTradeCardText(text);
    expect(result.entryDateTime).toBe("2026-03-15T10:00:00");
    expect(result.exitDateTime).toBeNull();
  });

  it("does not misread a symbol's ticket number as the entry price", () => {
    // Ticket numbers are integers (no decimal point) and must be skipped.
    const text = `EURUSD 99887766 buy 1.00\n1.12345`;
    const result = parseTradeCardText(text);
    expect(result.entryPrice).toBeCloseTo(1.12345);
  });
});
