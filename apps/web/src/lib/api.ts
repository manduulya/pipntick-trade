import type {
  CandleInterval,
  CandlesResponse,
  CreateAccountInput,
  CreatePlanInput,
  CreateTradeInput,
  ParsedTradeScreenshot,
  Quote,
  SaveRulesInput,
  Trade,
  TradePlan,
  TradingAccount,
  TradingRule,
  UpdateAccountInput,
  UpdatePlanInput,
} from "@pipntick/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  // NB: do NOT set `cache: "no-store"` here. WebKit drops the request body on a non-GET fetch
  // when that option is set (https://bugs.webkit.org/show_bug.cgi?id=252542), which made PATCH
  // silently no-op on Safari — the row came back 200 with every field merged from its unchanged
  // current value. Cache-busting is handled server-side instead: the API sends
  // `Cache-Control: no-store` on every response (apps/api/src/index.ts).
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  trades: {
    list: (token: string | null, accountId?: string) =>
      request<Trade[]>(`/api/trades${accountId ? `?accountId=${accountId}` : ""}`, token),
    create: (token: string | null, input: CreateTradeInput) =>
      request<Trade>("/api/trades", token, { method: "POST", body: JSON.stringify(input) }),
    update: (token: string | null, id: string, input: Partial<CreateTradeInput>) =>
      request<Trade>(`/api/trades/${id}`, token, { method: "PATCH", body: JSON.stringify(input) }),
    remove: (token: string | null, id: string) =>
      request<void>(`/api/trades/${id}`, token, { method: "DELETE" }),
  },
  accounts: {
    list: (token: string | null) => request<TradingAccount[]>("/api/accounts", token),
    create: (token: string | null, input: CreateAccountInput) =>
      request<TradingAccount>("/api/accounts", token, { method: "POST", body: JSON.stringify(input) }),
    update: (token: string | null, id: string, input: UpdateAccountInput) =>
      request<TradingAccount>(`/api/accounts/${id}`, token, { method: "PATCH", body: JSON.stringify(input) }),
    remove: (token: string | null, id: string) =>
      request<void>(`/api/accounts/${id}`, token, { method: "DELETE" }),
  },
  account: {
    delete: (token: string | null) => request<void>("/api/account", token, { method: "DELETE" }),
  },
  screenshot: {
    parseTrade: (token: string | null, imageDataUrl: string) =>
      request<ParsedTradeScreenshot>("/api/trades/parse-screenshot", token, {
        method: "POST",
        body: JSON.stringify({ image: imageDataUrl }),
      }),
  },
  quote: {
    get: (token: string | null) => request<Quote>("/api/quote", token),
  },
  candles: {
    /** `entry`/`exit` are real UTC instants (ISO) — convert broker wall-clock times first. */
    get: (token: string | null, params: { symbol: string; entry: string; exit?: string; interval: CandleInterval }) => {
      const qs = new URLSearchParams({ symbol: params.symbol, entry: params.entry, interval: params.interval });
      if (params.exit) qs.set("exit", params.exit);
      return request<CandlesResponse>(`/api/candles?${qs.toString()}`, token);
    },
  },
  rules: {
    list: (token: string | null, accountId: string) => request<TradingRule[]>(`/api/rules?accountId=${accountId}`, token),
    save: (token: string | null, accountId: string, rules: SaveRulesInput) =>
      request<TradingRule[]>(`/api/rules?accountId=${accountId}`, token, { method: "PUT", body: JSON.stringify(rules) }),
  },
  plans: {
    list: (token: string | null, accountId: string, from: string, to: string) =>
      request<TradePlan[]>(`/api/plans?accountId=${accountId}&from=${from}&to=${to}`, token),
    create: (token: string | null, input: CreatePlanInput) =>
      request<TradePlan>("/api/plans", token, { method: "POST", body: JSON.stringify(input) }),
    update: (token: string | null, id: string, input: UpdatePlanInput) =>
      request<TradePlan>(`/api/plans/${id}`, token, { method: "PATCH", body: JSON.stringify(input) }),
    remove: (token: string | null, id: string) => request<void>(`/api/plans/${id}`, token, { method: "DELETE" }),
  },
};
