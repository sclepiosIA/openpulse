import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie l'absence de pages vides : `#main-content` doit contenir au moins
 * 100 caractères de texte sur chaque page principale (pas juste un spinner).
 */

const ROUTES = ['/', '/etablissements', '/prospects', '/emails', '/people', '/tresorerie', '/taches', '/parametres', '/notifications', '/profil'];

test.describe('Pages non vides', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} contient du contenu`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      // Attente ACTIVE de l'hydratation. Le `waitForTimeout(2000)` fixe qui
      // précédait suffisait en local, mais pas contre le live Azure (~11 s) :
      // la lecture qui suivait tombait sur le spinner et le test échouait
      // pour une raison de latence, pas de contenu.
      await expect
        .poll(async () => (await page.locator('#main-content').innerText()).trim().length, {
          message: `Page ${path} vide ou seulement spinner`,
          timeout: 30000,
        })
        .toBeGreaterThanOrEqual(50);
    });
  }
});
