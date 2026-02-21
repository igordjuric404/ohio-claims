#!/usr/bin/env node
/**
 * Verifies admin UI at http://localhost:5173/#/admin
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:5173/admin';
const PASSWORD = 'admin-dev-password';
const SCREENSHOT_DIR = join(process.cwd(), 'admin-verification-screenshots');

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const results = [];
  const takeScreenshot = async (name) => {
    const path = join(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path });
    results.push({ step: name, path });
    return path;
  };

  try {
    // 1. Go to admin and login
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await takeScreenshot('01-login-page');
    
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('.admin-overview, .admin-layout', { timeout: 5000 });
    await takeScreenshot('02-after-login-dashboard');

    // 2. Verify Purge All Data button
    const purgeBtn = page.locator('button:has-text("Purge All Data")');
    const purgeExists = await purgeBtn.count() > 0;
    const purgeDanger = purgeExists && (await purgeBtn.getAttribute('class') || '').includes('btn-danger');
    results.push({ check: 'Purge All Data button', exists: purgeExists, dangerStyle: purgeDanger });

    // 3. Navigate to Claims
    await page.click('button:has-text("Claims")');
    await page.waitForSelector('.admin-claims', { timeout: 3000 });
    await takeScreenshot('03-claims-page');

    const claimsRows = await page.locator('.admin-claims table tbody tr').count();
    results.push({ check: 'Claims listed', count: claimsRows });

    // 4. Click first claim if any
    if (claimsRows > 0) {
      await page.click('.admin-claims table tbody tr:first-child');
      await page.waitForSelector('h3:has-text("Damage Photos")', { timeout: 5000 }).catch(() => null);
      await takeScreenshot('04-claim-detail');
      const damagePhotosSection = await page.locator('h3:has-text("Damage Photos")').count() > 0;
      results.push({ check: 'Damage Photos section in claim detail', exists: damagePhotosSection });
    } else {
      results.push({ check: 'Damage Photos section', note: 'No claims to click' });
    }

    // 5. Go to Audit
    await page.click('button:has-text("Audit")');
    await page.waitForSelector('.admin-audit', { timeout: 3000 });
    await takeScreenshot('05-audit-page');

    const auditClaimsCount = await page.locator('.audit-claim-item').count();
    results.push({ check: 'Audit claims in sidebar', count: auditClaimsCount, hasSidebar: true });

    // Summary
    writeFileSync(
      join(SCREENSHOT_DIR, 'report.json'),
      JSON.stringify(results, null, 2)
    );
    console.log(JSON.stringify(results, null, 2));
  } catch (e) {
    console.error(e);
    try { await takeScreenshot('99-error'); } catch (_) {}
    throw e;
  } finally {
    await browser.close();
  }
}

main();
