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
 * CME-group futures by root symbol (no month code, e.g. "MES", not "MESZ6"). `pointValue` is the
 * dollar P&L per contract for a 1.0 move in the quoted price — e.g. MES $5, so +10 points on
 * 2 contracts = $100. For contracts quoted in cents (grains) that's per 1 cent.
 */
export const FUTURES_CONTRACTS: Record<string, { name: string; pointValue: number }> = {
  // Equity index
  ES: { name: "E-mini S&P 500", pointValue: 50 },
  MES: { name: "Micro E-mini S&P 500", pointValue: 5 },
  NQ: { name: "E-mini Nasdaq-100", pointValue: 20 },
  MNQ: { name: "Micro E-mini Nasdaq-100", pointValue: 2 },
  YM: { name: "E-mini Dow ($5)", pointValue: 5 },
  MYM: { name: "Micro E-mini Dow", pointValue: 0.5 },
  RTY: { name: "E-mini Russell 2000", pointValue: 50 },
  M2K: { name: "Micro E-mini Russell 2000", pointValue: 5 },
  // Metals
  GC: { name: "Gold", pointValue: 100 },
  MGC: { name: "Micro Gold", pointValue: 10 },
  SI: { name: "Silver", pointValue: 5000 },
  SIL: { name: "Micro Silver", pointValue: 1000 },
  HG: { name: "Copper", pointValue: 25000 },
  MHG: { name: "Micro Copper", pointValue: 2500 },
  PL: { name: "Platinum", pointValue: 50 },
  // Energy
  CL: { name: "Crude Oil (WTI)", pointValue: 1000 },
  MCL: { name: "Micro Crude Oil (WTI)", pointValue: 100 },
  NG: { name: "Natural Gas", pointValue: 10000 },
  // Interest rates
  ZB: { name: "30-Year U.S. Treasury Bond", pointValue: 1000 },
  ZN: { name: "10-Year U.S. Treasury Note", pointValue: 1000 },
  ZF: { name: "5-Year U.S. Treasury Note", pointValue: 1000 },
  ZT: { name: "2-Year U.S. Treasury Note", pointValue: 2000 },
  // Currencies
  "6E": { name: "Euro FX", pointValue: 125000 },
  M6E: { name: "Micro Euro FX", pointValue: 12500 },
  "6B": { name: "British Pound", pointValue: 62500 },
  "6J": { name: "Japanese Yen", pointValue: 12500000 },
  "6A": { name: "Australian Dollar", pointValue: 100000 },
  "6C": { name: "Canadian Dollar", pointValue: 100000 },
  // Crypto
  BTC: { name: "Bitcoin (CME)", pointValue: 5 },
  MBT: { name: "Micro Bitcoin", pointValue: 0.1 },
  ETH: { name: "Ether (CME)", pointValue: 50 },
  MET: { name: "Micro Ether", pointValue: 0.1 },
  // Grains (quoted in cents per bushel)
  ZC: { name: "Corn", pointValue: 50 },
  ZS: { name: "Soybeans", pointValue: 50 },
  ZW: { name: "Wheat", pointValue: 50 },
};

/** The futures contract spec for a root symbol, or null if it isn't a known future. */
export function getFuturesContract(symbol: string): { name: string; pointValue: number } | null {
  return FUTURES_CONTRACTS[symbol.trim().toUpperCase()] ?? null;
}

/**
 * Standard contract size for 1.0 lot, used to auto-calculate P&L from raw price diff.
 * Futures: the contract's point value, with "lot" = number of contracts. Forex pairs: 1 lot =
 * 100,000 units of base currency. Metals: see overrides above. Everything else (stocks, indices,
 * crypto) defaults to 1 — "lot" is treated as the raw unit entered (shares, coins) since those
 * conventions vary by broker.
 */
export function getContractSize(symbol: string): number {
  const s = symbol.trim().toUpperCase();
  const future = FUTURES_CONTRACTS[s];
  if (future) return future.pointValue;
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

// ─── Trade Plan ────────────────────────────────────────────────────────────

export type RuleType = "check" | "choice";
export type PlanStatus = "planned" | "logged" | "skipped";
export const TRADE_GRADES = ["F", "D", "C", "B", "A", "A++"] as const;
export type TradeGrade = (typeof TRADE_GRADES)[number];

/** One rule in an account's pre-trade checklist ("My Rules"). */
export interface TradingRule {
  id: string;
  accountId: string;
  position: number;
  text: string;
  type: RuleType;
  /** Answer options for a `choice` rule; always empty for `check`. */
  options: string[];
  createdAt: string;
  updatedAt: string;
}

/** A rule as frozen into a plan when the plan was created, plus the plan's answer to it. */
export interface RuleSnapshotItem {
  text: string;
  type: RuleType;
  options: string[];
  /** `check` rules: ticked or not. */
  done: boolean;
  /** `choice` rules: the picked option, or null. */
  value: string | null;
}

export interface TradePlan {
  id: string;
  accountId: string;
  /** Calendar day the plan sits on, "YYYY-MM-DD". */
  planDate: string;
  symbol: string;
  direction: TradeDirection;
  grade: TradeGrade | null;
  status: PlanStatus;
  rulesSnapshot: RuleSnapshotItem[];
  /** The Journal trade this plan was logged as, if any. */
  journalTradeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SaveRulesInput = { text: string; type: RuleType; options: string[] }[];

export interface CreatePlanInput {
  accountId?: string;
  planDate: string;
}

export interface UpdatePlanInput {
  symbol?: string;
  direction?: TradeDirection;
  grade?: TradeGrade | null;
  status?: PlanStatus;
  journalTradeId?: string | null;
  /** Answers per snapshot index. Only `done`/`value` are writable — a snapshot's rule text,
   * type and options are fixed once the plan exists. */
  answers?: { done: boolean; value: string | null }[];
}

/** A checklist item counts as met when a check is ticked or a choice has an answer. */
export function isRuleMet(item: Pick<RuleSnapshotItem, "type" | "done" | "value">): boolean {
  return item.type === "choice" ? !!item.value : item.done;
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
