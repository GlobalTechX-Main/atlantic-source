/**
 * Database safety guard to isolate test environments from touching production / dev databases.
 */
export function assertTestDatabase(dbUrl?: string): void {
  const nodeEnv = process.env.NODE_ENV;
  const url = dbUrl || process.env.DATABASE_URL || "";

  if (nodeEnv === "test") {
    // In test environment, target DB MUST explicitly be 'atlanticsource_test_db'
    const isExplicitTestDb = url.includes("atlanticsource_test_db");

    if (!isExplicitTestDb) {
      throw new Error(
        `SAFETY GUARD TRIGGERED: Test suite attempted to run against non-test database! Target URL: "${url}". ` +
        `Tests must explicitly target 'atlanticsource_test_db'.`
      );
    }
  }
}
