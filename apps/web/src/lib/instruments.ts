import { useEffect, useState } from "react";
import { CURATED_INSTRUMENTS as SHARED_CURATED, FUTURES_CONTRACTS, type AssetClass, type Instrument } from "@pipntick/shared";

export type { Instrument };

type IndexedInstrument = Instrument & { assetClass: AssetClass; _symbolL: string; _nameL: string };

function index(inst: Instrument & { assetClass: AssetClass }): IndexedInstrument {
  return { ...inst, _symbolL: inst.symbol.toLowerCase(), _nameL: inst.name.toLowerCase() };
}

// Hand-curated forex/metals/index CFDs and crypto (from @pipntick/shared, so the server validates
// against the same list), plus futures roots — names come from the shared spec so the list and
// P&L sizing can't drift.
export const CURATED_INSTRUMENTS: (Instrument & { assetClass: AssetClass })[] = [
  ...SHARED_CURATED,
  ...Object.entries(FUTURES_CONTRACTS).map(([symbol, f]) => ({ symbol, name: `${f.name} · Futures`, assetClass: "futures" as const })),
];

const curatedIndexed: IndexedInstrument[] = CURATED_INSTRUMENTS.map(index);

// ~11k US-listed stocks/ETFs from NASDAQ + NYSE/other exchange symbol directories,
// served as a static public file and fetched lazily so it never bloats the JS bundle.
// Only stocks accounts need it.
let stockIndexed: IndexedInstrument[] | null = null;
let stockPromise: Promise<IndexedInstrument[]> | null = null;

export function loadStockInstruments(): Promise<Instrument[]> {
  if (stockIndexed) return Promise.resolve(stockIndexed);
  if (!stockPromise) {
    stockPromise = fetch("/instruments-stocks.json")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Instrument[]) => {
        stockIndexed = data.map((i) => index({ ...i, assetClass: "stocks" }));
        return stockIndexed;
      })
      .catch(() => {
        stockIndexed = [];
        return stockIndexed;
      });
  }
  return stockPromise;
}

export function stockInstrumentsLoaded(): boolean {
  return stockIndexed !== null;
}

/** The instruments an account of this class can trade (stocks only once loaded). */
function poolFor(assetClass: AssetClass): IndexedInstrument[] {
  if (assetClass === "stocks") return stockIndexed ?? [];
  return curatedIndexed.filter((i) => i.assetClass === assetClass);
}

/** Whether instruments of this class are ready to search (stocks wait for the lazy list). */
export function instrumentsReady(assetClass: AssetClass): boolean {
  return assetClass !== "stocks" || stockInstrumentsLoaded();
}

/** Loads whatever this class needs before findInstrument can answer (only stocks need a fetch). */
export async function ensureInstruments(assetClass: AssetClass): Promise<void> {
  if (assetClass === "stocks") await loadStockInstruments();
}

/**
 * The listed instrument of the account's class a typed symbol refers to (case-insensitive exact
 * match), or null if it isn't in that class's list. A bare 6-letter pair like "EURUSD" also
 * resolves to its slashed "EUR/USD" entry. Stocks only resolve once loadStockInstruments() has
 * finished.
 */
export function findInstrument(symbol: string, assetClass: AssetClass): Instrument | null {
  const s = symbol.trim().toLowerCase();
  if (!s) return null;
  const candidates = /^[a-z]{6}$/.test(s) ? [s, `${s.slice(0, 3)}/${s.slice(3)}`] : [s];
  const pool = poolFor(assetClass);
  for (const c of candidates) {
    const hit = pool.find((inst) => inst._symbolL === c);
    if (hit) return { symbol: hit.symbol, name: hit.name };
  }
  return null;
}

/** Re-renders the caller once the instruments for this class are available (stocks are fetched
 * lazily), so findInstrument can resolve them. */
export function useInstrumentsReady(assetClass: AssetClass): boolean {
  const [loaded, setLoaded] = useState(() => instrumentsReady(assetClass));
  useEffect(() => {
    if (instrumentsReady(assetClass)) setLoaded(true);
    else ensureInstruments(assetClass).then(() => setLoaded(true));
  }, [assetClass]);
  return loaded;
}

export function matchInstruments(query: string, assetClass: AssetClass, limit = 5): Instrument[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const pool = poolFor(assetClass);
  // Exact symbol hits first (typing "MES" must surface MES before MESH), then prefix, then
  // substring/name matches.
  const exact: Instrument[] = [];
  const starts: Instrument[] = [];
  const contains: Instrument[] = [];

  for (const inst of pool) {
    if (inst._symbolL === q) {
      exact.push(inst);
    } else if (inst._symbolL.startsWith(q)) {
      starts.push(inst);
    } else if (inst._symbolL.includes(q) || inst._nameL.includes(q)) {
      contains.push(inst);
    }
  }

  return [...exact, ...starts, ...contains].slice(0, limit);
}
