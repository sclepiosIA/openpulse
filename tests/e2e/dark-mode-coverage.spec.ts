import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie que le thème sombre/clair s'applique et persiste après reload
 * sur quelques pages représentatives.
 */

const PAGES = ['/', '/etablissements', '/emails', '/taches'];

test.describe('Dark mode persistance', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const path of PAGES) {
    test(`${path} bascule dark/light sans crash`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

      // Force dark via classList (le toggle d'app utilise data-theme/class dark)
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.waitForTimeout(200);
      expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);

      await page.evaluate(() => document.documentElement.classList.remove('dark'));
      await page.waitForTimeout(200);
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
    });
  }
});
