import { PrismaClient } from "@prisma/client";
import { env } from "./env";

/**
 * Single shared PrismaClient instance.
 *
 * In development, `tsx watch` reloads the module on every file change.
 * Without this guard, each reload would create a NEW PrismaClient and
 * exhaust the database connection pool. We stash the instance on a global
 * so reloads reuse the same client.
 *
 * Never instantiate PrismaClient anywhere else (CLAUDE.md).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Verbose query logging in development only.
    log:
      env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
