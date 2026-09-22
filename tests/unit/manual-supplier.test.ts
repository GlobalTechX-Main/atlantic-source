import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { UserRoleEnum } from "@prisma/client";
import { UserSession, setTestSessionOverride } from "@/lib/auth/session";
import { createManualSupplier, CreateManualSupplierSchema } from "@/lib/admin/ingestion";
import { createManualSupplierAction } from "@/lib/actions/suppliers";

describe("Manual Supplier Creation & RBAC Guards", () => {
  const platformAdmin: UserSession = {
    id: "usr_admin_1",
    email: "admin@atlanticsource.ca",
    isPlatformAdmin: true,
    buyerMemberships: [],
    supplierMemberships: [],
  };

  const regularUser: UserSession = {
    id: "usr_buyer_1",
    email: "buyer@construction.ca",
    isPlatformAdmin: false,
    buyerMemberships: [{ buyerOrganizationId: "org_buyer_1", role: UserRoleEnum.BUYER_MEMBER }],
    supplierMemberships: [],
  };

  beforeEach(() => {
    setTestSessionOverride(undefined);
  });

  afterEach(() => {
    setTestSessionOverride(undefined);
  });

  // 1. Zod Schema Validation Tests
  it("rejects invalid URLs in CreateManualSupplierSchema", () => {
    const invalidUrlInput = {
      companyName: "Moncton Machine Shop",
      websiteUrl: "not-a-valid-url",
      city: "Moncton",
    };
    const result = CreateManualSupplierSchema.safeParse(invalidUrlInput);
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields (empty company name or missing city)", () => {
    const missingNameInput = {
      companyName: "   ",
      websiteUrl: "https://monctonmachine.ca",
      city: "Moncton",
    };
    const result = CreateManualSupplierSchema.safeParse(missingNameInput);
    expect(result.success).toBe(false);
  });

  it("rejects invalid public email format", () => {
    const invalidEmailInput = {
      companyName: "Moncton Machine Shop",
      websiteUrl: "https://monctonmachine.ca",
      city: "Moncton",
      publicEmail: "not-an-email-address",
    };
    const result = CreateManualSupplierSchema.safeParse(invalidEmailInput);
    expect(result.success).toBe(false);
  });

  it("accepts valid manual supplier input", () => {
    const validInput = {
      companyName: "Fredericton Precision Hydraulics",
      websiteUrl: "https://frederictonhydraulics.ca",
      city: "Fredericton",
      publicPhone: "506-555-0188",
      publicEmail: "contact@frederictonhydraulics.ca",
      category: "Machining",
    };
    const result = CreateManualSupplierSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  // 2. Server-side Platform Admin Authorization Guard
  it("allows real platform admin to create manual supplier", async () => {
    const validInput = {
      companyName: "Saint John Welding Specialists",
      websiteUrl: "https://saintjohnwelding.ca",
      city: "Saint John",
      publicPhone: "506-555-4433",
      category: "Welding",
    };

    const result = await createManualSupplier(validInput, platformAdmin);
    expect(result.success).toBe(true);
    expect(result.supplierId).toBeDefined();
  });

  it("rejects normal authenticated user (isPlatformAdmin = false) attempting to create supplier", async () => {
    const validInput = {
      companyName: "Unauthorized Supplier Creation",
      websiteUrl: "https://unauthorized.ca",
      city: "Fredericton",
    };

    const result = await createManualSupplier(validInput, regularUser);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unauthorized");
  });

  it("rejects unauthenticated (null session) attempts to create manual supplier", async () => {
    const validInput = {
      companyName: "Unauthenticated Supplier",
      websiteUrl: "https://unauth.ca",
      city: "Moncton",
    };

    const result = await createManualSupplier(validInput, null);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unauthorized");
  });

  // 3. Server Action Session Resolution & Client Spoofing Security Tests
  it("allows real platform admin via Server Action when session resolves to platform admin", async () => {
    setTestSessionOverride(platformAdmin);
    const validInput = {
      companyName: "Authorized Server Action Supplier",
      websiteUrl: "https://authaction.ca",
      city: "Saint John",
    };

    const result = await createManualSupplierAction(validInput);
    expect(result.success).toBe(true);
    expect(result.supplierId).toBeDefined();
  });

  it("rejects normal user via Server Action even if client-side payload contains spoofed admin flags", async () => {
    setTestSessionOverride(regularUser);
    const spoofedInput = {
      companyName: "Spoofed Client Request",
      websiteUrl: "https://spoofed.ca",
      city: "Fredericton",
      // Attacker attempts to pass spoofed admin flag in request body
      isPlatformAdmin: true,
    } as unknown as Parameters<typeof createManualSupplierAction>[0];

    const result = await createManualSupplierAction(spoofedInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unauthorized");
  });

  it("rejects unauthenticated user via Server Action", async () => {
    setTestSessionOverride(null);
    const validActionInput = {
      companyName: "Unauthenticated Server Action Request",
      websiteUrl: "https://unauthaction.ca",
      city: "Moncton",
    };

    const result = await createManualSupplierAction(validActionInput);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unauthorized");
  });

  // 4. Duplicate Submission Guard
  it("prevents duplicate supplier submissions with identical domain or name", async () => {
    const duplicateInput = {
      companyName: "DUPLICATE_NAME_TEST",
      websiteUrl: "https://duplicate.com",
      city: "Fredericton",
    };

    const result = await createManualSupplier(duplicateInput, platformAdmin);
    expect(result.success).toBe(false);
    expect(result.duplicateSkipped).toBe(true);
  });
});
