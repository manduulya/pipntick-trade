import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, setSelectResult } = vi.hoisted(() => {
  function makeChain(getResult: () => unknown) {
    const chain: Record<string, unknown> = {};
    for (const method of ["from", "where", "orderBy", "innerJoin", "limit"]) {
      chain[method] = () => chain;
    }
    chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(getResult()).then(onFulfilled, onRejected);
    chain.catch = (onRejected: (e: unknown) => unknown) => Promise.resolve(getResult()).catch(onRejected);
    return chain;
  }

  let selectResult: unknown[] = [];
  const mockDb = { select: () => makeChain(() => selectResult) };
  return { mockDb, setSelectResult: (r: unknown[]) => (selectResult = r) };
});

vi.mock("@pipntick/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pipntick/db")>();
  return { ...actual, db: mockDb };
});
vi.mock("../../lib/auth", () => ({ getUserId: vi.fn() }));
vi.mock("../../lib/ensure-account", () => ({ getDefaultAccount: vi.fn(), ensureUser: vi.fn() }));

import Fastify from "fastify";
import { getUserId } from "../../lib/auth";
import { getDefaultAccount } from "../../lib/ensure-account";
import { performanceRoutes } from "../../routes/performance";

async function buildApp() {
  const app = Fastify();
  await app.register(performanceRoutes);
  await app.ready();
  return app;
}

const FAKE_ACCOUNT = {
  id: "acct-1",
  userId: "user-1",
  name: "Default",
  broker: null,
  currency: "USD",
  startingBalance: "0",
  isDefault: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  setSelectResult([]);
  vi.mocked(getUserId).mockReturnValue("user-1");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getDefaultAccount).mockResolvedValue(FAKE_ACCOUNT as any);
});

describe("GET /api/performance", () => {
  it("returns 401 without an authenticated user", async () => {
    vi.mocked(getUserId).mockReturnValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/performance" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when the caller has no resolvable default account", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getDefaultAccount).mockResolvedValue(null as any);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/performance" });
    expect(res.statusCode).toBe(404);
  });

  it("defaults to the monthly period when none is given", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/performance" });
    expect(res.statusCode).toBe(200);
    expect(res.json().period).toBe("monthly");
  });

  it("falls back to monthly for an unrecognized period value", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/performance?period=daily" });
    expect(res.json().period).toBe("monthly");
  });

  it("honors a valid period query param", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/performance?period=yearly" });
    expect(res.json().period).toBe("yearly");
  });

  it("aggregates the fetched rows into the performance summary shape", async () => {
    setSelectResult([
      { pnl: "100.00", direction: "long", symbol: "EUR/USD", entryTime: new Date(), exitTime: new Date() },
      { pnl: "-50.00", direction: "short", symbol: "GBP/USD", entryTime: new Date(), exitTime: new Date() },
    ]);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/performance" });
    const body = res.json();
    expect(body.pnl).toBe(50);
    expect(body.totalTrades).toBe(2);
    expect(body.winRate).toBe(50);
  });
});
