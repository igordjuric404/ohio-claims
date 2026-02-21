import { test, expect, loginAsReviewer } from "./fixtures";
import { seedReviewedClaim, purgeAllData, seedAgentsViaApi } from "./helpers";

test.describe("V4 Fixes — Demo Seed, PII Decrypt, Confidence Colors", () => {
  let claimId: string;

  test.beforeAll(async () => {
    await purgeAllData();
    await seedAgentsViaApi();
    claimId = await seedReviewedClaim();
  });

  test("demo seed loads exactly 1 image (not 3 Unsplash)", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const seedBtn = page.locator('button:has-text("Seed Demo Data")');
    await seedBtn.click();
    await page.waitForTimeout(2000);

    const previewItems = page.locator(".image-preview-item");
    await expect(previewItems).toHaveCount(1);

    const imgName = page.locator(".image-preview-info span").first();
    await expect(imgName).toContainText("demo-damage");
  });

  test("reviewer header does NOT duplicate claimant name", async ({ page }) => {
    await loginAsReviewer(page);
    await page.locator(`text=${claimId}`).first().click();
    await page.waitForLoadState("networkidle");

    const headerSubtext = page.locator(".reviewer-claim-header .muted");
    const headerText = await headerSubtext.textContent();

    expect(headerText).toContain("POL-OH-2024-83921");
    expect(headerText).not.toContain("Sarah Mitchell");
  });

  test("reviewer claim detail shows decrypted (readable) claimant data", async ({
    page,
  }) => {
    await loginAsReviewer(page);
    await page.locator(`text=${claimId}`).first().click();
    await page.waitForLoadState("networkidle");

    const summary = page.locator(".reviewer-claim-summary");
    await expect(summary).toBeVisible();

    await expect(summary).toContainText("Sarah Mitchell");
    await expect(summary).toContainText("(614) 555-0237");

    const summaryText = await summary.textContent();
    expect(summaryText).not.toMatch(/^[A-Za-z0-9+/=]{40,}$/m);
  });

  test("confidence values have color-coded backgrounds", async ({ page }) => {
    await loginAsReviewer(page);
    await page.locator(`text=${claimId}`).first().click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".reviewer-agent-section").first()).toBeVisible();

    const allOutputItems = page.locator(".agent-output-item");
    const totalItems = await allOutputItems.count();

    let confidenceCount = 0;
    for (let i = 0; i < totalItems; i++) {
      const item = allOutputItems.nth(i);
      const label = await item.locator(".output-label").textContent();
      if (label?.toLowerCase().includes("confidence")) {
        confidenceCount++;
        const classes = await item.getAttribute("class");
        expect(classes).toMatch(/confidence-(low|mid|high)/);
      }
    }

    expect(confidenceCount).toBeGreaterThanOrEqual(1);
  });

  test("summary grid values do not overflow their containers", async ({
    page,
  }) => {
    await loginAsReviewer(page);
    await page.locator(`text=${claimId}`).first().click();
    await page.waitForLoadState("networkidle");

    const summaryValues = page.locator(".summary-grid .output-value");
    const count = await summaryValues.count();

    for (let i = 0; i < count; i++) {
      const el = summaryValues.nth(i);
      const overflow = await el.evaluate(
        (e) => getComputedStyle(e).textOverflow
      );
      expect(overflow).toBe("ellipsis");
    }
  });
});
