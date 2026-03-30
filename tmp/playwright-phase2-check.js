const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage({ viewport: { width: 1440, height: 900 } });

  const result = {
    quickStartVisible: false,
    quickStartText: '',
    alertsCardKeyboardReady: false,
    focusVisibleClassProbe: false,
    consoleErrors: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') result.consoleErrors.push(msg.text());
  });

  await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /get started/i }).click();
  await page.waitForURL('**/dashboard');
  await page.waitForTimeout(600);

  const quickStart = page.locator('section:has-text("Quick Start")');
  result.quickStartVisible = await quickStart.count().then((c) => c > 0);
  result.quickStartText = result.quickStartVisible
    ? ((await quickStart.first().innerText()).replace(/\s+/g, ' ').trim().slice(0, 120))
    : '';

  const alertsCard = page.locator('[role="button"][aria-label="Open alerts summary"][tabindex="0"]');
  result.alertsCardKeyboardReady = await alertsCard.count().then((c) => c > 0);

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const activeTag = await page.evaluate(() => document.activeElement?.tagName || '');
  result.focusVisibleClassProbe = Boolean(activeTag);

  await page.screenshot({ path: 'c:/Users/Daksh/OneDrive/carterA++/tmp/ux-phase2-dashboard.png', fullPage: true });
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})();
