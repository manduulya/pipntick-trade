import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/fastify";
import { db, users } from "@pipntick/db";
import { getUserId, DEV_AUTH_BYPASS } from "../lib/auth";

export async function selfAccountRoutes(app: FastifyInstance) {
  app.delete("/api/account", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    await db.delete(users).where(eq(users.id, userId));

    if (!DEV_AUTH_BYPASS) {
      await clerkClient.users.deleteUser(userId);
    }

    return reply.code(204).send();
  });
}
