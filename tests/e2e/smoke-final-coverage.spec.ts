import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Smoke final : navigation séquentielle complète des 12 modules principaux,
 * en vérifiant à chaque étape que le shell reste monté.
 */

const FLOW = [
  '/', '/etablissements', '/prospects', '/emails', '/taches',
  '/calendrier', '/people', '/tresorerie', '/facturation',
  '/notifications', '/profil', '/parametres',
];

test('Smoke final — parcours 12 modules', async ({ page }) => {
  await loginAsAdmin(page);
  for (const path of FLOW) {
    const r = await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => null);
    if (r && r.status() >= 500) throw new Error(`HTTP ${r.status()} sur ${path}`);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
  }
});
