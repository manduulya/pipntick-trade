import { describe, expect, it } from "vitest";
import { findInstrument, matchInstruments } from "../../lib/instruments";

// Only the curated list is exercised here — the stock directory is fetched lazily in the browser.

describe("findInstrument", () => {
  it("resolves listed symbols of the account's class case-insensitively to their canonical form", () => {
    expect(findInstrument("mgc", "futures")).toEqual({ symbol: "MGC", name: "Micro Gold · Futures" });
    expect(findInstrument(" EUR/USD ", "forex")?.symbol).toBe("EUR/USD");
    expect(findInstrument("btc/usd", "crypto")?.symbol).toBe("BTC/USD");
  });

  it("maps a bare 6-letter pair to its slashed entry", () => {
    expect(findInstrument("eurusd", "forex")?.symbol).toBe("EUR/USD");
  });

  it("rejects symbols from another asset class", () => {
    expect(findInstrument("EUR/USD", "futures")).toBeNull();
    expect(findInstrument("MES", "forex")).toBeNull();
    expect(findInstrument("BTC/USD", "forex")).toBeNull();
    // Stocks come only from the (not loaded here) exchange directory.
    expect(findInstrument("MES", "stocks")).toBeNull();
  });

  it("rejects unlisted or partial symbols", () => {
    expect(findInstrument("MG", "futures")).toBeNull();
    expect(findInstrument("NOTREAL", "forex")).toBeNull();
    expect(findInstrument("", "futures")).toBeNull();
  });
});

describe("matchInstruments", () => {
  it("puts an exact symbol match ahead of longer prefix matches", () => {
    expect(matchInstruments("mes", "futures")[0].symbol).toBe("MES");
    expect(matchInstruments("mgc", "futures")[0].symbol).toBe("MGC");
  });

  it("only suggests the account's class", () => {
    expect(matchInstruments("gold", "futures").map((i) => i.symbol)).toEqual(["GC", "MGC"]);
    expect(matchInstruments("gold", "forex").map((i) => i.symbol)).toEqual(["XAU/USD"]);
  });
});
