import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture des modules analytics / reporting : forecasting, churn,
 * rapports custom, scoring, attribution, activité globale.
 */

const ROUTES = [
  '/forecasting',
  '/churn',
  '/rapports-custom',
  '/prospects/scoring',
  '/activite',
  '/automatisations',
];

test.describe('Analytics & reporting', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const path of ROUTES) {
    test(`${path} se charge sans crash`, async ({ page }) => {
      const resp = await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (resp && resp.status() >= 500) throw new Error(`HTTP ${resp.status()} sur ${path}`);
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
    });
  }
});
