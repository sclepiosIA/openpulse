import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture exports/téléchargements : on clique sur les boutons "Exporter"
 * visibles sur les principaux modules et on vérifie qu'un download démarre
 * (ou qu'un menu de format apparaît) sans crash.
 */

const EXPORT_ROUTES = [
  '/etablissements',
  '/prospects',
  '/people',
  '/contrats',
  '/tresorerie',
  '/rapports-custom',
];

test.describe('Exports — boutons "Exporter"', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const path of EXPORT_ROUTES) {
    test(`${path} — bouton Exporter ne crashe pas`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(800);

      const btn = page
        .getByRole('button', { name: /exporter|télécharger|download|export/i })
        .first();

      if (!(await btn.isVisible({ timeout: 4000 }).catch(() => false))) {
        test.skip(true, `Pas de bouton export sur ${path}`);
      }

      // Préparer la capture d'un éventuel download.
      const downloadP = page.waitForEvent('download', { timeout: 4000 }).catch(() => null);
      await btn.click();
      await page.waitForTimeout(800);

      // Soit un download démarre, soit un menu de choix s'affiche.
      const dl = await downloadP;
      const menu = await page
        .locator('[role="menu"], [role="dialog"], [data-radix-popper-content-wrapper]')
        .first()
        .isVisible()
        .catch(() => false);

      expect(dl !== null || menu, 'Aucun download ni menu après clic Exporter').toBeTruthy();
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
    });
  }
});
