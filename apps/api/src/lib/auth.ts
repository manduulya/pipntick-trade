import type { FastifyInstance, FastifyRequest } from "fastify";
import { clerkPlugin, getAuth } from "@clerk/fastify";

// Local dev only: without a real Clerk secret key there's no way to verify a
// session, so every request is attributed to a fixed dev user instead of
// registering clerkPlugin (which would otherwise throw on every request).
// In any real deployment CLERK_SECRET_KEY is set, so this branch never runs.
export const DEV_AUTH_BYPASS = !process.env.CLERK_SECRET_KEY;
const DEV_USER_ID = process.env.DEV_USER_ID ?? "user_dev_001";

declare module "fastify" {
  interface FastifyRequest {
    devUserId?: string;
  }
}

export async function registerAuth(app: FastifyInstance) {
  if (DEV_AUTH_BYPASS) {
    app.log.warn(
      `CLERK_SECRET_KEY not set - using DEV_USER_ID ("${DEV_USER_ID}") auth bypass for local development. Set CLERK_SECRET_KEY to use real auth.`,
    );
    app.addHook("onRequest", async (request) => {
      request.devUserId = DEV_USER_ID;
    });
    return;
  }
  await app.register(clerkPlugin);
}

export function getUserId(request: FastifyRequest): string | null {
  if (DEV_AUTH_BYPASS) return request.devUserId ?? null;
  return getAuth(request).userId ?? null;
}
