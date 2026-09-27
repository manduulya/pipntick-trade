import { beforeEach, describe, expect, it, vi } from "vitest";

// Fake chainable drizzle builder (see trades.route.test.ts). Selects answer from a queue, every
// update's `.set()` payload is recorded in order, and `transaction` runs the callback against the
// same fake — enough to assert the default-account hand-off sequence.
const { mockDb, queueSelect, setInsertResult, setUpdateResult, getInsertValues, getUpdateSets, getDeleteCount, reset } =
  vi.hoisted(() => {
    function makeChain(getResult: () => unknown, onCapture?: (args: unknown) => void) {
      const chain: Record<string, unknown> = {};
      for (const method of ["from", "where", "orderBy", "innerJoin", "limit"]) chain[method] = () => chain;
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
      return chain;
    }

    let selectQueue: unknown[][] = [];
    let insertResult: unknown[] = [];
    let updateResult: unknown[] = [];
    let insertValues: unknown;
    let updateSets: Record<string, unknown>[] = [];
    let deleteCount = 0;

    const mockDb: Record<string, unknown> = {
      select: () => {
        const result = selectQueue.shift() ?? [];
        return makeChain(() => result);
      },
      insert: () => makeChain(() => insertResult, (v) => (insertValues = v)),
      update: () => makeChain(() => updateResult, (v) => updateSets.push(v as Record<string, unknown>)),
      delete: () => {
        deleteCount++;
        return makeChain(() => undefined);
      },
    };
    mockDb.transaction = (fn: (tx: unknown) => unknown) => fn(mockDb);

    return {
      mockDb,
      queueSelect: (...results: unknown[][]) => selectQueue.push(...results),
      setInsertResult: (r: unknown[]) => (insertResult = r),
      setUpdateResult: (r: unknown[]) => (updateResult = r),
      getInsertValues: () => insertValues as Record<string, unknown>,
      getUpdateSets: () => updateSets,
      getDeleteCount: () => deleteCount,
      reset: () => {
        selectQueue = [];
        insertResult = [];
        updateResult = [];
        insertValues = undefined;
        updateSets = [];
        deleteCount = 0;
      },
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
import { accountRoutes } from "../../routes/accounts";

async function buildApp() {
  const app = Fastify();
  await app.register(accountRoutes);
  await app.ready();
  return app;
}

function fakeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acct-1",
    userId: "user-1",
    name: "Main",
    broker: null,
    currency: "USD",
    startingBalance: "0",
    isDefault: false,
    status: "active",
    brokerUtcOffsetMinutes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

const patch = (payload: unknown) => ({ method: "PATCH" as const, url: "/api/accounts/acct-1", payload: payload as object });

beforeEach(() => {
  vi.clearAllMocks();
  reset();
  vi.mocked(getUserId).mockReturnValue("user-1");
});

describe("POST /api/accounts", () => {
  it("makes the user's first account the default", async () => {
    queueSelect([]); // no existing default
    setInsertResult([fakeAccount({ isDefault: true })]);
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/api/accounts", payload: { name: "Main" } });
    expect(res.statusCode).toBe(201);
    expect(getInsertValues()).toMatchObject({ isDefault: true });
  });

  it("doesn't steal the default when one already exists", async () => {
    queueSelect([{ id: "acct-0" }]);
    setInsertResult([fakeAccount()]);
    const app = await buildApp();
    await app.inject({ method: "POST", url: "/api/accounts", payload: { name: "Second" } });
    expect(getInsertValues()).toMatchObject({ isDefault: false });
  });
});

describe("PATCH /api/accounts/:id — default", () => {
  it("clears the old default before claiming it", async () => {
    queueSelect([fakeAccount()]);
    setUpdateResult([fakeAccount({ isDefault: true })]);
    const app = await buildApp();
    const res = await app.inject(patch({ isDefault: true }));
    expect(res.statusCode).toBe(200);
    const sets = getUpdateSets();
    expect(sets[0]).toEqual({ isDefault: false }); // everyone else
    expect(sets[1]).toMatchObject({ isDefault: true }); // this account
  });

  it("rejects isDefault: false", async () => {
    queueSelect([fakeAccount({ isDefault: true })]);
    const app = await buildApp();
    const res = await app.inject(patch({ isDefault: false }));
    expect(res.statusCode).toBe(400);
  });

  it("won't make an archived account the default", async () => {
    queueSelect([fakeAccount({ status: "archived" })]);
    const app = await buildApp();
    const res = await app.inject(patch({ isDefault: true }));
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /api/accounts/:id — status", () => {
  it("rejects an unknown status", async () => {
    queueSelect([fakeAccount()]);
    const app = await buildApp();
    const res = await app.inject(patch({ status: "blown" }));
    expect(res.statusCode).toBe(400);
  });

  it("archiving the default hands it to another account", async () => {
    queueSelect([fakeAccount({ isDefault: true })], [{ id: "acct-2" }]); // existing, then hand-off pick
    setUpdateResult([fakeAccount({ status: "archived" })]);
    const app = await buildApp();
    const res = await app.inject(patch({ status: "archived" }));
    expect(res.statusCode).toBe(200);
    const sets = getUpdateSets();
    expect(sets[0]).toMatchObject({ status: "archived", isDefault: false });
    expect(sets[1]).toEqual({ isDefault: true }); // acct-2
  });

  it("refuses detail edits on an archived account", async () => {
    queueSelect([fakeAccount({ status: "archived" })]);
    const app = await buildApp();
    const res = await app.inject(patch({ name: "Renamed" }));
    expect(res.statusCode).toBe(409);
  });

  it("allows reactivating an archived account, which takes the default if none exists", async () => {
    queueSelect([fakeAccount({ status: "archived" })], []); // existing, then "any other default?" = none
    setUpdateResult([fakeAccount({ status: "active", isDefault: true })]);
    const app = await buildApp();
    const res = await app.inject(patch({ status: "active" }));
    expect(res.statusCode).toBe(200);
    expect(getUpdateSets()[0]).toMatchObject({ status: "active", isDefault: true });
  });
});

describe("DELETE /api/accounts/:id", () => {
  it("hands the default on when deleting the default account", async () => {
    queueSelect([{ id: "acct-1", isDefault: true }], [{ id: "acct-2" }]);
    const app = await buildApp();
    const res = await app.inject({ method: "DELETE", url: "/api/accounts/acct-1" });
    expect(res.statusCode).toBe(204);
    expect(getDeleteCount()).toBe(1);
    expect(getUpdateSets()).toEqual([{ isDefault: true }]);
  });

  it("returns 404 for an account the caller doesn't own", async () => {
    queueSelect([]);
    const app = await buildApp();
    const res = await app.inject({ method: "DELETE", url: "/api/accounts/acct-1" });
    expect(res.statusCode).toBe(404);
  });
});
