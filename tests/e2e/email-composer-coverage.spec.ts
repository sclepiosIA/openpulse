import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture du module Email (composer, dossiers, filtres, sélection).
 * On ouvre la boîte, on bascule les dossiers (Inbox/Envoyés/Brouillons/
 * Corbeille) et on ouvre le composer sans envoi.
 */

const FOLDERS = [/boîte de réception|inbox/i, /envoyés|sent/i, /brouillons|drafts/i, /corbeille|trash/i, /archive/i];

test.describe('Module Email — couverture étendue', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/emails');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1200);
  });

  test('bascule entre dossiers sans crash', async ({ page }) => {
    let switched = 0;
    for (const rx of FOLDERS) {
      const link = page.getByRole('link', { name: rx })
        .or(page.getByRole('button', { name: rx }))
        .or(page.getByRole('tab', { name: rx }))
        .first();
      if (await link.isVisible({ timeout: 800 }).catch(() => false)) {
        await link.click();
        await page.waitForTimeout(500);
        await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
        switched++;
      }
    }
    expect(switched, 'Aucun dossier email trouvé').toBeGreaterThan(0);
  });

  test('ouvre le composer "Nouveau mail" sans envoi', async ({ page }) => {
    const btn = page
      .getByRole('button', { name: /nouveau mail|composer|nouveau message|rédiger/i })
      .first();
    if (!(await btn.isVisible({ timeout: 4000 }).catch(() => false))) {
      test.skip(true, 'Bouton composer non visible');
    }
    await btn.click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
    await page.keyboard.press('Escape');
  });
});
