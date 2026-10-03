import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/auth", () => ({ getUserId: vi.fn() }));

import Fastify from "fastify";
import { getUserId } from "../../lib/auth";
import { clearCandleCache } from "../../lib/market-data";
import { candleRoutes } from "../../routes/candles";

async function buildApp() {
  const app = Fastify();
  await app.register(candleRoutes);
  await app.ready();
  return app;
}

const recentEntry = () => new Date(Date.now() - 2 * 86_400_000).toISOString();
const recentExit = () => new Date(Date.now() - 2 * 86_400_000 + 3_600_000).toISOString();

function yahooResponse(ok = true) {
  return {
    ok,
    status: ok ? 200 : 503,
    json: async () => ({
      chart: { result: [{ timestamp: [1000, 1300], indicators: { quote: [{ open: [1, 2], high: [2, 3], low: [0.5, 1.5], close: [1.5, 2.5] }] } }] },
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  clearCandleCache();
  vi.mocked(getUserId).mockReturnValue("user-1");
});
afterEach(() => vi.unstubAllGlobals());

describe("GET /api/candles", () => {
  it("returns 401 without an authenticated user", async () => {
    vi.mocked(getUserId).mockReturnValue(null);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/candles?symbol=MES&entry=${recentEntry()}` });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for a symbol with no data source", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/candles?symbol=${encodeURIComponent("??")}&entry=${recentEntry()}` });
    expect(res.statusCode).toBe(404);
  });

  it("validates the interval and refuses trades older than any free history", async () => {
    const app = await buildApp();
    const bad = await app.inject({ method: "GET", url: `/api/candles?symbol=MES&entry=${recentEntry()}&interval=1m` });
    expect(bad.statusCode).toBe(400);
    const ancient = new Date(Date.now() - 1000 * 86_400_000).toISOString();
    const tooOld = await app.inject({ method: "GET", url: `/api/candles?symbol=MES&entry=${ancient}&interval=4h` });
    expect(tooOld.statusCode).toBe(400);
  });

  it("falls back to a coarser interval for an older trade", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(yahooResponse()));
    const app = await buildApp();
    const yearOld = new Date(Date.now() - 400 * 86_400_000).toISOString();
    const yearOldExit = new Date(Date.now() - 400 * 86_400_000 + 3_600_000).toISOString();
    const res = await app.inject({ method: "GET", url: `/api/candles?symbol=MES&entry=${yearOld}&exit=${yearOldExit}&interval=15m` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ interval: "1h", allowedIntervals: ["1h", "4h"] });
  });

  it("fetches candles from the continuous contract for a micro future", async () => {
    const fetchMock = vi.fn().mockResolvedValue(yahooResponse());
    vi.stubGlobal("fetch", fetchMock);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/candles?symbol=MES&entry=${recentEntry()}&exit=${recentExit()}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ symbol: "MES", ticker: "ES=F", interval: "15m", approximate: false });
    expect(body.candles).toHaveLength(2);
    expect(fetchMock.mock.calls[0][0]).toContain("ES%3DF");
  });

  it("returns 502 when the data source fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(yahooResponse(false)));
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/candles?symbol=MES&entry=${recentEntry()}&exit=${recentExit()}` });
    expect(res.statusCode).toBe(502);
  });
});
