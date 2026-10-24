// Shared types between web and api

export type TradeDirection = "long" | "short";
export type TradeStatus = "open" | "closed";
export type TradeSource = "manual" | "screenshot" | "mt4";

/** active = trading it now; inactive = paused but editable; archived = finished, read-only. */
export type AccountStatus = "active" | "inactive" | "archived";
export const ACCOUNT_STATUSES: readonly AccountStatus[] = ["active", "inactive", "archived"];

export interface TradingAccount {
  id: string;
  userId: string;
  name: string;
  broker: string | null;
  currency: string;
  startingBalance: string;
  /** At most one per user, never an archived account. */
  isDefault: boolean;
  status: AccountStatus;
  /** Broker platform's server timezone as an offset from UTC in minutes (e.g. 180 for UTC+3).
   * Null = unset, meaning screenshot-imported times are treated as literal UTC (legacy behavior). */
  brokerUtcOffsetMinutes: number | null;
  /** IANA timezone of the broker clock (e.g. "America/New_York"); follows daylight saving.
   * Takes precedence over brokerUtcOffsetMinutes, which is only the legacy fallback. */
  brokerTimezone: string | null;
  /** What the account trades; drives the symbol picker, size unit and P&L sizing. */
  assetClass: AssetClass;
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
  /** Flagged as a mistake by the trader; `notes` then describes the mistake. */
  isMistake: boolean;
  /** Optional planned stop-loss price. */
  stopLoss: string | null;
  /** Optional take-profit targets (0–5), nearest to entry first. Empty when none. */
  takeProfits: string[];
  /** Optional TradingView snapshot links (normalized), before and after the trade. */
  preTradeUrl: string | null;
  postTradeUrl: string | null;
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
export function getContractSize(symbol: string, assetClass?: AssetClass): number {
  const s = symbol.trim().toUpperCase();
  // The account's asset class settles ticker collisions: "ES" in a stocks account is Eversource
  // shares (×1), not the E-mini future (×$50).
  if (assetClass === "stocks" || assetClass === "crypto") return 1;
  const future = FUTURES_CONTRACTS[s];
  if (future && assetClass !== "forex") return future.pointValue;
  if (s in CONTRACT_SIZE_OVERRIDES) return CONTRACT_SIZE_OVERRIDES[s];
  if (FOREX_PAIR_RE.test(s)) return 100000;
  return 1;
}

// ─── Asset classes ─────────────────────────────────────────────────────────

/**
 * What an account trades. It decides which symbols the instrument picker offers, the size unit
 * (contracts / lots / shares / coins) and P&L sizing. Forex follows MT4/MT5 brokers and also
 * covers spot metals and index CFDs. Options aren't supported yet (shown as "coming soon").
 */
export type AssetClass = "futures" | "forex" | "stocks" | "crypto";
export const ASSET_CLASS_VALUES: readonly AssetClass[] = ["futures", "forex", "stocks", "crypto"];

export const ASSET_CLASSES: Record<
  AssetClass,
  { label: string; unit: string; unitPlural: string; sizeLabel: string; step: string; min?: number; placeholder: string; example: string }
> = {
  futures: { label: "Futures", unit: "contract", unitPlural: "contracts", sizeLabel: "Contracts", step: "1", min: 1, placeholder: "1", example: "MES" },
  forex: { label: "Forex", unit: "lot", unitPlural: "lots", sizeLabel: "Lots", step: "any", placeholder: "0.01", example: "EUR/USD" },
  stocks: { label: "Stocks", unit: "share", unitPlural: "shares", sizeLabel: "Shares", step: "any", placeholder: "100", example: "AAPL" },
  crypto: { label: "Crypto", unit: "coin", unitPlural: "coins", sizeLabel: "Coins", step: "any", placeholder: "0.1", example: "BTC/USD" },
};

export function isAssetClass(value: unknown): value is AssetClass {
  return typeof value === "string" && (ASSET_CLASS_VALUES as readonly string[]).includes(value);
}

export interface Instrument {
  symbol: string;
  name: string;
}

/** Hand-curated forex / metals / index CFDs (all "forex" accounts) and crypto. Futures come from
 * FUTURES_CONTRACTS and stocks from the web app's exchange symbol directory. */
export const CURATED_INSTRUMENTS: (Instrument & { assetClass: "forex" | "crypto" })[] = [
  // Forex majors
  { symbol: "EUR/USD", name: "Euro / US Dollar", assetClass: "forex" },
  { symbol: "GBP/USD", name: "British Pound / US Dollar", assetClass: "forex" },
  { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", assetClass: "forex" },
  { symbol: "USD/CHF", name: "US Dollar / Swiss Franc", assetClass: "forex" },
  { symbol: "USD/CAD", name: "US Dollar / Canadian Dollar", assetClass: "forex" },
  { symbol: "AUD/USD", name: "Australian Dollar / US Dollar", assetClass: "forex" },
  { symbol: "NZD/USD", name: "New Zealand Dollar / US Dollar", assetClass: "forex" },
  // Forex crosses
  { symbol: "EUR/GBP", name: "Euro / British Pound", assetClass: "forex" },
  { symbol: "EUR/JPY", name: "Euro / Japanese Yen", assetClass: "forex" },
  { symbol: "GBP/JPY", name: "British Pound / Japanese Yen", assetClass: "forex" },
  { symbol: "EUR/AUD", name: "Euro / Australian Dollar", assetClass: "forex" },
  { symbol: "EUR/CHF", name: "Euro / Swiss Franc", assetClass: "forex" },
  { symbol: "AUD/JPY", name: "Australian Dollar / Japanese Yen", assetClass: "forex" },
  { symbol: "GBP/AUD", name: "British Pound / Australian Dollar", assetClass: "forex" },
  { symbol: "CHF/JPY", name: "Swiss Franc / Japanese Yen", assetClass: "forex" },
  { symbol: "NZD/JPY", name: "New Zealand Dollar / Japanese Yen", assetClass: "forex" },
  { symbol: "CAD/JPY", name: "Canadian Dollar / Japanese Yen", assetClass: "forex" },
  // Metals
  { symbol: "XAU/USD", name: "Gold / US Dollar", assetClass: "forex" },
  { symbol: "XAG/USD", name: "Silver / US Dollar", assetClass: "forex" },
  // Index CFDs
  { symbol: "US30", name: "Dow Jones Industrial Average", assetClass: "forex" },
  { symbol: "NAS100", name: "Nasdaq 100", assetClass: "forex" },
  { symbol: "SPX500", name: "S&P 500", assetClass: "forex" },
  { symbol: "GER40", name: "Germany 40", assetClass: "forex" },
  { symbol: "UK100", name: "FTSE 100", assetClass: "forex" },
  // Crypto
  { symbol: "BTC/USD", name: "Bitcoin / US Dollar", assetClass: "crypto" },
  { symbol: "ETH/USD", name: "Ethereum / US Dollar", assetClass: "crypto" },
  { symbol: "XRP/USD", name: "XRP / US Dollar", assetClass: "crypto" },
  { symbol: "SOL/USD", name: "Solana / US Dollar", assetClass: "crypto" },
];

const STOCK_TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

/** The curated entry for a symbol, also accepting a bare pair like "EURUSD" for "EUR/USD". */
function findCurated(symbol: string) {
  const s = symbol.trim().toUpperCase();
  const candidates = /^[A-Z]{6}$/.test(s) ? [s, `${s.slice(0, 3)}/${s.slice(3)}`] : [s];
  return CURATED_INSTRUMENTS.find((i) => candidates.includes(i.symbol)) ?? null;
}

/**
 * Whether a symbol belongs to an asset class. Futures: a known CME root. Forex / crypto: a
 * curated instrument of that class. Stocks: any plain ticker that isn't a curated instrument, so
 * "ES" is a valid stock (Eversource) in a stocks account. The web picker further limits stocks to
 * the listed exchange directory; the server can only check the shape.
 */
export function symbolFitsClass(symbol: string, assetClass: AssetClass): boolean {
  const s = symbol.trim().toUpperCase();
  if (!s) return false;
  switch (assetClass) {
    case "futures":
      return s in FUTURES_CONTRACTS;
    case "forex":
    case "crypto":
      return findCurated(s)?.assetClass === assetClass;
    case "stocks":
      return STOCK_TICKER_RE.test(s) && !findCurated(s);
  }
}

/**
 * The symbols that block switching an account from `from` to `to`. A trade blocks it unless it
 * fits the new class *and* wasn't entered as the current one: "MES" is stock-shaped, but switching
 * a futures account to stocks would silently turn its contracts into shares. Only legacy trades
 * that never fit the current class can carry over. De-duplicated, in first-seen order.
 */
export function classChangeMisfits(symbols: string[], from: AssetClass, to: AssetClass): string[] {
  if (from === to) return [];
  return [...new Set(symbols)].filter((s) => symbolFitsClass(s, from) || !symbolFitsClass(s, to));
}

/** Best guess at a symbol's class from the symbol alone (futures roots win collisions). Only for
 * legacy trades that don't fit their account's class. */
export function inferAssetClass(symbol: string): AssetClass {
  const s = symbol.trim().toUpperCase();
  if (s in FUTURES_CONTRACTS) return "futures";
  const curated = findCurated(s);
  if (curated) return curated.assetClass;
  if (FOREX_PAIR_RE.test(s)) return "forex";
  return "stocks";
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
  /** IANA timezone (e.g. "America/New_York"). Same absent/null/value rule as the offset. */
  brokerTimezone?: string | null;
  /** Defaults to "forex" on create. On update, only allowed when every existing trade fits. */
  assetClass?: AssetClass;
}

export type UpdateAccountInput = Partial<CreateAccountInput> & {
  status?: AccountStatus;
  /** Only `true` is accepted — the default moves by making another account the default. */
  isDefault?: true;
};

/** Archived accounts are kept for history only: no new or edited trades, plans or rules. */
export function isReadOnlyAccount(account: Pick<TradingAccount, "status"> | null | undefined): boolean {
  return account?.status === "archived";
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
  /** Mark the trade as a mistake (PATCH: omit to keep). */
  isMistake?: boolean;
  /** Optional stop-loss price. PATCH: omit = keep, null = clear. */
  stopLoss?: number | null;
  /** Optional take-profit targets (up to 5). PATCH: omit = keep, [] = clear. */
  takeProfits?: number[];
  /** Optional TradingView snapshot links (tradingview.com/x/…). PATCH: omit = keep, null = clear. */
  preTradeUrl?: string | null;
  postTradeUrl?: string | null;
}

const TRADINGVIEW_SNAPSHOT_RE = /^(?:https?:\/\/)?(?:www\.)?tradingview\.com\/x\/([A-Za-z0-9]+)\/?(?:[?#].*)?$/;

/**
 * A TradingView snapshot link ("https://www.tradingview.com/x/k1tz0owS/"), normalized, or null
 * when the text isn't one. Accepts http/https, with or without "www." and the trailing slash.
 * `imageUrl` is the PNG behind the snapshot — an informal (undocumented) TradingView path, so the
 * UI must fall back to the page link if it doesn't load.
 */
export function parseTradingViewSnapshot(value: string): { id: string; url: string; imageUrl: string } | null {
  const m = TRADINGVIEW_SNAPSHOT_RE.exec(value.trim());
  if (!m) return null;
  const id = m[1];
  return {
    id,
    url: `https://www.tradingview.com/x/${id}/`,
    imageUrl: `https://s3.tradingview.com/snapshots/${id[0].toLowerCase()}/${id}.png`,
  };
}

/**
 * A commission/charge is always a cost, whatever sign the trader typed: 1.20 and -1.20 both mean
 * "$1.20 deducted". Returned negative (0 stays 0), matching the signed-fees convention where
 * negative = cost. Swap is deliberately not normalized — brokers can pay swap as well as charge it.
 */
export function commissionAsCost(value: number): number {
  return value === 0 ? 0 : -Math.abs(value);
}

export const MAX_TAKE_PROFITS = 5;

/**
 * Planned reward:risk for a trade from its entry, stop and first target, e.g. 2.4 for "1 : 2.4".
 * Null unless all three exist and the stop/target sit on opposite sides of the entry.
 */
export function plannedRewardRisk(entry: number, stop: number | null | undefined, target: number | null | undefined): number | null {
  if (stop == null || target == null || !Number.isFinite(entry)) return null;
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const opposite = (target - entry) * (entry - stop) > 0;
  return risk > 0 && opposite ? reward / risk : null;
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
  /** Move the plan to another day ("YYYY-MM-DD"). Only allowed while the plan is still `planned`. */
  planDate?: string;
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

// ─── Trade Review chart ────────────────────────────────────────────────────

export type CandleInterval = "15m" | "30m" | "1h" | "4h";
export const CANDLE_INTERVALS: readonly CandleInterval[] = ["15m", "30m", "1h", "4h"];

/** One OHLC bar; `time` is unix seconds (UTC). */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CandlesResponse {
  symbol: string;
  /** The data source's ticker, e.g. "ES=F" for MES (micros chart their parent contract). */
  ticker: string;
  interval: CandleInterval;
  /** Intervals whose history still covers this trade (finer ones expire after days/weeks). */
  allowedIntervals: CandleInterval[];
  /** The data is a stand-in for the traded instrument (e.g. gold futures for spot XAU/USD). */
  approximate: boolean;
  note: string | null;
  candles: Candle[];
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
