import { test, expect, loginAsAdmin, loginAsReviewer } from "./fixtures";
import { seedReviewedClaim, seedAgentsViaApi, purgeAllData } from "./helpers";

const RAW_VARIABLE_PATTERNS = [
  /\brepair_estimate_low\b/,
  /\brepair_estimate_high\b/,
  /\btotal_loss_recommended\b/,
  /\bfraud_risk_score\b/,
  /\brisk_level\b/,
  /\bcoverage_confirmed\b/,
  /\bpolicy_active\b/,
  /\btriage_priority\b/,
  /\bmissing_documents\b/,
  /\bassessment_notes\b/,
  /\banalysis_notes\b/,
  /\bdamaged_components\b/,
  /\bexclusions_applicable\b/,
  /\bcoverage_limit\b/,
  /\bred_flags\b/,
];

test.describe("Human-friendly Labels (R7)", () => {
  let claimId: string;

  test.beforeAll(async () => {
    await purgeAllData();
    await seedAgentsViaApi();
    claimId = await seedReviewedClaim();
  });

  test("R7: reviewer claim detail uses human-friendly labels", async ({
    page,
  }) => {
    await loginAsReviewer(page);
    await page.locator(`text=${claimId}`).first().click();
    await page.waitForLoadState("networkidle");

    const bodyText = await page.locator(".reviewer-claim-detail").innerText();

    for (const pattern of RAW_VARIABLE_PATTERNS) {
      expect(bodyText).not.toMatch(pattern);
    }
  });

  test("R7: reviewer claim detail shows formatted values", async ({
    page,
  }) => {
    await loginAsReviewer(page);
    await page.locator(`text=${claimId}`).first().click();
    await page.waitForLoadState("networkidle");

    const bodyText = await page.locator(".reviewer-claim-detail").innerText();

    expect(bodyText).toContain("$2,800");
    expect(bodyText).toContain("$3,500");
  });

  test("R7: admin claims page uses human-friendly stage names", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.locator('.admin-nav button:has-text("Claims")').click();
    await page.waitForLoadState("networkidle");

    const bodyText = await page.locator(".admin-main").innerText();

    expect(bodyText).not.toMatch(/\bFNOL_SUBMITTED\b/);
    expect(bodyText).not.toMatch(/\bFRONTDESK_DONE\b/);
    expect(bodyText).not.toMatch(/\bPENDING_REVIEW\b/);

    expect(
      bodyText.includes("Pending Review") ||
        bodyText.includes("FNOL Submitted") ||
        bodyText.includes("No claims")
    ).toBe(true);
  });

  test("R7: reviewer dashboard uses human-friendly stage names", async ({
    page,
  }) => {
    await loginAsReviewer(page);

    const bodyText = await page.locator(".admin-claims").innerText();
    expect(bodyText).not.toMatch(/\bPENDING_REVIEW\b/);
    expect(bodyText).toContain("Pending Review");
  });
});
