export type Instrument = {
  symbol: string;
  name: string;
};

type IndexedInstrument = Instrument & { _symbolL: string; _nameL: string };

function index(inst: Instrument): IndexedInstrument {
  return { ...inst, _symbolL: inst.symbol.toLowerCase(), _nameL: inst.name.toLowerCase() };
}

// Hand-curated: forex, metals, indices, crypto — not covered by exchange symbol directories.
export const CURATED_INSTRUMENTS: Instrument[] = [
  // Forex majors
  { symbol: "EUR/USD", name: "Euro / US Dollar" },
  { symbol: "GBP/USD", name: "British Pound / US Dollar" },
  { symbol: "USD/JPY", name: "US Dollar / Japanese Yen" },
  { symbol: "USD/CHF", name: "US Dollar / Swiss Franc" },
  { symbol: "USD/CAD", name: "US Dollar / Canadian Dollar" },
  { symbol: "AUD/USD", name: "Australian Dollar / US Dollar" },
  { symbol: "NZD/USD", name: "New Zealand Dollar / US Dollar" },
  // Forex crosses
  { symbol: "EUR/GBP", name: "Euro / British Pound" },
  { symbol: "EUR/JPY", name: "Euro / Japanese Yen" },
  { symbol: "GBP/JPY", name: "British Pound / Japanese Yen" },
  { symbol: "EUR/AUD", name: "Euro / Australian Dollar" },
  { symbol: "EUR/CHF", name: "Euro / Swiss Franc" },
  { symbol: "AUD/JPY", name: "Australian Dollar / Japanese Yen" },
  { symbol: "GBP/AUD", name: "British Pound / Australian Dollar" },
  { symbol: "CHF/JPY", name: "Swiss Franc / Japanese Yen" },
  { symbol: "NZD/JPY", name: "New Zealand Dollar / Japanese Yen" },
  { symbol: "CAD/JPY", name: "Canadian Dollar / Japanese Yen" },
  // Metals
  { symbol: "XAU/USD", name: "Gold / US Dollar" },
  { symbol: "XAG/USD", name: "Silver / US Dollar" },
  // Indices
  { symbol: "US30", name: "Dow Jones Industrial Average" },
  { symbol: "NAS100", name: "Nasdaq 100" },
  { symbol: "SPX500", name: "S&P 500" },
  { symbol: "GER40", name: "Germany 40" },
  { symbol: "UK100", name: "FTSE 100" },
  // Crypto
  { symbol: "BTC/USD", name: "Bitcoin / US Dollar" },
  { symbol: "ETH/USD", name: "Ethereum / US Dollar" },
  { symbol: "XRP/USD", name: "XRP / US Dollar" },
  { symbol: "SOL/USD", name: "Solana / US Dollar" },
];

const curatedIndexed: IndexedInstrument[] = CURATED_INSTRUMENTS.map(index);

// ~11k US-listed stocks/ETFs from NASDAQ + NYSE/other exchange symbol directories,
// served as a static public file and fetched lazily so it never bloats the JS bundle.
let stockIndexed: IndexedInstrument[] | null = null;
let stockPromise: Promise<IndexedInstrument[]> | null = null;

export function loadStockInstruments(): Promise<Instrument[]> {
  if (stockIndexed) return Promise.resolve(stockIndexed);
  if (!stockPromise) {
    stockPromise = fetch("/instruments-stocks.json")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Instrument[]) => {
        stockIndexed = data.map(index);
        return stockIndexed;
      })
      .catch(() => {
        stockIndexed = [];
        return stockIndexed;
      });
  }
  return stockPromise;
}

export function matchInstruments(query: string, limit = 5): Instrument[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const pool = stockIndexed ? [...curatedIndexed, ...stockIndexed] : curatedIndexed;
  const starts: Instrument[] = [];
  const contains: Instrument[] = [];

  for (const inst of pool) {
    if (inst._symbolL.startsWith(q)) {
      starts.push(inst);
    } else if (inst._symbolL.includes(q) || inst._nameL.includes(q)) {
      contains.push(inst);
    }
  }

  return [...starts, ...contains].slice(0, limit);
}
