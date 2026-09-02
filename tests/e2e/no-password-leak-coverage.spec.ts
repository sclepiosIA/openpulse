import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucun secret ne traîne dans un champ password sur les pages
 * authentifiées — signal d'un formulaire de connexion oublié ou d'un mot de
 * passe pré-rempli côté serveur.
 *
 * On teste l'absence de VALEUR, pas l'absence de champ : /parametres expose
 * légitimement un champ de configuration SIP (`sip_password`), vide et marqué
 * `autocomplete="new-password"`. Interdire tout champ password y rendait le
 * test faux — il échouait sur un formulaire de saisie parfaitement sain,
 * sans rien dire du risque réel, qui est la fuite d'une valeur.
 */

const ROUTES = ['/', '/etablissements', '/emails', '/people', '/parametres'];

test.describe('Pas de password input visible hors auth', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : aucun input[type=password] visible`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);
      const fields = page.locator('input[type="password"]:visible');
      const filled: string[] = [];
      for (let i = 0; i < (await fields.count()); i += 1) {
        const field = fields.nth(i);
        if ((await field.inputValue().catch(() => '')).length > 0) {
          filled.push((await field.getAttribute('id')) || `#${i}`);
        }
      }
      expect(filled, `Champ password pré-rempli sur ${path} : ${filled.join(', ')}`).toEqual([]);
    });
  }
});
