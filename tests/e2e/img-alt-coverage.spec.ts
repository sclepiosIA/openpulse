import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucune image n'est servie sans attribut alt sur les pages clés
 * (a11y/SEO). On tolère les images décoratives explicitement marquées alt="".
 */

const ROUTES = ['/', '/etablissements', '/people', '/parametres'];

test.describe('Images avec alt', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : <img> a un attribut alt`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1500);
      const missing = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img'))
          .filter(i => !i.hasAttribute('alt'))
          .map(i => (i as HTMLImageElement).src).slice(0, 5);
      });
      expect(missing, `Images sans alt sur ${path}: ${missing.join(', ')}`).toHaveLength(0);
    });
  }
});
