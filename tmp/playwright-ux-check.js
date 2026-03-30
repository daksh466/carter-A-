const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:5173';

async function safeText(locator) {
  try {
    if (await locator.count()) {
      return (await locator.first().innerText()).trim();
    }
  } catch (_) {}
  return '';
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const summary = {
    url: TARGET_URL,
    title: '',
    hasMain: false,
    hasNav: false,
    h1Count: 0,
    buttonCount: 0,
    linkCount: 0,
    inputCount: 0,
    routeSnaps: [],
    viewportSnaps: [],
    consoleErrors: [],
    pageErrors: [],
  };

  page.on('console', msg => {
    if (msg.type() === 'error') {
      summary.consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    summary.pageErrors.push(err.message);
  });

  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
  summary.title = await page.title();

  summary.hasMain = (await page.locator('main').count()) > 0;
  summary.hasNav = (await page.locator('nav').count()) > 0;
  summary.h1Count = await page.locator('h1').count();
  summary.buttonCount = await page.locator('button').count();
  summary.linkCount = await page.locator('a').count();
  summary.inputCount = await page.locator('input, select, textarea').count();

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    const path = `c:/Users/Daksh/OneDrive/carterA++/tmp/ux-${vp.name}.png`;
    await page.screenshot({ path, fullPage: true });
    summary.viewportSnaps.push({ ...vp, path });
  }

  // Try navigating through top nav links for route snapshots.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

  const navLinks = page.locator('a[href^="/"]');
  const routeCount = Math.min(await navLinks.count(), 8);

  for (let i = 0; i < routeCount; i++) {
    const link = navLinks.nth(i);
    const href = await link.getAttribute('href');
    const label = (await link.innerText()).trim().replace(/\s+/g, ' ').slice(0, 80);

    if (!href) continue;

    try {
      await Promise.all([
        page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {}),
        link.click({ timeout: 3000 }),
      ]);
    } catch (_) {
      try {
        await page.goto(new URL(href, TARGET_URL).toString(), { waitUntil: 'networkidle', timeout: 30000 });
      } catch (_) {
        continue;
      }
    }

    const routePath = page.url();
    const h1Text = await safeText(page.locator('h1'));
    const path = `c:/Users/Daksh/OneDrive/carterA++/tmp/ux-route-${i + 1}.png`;
    await page.screenshot({ path, fullPage: true });

    summary.routeSnaps.push({
      index: i + 1,
      href,
      label,
      url: routePath,
      h1: h1Text,
      path,
    });
  }

  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
})();
