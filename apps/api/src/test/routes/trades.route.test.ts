import { beforeEach, describe, expect, it, vi } from "vitest";

// A minimal fake of drizzle's chainable query builder. Every chain method returns the same
// chain object so call order doesn't matter, and the chain resolves via `.then`/`.returning()`
// to whatever result the test configured — this lets route handlers run unmodified against a
// mocked `db` without a real Postgres connection.
const { mockDb, setSelectResult, setInsertResult, setUpdateResult, getLastInsertValues, getLastUpdateSet } =
  vi.hoisted(() => {
    function makeChain(getResult: () => unknown, onCapture?: (args: unknown) => void) {
      const chain: Record<string, unknown> = {};
      for (const method of ["from", "where", "orderBy", "innerJoin", "limit"]) {
        chain[method] = () => chain;
      }
      chain.values = (args: unknown) => {
        onCapture?.(args);
        return chain;
      };
      chain.set = (args: unknown) => {
        onCapture?.(args);
        return chain;
      };
      chain.returning = () => Promise.resolve(getResult());
      chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(getResult()).then(onFulfilled, onRejected);
      chain.catch = (onRejected: (e: unknown) => unknown) => Promise.resolve(getResult()).catch(onRejected);
      return chain;
    }

    let selectResult: unknown[] = [];
    let insertResult: unknown[] = [];
    let updateResult: unknown[] = [];
    let lastInsertValues: unknown;
    let lastUpdateSet: unknown;

    const mockDb = {
      select: () => makeChain(() => selectResult),
      insert: () =>
        makeChain(
          () => insertResult,
          (v) => (lastInsertValues = v),
        ),
      update: () =>
        makeChain(
          () => updateResult,
          (v) => (lastUpdateSet = v),
        ),
      delete: () => makeChain(() => undefined),
    };

    return {
      mockDb,
      setSelectResult: (r: unknown[]) => (selectResult = r),
      setInsertResult: (r: unknown[]) => (insertResult = r),
      setUpdateResult: (r: unknown[]) => (updateResult = r),
      getLastInsertValues: () => lastInsertValues,
      getLastUpdateSet: () => lastUpdateSet,
    };
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
import { tradeRoutes } from "../../routes/trades";

async function buildApp() {
  const app = Fastify();
  await app.register(tradeRoutes);
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
  setInsertResult([]);
  setUpdateResult([]);
  vi.mocked(getUserId).mockReturnValue("user-1");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getDefaultAccount).mockResolvedValue(FAKE_ACCOUNT as any);
});

describe("GET /api/trades", () => {
  it("returns 401 when there is no authenticated user", async () => {
    vi.mocked(getUserId).mockReturnValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/trades" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when the caller has no resolvable account", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getDefaultAccount).mockResolvedValue(null as any);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/trades" });
    expect(res.statusCode).toBe(404);
  });

  it("returns the trades for the caller's default account", async () => {
    setSelectResult([{ id: "t1", symbol: "EUR/USD" }]);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/trades" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ id: "t1", symbol: "EUR/USD" }]);
  });
});

