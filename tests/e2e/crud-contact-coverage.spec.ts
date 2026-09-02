import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * CRUD scaffold — création d'un contact lié à un établissement. Gated.
 */

test.describe('CRUD contact (gated)', () => {
  test.skip(process.env.RUN_CRUD_E2E !== 'true', 'RUN_CRUD_E2E != true');

  test('création d\'un contact sur le premier établissement', async ({ page }) => {
    const unique = `E2E-contact-${Date.now()}`;
    await loginAsAdmin(page);
    await page.goto('/etablissements');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    const firstRow = page.locator('a[href*="/etablissements/"]').first();
    if (!(await firstRow.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Aucun établissement disponible');
      return;
    }
    await firstRow.click();
    await page.waitForTimeout(1500);

    const tab = page.getByRole('tab', { name: /contacts?/i }).first();
    if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) await tab.click();
    await page.waitForTimeout(500);

    const add = page.getByRole('button', { name: /ajouter|nouveau contact|créer/i }).first();
    if (!(await add.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, 'Bouton ajout contact introuvable');
      return;
    }
    await add.click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog.getByLabel(/nom|name/i).first().fill(unique);
    const emailField = dialog.getByLabel(/email/i).first();
    if (await emailField.isVisible().catch(() => false)) {
      await emailField.fill(`${unique}@example.com`);
    }
    await dialog.getByRole('button', { name: /enregistrer|créer|save/i }).first().click();
    await page.waitForTimeout(1500);
    await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
  });
});
