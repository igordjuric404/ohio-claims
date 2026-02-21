import { test, expect, loginAsAdmin, loginAsReviewer } from "./fixtures";
import {
  seedAgentsViaApi,
  seedReviewedClaim,
  purgeAllData,
} from "./helpers";

test.describe("Senior Reviewer Agent Removal (R4)", () => {
  let claimId: string;

  test.beforeAll(async () => {
    await seedAgentsViaApi();
    claimId = await seedReviewedClaim();
  });

  test("R4: reviewer claim detail does NOT include seniorreviewer in agent sections", async ({
    page,
  }) => {
    await loginAsReviewer(page);
    await page.locator(`text=${claimId}`).first().click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".reviewer-claim-detail")).toBeVisible();

    const sectionHeaders = page.locator(".agent-section-header h3");
    const headers = await sectionHeaders.allTextContents();

    expect(headers).not.toContain("Senior Reviewer");

    expect(headers.length).toBeGreaterThanOrEqual(1);
    for (const h of headers) {
      expect(h).not.toContain("Senior Reviewer");
    }
  });

  test("R4: pipeline stages do not include seniorreviewer", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await seedAgentsViaApi();

    await page.locator('.admin-nav button:has-text("Agents")').click();
    await page.waitForLoadState("networkidle");

    const pageText = await page.locator(".admin-main").innerText();

    const hasSRInPipelineOrder =
      pageText.includes("seniorreviewer") &&
      pageText.includes("Pipeline Order");
    expect(hasSRInPipelineOrder).toBe(false);
  });
});
