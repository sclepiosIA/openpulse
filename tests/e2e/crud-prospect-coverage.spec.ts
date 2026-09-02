import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * CRUD scaffold — crée puis supprime un prospect via l'UI.
 * Skippé tant que RUN_CRUD_E2E != true (évite de polluer la DB par défaut).
 *
 * Active avec RUN_CRUD_E2E=true.
 */

test.describe('CRUD prospect (gated)', () => {
  test.skip(process.env.RUN_CRUD_E2E !== 'true', 'RUN_CRUD_E2E != true');

  test('création puis suppression d\'un prospect', async ({ page }) => {
    const unique = `E2E-${Date.now()}`;
    await loginAsAdmin(page);
    await page.goto('/prospects');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

    const add = page.getByRole('button', { name: /nouveau|ajouter|créer prospect|new prospect/i }).first();
    await add.click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const nameInput = dialog.getByLabel(/nom|name|établissement/i).first();
    await nameInput.fill(unique);
    await dialog.getByRole('button', { name: /enregistrer|créer|save/i }).first().click();

    await expect(page.getByText(unique).first()).toBeVisible({ timeout: 10000 });

    // Cleanup : ouvrir la ligne et supprimer
    await page.getByText(unique).first().click();
    await page.waitForTimeout(800);
    const del = page.getByRole('button', { name: /supprimer|delete/i }).first();
    if (await del.isVisible({ timeout: 2000 }).catch(() => false)) {
      await del.click();
      const confirm = page.getByRole('button', { name: /confirmer|oui|delete/i }).last();
      if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirm.click();
      }
    }
  });
});
