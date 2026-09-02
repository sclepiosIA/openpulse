import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const ROUTES = [
  '/facturation',
  '/facturation/factures',
  '/facturation/devis',
  '/facturation/avoirs',
  '/facturation/relances',
];

test.describe('Facturation', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} sans crash`, async ({ page }) => {
      const r = await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (r && r.status() >= 500) throw new Error(`HTTP ${r.status()} sur ${path}`);
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
    });
  }
});
