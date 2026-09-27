import { describe, expect, it } from "vitest";
import { findInstrument, matchInstruments } from "../../lib/instruments";

// Only the curated list is exercised here — the stock directory is fetched lazily in the browser.

describe("findInstrument", () => {
  it("resolves listed symbols case-insensitively to their canonical form", () => {
    expect(findInstrument("mgc")).toEqual({ symbol: "MGC", name: "Micro Gold · Futures" });
    expect(findInstrument(" EUR/USD ")?.symbol).toBe("EUR/USD");
  });

  it("maps a bare 6-letter pair to its slashed entry", () => {
    expect(findInstrument("eurusd")?.symbol).toBe("EUR/USD");
  });

  it("rejects unlisted or partial symbols", () => {
    expect(findInstrument("MG")).toBeNull();
    expect(findInstrument("NOTREAL")).toBeNull();
    expect(findInstrument("")).toBeNull();
  });
});

describe("matchInstruments", () => {
  it("puts an exact symbol match ahead of longer prefix matches", () => {
    expect(matchInstruments("mes")[0].symbol).toBe("MES");
    expect(matchInstruments("mgc")[0].symbol).toBe("MGC");
  });
});
