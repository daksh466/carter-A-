const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const out = { inventory: '', shipments: '', errors: [] };

  page.on('console', (msg) => {
    if (msg.type() === 'error') out.errors.push(msg.text());
  });

  await page.goto(`${BASE}/dashboard/inventory`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'c:/Users/Daksh/OneDrive/carterA++/tmp/erp-inventory-desktop.png', fullPage: true });
  out.inventory = await page.title();

  await page.goto(`${BASE}/dashboard/shipments`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'c:/Users/Daksh/OneDrive/carterA++/tmp/erp-shipments-desktop.png', fullPage: true });
  out.shipments = await page.title();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/dashboard/inventory`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'c:/Users/Daksh/OneDrive/carterA++/tmp/erp-inventory-mobile.png', fullPage: true });

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
