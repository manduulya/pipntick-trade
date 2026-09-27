import { beforeEach, describe, expect, it, vi } from "vitest";

// Same fake chainable drizzle builder as trades.route.test.ts, plus `transaction` (which just runs
// the callback against the same fake) and a delete-call counter.
const { mockDb, setSelectResult, setInsertResult, getLastInsertValues, getDeleteCount, resetCaptures } = vi.hoisted(() => {
  function makeChain(getResult: () => unknown, onCapture?: (args: unknown) => void) {
    const chain: Record<string, unknown> = {};
    for (const method of ["from", "where", "orderBy", "innerJoin", "limit"]) {
      chain[method] = () => chain;
    }
    chain.values = (args: unknown) => {
      onCapture?.(args);
      return chain;
    };
    chain.returning = () => Promise.resolve(getResult());
    chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(getResult()).then(onFulfilled, onRejected);
    return chain;
  }

  let selectResult: unknown[] = [];
  let insertResult: unknown[] = [];
  let lastInsertValues: unknown;
  let deleteCount = 0;

  const mockDb: Record<string, unknown> = {
    select: () => makeChain(() => selectResult),
    insert: () => makeChain(() => insertResult, (v) => (lastInsertValues = v)),
    delete: () => {
      deleteCount++;
      return makeChain(() => undefined);
    },
  };
  mockDb.transaction = (fn: (tx: unknown) => unknown) => fn(mockDb);

  return {
    mockDb,
    setSelectResult: (r: unknown[]) => (selectResult = r),
    setInsertResult: (r: unknown[]) => (insertResult = r),
    getLastInsertValues: () => lastInsertValues,
    getDeleteCount: () => deleteCount,
    resetCaptures: () => {
      lastInsertValues = undefined;
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
import { getDefaultAccount } from "../../lib/ensure-account";
import { normalizeRules, ruleRoutes } from "../../routes/rules";

async function buildApp() {
  const app = Fastify();
  await app.register(ruleRoutes);
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  setSelectResult([]);
  setInsertResult([]);
  resetCaptures();
  vi.mocked(getUserId).mockReturnValue("user-1");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getDefaultAccount).mockResolvedValue({ id: "acct-1" } as any);
});

describe("normalizeRules", () => {
  it("drops rules with empty text and strips options from checks", () => {
    const result = normalizeRules([
      { text: "  Risk is 1% or less ", type: "check", options: ["x"] },
      { text: "   ", type: "check", options: [] },
      { text: "Weekly trend", type: "choice", options: ["Up", " Down ", "Up", ""] },
    ]);
    expect(result).toEqual({
      rules: [
        { text: "Risk is 1% or less", type: "check", options: [] },
        { text: "Weekly trend", type: "choice", options: ["Up", "Down"] },
      ],
    });
  });

  it("rejects a choice rule with fewer than two distinct options", () => {
    const result = normalizeRules([{ text: "Trend", type: "choice", options: ["Up", "Up"] }]);
    expect(result).toHaveProperty("error");
  });

  it("rejects an unknown rule type and a non-array body", () => {
    expect(normalizeRules([{ text: "A", type: "slider", options: [] }])).toHaveProperty("error");
    expect(normalizeRules({ text: "A" })).toHaveProperty("error");
  });
});

describe("GET /api/rules", () => {
  it("returns 401 without an authenticated user", async () => {
    vi.mocked(getUserId).mockReturnValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/rules" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for an account the caller doesn't own", async () => {
    setSelectResult([]); // ownership lookup finds nothing
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/rules?accountId=someone-else" });
    expect(res.statusCode).toBe(404);
  });

  it("returns the default account's rules", async () => {
    setSelectResult([{ id: "r1", text: "SL set", type: "check", options: [], position: 0 }]);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/rules" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });
});

describe("PUT /api/rules", () => {
  it("replaces the rule set, dropping empty rules and numbering positions in order", async () => {
    setInsertResult([
      { id: "r2", position: 1, text: "B", type: "check", options: [] },
      { id: "r1", position: 0, text: "A", type: "check", options: [] },
    ]);
    const app = await buildApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/rules",
      payload: [
        { text: "A", type: "check", options: [] },
        { text: "", type: "check", options: [] },
        { text: "B", type: "check", options: [] },
      ],
    });
    expect(res.statusCode).toBe(200);
    expect(getDeleteCount()).toBe(1);
    expect(getLastInsertValues()).toEqual([
      { accountId: "acct-1", position: 0, text: "A", type: "check", options: [] },
      { accountId: "acct-1", position: 1, text: "B", type: "check", options: [] },
    ]);
    expect(res.json().map((r: { id: string }) => r.id)).toEqual(["r1", "r2"]);
  });

  it("clears the set without inserting when every rule is empty", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "PUT", url: "/api/rules", payload: [{ text: " ", type: "check", options: [] }] });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    expect(getLastInsertValues()).toBeUndefined();
  });

  it("returns 400 for an invalid rule", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "PUT", url: "/api/rules", payload: [{ text: "Trend", type: "choice", options: ["Up"] }] });
    expect(res.statusCode).toBe(400);
  });
});
