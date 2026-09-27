import { beforeEach, describe, expect, it, vi } from "vitest";

// Fake chainable drizzle builder (see trades.route.test.ts). `select` results come from a queue so
// a handler that runs several selects (ownership lookup, then a trade lookup) gets one each.
const { mockDb, queueSelect, setInsertResult, setUpdateResult, getLastInsertValues, getLastUpdateSet, reset } =
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
      return chain;
    }

    let selectQueue: unknown[][] = [];
    let insertResult: unknown[] = [];
    let updateResult: unknown[] = [];
    let lastInsertValues: unknown;
    let lastUpdateSet: unknown;

    const mockDb = {
      select: () => {
        const result = selectQueue.shift() ?? [];
        return makeChain(() => result);
      },
      insert: () => makeChain(() => insertResult, (v) => (lastInsertValues = v)),
      update: () => makeChain(() => updateResult, (v) => (lastUpdateSet = v)),
      delete: () => makeChain(() => undefined),
    };

    return {
      mockDb,
      queueSelect: (...results: unknown[][]) => selectQueue.push(...results),
      setInsertResult: (r: unknown[]) => (insertResult = r),
      setUpdateResult: (r: unknown[]) => (updateResult = r),
      getLastInsertValues: () => lastInsertValues,
      getLastUpdateSet: () => lastUpdateSet as Record<string, unknown>,
      reset: () => {
        selectQueue = [];
        insertResult = [];
        updateResult = [];
        lastInsertValues = undefined;
        lastUpdateSet = undefined;
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
import type { RuleSnapshotItem } from "@pipntick/shared";
import { getUserId } from "../../lib/auth";
import { getDefaultAccount } from "../../lib/ensure-account";
import { applyAnswers, isValidDateKey, planRoutes } from "../../routes/plans";

async function buildApp() {
  const app = Fastify();
  await app.register(planRoutes);
  await app.ready();
  return app;
}

const SNAPSHOT: RuleSnapshotItem[] = [
  { text: "Weekly trend", type: "choice", options: ["Up", "Down"], done: false, value: null },
  { text: "SL set", type: "check", options: [], done: false, value: null },
];

function fakePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    accountId: "acct-1",
    planDate: "2026-09-26",
    symbol: "",
    direction: "long",
    grade: null,
    status: "planned",
    rulesSnapshot: SNAPSHOT,
    journalTradeId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  reset();
  vi.mocked(getUserId).mockReturnValue("user-1");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getDefaultAccount).mockResolvedValue({ id: "acct-1" } as any);
});

describe("isValidDateKey", () => {
  it("accepts real calendar dates only", () => {
    expect(isValidDateKey("2026-09-26")).toBe(true);
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("26-09-2026")).toBe(false);
    expect(isValidDateKey(undefined)).toBe(false);
  });
});

describe("applyAnswers", () => {
  it("only takes done/value from the client, never rule text or options", () => {
    const result = applyAnswers(SNAPSHOT, [
      { done: true, value: "Up", text: "Hacked", options: ["Up", "Hacked"] },
      { done: true, value: "ignored" },
    ]);
    expect(result).toEqual({
      snapshot: [
        { text: "Weekly trend", type: "choice", options: ["Up", "Down"], done: false, value: "Up" },
        { text: "SL set", type: "check", options: [], done: true, value: null },
      ],
    });
  });

  it("rejects a choice value that isn't one of the rule's options", () => {
    expect(applyAnswers(SNAPSHOT, [{ done: false, value: "Sideways" }, { done: false, value: null }])).toHaveProperty("error");
  });

  it("rejects answers whose length doesn't match the snapshot", () => {
    expect(applyAnswers(SNAPSHOT, [{ done: true, value: null }])).toHaveProperty("error");
  });
});

describe("GET /api/plans", () => {
  it("returns 401 without an authenticated user", async () => {
    vi.mocked(getUserId).mockReturnValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/plans?from=2026-09-20&to=2026-09-26" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 without a valid date range", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/plans?from=2026-09-20" });
    expect(res.statusCode).toBe(400);
  });

  it("returns the plans in range", async () => {
    queueSelect([fakePlan()]);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/plans?from=2026-09-20&to=2026-09-26" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });
});

describe("POST /api/plans", () => {
  it("snapshots the account's current rules into the new plan", async () => {
    queueSelect([
      { text: "Weekly trend", type: "choice", options: ["Up", "Down"], position: 0 },
      { text: "SL set", type: "check", options: [], position: 1 },
    ]);
    setInsertResult([fakePlan()]);
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/api/plans", payload: { planDate: "2026-09-26" } });
    expect(res.statusCode).toBe(201);
    expect(getLastInsertValues()).toEqual({ accountId: "acct-1", planDate: "2026-09-26", rulesSnapshot: SNAPSHOT });
  });

  it("returns 400 for a malformed planDate", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/api/plans", payload: { planDate: "tomorrow" } });
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /api/plans/:id", () => {
  it("returns 404 for a plan the caller doesn't own", async () => {
    queueSelect([]);
    const app = await buildApp();
    const res = await app.inject({ method: "PATCH", url: "/api/plans/plan-1", payload: { symbol: "eurusd" } });
    expect(res.statusCode).toBe(404);
  });

  it("upper-cases the symbol and keeps untouched fields", async () => {
    queueSelect([{ plan: fakePlan({ grade: "B" }) }]);
    setUpdateResult([fakePlan({ symbol: "EURUSD", grade: "B" })]);
    const app = await buildApp();
    const res = await app.inject({ method: "PATCH", url: "/api/plans/plan-1", payload: { symbol: " eurusd " } });
    expect(res.statusCode).toBe(200);
    expect(getLastUpdateSet()).toMatchObject({ symbol: "EURUSD", grade: "B", status: "planned", rulesSnapshot: SNAPSHOT });
  });

  it("refuses to log a plan that has no grade", async () => {
    queueSelect([{ plan: fakePlan() }]);
    const app = await buildApp();
    const res = await app.inject({ method: "PATCH", url: "/api/plans/plan-1", payload: { status: "logged" } });
    expect(res.statusCode).toBe(400);
  });

  it("rejects linking a trade from another account", async () => {
    queueSelect([{ plan: fakePlan({ grade: "A" }) }], []);
    const app = await buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/api/plans/plan-1",
      payload: { status: "logged", journalTradeId: "trade-elsewhere" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("logs a graded plan and links its journal trade", async () => {
    queueSelect([{ plan: fakePlan({ grade: "A" }) }], [{ id: "trade-1" }]);
    setUpdateResult([fakePlan({ grade: "A", status: "logged", journalTradeId: "trade-1" })]);
    const app = await buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/api/plans/plan-1",
      payload: { status: "logged", journalTradeId: "trade-1" },
    });
    expect(res.statusCode).toBe(200);
    expect(getLastUpdateSet()).toMatchObject({ status: "logged", journalTradeId: "trade-1" });
  });
});

describe("DELETE /api/plans/:id", () => {
  it("deletes an owned plan", async () => {
    queueSelect([{ plan: fakePlan() }]);
    const app = await buildApp();
    const res = await app.inject({ method: "DELETE", url: "/api/plans/plan-1" });
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 for a plan the caller doesn't own", async () => {
    queueSelect([]);
    const app = await buildApp();
    const res = await app.inject({ method: "DELETE", url: "/api/plans/plan-1" });
    expect(res.statusCode).toBe(404);
  });
});
