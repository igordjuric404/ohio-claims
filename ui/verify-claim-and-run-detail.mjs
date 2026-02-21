#!/usr/bin/env node
/**
 * Verify claim detail (Damage Photos) and run detail (assessor_vision vs assessor)
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { mkdirSync } from 'fs';
import { join } from 'path';

const ADMIN_URL = 'https://bd61526b.ohio-claims-ui.pages.dev/admin';
const PASSWORD = 'QgRj2aeZUOaMgQPIMgh0vnrtx+kq93BSECN+sqP395l3nxSX';
const SCREENSHOT_DIR = join(process.cwd(), 'claim-run-verification-screenshots');

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const results = [];
  const takeScreenshot = async (name) => {
    const path = join(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path });
    results.push({ step: name, path });
    return path;
  };

  try {
    // 1. Login
    await page.goto(ADMIN_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('.admin-overview, .admin-layout', { timeout: 10000 });
    await takeScreenshot('01-logged-in');

    // 2. Go to Claims, find and click claim CLM-53nPLYPP5AA4
    await page.click('button:has-text("Claims")');
    await page.waitForSelector('.admin-claims', { timeout: 5000 });
    await page.waitForTimeout(1500);

    const claimRow = page.locator(`tr:has-text("CLM-53nPLYPP5AA4")`);
    const claimExists = await claimRow.count() > 0;
    results.push({ claimCLM53nPLYPP5AA4: { inList: claimExists } });

    if (claimExists) {
      await claimRow.first().click();
    } else {
      // try first claim row if ID differs
      const firstRow = page.locator('.admin-claims table tbody tr').first();
      if (await firstRow.count() > 0) {
        await firstRow.click();
      }
    }

    await page.waitForSelector('.admin-claim-detail', { timeout: 8000 });
    await page.waitForTimeout(3000); // wait for Damage Photos to load (async)

    // 3. Claim detail - Damage Photos section
    const damagePhotosCard = page.locator('.card:has(h3:has-text("Damage Photos"))');
    const damagePhotosExists = await damagePhotosCard.count() > 0;
    const photoImgs = page.locator('.damage-photos-grid img, .damage-photo-thumb img');
    const imgCount = await photoImgs.count();
    const hasRenderedImages = imgCount > 0;
    const filenamesOnly = await page.locator('.card h3:has-text("Damage Photos")').locator('..').locator('.muted:has-text("No damage photos")').count() > 0;
    results.push({
      claimDetailDamagePhotos: {
        sectionExists: damagePhotosExists,
        renderedImageCount: imgCount,
        hasRenderedImages,
        showsFilenamesOnly: filenamesOnly && !hasRenderedImages,
      },
    });

    await takeScreenshot('02-claim-detail-damage-photos');

    // 4. Find assessor_vision run - click it
    const assessorVisionRun = page.locator('.admin-run-item:has-text("Assessor")').filter({ hasText: 'Vision' });
    const visionRunCount = await assessorVisionRun.count();
    let clickedVision = false;
    if (visionRunCount > 0) {
      await assessorVisionRun.first().click();
      clickedVision = true;
    } else {
      const runItems = page.locator('.admin-run-item');
      for (let i = 0; i < Math.min(await runItems.count(), 10); i++) {
        const text = await runItems.nth(i).textContent();
        if (text && (text.includes('Assessor') || text.includes('assessor_vision') || text.includes('Vision'))) {
          await runItems.nth(i).click();
          clickedVision = true;
          break;
        }
      }
    }
    if (!clickedVision) {
      await page.click('button:has-text("Runs")');
      await page.waitForSelector('.admin-runs', { timeout: 5000 });
      await page.waitForTimeout(2000);
      const runRow = page.locator('tr:has-text("assessor_vision"), tr:has-text("Assessor")').first();
      if (await runRow.count() > 0) await runRow.click();
    }

    await page.waitForTimeout(3000);
    await takeScreenshot('03-assessor-vision-run-overview');

    // 5. assessor_vision run detail sections
    const runDamagePhotos = page.locator('.card h3:has-text("Damage Photos")');
    const runWebSearch = page.locator('.card h3:has-text("Web Search"), .card h3:has-text("Search Evidence")');
    const runDamageAnalysis = page.locator('.card h3:has-text("Damage Analysis"), table:has(th:has-text("Damage"))');
    const runPhotosImgCount = await page.locator('.run-section img, .damage-photos-grid img').count();
    const webSearchExists = await runWebSearch.count() > 0 || await page.locator('*:has-text("Web Search Evidence")').count() > 0;
    const damageAnalysisExists = await runDamageAnalysis.count() > 0 || await page.locator('table').filter({ has: page.locator('th:has-text("Part"), th:has-text("Damage")') }).count() > 0;

    results.push({
      assessorVisionRun: {
        damagePhotosSection: await runDamagePhotos.count() > 0,
        damagePhotosImageCount: runPhotosImgCount,
        webSearchEvidenceSection: webSearchExists,
        damageAnalysisTable: damageAnalysisExists,
      },
    });

    await takeScreenshot('04-assessor-vision-full');

    // Scroll and capture Damage Photos, Web Search Evidence, Damage Analysis
    const photoSection = page.locator('.run-section:has(h3:has-text("Damage Photos")), .card:has(h3:has-text("Damage Photos"))');
    if (await photoSection.count() > 0) {
      await photoSection.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await photoSection.first().screenshot({ path: join(SCREENSHOT_DIR, '04a-damage-photos-section.png') });
      results.push({ step: '04a-damage-photos-section', path: join(SCREENSHOT_DIR, '04a-damage-photos-section.png') });
    }
    const webSection = page.locator('.run-section:has(h3:has-text("Web Search Evidence"))');
    if (await webSection.count() > 0) {
      await webSection.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await webSection.first().screenshot({ path: join(SCREENSHOT_DIR, '04b-web-search-section.png') }).catch(() => {});
      results.push({ step: '04b-web-search-section', path: join(SCREENSHOT_DIR, '04b-web-search-section.png') });
    }
    const damageTable = page.locator('.run-section:has(h3:has-text("Damage Analysis"))');
    if (await damageTable.count() > 0) {
      await damageTable.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await damageTable.first().screenshot({ path: join(SCREENSHOT_DIR, '04c-damage-analysis-table.png') }).catch(() => {});
      results.push({ step: '04c-damage-analysis-table', path: join(SCREENSHOT_DIR, '04c-damage-analysis-table.png') });
    }

    // 6. Go back, find regular assessor run (not vision)
    await page.click('button:has-text("Claims")');
    await page.waitForTimeout(1000);
    const claimRow2 = page.locator('tr:has-text("CLM-53nPLYPP5AA4")').first();
    if (await claimRow2.count() > 0) await claimRow2.click();
    await page.waitForTimeout(2000);

    const assessorRun = page.locator('.admin-run-item').filter({ hasNotText: 'Vision' }).filter({ hasText: 'Assessor' });
    if (await assessorRun.count() > 0) {
      await assessorRun.first().click();
      await page.waitForTimeout(3000);
      await takeScreenshot('05-assessor-run-no-vision');

      const hasWebSearchInAssessor = await page.locator('*:has-text("Web Search Evidence")').count() > 0;
      results.push({
        regularAssessorRun: { hasWebSearchSection: hasWebSearchInAssessor },
      });
    } else {
      await page.click('button:has-text("Runs")');
      await page.waitForTimeout(2000);
      const assessorRows = page.locator('tr:has-text("assessor")').filter({ hasNot: page.locator(':has-text("vision")') });
      if (await assessorRows.count() > 0) {
        await assessorRows.first().click();
        await page.waitForTimeout(3000);
        await takeScreenshot('05-assessor-run-no-vision');
      }
    }

    writeFileSync(join(SCREENSHOT_DIR, 'report.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } catch (e) {
    console.error(e);
    try {
      await takeScreenshot('99-error');
      const bodyText = await page.locator('body').textContent().catch(() => '');
      results.push({ error: String(e.message || e), bodyPreview: bodyText?.slice(0, 1000) });
    } catch (_) {}
    writeFileSync(join(SCREENSHOT_DIR, 'report.json'), JSON.stringify(results, null, 2));
    throw e;
  } finally {
    await browser.close();
  }
}

main();
