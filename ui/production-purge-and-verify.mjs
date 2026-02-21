#!/usr/bin/env node
/**
 * Production: login, purge, verify, Claims empty, Audit, public form
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { mkdirSync } from 'fs';
import { join } from 'path';

const ADMIN_URL = 'https://bd61526b.ohio-claims-ui.pages.dev/admin';
const PUBLIC_URL = 'https://bd61526b.ohio-claims-ui.pages.dev';
const PASSWORD = 'QgRj2aeZUOaMgQPIMgh0vnrtx+kq93BSECN+sqP395l3nxSX';
const SCREENSHOT_DIR = join(process.cwd(), 'production-verification-screenshots');

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
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

  page.on('dialog', async (dialog) => {
    console.log('Dialog:', dialog.message());
    await dialog.accept();
  });

  try {
    // 1. Login
    await page.goto(ADMIN_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await takeScreenshot('01-login-page');

    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('.admin-overview, .admin-layout', { timeout: 10000 });
    await page.waitForSelector('.admin-overview', { timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(2000); // ensure overview loaded
    await takeScreenshot('02-dashboard');

    // 2. Verify & click Purge All Data
    const purgeBtn = page.locator('button:has-text("Purge All Data")');
    await purgeBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
    const purgeExists = await purgeBtn.count() > 0;
    const purgeDanger = purgeExists && (await purgeBtn.first().getAttribute('class') || '').includes('btn-danger');
    results.push({ purgeButton: { exists: purgeExists, dangerStyle: purgeDanger } });

    if (!purgeExists) {
      await takeScreenshot('02b-dashboard-no-purge');
      const bodyText = await page.locator('body').textContent().catch(() => '');
      results.push({ debug: { bodyPreview: bodyText?.slice(0, 800) } });
      throw new Error('Purge All Data button not found');
    }

    await purgeBtn.click();
    await page.waitForTimeout(2500);
    await page.waitForTimeout(3500); // purge API completion
    await takeScreenshot('03-dashboard-after-purge');

    const statCards = page.locator('.admin-stat');
    const totalClaims = await statCards.nth(0).locator('.admin-stat-value').textContent().catch(() => null);
    const totalRuns = await statCards.nth(1).locator('.admin-stat-value').textContent().catch(() => null);
    results.push({ afterPurge: { totalClaims: totalClaims?.trim(), totalRuns: totalRuns?.trim() } });

    // 3. Claims page (empty state)
    await page.click('button:has-text("Claims")');
    await page.waitForSelector('.admin-claims', { timeout: 3000 });
    await page.waitForTimeout(1000);
    await takeScreenshot('04-claims-empty');

    // 4. Audit page
    await page.click('button:has-text("Audit")');
    await page.waitForSelector('.admin-audit', { timeout: 3000 });
    await takeScreenshot('05-audit-page');

    // 5. Public form - new tab
    const publicPage = await context.newPage();
    await publicPage.goto(PUBLIC_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await publicPage.waitForTimeout(1500);
    const publicPath = join(SCREENSHOT_DIR, '06-public-form.png');
    await publicPage.screenshot({ path: publicPath });
    results.push({ step: '06-public-form', path: publicPath });
    await publicPage.close();

    // Back to admin - note state
    await page.click('button:has-text("Dashboard")');
    await page.waitForTimeout(500);
    await takeScreenshot('07-admin-dashboard-final');

    const finalStats = await page.locator('.admin-stats-grid').textContent().catch(() => '');
    const purgeMsg = await page.locator('.pipeline-result').textContent().catch(() => '');
    results.push({ final: { stats: finalStats?.slice(0, 500), purgeMessage: purgeMsg } });

    writeFileSync(join(SCREENSHOT_DIR, 'report.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } catch (e) {
    console.error(e);
    try { await takeScreenshot('99-error'); } catch (_) {}
    results.push({ error: String(e.message || e) });
    writeFileSync(join(SCREENSHOT_DIR, 'report.json'), JSON.stringify(results, null, 2));
    throw e;
  } finally {
    await browser.close();
  }
}

main();
