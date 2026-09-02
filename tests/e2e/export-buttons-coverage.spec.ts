import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const ROUTES = ['/etablissements', '/prospects', '/taches', '/people'];

test.describe('Boutons export sans crash', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : export ne crash pas`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);
      const btn = page.getByRole('button', { name: /exporter|télécharger|export csv|export excel/i }).first();
      if (!(await btn.isVisible({ timeout: 2000 }).catch(() => false))) {
        test.skip(true, `Pas de bouton export sur ${path}`); return;
      }
      await btn.click().catch(() => {});
      await page.waitForTimeout(800);
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
    });
  }
});
