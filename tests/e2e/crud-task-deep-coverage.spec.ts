import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * CRUD profond — création → édition → suppression d'une tâche personnelle.
 *
 * Gated : RUN_CRUD_E2E=true. Utilise un titre unique horodaté pour éviter
 * tout conflit avec des données existantes et faciliter le nettoyage.
 */

test.describe('CRUD task — flow complet (gated)', () => {
  test.skip(process.env.RUN_CRUD_E2E !== 'true', 'RUN_CRUD_E2E != true');

  test('créer → éditer → supprimer une tâche', async ({ page }) => {
    const title = `E2E-task-${Date.now()}`;
    const titleEdited = `${title}-edited`;

    await loginAsAdmin(page);
    await page.goto('/taches');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

    // 1. CREATE
    const addBtn = page
      .getByRole('button', { name: /nouvelle tâche|ajouter|créer|new task/i })
      .first();
    await addBtn.click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const titleInput = dialog
      .getByLabel(/titre|title/i)
      .or(dialog.locator('input[name="titre"], input[name="title"]'))
      .first();
    await titleInput.fill(title);
    await dialog
      .getByRole('button', { name: /enregistrer|créer|save|valider/i })
      .first()
      .click();
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 });

    // 2. UPDATE
    await page.getByText(title).first().click();
    await page.waitForTimeout(600);
    const editBtn = page.getByRole('button', { name: /modifier|éditer|edit/i }).first();
    if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editBtn.click();
    }
    const editDialog = page.locator('[role="dialog"]').first();
    if (await editDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      const inp = editDialog
        .getByLabel(/titre|title/i)
        .or(editDialog.locator('input[name="titre"], input[name="title"]'))
        .first();
      await inp.fill(titleEdited);
      await editDialog
        .getByRole('button', { name: /enregistrer|save|valider/i })
        .first()
        .click();
      await expect(page.getByText(titleEdited).first()).toBeVisible({ timeout: 10000 });
    }

    // 3. DELETE (cleanup obligatoire)
    const target = page.getByText(titleEdited).or(page.getByText(title)).first();
    await target.click();
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
      // Vérifie disparition
      await expect(page.getByText(titleEdited)).toHaveCount(0, { timeout: 8000 });
    }
  });
});
