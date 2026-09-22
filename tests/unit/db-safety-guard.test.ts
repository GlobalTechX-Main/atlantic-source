import { describe, it, expect } from "vitest";
import { assertTestDatabase } from "@/lib/db/safety-guard";

describe("Database Safety Guard", () => {
  it("allows valid test database URLs in test mode", () => {
    expect(() =>
      assertTestDatabase("postgresql://atlanticsource:secret@127.0.0.1:5432/atlanticsource_test_db?schema=public")
    ).not.toThrow();
  });

  it("blocks main database on port 5433 in test mode", () => {
    expect(() =>
      assertTestDatabase("postgresql://atlanticsource:secret@127.0.0.1:5433/atlanticsource_db?schema=public")
    ).toThrow(/SAFETY GUARD TRIGGERED/);
  });

  it("blocks main database on port 5432 in test mode", () => {
    expect(() =>
      assertTestDatabase("postgresql://atlanticsource:secret@127.0.0.1:5432/atlanticsource_db?schema=public")
    ).toThrow(/SAFETY GUARD TRIGGERED/);
  });
});
