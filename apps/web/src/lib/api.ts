import type { CreateAccountInput, CreateTradeInput, ParsedTradeScreenshot, Quote, Trade, TradingAccount } from "@pipntick/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
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
    update: (token: string | null, id: string, input: Partial<CreateAccountInput>) =>
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
};
