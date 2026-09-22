import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL || "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "password",
    "token",
    "secret",
  ],
  base: {
    env: env.NODE_ENV,
    service: "atlanticsource-web",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
