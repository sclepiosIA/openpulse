import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie le temps de chargement TTI approximatif des pages principales :
 * #main-content doit être visible en moins de 10s.
 */

const ROUTES = ['/', '/etablissements', '/emails', '/people', '/parametres'];

test.describe('TTI < 10s', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} TTI < 10s`, async ({ page }) => {
      const start = Date.now();
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.locator('#main-content').waitFor({ state: 'visible', timeout: 10000 });
      const elapsed = Date.now() - start;
      expect(elapsed, `TTI trop long sur ${path} : ${elapsed}ms`).toBeLessThan(10000);
    });
  }
});
