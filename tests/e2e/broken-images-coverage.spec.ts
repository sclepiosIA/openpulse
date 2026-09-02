import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucune image visible n'est cassée (naturalWidth === 0) sur les
 * pages clés. Filtre les images data-uri/svg inline.
 */

const ROUTES = ['/', '/etablissements', '/people', '/emails', '/parametres'];

test.describe('Images cassées', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} n'a pas d'image cassée`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1500);
      const broken = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
        return imgs
          .filter(i => i.src && !i.src.startsWith('data:') && i.complete && i.naturalWidth === 0)
          .map(i => i.src);
      });
      expect(broken, `Images cassées sur ${path} : ${broken.join(', ')}`).toHaveLength(0);
    });
  }
});
