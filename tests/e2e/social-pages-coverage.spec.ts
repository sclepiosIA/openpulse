import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const ROUTES = ['/social', '/social/calendrier', '/social/analytics', '/social/composer'];

test.describe('Social dashboard', () => {
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
