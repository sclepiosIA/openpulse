import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucune requête réseau ne retourne 5xx au chargement des pages
 * principales (les 4xx restent acceptables : RLS sans data, 404 ressources).
 */

const ROUTES = ['/', '/etablissements', '/emails', '/people', '/tresorerie', '/taches', '/parametres'];

test.describe('Pas de 5xx réseau', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} sans 5xx`, async ({ page }) => {
      const failures: string[] = [];
      page.on('response', resp => {
        if (resp.status() >= 500) failures.push(`${resp.status()} ${resp.url()}`);
      });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(2000);
      expect(failures, `5xx sur ${path} :\n${failures.join('\n')}`).toHaveLength(0);
    });
  }
});
