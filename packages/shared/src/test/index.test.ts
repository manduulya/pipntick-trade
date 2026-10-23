import { describe, expect, it } from "vitest";
import {
  classChangeMisfits,
  commissionAsCost,
  getContractSize,
  getFuturesContract,
  inferAssetClass,
  isAssetClass,
  isReadOnlyAccount,
  isRuleMet,
  plannedRewardRisk,
  symbolFitsClass,
} from "../index";

describe("plannedRewardRisk", () => {
  it("is target distance over stop distance for a long or short", () => {
    expect(plannedRewardRisk(4210, 4200, 4234)).toBeCloseTo(2.4); // long
    expect(plannedRewardRisk(4210, 4220, 4180)).toBeCloseTo(3); // short
  });

  it("is null when a level is missing or both sit on the same side", () => {
    expect(plannedRewardRisk(4210, null, 4234)).toBeNull();
    expect(plannedRewardRisk(4210, 4200, undefined)).toBeNull();
    expect(plannedRewardRisk(4210, 4215, 4234)).toBeNull(); // stop above a long's entry (breakeven/trail)
    expect(plannedRewardRisk(4210, 4210, 4234)).toBeNull(); // zero risk
  });
});

describe("commissionAsCost", () => {
  it("is always a negative cost, whatever sign was typed", () => {
    expect(commissionAsCost(1.2)).toBe(-1.2);
    expect(commissionAsCost(-1.2)).toBe(-1.2);
    expect(commissionAsCost(0)).toBe(0);
  });
});

describe("isReadOnlyAccount", () => {
  it("is true only for archived accounts", () => {
    expect(isReadOnlyAccount({ status: "archived" })).toBe(true);
    expect(isReadOnlyAccount({ status: "inactive" })).toBe(false);
    expect(isReadOnlyAccount({ status: "active" })).toBe(false);
    expect(isReadOnlyAccount(null)).toBe(false);
  });
});

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

  it("lets the account's asset class settle ticker collisions", () => {
    expect(getContractSize("ES", "stocks")).toBe(1); // Eversource shares, not the $50 E-mini
    expect(getContractSize("ES", "futures")).toBe(50);
    expect(getContractSize("BTC/USD", "crypto")).toBe(1);
    expect(getContractSize("XAU/USD", "forex")).toBe(100);
    expect(getContractSize("EUR/USD", "forex")).toBe(100000);
  });
});

describe("asset classes", () => {
  it("fits futures roots, curated forex/CFDs and crypto, and plain stock tickers", () => {
    expect(symbolFitsClass("MES", "futures")).toBe(true);
    expect(symbolFitsClass("EUR/USD", "futures")).toBe(false);
    expect(symbolFitsClass("EUR/USD", "forex")).toBe(true);
    expect(symbolFitsClass("eurusd", "forex")).toBe(true);
    expect(symbolFitsClass("XAU/USD", "forex")).toBe(true);
    expect(symbolFitsClass("NAS100", "forex")).toBe(true);
    expect(symbolFitsClass("BTC/USD", "forex")).toBe(false);
    expect(symbolFitsClass("BTC/USD", "crypto")).toBe(true);
    expect(symbolFitsClass("AAPL", "stocks")).toBe(true);
    expect(symbolFitsClass("BRK.B", "stocks")).toBe(true);
    expect(symbolFitsClass("ES", "stocks")).toBe(true); // collision: a valid stock in a stocks account
    expect(symbolFitsClass("US30", "stocks")).toBe(false); // a curated CFD
    expect(symbolFitsClass("EUR/USD", "stocks")).toBe(false);
    expect(symbolFitsClass("", "stocks")).toBe(false);
  });

  it("guesses a legacy symbol's class with futures winning collisions", () => {
    expect(inferAssetClass("ES")).toBe("futures");
    expect(inferAssetClass("XAU/USD")).toBe("forex");
    expect(inferAssetClass("SOL/USD")).toBe("crypto");
    expect(inferAssetClass("AAPL")).toBe("stocks");
  });

  it("blocks a class change for trades entered as the current class or not fitting the new one", () => {
    expect(classChangeMisfits(["MES", "MNQ", "MES"], "futures", "stocks")).toEqual(["MES", "MNQ"]); // contracts ≠ shares
    expect(classChangeMisfits(["EUR/USD"], "forex", "futures")).toEqual(["EUR/USD"]);
    expect(classChangeMisfits([], "forex", "crypto")).toEqual([]);
    // A legacy misfit that fits the new class carries over.
    expect(classChangeMisfits(["MES"], "forex", "futures")).toEqual([]);
    expect(classChangeMisfits(["MES"], "futures", "futures")).toEqual([]);
  });

  it("validates class names", () => {
    expect(isAssetClass("futures")).toBe(true);
    expect(isAssetClass("options")).toBe(false);
    expect(isAssetClass(undefined)).toBe(false);
  });
});
