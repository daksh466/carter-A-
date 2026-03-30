const { chromium } = require('playwright');

const TARGET_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const inventoryRequests = [];

  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/spares') || url.includes('/api/inventory')) {
      inventoryRequests.push(url);
    }
  });

  await page.goto(`${TARGET_URL}/dashboard/inventory`, {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  await page.waitForSelector('h2', { timeout: 15000 });
  await page.waitForTimeout(1500);

  const heading = (await page.locator('h2').first().textContent().catch(() => '') || '').trim();
  const summaryText = (await page.locator('p').first().textContent().catch(() => '') || '').trim();
  const rowCount = await page.$$eval('tbody tr', (rows) => rows.length).catch(() => 0);
  const hasRefreshButton = await page.locator('button:has-text("Refresh")').count().catch(() => 0);
  const lastRequest = inventoryRequests[inventoryRequests.length - 1] || '';

  console.log(JSON.stringify({
    ok: true,
    page: `${TARGET_URL}/dashboard/inventory`,
    heading,
    summaryText,
    rowCount,
    hasRefreshButton: hasRefreshButton > 0,
    lastRequest,
    sawStoreScopedRequest: inventoryRequests.some((u) => /[?&]storeId=/.test(u)),
    sampleRequests: inventoryRequests.slice(-6)
  }, null, 2));

  await browser.close();
})();
