import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucun lien externe ne manque rel="noopener noreferrer"
 * (faille tabnabbing).
 */

const ROUTES = ['/', '/parametres'];

test.describe('Liens externes sécurisés (noopener)', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : tous les target=_blank ont rel sécurisé`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(500);
      const unsafe = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[target="_blank"]'))
          .filter(a => {
            const rel = (a.getAttribute('rel') || '').toLowerCase();
            return !rel.includes('noopener');
          })
          .map(a => (a as HTMLAnchorElement).href);
      });
      expect(unsafe, `target=_blank sans rel=noopener sur ${path}: ${unsafe.join(', ')}`).toHaveLength(0);
    });
  }
});
