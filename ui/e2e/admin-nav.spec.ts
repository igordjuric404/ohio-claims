import { test, expect, loginAsAdmin } from "./fixtures";
import { seedAgentsViaApi, createTestClaim } from "./helpers";

test.describe("Admin Navigation & Dashboard (R3)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("admin sidebar shows all expected nav items", async ({ page }) => {
    const nav = page.locator(".admin-nav");
    await expect(nav.locator("button")).toHaveCount(6);

    const labels = ["Dashboard", "Claims", "Runs", "Agents", "Audit", "Tests"];
    for (const label of labels) {
      await expect(nav.locator(`button:has-text("${label}")`)).toBeVisible();
    }
  });

  test("admin dashboard (Overview) loads", async ({ page }) => {
    await expect(page.locator(".admin-main")).toBeVisible();
    const statCards = page.locator(".admin-stat");
    const count = await statCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("navigating to Claims page shows claims list", async ({ page }) => {
    await page.locator('.admin-nav button:has-text("Claims")').click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".admin-main")).toContainText("Claims");
    await expect(page.locator(".admin-table").first()).toBeVisible();
  });

  test("navigating to Agents page shows agents list", async ({ page }) => {
    await seedAgentsViaApi();
    await page.locator('.admin-nav button:has-text("Agents")').click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".admin-main")).toContainText("Agent");
  });

  test("navigating to Audit page shows audit view", async ({ page }) => {
    await page.locator('.admin-nav button:has-text("Audit")').click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".admin-main")).toContainText("Audit");
  });
});
