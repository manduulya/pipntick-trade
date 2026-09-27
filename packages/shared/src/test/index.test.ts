import { describe, expect, it } from "vitest";
import { getContractSize, getFuturesContract, isRuleMet } from "../index";

describe("futures", () => {
  it("uses the contract's dollar point value as its size", () => {
    expect(getContractSize("MES")).toBe(5);
    expect(getContractSize("mgc")).toBe(10);
    expect(getContractSize("ES")).toBe(50);
    expect(getContractSize("CL")).toBe(1000);
  });

  it("recognizes known roots only", () => {
    expect(getFuturesContract(" mnq ")).toEqual({ name: "Micro E-mini Nasdaq-100", pointValue: 2 });
    expect(getFuturesContract("AAPL")).toBeNull();
    expect(getFuturesContract("MESZ6")).toBeNull();
  });
});

describe("isRuleMet", () => {
  it("counts a check when ticked and a choice when answered", () => {
    expect(isRuleMet({ type: "check", done: true, value: null })).toBe(true);
    expect(isRuleMet({ type: "check", done: false, value: null })).toBe(false);
    expect(isRuleMet({ type: "choice", done: false, value: "Up" })).toBe(true);
    expect(isRuleMet({ type: "choice", done: true, value: null })).toBe(false);
  });
});

describe("getContractSize", () => {
  it("treats a slash-separated 3/3 letter pair as forex (1 lot = 100,000 units)", () => {
    expect(getContractSize("EUR/USD")).toBe(100000);
    expect(getContractSize("GBP/JPY")).toBe(100000);
  });

  it("normalizes case before matching", () => {
    expect(getContractSize("eur/usd")).toBe(100000);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(getContractSize("  EUR/USD  ")).toBe(100000);
  });

  it("uses the gold override (100 troy oz) for XAU/USD", () => {
    expect(getContractSize("XAU/USD")).toBe(100);
  });

  it("uses the silver override (5,000 troy oz) for XAG/USD", () => {
    expect(getContractSize("XAG/USD")).toBe(5000);
  });

  it("is case-insensitive for metal overrides too", () => {
    expect(getContractSize("xau/usd")).toBe(100);
  });

  it("defaults to 1 for symbols that aren't a recognized forex pair or metal", () => {
    expect(getContractSize("AAPL")).toBe(1);
    expect(getContractSize("BTCUSD")).toBe(1);
    expect(getContractSize("US30")).toBe(1);
  });

  it("does not treat a 6-letter symbol without a slash as forex", () => {
    // Only the explicit AAA/BBB shape counts — a bare "EURUSD" falls through to the default.
    expect(getContractSize("EURUSD")).toBe(1);
  });
});
