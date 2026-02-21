import { test, expect, ADMIN_PASSWORD, REVIEWER_PASSWORD } from "./fixtures";

test.describe("Admin Authentication", () => {
  test("shows login form at /admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("h1")).toHaveText("Admin Console");
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText("Sign In");
  });

  test("logs in with correct password", async ({ page }) => {
    await page.goto("/admin");
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".admin-sidebar")).toBeVisible();
    await expect(page.locator(".admin-logo h2")).toHaveText("Ohio Claims");
  });

  test("shows error with wrong password", async ({ page }) => {
    await page.goto("/admin");
    await page.locator('input[type="password"]').fill("wrong-password");
    await page.locator('button[type="submit"]').click();

    await expect(page.locator(".pipeline-error")).toHaveText(
      "Invalid credentials"
    );
  });

  test("can sign out", async ({ page }) => {
    await page.goto("/admin");
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".admin-sidebar")).toBeVisible();
    await page.locator('button:has-text("Sign Out")').click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});

test.describe("Reviewer Authentication", () => {
  test("shows login form at /reviewer", async ({ page }) => {
    await page.goto("/reviewer");
    await expect(page.locator("h2")).toContainText("Senior Reviewer");
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText("Sign In");
  });

  test("logs in with correct password", async ({ page }) => {
    await page.goto("/reviewer");
    await page.locator('input[type="password"]').fill(REVIEWER_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".admin-sidebar")).toBeVisible();
    await expect(page.locator(".admin-logo")).toContainText("Senior Reviewer");
  });

  test("shows error with wrong password", async ({ page }) => {
    await page.goto("/reviewer");
    await page.locator('input[type="password"]').fill("wrong-password");
    await page.locator('button[type="submit"]').click();

    await expect(page.locator(".pipeline-error")).toHaveText(
      "Invalid credentials"
    );
  });

  test("can sign out", async ({ page }) => {
    await page.goto("/reviewer");
    await page.locator('input[type="password"]').fill(REVIEWER_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".admin-sidebar")).toBeVisible();
    await page.locator('button:has-text("Sign Out")').click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});
