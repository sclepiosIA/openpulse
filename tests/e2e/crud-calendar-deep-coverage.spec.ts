import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * CRUD profond — création → suppression d'un événement calendrier.
 * Gated : RUN_CRUD_E2E=true.
 */

test.describe('CRUD calendrier — flow complet (gated)', () => {
  test.skip(process.env.RUN_CRUD_E2E !== 'true', 'RUN_CRUD_E2E != true');

  test('créer puis supprimer un événement', async ({ page }) => {
    const title = `E2E-evt-${Date.now()}`;

    await loginAsAdmin(page);
    await page.goto('/calendrier');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

    // CREATE
    const addBtn = page
      .getByRole('button', { name: /nouvel? événement|ajouter|créer|new event/i })
      .first();
    await addBtn.click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const titleInput = dialog
      .getByLabel(/titre|title|sujet/i)
      .or(dialog.locator('input[name="titre"], input[name="title"]'))
      .first();
    await titleInput.fill(title);
    await dialog
      .getByRole('button', { name: /enregistrer|créer|save|valider/i })
      .first()
      .click();
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 });

    // DELETE
    await page.getByText(title).first().click();
    await page.waitForTimeout(600);
    const del = page.getByRole('button', { name: /supprimer|delete/i }).first();
    if (await del.isVisible({ timeout: 2000 }).catch(() => false)) {
      await del.click();
      const confirm = page
        .getByRole('button', { name: /confirmer|oui|delete|supprimer/i })
        .last();
      if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirm.click();
      }
      await expect(page.getByText(title)).toHaveCount(0, { timeout: 8000 });
    }
  });
});
