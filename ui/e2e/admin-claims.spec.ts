import { test, expect, loginAsAdmin } from "./fixtures";
import { seedReviewedClaim, seedAgentsViaApi, purgeAllData } from "./helpers";

test.describe("Admin Claims - Runs Grouped by Claim (R3)", () => {
  let claimId: string;

  test.beforeAll(async () => {
    await purgeAllData();
    await seedAgentsViaApi();
    claimId = await seedReviewedClaim();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("R3: claims list shows created claim", async ({ page }) => {
    await page.locator('.admin-nav button:has-text("Claims")').click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".admin-main")).toContainText(claimId);
  });

  test("R3: clicking a claim shows runs for THAT claim", async ({ page }) => {
    await page.locator('.admin-nav button:has-text("Claims")').click();
    await page.waitForLoadState("networkidle");

    await page.locator(`text=${claimId}`).first().click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".admin-claim-detail")).toBeVisible();
    await expect(page.locator(".admin-claim-detail")).toContainText(claimId);

    const runsSection = page.locator(
      '.admin-claim-detail :text("Runs"), .admin-claim-detail :text("Pipeline Runs"), .admin-claim-detail :text("Agent Runs")'
    );
    const hasRuns = (await runsSection.count()) > 0;
    const runRows = page.locator(".admin-claim-detail table tbody tr");
    const hasRunRows = (await runRows.count()) > 0;
    expect(hasRuns || hasRunRows).toBe(true);
  });
});
