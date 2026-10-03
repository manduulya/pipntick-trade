import type { FastifyInstance } from "fastify";
import type { CandleInterval, CandlesResponse } from "@pipntick/shared";
import { CANDLE_INTERVALS } from "@pipntick/shared";
import { getUserId } from "../lib/auth.js";
import { MarketDataError, allowedIntervals, fetchCandles, pickWindow, toYahooTicker } from "../lib/market-data.js";

// Candles around one trade for the Trade Review chart. Auth-required so this can't be used as an
// open proxy to the data source. `entry`/`exit` are real UTC instants — the client converts the
// trade's broker wall-clock times with the account's timezone before calling.
export async function candleRoutes(app: FastifyInstance) {
  app.get("/api/candles", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const q = request.query as { symbol?: string; entry?: string; exit?: string; interval?: string };
    if (!q.symbol || !q.entry) return reply.code(400).send({ error: "symbol and entry are required" });

    const now = Date.now();
    const entryMs = Date.parse(q.entry);
    const exitMs = q.exit ? Date.parse(q.exit) : now;
    if (Number.isNaN(entryMs) || Number.isNaN(exitMs) || exitMs < entryMs) {
      return reply.code(400).send({ error: "entry/exit must be ISO times with exit after entry" });
    }

    const interval = (q.interval ?? "15m") as CandleInterval;
    if (!CANDLE_INTERVALS.includes(interval)) {
      return reply.code(400).send({ error: `interval must be one of ${CANDLE_INTERVALS.join(", ")}` });
    }

    const info = toYahooTicker(q.symbol);
    if (!info) return reply.code(404).send({ error: `No chart data available for ${q.symbol}` });

    const clampedExit = Math.min(exitMs, now);
    const window = pickWindow(entryMs, clampedExit, now, interval);
    const allowed = allowedIntervals(entryMs, clampedExit, now);
    // Falls back to a coarser interval when the requested one's history doesn't reach the trade;
    // null only when the trade is older than any free intraday history (~2 years).
    if (!window) {
      return reply.code(400).send({ error: "This trade is too old for the free chart data (intraday history goes back about 2 years)." });
    }

    try {
      const candles = await fetchCandles(info.ticker, window, now);
      const body: CandlesResponse = {
        symbol: q.symbol,
        ticker: info.ticker,
        interval: window.interval,
        allowedIntervals: allowed,
        approximate: info.approximate,
        note: info.note ?? null,
        candles,
      };
      return body;
    } catch (err) {
      if (err instanceof MarketDataError) {
        request.log.warn({ err: err.message, ticker: info.ticker }, "candle fetch failed");
        return reply.code(502).send({ error: "Chart data is unavailable right now. Try again in a minute." });
      }
      throw err;
    }
  });
}
