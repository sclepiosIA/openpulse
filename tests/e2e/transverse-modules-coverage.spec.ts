import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture des modules transverses : rapports custom, automatisations,
 * churn, forecasting, attribution, activité — visite et shell OK.
 *
 * `/workflows` et `/signatures` ont été retirés : aucune de ces routes n'est
 * déclarée dans le routeur et aucune page correspondante n'existe. Les tests
 * atterrissaient sur la 404 et échouaient sur leur propre garde-fou. Les
 * workflows sont servis par `/automatisations`, déjà couvert ci-dessous.
 */

const ROUTES = [
  '/rapports-custom',
  '/automatisations',
  '/churn',
  '/forecasting',
  '/attribution',
  '/activite',
  '/analyse-geographique',
  '/prospects/scoring',
  '/documents',
  '/contrats',
];

test.describe('Modules transverses — couverture', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const path of ROUTES) {
    test(`${path} se charge sans crash`, async ({ page }) => {
      const resp = await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (resp && resp.status() >= 500) {
        throw new Error(`HTTP ${resp.status()} sur ${path}`);
      }
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
      await expect(page.getByText(/page introuvable|^404$/i)).toHaveCount(0);
    });
  }
});
