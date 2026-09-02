import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie l'absence de doublons d'IDs DOM (a11y + risque de bugs JS).
 */

const ROUTES = ['/', '/etablissements', '/emails', '/people', '/parametres'];

test.describe('IDs DOM uniques', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : pas d'ID dupliqué`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);
      const dupes = await page.evaluate(() => {
        const ids = new Map<string, number>();
        document.querySelectorAll('[id]').forEach(el => {
          const id = el.id;
          ids.set(id, (ids.get(id) || 0) + 1);
        });
        return Array.from(ids.entries()).filter(([, n]) => n > 1).map(([id]) => id);
      });
      expect(dupes, `IDs dupliqués sur ${path} : ${dupes.join(', ')}`).toHaveLength(0);
    });
  }
});
