// Shared types between web and api

export type TradeDirection = "long" | "short";
export type TradeStatus = "open" | "closed";
export type TradeSource = "manual" | "screenshot" | "mt4";

export interface TradingAccount {
  id: string;
  userId: string;
  name: string;
  broker: string | null;
  currency: string;
  startingBalance: string;
  isDefault: boolean;
  /** Broker platform's server timezone as an offset from UTC in minutes (e.g. 180 for UTC+3).
   * Null = unset, meaning screenshot-imported times are treated as literal UTC (legacy behavior). */
  brokerUtcOffsetMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

// Numeric columns are serialized as strings (Postgres numeric -> drizzle -> JSON)
export interface Trade {
  id: string;
  accountId: string;
  symbol: string;
  direction: TradeDirection;
  status: TradeStatus;
  entryPrice: string;
  exitPrice: string | null;
  lotSize: string;
  pnl: string | null;
  pnlManual: boolean;
  /** Signed broker adjustments already folded into pnl (negative = a cost). */
  swap: string | null;
  commission: string | null;
  entryTime: string;
  exitTime: string | null;
  session: string | null;
  source: TradeSource;
  screenshotUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const FOREX_PAIR_RE = /^[A-Z]{3}\/[A-Z]{3}$/;

// 1 lot = 100 troy oz for gold, 5,000 troy oz for silver — standard MT4/5 convention.
const CONTRACT_SIZE_OVERRIDES: Record<string, number> = {
  "XAU/USD": 100,
  "XAG/USD": 5000,
};

/**
 * Standard contract size for 1.0 lot, used to auto-calculate P&L from raw price diff.
 * Forex pairs: 1 lot = 100,000 units of base currency. Metals: see overrides above.
 * Everything else (stocks, indices, crypto) defaults to 1 — "lot" is treated as the
 * raw unit entered (shares, contracts, coins) since those conventions vary by broker.
 */
export function getContractSize(symbol: string): number {
  const s = symbol.trim().toUpperCase();
  if (s in CONTRACT_SIZE_OVERRIDES) return CONTRACT_SIZE_OVERRIDES[s];
  if (FOREX_PAIR_RE.test(s)) return 100000;
  return 1;
}

export interface CreateAccountInput {
  name: string;
  broker?: string;
  currency?: string;
  startingBalance?: number;
  /** ISO date/time string — when account history should start counting from. Optional on both
   * create and update; defaults to now if omitted at creation. */
  createdAt?: string;
  /** Broker platform's server timezone as an offset from UTC in minutes (e.g. 180 for UTC+3).
   * Omit/undefined leaves it unchanged (update) or unset (create); pass null to explicitly clear it. */
  brokerUtcOffsetMinutes?: number | null;
}

export interface CreateTradeInput {
  accountId?: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  lotSize: number;
  entryTime: string;
  session?: string;
  source?: TradeSource;
  screenshotUrl?: string;
  // Clearable optional fields. On PATCH: omit/undefined = leave unchanged, `null` = clear it,
  // a value = set it. On POST: `null` behaves the same as omitting.
  exitPrice?: number | null;
  exitTime?: string | null;
  notes?: string | null;
  /** Manual P&L override. Omit to auto-calculate from entry/exit/lot/contract size (+ swap/commission); `null` clears an existing override. */
  pnl?: number | null;
  /** Signed broker adjustments (negative = a cost). Folded into the auto-calculated pnl. */
  swap?: number | null;
  commission?: number | null;
}

/** Trade fields extracted from a broker screenshot via OCR. Any field can be null if not legible/present. */
export interface ParsedTradeScreenshot {
  symbol: string | null;
  direction: TradeDirection | null;
  entryPrice: number | null;
  exitPrice: number | null;
  lotSize: number | null;
  /** ISO-like "YYYY-MM-DDTHH:mm:ss", transcribed as shown (no timezone conversion). */
  entryDateTime: string | null;
  exitDateTime: string | null;
  pnl: number | null;
  swap: number | null;
  commission: number | null;
}

export interface Quote {
  content: string;
  author: string;
}

export interface PerformanceSummary {
  period: "weekly" | "monthly" | "yearly";
  pnl: number;
  winRate: number;
  profitFactor: number | null;
  avgWin: number;
  avgLoss: number;
  totalTrades: number;
  avgDurationMinutes: number;
  byInstrument: { symbol: string; trades: number; pnl: number; winRate: number }[];
  byDirection: { direction: TradeDirection; trades: number; pnl: number; winRate: number; avgPnl: number }[];
}
