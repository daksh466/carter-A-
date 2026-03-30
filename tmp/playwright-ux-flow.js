const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const out = {
    beforeUrl: '',
    afterUrl: '',
    afterButtons: 0,
    afterLinks: 0,
    afterNav: false,
    heading: '',
    consoleErrors: [],
  };

  page.on('console', msg => {
    if (msg.type() === 'error') out.consoleErrors.push(msg.text());
  });

  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
  out.beforeUrl = page.url();
  await page.screenshot({ path: 'c:/Users/Daksh/OneDrive/carterA++/tmp/ux-before-click.png', fullPage: true });

  const button = page.getByRole('button', { name: /get started/i });
  if (await button.count()) {
    await button.first().click();
    await page.waitForTimeout(1400);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  }

  out.afterUrl = page.url();
  out.afterButtons = await page.locator('button').count();
  out.afterLinks = await page.locator('a').count();
  out.afterNav = (await page.locator('nav').count()) > 0;
  out.heading = (await page.locator('h1').first().innerText().catch(() => '')).trim();

  await page.screenshot({ path: 'c:/Users/Daksh/OneDrive/carterA++/tmp/ux-after-click.png', fullPage: true });
  console.log(JSON.stringify(out, null, 2));

  await browser.close();
})();
