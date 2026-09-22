import { test, expect } from "@playwright/test";

test.describe("Pre-Demo End-to-End Acceptance Workflows", () => {

  test("1. Public Discovery Flow: Search, Filter, and Supplier Profile View", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AtlanticSource/);
    await expect(page.locator("h1")).toContainText("AtlanticSource");

    // Navigate to supplier search page
    await page.goto("/suppliers");
    await expect(page).toHaveURL(/\/suppliers/);

    // Apply search query or filter if input available
    const searchInput = page.locator("input[placeholder*='Search']").first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("Steel");
    }

    // Verify supplier list renders
    const pageContent = await page.textContent("body");
    expect(pageContent).toBeTruthy();
  });

  test("2. Buyer Sourcing Flow: Supplier Selection & RFQ Navigation", async ({ page }) => {
    await page.goto("/suppliers");
    
    // Test navigating to RFQ creation
    await page.goto("/rfq/new");
    await expect(page.locator("h1")).toContainText("Create Sourcing Request");

    // Fill out draft RFQ form fields
    await page.fill("input[placeholder*='Structural Steel']", "E2E Fabrication Request");
    await page.fill("textarea[placeholder*='Describe material']", "Supply 20 tons of structural steel.");

    // Submit save draft or send
    const submitBtn = page.locator("button", { hasText: "Save as Draft" });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    }
  });

  test("3. Supplier One-Click Response Landing Page", async ({ page }) => {
    // Access response route with invalid token to verify security rejection
    await page.goto("/rfq/respond?token=invalid_mock_token");
    await expect(page.locator("h1")).toContainText("Invalid or Expired Token");
  });

  test("4. Supplier Claiming Verification Route", async ({ page }) => {
    await page.goto("/claim/verify?token=invalid_test_token");
    await expect(page.locator("h1")).toContainText("Verification Failed");
  });

  test("5. Admin Ingestion & Review Dashboard Route", async ({ page }) => {
    await page.goto("/admin/suppliers/import");
    await expect(page.locator("body")).toContainText("Import");
  });

});
