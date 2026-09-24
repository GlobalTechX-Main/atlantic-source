import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().default("postgresql://atlanticsource:atlanticsource_secret@localhost:5432/atlanticsource_db?schema=public"),
  NEXTAUTH_SECRET: z.string().default("default_secret_must_be_at_least_32_characters_long_for_security"),
  NEXTAUTH_URL: z.string().url().optional(),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().default("us-east-1"),
  STORAGE_BUCKET: z.string().default("atlanticsource-uploads"),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["development", "resend", "smtp"]).default("development"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default("noreply@atlanticsource.ca"),
  SMOKE_TEST_SUPPLIER_EMAIL_1: z.string().email().optional(),
  SMOKE_TEST_SUPPLIER_EMAIL_2: z.string().email().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  // "true" lets low-risk crawled facts publish without an admin. Off by default (AGENTS.md rule 4).
  AUTO_PUBLISH_LOW_RISK_FACTS: z.enum(["true", "false"]).default("false"),
  // Optional AI second opinion on facts the rules leave for review (see AGENTS.md rule 6).
  AI_REVIEW_ENABLED: z.enum(["true", "false"]).default("false"),
  OPENAI_API_KEY: z.string().optional(),
  AI_REVIEW_MODEL: z.string().default("gpt-4o-mini"),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:", result.error.format());
    if (process.env.NODE_ENV === "test" || process.env.NEXT_PHASE === "phase-production-build") {
      return {
        NODE_ENV: process.env.NODE_ENV === "test" ? "test" : "production",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        DATABASE_URL: process.env.DATABASE_URL || "postgresql://atlanticsource:atlanticsource_secret@localhost:5432/atlanticsource_db?schema=public",
        NEXTAUTH_SECRET: "default_secret_must_be_at_least_32_characters_long_for_security",
        NEXTAUTH_URL: "http://localhost:3000",
        STORAGE_REGION: "us-east-1",
        STORAGE_BUCKET: "atlanticsource-uploads",
        EMAIL_FROM: "noreply@atlanticsource.ca",
        EMAIL_PROVIDER: "development",
        LOG_LEVEL: "silent",
        AUTO_PUBLISH_LOW_RISK_FACTS: "false",
        AI_REVIEW_ENABLED: "false",
        AI_REVIEW_MODEL: "gpt-4o-mini",
      };
    }
    throw new Error("Invalid environment configuration");
  }
  return result.data;
}

export const env = parseEnv();
