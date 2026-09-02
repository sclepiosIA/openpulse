import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucun spinner ne reste affiché plus de 15s sur les pages
 * principales (signal d'un chargement bloqué — guideline PageDataState).
 */

const ROUTES = ['/', '/etablissements', '/emails', '/people', '/tresorerie', '/taches', '/parametres'];

test.describe('Spinners non bloqués', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : spinner se résorbe`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      // Sélecteurs courants pour spinners shadcn/Radix/Lucide.
      // `[role="status"]` seul ne convient pas : la région d'annonces ARIA des
      // toasts (Sonner) porte ce rôle et reste montée en permanence, vide. Le
      // test la prenait pour un chargement bloqué. On ne retient donc que les
      // indicateurs de chargement réels, y compris ceux placés à l'intérieur
      // d'une région `status`.
      const spinner = page
        .locator('.animate-spin, [data-loading="true"], [role="status"]:has(.animate-spin)')
        .first();
      // Si un spinner est présent, il doit disparaître dans les 15s
      if (await spinner.isVisible({ timeout: 500 }).catch(() => false)) {
        await expect(spinner).toBeHidden({ timeout: 15000 });
      }
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
    });
  }
});
