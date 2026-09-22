import { PrismaClient } from "@prisma/client";
import { env } from "./env";
import { assertTestDatabase } from "./db/safety-guard";

assertTestDatabase(env.DATABASE_URL);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export const prisma = db;

