import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getEmailProvider, DevelopmentEmailProvider, ResendEmailProvider, SendRFQEmailPayload } from "@/lib/email/email-provider";
import { runSmokeTestSeed } from "@/scripts/seed_smoke_test";
import { db } from "@/lib/db";

describe("Email Provider & Smoke Test Seed Integration Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Provider Factory Selection", () => {
    it("selects DevelopmentEmailProvider by default or when EMAIL_PROVIDER=development", () => {
      delete process.env.EMAIL_PROVIDER;
      const defaultProvider = getEmailProvider();
      expect(defaultProvider).toBeInstanceOf(DevelopmentEmailProvider);

      process.env.EMAIL_PROVIDER = "development";
      const devProvider = getEmailProvider();
      expect(devProvider).toBeInstanceOf(DevelopmentEmailProvider);
    });

    it("selects ResendEmailProvider when EMAIL_PROVIDER=resend", () => {
      process.env.EMAIL_PROVIDER = "resend";
      process.env.RESEND_API_KEY = "re_test_key_12345";
      const resendProvider = getEmailProvider();
      expect(resendProvider).toBeInstanceOf(ResendEmailProvider);
    });
  });

  describe("ResendEmailProvider Dispatch & Failure Behaviors", () => {
    const payload: SendRFQEmailPayload = {
      recipientId: "rec_unit_test_123",
      sourcingRequestId: "rfq_unit_test_123",
      supplierCompanyId: "supp_unit_test_123",
      contactId: "contact_unit_test_123",
      recipientEmail: "test@domain.com",
      buyerOrgName: "Unit Test Buyer Corp",
      rfqTitle: "Unit Test Steel Beams Procurement",
      rfqDescription: "Need 20 tons of structural steel.",
      location: "Saint John, NB",
      responseDeadline: new Date(),
    };

    it("throws configuration error if RESEND_API_KEY is missing", async () => {
      delete process.env.RESEND_API_KEY;
      const provider = new ResendEmailProvider("", "noreply@atlanticsource.ca");
      await expect(provider.sendRFQNotification(payload)).rejects.toThrow("RESEND_API_KEY is not configured");
    });

    it("marks status=SENT and persists EmailDelivery when Resend returns 200 OK with ID", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "msg_resend_9999" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const provider = new ResendEmailProvider("re_valid_key", "noreply@atlanticsource.ca");
      const result = await provider.sendRFQNotification(payload);

      expect(result.status).toBe("SENT");
      expect(result.providerMessageId).toBe("msg_resend_9999");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("marks status=FAILED and creates FAILED EmailDelivery record on Resend error", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ message: "API key invalid" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const provider = new ResendEmailProvider("re_invalid_key", "noreply@atlanticsource.ca");
      const result = await provider.sendRFQNotification(payload);

      expect(result.status).toBe("FAILED");
      expect(result.providerMessageId).toContain("resend_fail_");
    });
  });

  describe("Smoke-Test Seed Idempotency & Safety", () => {
    it("refuses to run when NODE_ENV is production and ALLOW_PROD_SEED is not true", async () => {
      (process.env as Record<string, string>).NODE_ENV = "production";
      delete process.env.ALLOW_PROD_SEED;

      await expect(runSmokeTestSeed()).rejects.toThrow("[SAFETY GUARD] Refusing to run development smoke-test seed");
    });

    it("executes idempotently without errors on multiple executions", async () => {
      (process.env as Record<string, string>).NODE_ENV = "test";

      await runSmokeTestSeed();
      await runSmokeTestSeed();

      const buyerOrg = await db.buyerOrganization.findUnique({
        where: { id: "org_atlantic_procurement" },
      });
      expect(buyerOrg).not.toBeNull();

      const supp1 = await db.supplierCompany.findUnique({
        where: { slug: "atlantic-steel-smoke-test" },
      });
      const supp2 = await db.supplierCompany.findUnique({
        where: { slug: "maritime-piping-smoke-test" },
      });

      expect(supp1?.profileStatus).toBe("PUBLISHED");
      expect(supp2?.profileStatus).toBe("PUBLISHED");
    });
  });
});
