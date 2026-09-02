import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucun ErrorBoundary (composant ErrorBoundary qui rend son fallback)
 * n'est visible au chargement des pages principales.
 */

const ROUTES = ['/', '/etablissements', '/emails', '/people', '/tresorerie', '/taches', '/parametres', '/calendrier'];

test.describe('Pas d\'ErrorBoundary actif', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : pas de fallback ErrorBoundary`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(2000);
      const eb = page.locator('text=/Une erreur est survenue|Quelque chose s\'est mal passé|Réessayer|Recharger la page/i');
      const count = await eb.count();
      // Tolérance : certains widgets ont leur propre ErrorBoundary local (ex: 1)
      expect(count, `ErrorBoundary actif sur ${path}`).toBeLessThanOrEqual(0);
    });
  }
});
