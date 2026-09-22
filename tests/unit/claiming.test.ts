import { describe, it, expect, beforeEach } from "vitest";
import { initiateCompanyClaim, verifyDomainClaimToken, mockTokenStore } from "@/lib/supplier/claiming";

describe("Company Claiming & Domain Verification Engine", () => {
  beforeEach(() => {
    mockTokenStore.clear();
  });

  it("generates automated domain match token when email domain matches company website", async () => {
    const res = await initiateCompanyClaim({
      supplierCompanyId: "comp_saint_john_steel",
      requestingUserId: "usr_claimant_1",
      userEmail: "john@saintjohnsteel.example.com",
    });

    expect(res.method).toBe("EMAIL_DOMAIN");
    expect(res.status).toBe("PENDING");
    expect(res.rawToken).toBeDefined();
    expect(res.rawToken!.length).toBe(64); // 32 bytes hex
  });

  it("routes free-mail providers (e.g. gmail.com) to manual admin review path", async () => {
    const res = await initiateCompanyClaim({
      supplierCompanyId: "comp_saint_john_steel",
      requestingUserId: "usr_claimant_2",
      userEmail: "owner@gmail.com",
    });

    expect(res.method).toBe("DOCUMENT_PROOF");
    expect(res.status).toBe("PENDING");
    expect(res.rawToken).toBeUndefined();
    expect(res.message).toContain("public free-mail providers");
  });

  it("routes domain mismatches to manual admin review path", async () => {
    const res = await initiateCompanyClaim({
      supplierCompanyId: "comp_saint_john_steel",
      requestingUserId: "usr_claimant_3",
      userEmail: "sales@unrelateddomain.ca",
    });

    expect(res.method).toBe("DOCUMENT_PROOF");
    expect(res.status).toBe("PENDING");
    expect(res.rawToken).toBeUndefined();
  });

  it("successfully verifies valid domain token and consumes it", async () => {
    const claimRes = await initiateCompanyClaim({
      supplierCompanyId: "comp_saint_john_steel",
      requestingUserId: "usr_claimant_1",
      userEmail: "john@saintjohnsteel.example.com",
    });

    const verifyRes = await verifyDomainClaimToken(claimRes.rawToken!);
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.supplierCompanyId).toBe("comp_saint_john_steel");
    expect(verifyRes.userId).toBe("usr_claimant_1");
  });

  it("rejects token replay attacks (token cannot be reused twice)", async () => {
    const claimRes = await initiateCompanyClaim({
      supplierCompanyId: "comp_saint_john_steel",
      requestingUserId: "usr_claimant_1",
      userEmail: "john@saintjohnsteel.example.com",
    });

    // First use: success
    await verifyDomainClaimToken(claimRes.rawToken!);

    // Replay attempt: must fail
    await expect(verifyDomainClaimToken(claimRes.rawToken!)).rejects.toThrow(
      "already been used"
    );
  });

  it("rejects expired verification tokens", async () => {
    const claimRes = await initiateCompanyClaim({
      supplierCompanyId: "comp_saint_john_steel",
      requestingUserId: "usr_claimant_1",
      userEmail: "john@saintjohnsteel.example.com",
    });

    // Manually expire token in mock store
    const crypto = await import("crypto");
    const tokenHash = crypto.createHash("sha256").update(claimRes.rawToken!).digest("hex");
    const record = mockTokenStore.get(tokenHash);
    if (record) {
      record.expiresAt = new Date(Date.now() - 1000); // 1 second in past
    }

    await expect(verifyDomainClaimToken(claimRes.rawToken!)).rejects.toThrow(
      "has expired"
    );
  });
});
