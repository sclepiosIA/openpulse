import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie que les tooltips s'ouvrent au hover sans crash.
 */

const ROUTES = ['/', '/etablissements'];

test.describe('Tooltips hover', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : hover sur boutons icon-only sans crash`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);
      const btn = page.locator('button[aria-label]').first();
      if (!(await btn.isVisible({ timeout: 2000 }).catch(() => false))) {
        test.skip(true, `Pas de bouton aria-label sur ${path}`); return;
      }
      await btn.hover();
      await page.waitForTimeout(800);
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
    });
  }
});
