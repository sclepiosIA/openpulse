import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie que les routes mobile PWA (/m/*) chargent correctement.
 */

const ROUTES = ['/m/mail', '/m/calendar', '/m/pulse', '/m/todos'];

test.use({ viewport: { width: 390, height: 844 } });

test.describe('Routes mobile /m/*', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} sans crash`, async ({ page }) => {
      const r = await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (r && r.status() >= 500) throw new Error(`HTTP ${r.status()} sur ${path}`);
      await page.waitForTimeout(2000);
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
    });
  }
});
