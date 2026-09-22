import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://atlanticsource:atlanticsource_secret@127.0.0.1:5433/atlanticsource_test_db?schema=public",
      NEXTAUTH_SECRET: "test_secret_must_be_at_least_32_characters_long_for_security",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
