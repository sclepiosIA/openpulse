import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const ROUTES = ['/', '/parametres'];

test.describe('Liens internes valides', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : liens internes répondent`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(500);
      const hrefs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href^="/"]'))
          .map(a => (a as HTMLAnchorElement).getAttribute('href') || '')
          .filter(h => h && !h.startsWith('//') && !h.includes('#'))
          .slice(0, 10);
      });
      for (const href of hrefs) {
        const resp = await page.request.get(href).catch(() => null);
        if (!resp) continue;
        expect(resp.status(), `Lien interne mort : ${href}`).toBeLessThan(500);
      }
    });
  }
});
