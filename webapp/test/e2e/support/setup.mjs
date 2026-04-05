// webapp/test/e2e/support/setup.mjs
import { setWorldConstructor, Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from 'playwright';

setDefaultTimeout(30_000);

class CustomWorld {
  browser = null;
  page    = null;
}

setWorldConstructor(CustomWorld);

Before(async function () {
  const headless = process.env.E2E_HEADLESS !== 'false';
  const slowMo   = Number(process.env.E2E_SLOW_MO ?? 0);
  const devtools = process.env.E2E_DEVTOOLS === 'true';
  this.browser = await chromium.launch({ headless, slowMo, devtools });
  const context = await this.browser.newContext({ ignoreHTTPSErrors: true });
  this.page    = await context.newPage();
});

After(async function () {
  if (this.page)    await this.page.close();
  if (this.browser) await this.browser.close();
});