describe("POST /api/trades", () => {
  it("returns 401 without an authenticated user", async () => {
    vi.mocked(getUserId).mockReturnValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/api/trades", payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/api/trades", payload: { symbol: "EUR/USD" } });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when exitTime is earlier than entryTime", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/trades",
      payload: {
        symbol: "EUR/USD",
        direction: "long",
        entryPrice: 1.1,
        exitPrice: 1.105,
        lotSize: 1,
        entryTime: "2026-03-15T22:00:00.000Z",
        exitTime: "2026-03-15T02:00:00.000Z",
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when entryTime is in the future", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/trades",
      payload: {
        symbol: "EUR/USD",
        direction: "long",
        entryPrice: 1.1,
        lotSize: 1,
        entryTime: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when the requested accountId isn't owned by the caller", async () => {
    setSelectResult([]); // account ownership lookup finds nothing
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/trades",
      payload: {
        accountId: "someone-elses-account",
        symbol: "EUR/USD",
        direction: "long",
        entryPrice: 1.1,
        lotSize: 1,
        entryTime: "2026-03-15T10:00:00.000Z",
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it("computes and persists pnl + closed status for a trade with an exit price", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/trades",
      payload: {
        symbol: "EUR/USD",
        direction: "long",
        entryPrice: 1.1,
        exitPrice: 1.105,
        lotSize: 1,
        entryTime: "2026-03-15T10:00:00.000Z",
      },
    });
    expect(res.statusCode).toBe(201);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted = getLastInsertValues() as any;
    expect(inserted.status).toBe("closed");
    expect(Number(inserted.pnl)).toBeCloseTo(500);
    expect(inserted.pnlManual).toBe(false);
  });

  it("creates an open trade with a null pnl when no exit price is given", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/trades",
      payload: {
        symbol: "EUR/USD",
        direction: "long",
        entryPrice: 1.1,
        lotSize: 1,
        entryTime: "2026-03-15T10:00:00.000Z",
      },
    });
    expect(res.statusCode).toBe(201);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted = getLastInsertValues() as any;
    expect(inserted.status).toBe("open");
    expect(inserted.pnl).toBeNull();
  });

  it("respects a manual pnl override instead of computing one", async () => {
    const app = await buildApp();
    await app.inject({
      method: "POST",
      url: "/api/trades",
      payload: {
        symbol: "EUR/USD",
        direction: "long",
        entryPrice: 1.1,
        exitPrice: 1.105,
        lotSize: 1,
        entryTime: "2026-03-15T10:00:00.000Z",
        pnl: 999,
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted = getLastInsertValues() as any;
    expect(Number(inserted.pnl)).toBe(999);
    expect(inserted.pnlManual).toBe(true);
  });
});

describe("PATCH /api/trades/:id", () => {
  it("returns 401 without an authenticated user", async () => {
    vi.mocked(getUserId).mockReturnValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: "PATCH", url: "/api/trades/t1", payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when the trade isn't found or not owned by the caller", async () => {
    setSelectResult([]);
    const app = await buildApp();
    const res = await app.inject({ method: "PATCH", url: "/api/trades/missing-id", payload: { exitPrice: 1.2 } });
    expect(res.statusCode).toBe(404);
  });

  it("recomputes pnl from the merged existing + patched fields", async () => {
    setSelectResult([
      {
        trade: {
          id: "t1",
          symbol: "EUR/USD",
          direction: "long",
          entryPrice: "1.1000",
          exitPrice: null,
          lotSize: "1",
          swap: null,
          commission: null,
          entryTime: new Date("2026-03-15T10:00:00.000Z"),
          exitTime: null,
          session: "London",
          notes: null,
          screenshotUrl: null,
        },
      },
    ]);
    const app = await buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/api/trades/t1",
      payload: { exitPrice: 1.105 },
    });
    expect(res.statusCode).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = getLastUpdateSet() as any;
    expect(updated.status).toBe("closed");
    expect(Number(updated.pnl)).toBeCloseTo(500);
  });

  it("returns 400 when a patched exitTime predates the existing entryTime", async () => {
    setSelectResult([
      {
        trade: {
          id: "t1",
          symbol: "EUR/USD",
          direction: "long",
          entryPrice: "1.1000",
          exitPrice: null,
          lotSize: "1",
          swap: null,
          commission: null,
          entryTime: new Date("2026-03-15T22:00:00.000Z"),
          exitTime: null,
          session: "London",
          notes: null,
          screenshotUrl: null,
        },
      },
    ]);
    const app = await buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/api/trades/t1",
      payload: { exitPrice: 1.105, exitTime: "2026-03-15T02:00:00.000Z" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when a patched entryTime is in the future", async () => {
    setSelectResult([
      {
        trade: {
          id: "t1",
          symbol: "EUR/USD",
          direction: "long",
          entryPrice: "1.1000",
          exitPrice: null,
          lotSize: "1",
          swap: null,
          commission: null,
          entryTime: new Date("2026-03-15T10:00:00.000Z"),
          exitTime: null,
          session: "London",
          notes: null,
          screenshotUrl: null,
        },
      },
    ]);
    const app = await buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/api/trades/t1",
      payload: { entryTime: new Date(Date.now() + 86_400_000).toISOString() },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("DELETE /api/trades/:id", () => {
  it("returns 401 without an authenticated user", async () => {
    vi.mocked(getUserId).mockReturnValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: "DELETE", url: "/api/trades/t1" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when the trade isn't found or not owned by the caller", async () => {
    setSelectResult([]);
    const app = await buildApp();
    const res = await app.inject({ method: "DELETE", url: "/api/trades/missing-id" });
    expect(res.statusCode).toBe(404);
  });

  it("returns 204 on successful delete", async () => {
    setSelectResult([{ id: "t1" }]);
    const app = await buildApp();
    const res = await app.inject({ method: "DELETE", url: "/api/trades/t1" });
    expect(res.statusCode).toBe(204);
  });
});
