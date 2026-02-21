import { test, expect, loginAsReviewer } from "./fixtures";
import { seedReviewedClaim, purgeAllData, seedAgentsViaApi } from "./helpers";

test.describe("Reviewer Dashboard & Claim Detail (R5, R6)", () => {
  let claimId: string;

  test.beforeAll(async () => {
    await purgeAllData();
    await seedAgentsViaApi();
    claimId = await seedReviewedClaim();
  });

  test("R5: reviewer dashboard loads and shows claims table", async ({
    page,
  }) => {
    await loginAsReviewer(page);

    await expect(
      page.locator(".admin-main h2, .admin-claims h2").first()
    ).toContainText("Claims Review Queue");

    const statCards = page.locator(".admin-stat");
    await expect(statCards).toHaveCount(3);

    await expect(page.locator(".admin-table").first()).toBeVisible();
  });

  test("R5: reviewer dashboard shows the seeded claim", async ({ page }) => {
    await loginAsReviewer(page);

    await expect(page.locator(".admin-table")).toContainText(claimId);
    await expect(page.locator(".admin-table")).toContainText("Sarah Mitchell");
    await expect(page.locator(".admin-table")).toContainText(
      "POL-OH-2024-83921"
    );
  });

  test("R5: reviewer sidebar is claims-focused (limited nav)", async ({
    page,
  }) => {
    await loginAsReviewer(page);

    const navButtons = page.locator(".admin-nav button");
    await expect(navButtons).toHaveCount(1);
    await expect(navButtons.first()).toContainText("Claims");
  });

  test("R6: clicking claim opens detail page with agent sections", async ({
    page,
  }) => {
    await loginAsReviewer(page);

    await page.locator(`text=${claimId}`).first().click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".reviewer-claim-detail")).toBeVisible();
    await expect(page.locator(".reviewer-claim-detail")).toContainText(claimId);
  });

  test("R6: claim detail shows claim summary", async ({ page }) => {
    await loginAsReviewer(page);
    await page.locator(`text=${claimId}`).first().click();
    await page.waitForLoadState("networkidle");

    const summary = page.locator(".reviewer-claim-summary");
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("Sarah Mitchell");
    await expect(summary).toContainText("(614) 555-0237");
    await expect(summary).toContainText("Broad Street");
  });

  test("R6: claim detail has 4 agent sections (frontdesk, claimsofficer, assessor, fraudanalyst)", async ({
    page,
  }) => {
    await loginAsReviewer(page);
    await page.locator(`text=${claimId}`).first().click();
    await page.waitForLoadState("networkidle");

    const agentSections = page.locator(".reviewer-agent-section");
    await expect(agentSections).toHaveCount(4);

    const sectionHeaders = page.locator(".agent-section-header h3");
    const headers = await sectionHeaders.allTextContents();

    expect(headers).toContain("Front Desk");
    expect(headers).toContain("Claims Officer");
    expect(headers).toContain("Assessor");
    expect(headers).toContain("Fraud Analyst");
  });

  test("R6: agent sections show structured outputs (not raw dumps)", async ({
    page,
  }) => {
    await loginAsReviewer(page);
    await page.locator(`text=${claimId}`).first().click();
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator(".reviewer-agent-section").first()
    ).toBeVisible({ timeout: 10000 });

    const agentSections = page.locator(".reviewer-agent-section");
    const sectionsCount = await agentSections.count();
    expect(sectionsCount).toBeGreaterThanOrEqual(1);

    const outputGrids = page.locator(".agent-output-grid");
    await expect(outputGrids.first()).toBeVisible();
    const count = await outputGrids.count();
    expect(count).toBeGreaterThanOrEqual(1);

    const outputLabels = page.locator(".output-label");
    const labelsCount = await outputLabels.count();
    expect(labelsCount).toBeGreaterThan(3);
  });

  test("R6: reasoning-enabled agents show reasoning section", async ({
    page,
  }) => {
    await loginAsReviewer(page);
    await page.locator(`text=${claimId}`).first().click();
    await page.waitForLoadState("networkidle");

    const agentSections = page.locator(".reviewer-agent-section");
    await expect(agentSections.first()).toBeVisible();

    const reasoningSections = page.locator(".agent-reasoning");
    const count = await reasoningSections.count();
    expect(count).toBeGreaterThanOrEqual(1);

    if (count > 0) {
      const firstReasoning = reasoningSections.first();
      await expect(firstReasoning.locator("h4")).toHaveText("Reasoning");
      const content = await firstReasoning
        .locator(".reasoning-content")
        .textContent();
      expect(content!.length).toBeGreaterThan(10);
    }
  });

  test("R6: decision panel is visible for PENDING_REVIEW claim", async ({
    page,
  }) => {
    await loginAsReviewer(page);
    await page.locator(`text=${claimId}`).first().click();
    await page.waitForLoadState("networkidle");

    const decisionPanel = page.locator(".decision-panel");
    await expect(decisionPanel).toBeVisible();
    await expect(decisionPanel).toContainText("Your Decision");

    await expect(
      decisionPanel.locator('button:has-text("Approve")')
    ).toBeVisible();
    await expect(
      decisionPanel.locator('button:has-text("Deny")')
    ).toBeVisible();
  });

  test("R6: assessor section shows pricing sources panel with clickable links", async ({
    page,
  }) => {
    await loginAsReviewer(page);
    await page.locator(`text=${claimId}`).first().click();
    await page.waitForLoadState("networkidle");

    const pricingPanel = page.locator(".pricing-sources-panel");
    await expect(pricingPanel).toBeVisible();

    await expect(pricingPanel.locator(".pricing-sources-header")).toContainText("Pricing Sources");
    await expect(pricingPanel.locator(".pricing-sources-header")).toContainText("verified");

    const links = pricingPanel.locator(".pricing-source-link");
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const href = await link.getAttribute("href");
      expect(href).toMatch(/^https?:\/\//);
      await expect(link.getAttribute("target")).resolves.toBe("_blank");
      await expect(link.getAttribute("rel")).resolves.toContain("noopener");
    }
  });

  test("R6: pricing source links show favicons and labels", async ({
    page,
  }) => {
    await loginAsReviewer(page);
    await page.locator(`text=${claimId}`).first().click();
    await page.waitForLoadState("networkidle");

    const pricingPanel = page.locator(".pricing-sources-panel");
    await expect(pricingPanel).toBeVisible();

    const firstLink = pricingPanel.locator(".pricing-source-link").first();
    await expect(firstLink.locator(".pricing-source-favicon img")).toBeVisible();
    await expect(firstLink.locator(".pricing-source-label")).not.toBeEmpty();
    await expect(firstLink.locator(".pricing-source-external")).toBeVisible();
  });
});
