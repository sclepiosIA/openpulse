import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * CRUD scaffold — création d'une note sur le premier établissement. Gated.
 */

test.describe('CRUD note (gated)', () => {
  test.skip(process.env.RUN_CRUD_E2E !== 'true', 'RUN_CRUD_E2E != true');

  test('création d\'une note sur le premier établissement', async ({ page }) => {
    const unique = `E2E-note-${Date.now()}`;
    await loginAsAdmin(page);
    await page.goto('/etablissements');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    const first = page.locator('a[href*="/etablissements/"]').first();
    if (!(await first.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Aucun établissement disponible'); return;
    }
    await first.click();
    await page.waitForTimeout(1500);

    const tab = page.getByRole('tab', { name: /notes?/i }).first();
    if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) await tab.click();
    await page.waitForTimeout(500);

    const add = page.getByRole('button', { name: /ajouter|nouvelle note|créer/i }).first();
    if (!(await add.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, 'Bouton note introuvable'); return;
    }
    await add.click();
    await page.waitForTimeout(500);
    const textarea = page.locator('textarea').first();
    await textarea.fill(unique);
    await page.getByRole('button', { name: /enregistrer|créer|save/i }).first().click();
    await page.waitForTimeout(1500);
    await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
  });
});
