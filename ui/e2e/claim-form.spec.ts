import { test, expect } from "./fixtures";

test.describe("Public Claim Submission (R1, R2)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("shows Manual FNOL tab as default view", async ({ page }) => {
    await expect(page.locator("h1")).toHaveText("Ohio Auto Claims");
    await expect(page.locator(".claim-form-subtitle")).toHaveText(
      "First Notice of Loss (FNOL)"
    );
    await expect(page.locator(".tab-btn.active")).toHaveText("Manual FNOL");
  });

  test("R1: Seed Demo Data button exists and populates form", async ({
    page,
  }) => {
    const seedBtn = page.locator('button:has-text("Seed Demo Data")');
    await expect(seedBtn).toBeVisible();

    await seedBtn.click();
    await page.waitForTimeout(1000);

    await expect(page.locator("#policy_id")).toHaveValue("POL-OH-2024-83921");
    await expect(page.locator("#full_name")).toHaveValue("Sarah Mitchell");
    await expect(page.locator("#phone")).toHaveValue("(614) 555-0237");
    await expect(page.locator("#email")).toHaveValue(
      "sarah.mitchell@email.com"
    );

    const desc = await page.locator("#description").inputValue();
    expect(desc).toContain("Broad Street");
    expect(desc).toContain("red light");

    await expect(page.locator("#make")).toHaveValue("Honda");
    await expect(page.locator("#model")).toHaveValue("Accord");
    await expect(page.locator("#year")).toHaveValue("2023");
  });

  test("R2: form submission shows simple confirmation message", async ({
    page,
  }) => {
    await page.locator("#full_name").fill("E2E Test User");
    await page.locator("#phone").fill("(614) 555-0001");
    await page.locator("#description").fill("Test collision for E2E.");
    await page.locator("#date_of_loss").fill("2026-02-15");

    await page.locator('button[type="submit"]').click();

    await expect(page.locator(".client-confirmation")).toBeVisible({
      timeout: 15000,
    });

    await expect(page.locator(".confirmation-title")).toHaveText(
      "Form Submitted for Review"
    );

    await expect(page.locator(".confirmation-claim-id .value")).toContainText(
      "CLM-"
    );

    const steps = page.locator(".conf-step");
    await expect(steps).toHaveCount(0);

    await expect(
      page.locator('button:has-text("Submit Another Claim")')
    ).toBeVisible();
  });

  test("R2: no 'Run Pipeline' button visible anywhere after submit", async ({
    page,
  }) => {
    await page.locator("#full_name").fill("Pipeline Check User");
    await page.locator("#phone").fill("(614) 555-0002");
    await page.locator("#description").fill("Testing no pipeline button.");
    await page.locator("#date_of_loss").fill("2026-02-15");

    await page.locator('button[type="submit"]').click();
    await expect(page.locator(".client-confirmation")).toBeVisible({
      timeout: 15000,
    });

    const runBtn = page.locator(
      'button:has-text("Run Pipeline"), button:has-text("Run pipeline"), button:has-text("Start Pipeline")'
    );
    await expect(runBtn).toHaveCount(0);
  });
});
