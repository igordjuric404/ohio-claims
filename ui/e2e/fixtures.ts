import { test as base, expect, type Page } from "@playwright/test";

export const ADMIN_PASSWORD = "admin-dev-password";
export const REVIEWER_PASSWORD = "reviewer-dev-password";

async function seedAgents(page: Page) {
  const resp = await page.request.post("/api/admin/agents/seed");
  if (!resp.ok()) {
    console.warn("Agent seed returned", resp.status());
  }
}

export async function loginAsAdmin(page: Page) {
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");

  const passwordInput = page.locator('input[type="password"]');
  if (await passwordInput.isVisible({ timeout: 3000 })) {
    await passwordInput.fill(ADMIN_PASSWORD);
    await page.locator('button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Login"), button[type="submit"]').first().click();
    await page.waitForLoadState("networkidle");
  }

  await seedAgents(page);
}

export async function loginAsReviewer(page: Page) {
  await page.goto("/reviewer");
  await page.waitForLoadState("networkidle");

  const passwordInput = page.locator('input[type="password"]');
  if (await passwordInput.isVisible({ timeout: 3000 })) {
    await passwordInput.fill(REVIEWER_PASSWORD);
    await page.locator('button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Login"), button[type="submit"]').first().click();
    await page.waitForLoadState("networkidle");
  }
}

export { base as test, expect };
