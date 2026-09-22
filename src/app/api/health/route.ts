import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "healthy";
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch (error) {
    dbStatus = "unhealthy";
    logger.error({ error }, "Health check database query failed");
  }

  const isHealthy = dbStatus === "healthy";
  const statusCode = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      totalLatencyMs: Date.now() - startTime,
      services: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
      },
      environment: process.env.NODE_ENV || "development",
    },
    { status: statusCode }
  );
}
