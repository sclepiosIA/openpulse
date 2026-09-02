import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucun écran ne contient un message hardcodé en anglais
 * (l'app est en français), hors quelques mots techniques tolérés.
 */

const ROUTES = ['/', '/etablissements', '/emails', '/people'];

// Phrases anglaises typiques d'un fallback non-traduit
const EN_PATTERNS = [
  /\bSomething went wrong\b/i,
  /\bAn error occurred\b/i,
  /\bLoading failed\b/i,
  /\bNot authorized\b/i,
  /\bPlease try again\b/i,
];

test.describe('Pas de fallback anglais', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : aucun message anglais générique`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1500);
      const text = await page.locator('#main-content').innerText();
      for (const rx of EN_PATTERNS) {
        const match = text.match(rx);
        expect(match, `Texte anglais détecté sur ${path}: ${match?.[0]}`).toBeNull();
      }
    });
  }
});
