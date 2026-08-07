import { describe, expect, it } from "vitest";
import { computePnl } from "../../routes/trades";

describe("computePnl", () => {
  it("computes a long profit as (exit - entry) * lot * contractSize", () => {
    // EUR/USD: 1 lot = 100,000 units. (1.1050 - 1.1000) * 1 * 100000 = 500
    expect(computePnl("long", 1.1, 1.105, 1, "EUR/USD")).toBeCloseTo(500);
  });

  it("computes a long loss when price moved against the position", () => {
    expect(computePnl("long", 1.1, 1.095, 1, "EUR/USD")).toBeCloseTo(-500);
  });

  it("computes a short profit as (entry - exit) * lot * contractSize", () => {
    expect(computePnl("short", 1.1, 1.095, 1, "EUR/USD")).toBeCloseTo(500);
  });

  it("computes a short loss when price moved against the position", () => {
    expect(computePnl("short", 1.1, 1.105, 1, "EUR/USD")).toBeCloseTo(-500);
  });

  it("scales with lot size", () => {
    expect(computePnl("long", 1.1, 1.105, 2.5, "EUR/USD")).toBeCloseTo(1250);
  });

  it("uses the symbol's contract size (gold = 100 oz/lot)", () => {
    expect(computePnl("long", 2000, 2010, 1, "XAU/USD")).toBeCloseTo(1000);
  });

  it("defaults non-forex/non-metal symbols to a 1:1 contract size", () => {
    expect(computePnl("long", 150, 155, 10, "AAPL")).toBeCloseTo(50);
  });

  it("folds swap and commission into the result (both signed, negative = cost)", () => {
    // Base pnl 500, then -2 swap and -1.5 commission.
    expect(computePnl("long", 1.1, 1.105, 1, "EUR/USD", -2, -1.5)).toBeCloseTo(496.5);
  });

  it("treats a positive swap as a credit", () => {
    expect(computePnl("long", 1.1, 1.105, 1, "EUR/USD", 3, 0)).toBeCloseTo(503);
  });

  it("defaults swap and commission to 0 when omitted", () => {
    expect(computePnl("long", 1.1, 1.105, 1, "EUR/USD")).toBeCloseTo(500);
  });
});
