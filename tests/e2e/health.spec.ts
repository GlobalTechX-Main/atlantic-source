import { test, expect } from "@playwright/test";

test.describe("System Health & Foundation E2E", () => {
  test("homepage loads with AtlanticSource title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AtlanticSource/);
    await expect(page.locator("h1")).toContainText("AtlanticSource");
  });

  test("health check API endpoint responds with valid status JSON", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.services.database.status).toBe("healthy");
  });
});
