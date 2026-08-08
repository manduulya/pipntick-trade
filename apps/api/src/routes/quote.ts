import type { FastifyInstance } from "fastify";
import type { Quote } from "@pipntick/shared";
import { getUserId } from "../lib/auth";

const MIN_LENGTH = 40;
const MAX_LENGTH = 140;

type ZenQuote = { q: string; a: string };

// Fetched server-side (not from the browser) because zenquotes.io doesn't send
// Access-Control-Allow-Origin, so a direct client fetch would be blocked by CORS.
export async function quoteRoutes(app: FastifyInstance) {
  app.get("/api/quote", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    try {
      const res = await fetch("https://zenquotes.io/api/quotes");
      if (!res.ok) throw new Error(`zenquotes responded ${res.status}`);
      const quotes = (await res.json()) as ZenQuote[];

      const candidates = quotes.filter((q) => q.q.length >= MIN_LENGTH && q.q.length <= MAX_LENGTH);
      const pool = candidates.length ? candidates : quotes;
      if (!pool.length) throw new Error("empty quote list");

      const picked = pool[Math.floor(Math.random() * pool.length)];
      const quote: Quote = { content: picked.q, author: picked.a };
      return quote;
    } catch (err) {
      request.log.error(err, "failed to fetch quote");
      return reply.code(502).send({ error: "Failed to fetch quote." });
    }
  });
}
