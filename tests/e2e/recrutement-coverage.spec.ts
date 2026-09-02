import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture du module Recrutement (phases H→V) : on visite chaque
 * sous-route publique du candidat space et chaque route admin du
 * pipeline, sans soumission.
 */

const ADMIN_ROUTES = [
  '/recrutement',
  '/recrutement/offres',
  '/recrutement/candidats',
  '/recrutement/sessions',
  '/recrutement/analytics',
  '/recrutement/sourcing',
  '/recrutement/cooptation',
  '/recrutement/templates',
];

test.describe('Recrutement — routes admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const path of ADMIN_ROUTES) {
    test(`${path} se charge sans crash`, async ({ page }) => {
      const resp = await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (resp && resp.status() >= 500) {
        throw new Error(`HTTP ${resp.status()} sur ${path}`);
      }
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/une erreur est survenue|oops|something went wrong/i)).toHaveCount(0);
    });
  }
});
