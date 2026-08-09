import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerAuth } from "./lib/auth.js";
import { accountRoutes } from "./routes/accounts.js";
import { selfAccountRoutes } from "./routes/account.js";
import { tradeRoutes } from "./routes/trades.js";
import { performanceRoutes } from "./routes/performance.js";
import { screenshotRoutes } from "./routes/screenshot.js";
import { quoteRoutes } from "./routes/quote.js";

// Default 1MB body limit is too small for base64-encoded screenshot uploads.
const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 });

async function start() {
  // Comma-separated so the same web app served from multiple origins (e.g. apex + www) can
  // both call the API without a code change — CORS_ORIGIN=https://a.com,https://b.com.
  const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  await app.register(cors, {
    origin: corsOrigins,
  });

  app.get("/health", async () => ({ status: "ok" }));

  // Auth is only required inside this scope, so /health stays up even
  // without Clerk keys configured.
  await app.register(async (api) => {
    await registerAuth(api);
    await api.register(accountRoutes);
    await api.register(selfAccountRoutes);
    await api.register(tradeRoutes);
    await api.register(performanceRoutes);
    await api.register(screenshotRoutes);
    await api.register(quoteRoutes);
  });

  try {
    await app.listen({ port: Number(process.env.PORT) || 3001, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
