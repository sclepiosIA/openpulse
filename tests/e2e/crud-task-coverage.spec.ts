import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * CRUD scaffold — création/suppression d'une tâche. Gated par RUN_CRUD_E2E.
 */

test.describe('CRUD tâche (gated)', () => {
  test.skip(process.env.RUN_CRUD_E2E !== 'true', 'RUN_CRUD_E2E != true');

  test('création puis suppression d\'une tâche', async ({ page }) => {
    const unique = `E2E-task-${Date.now()}`;
    await loginAsAdmin(page);
    await page.goto('/taches');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

    const add = page.getByRole('button', { name: /nouvelle tâche|ajouter|créer|new task/i }).first();
    await add.click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await dialog.getByLabel(/titre|title|intitulé/i).first().fill(unique);
    await dialog.getByRole('button', { name: /enregistrer|créer|save/i }).first().click();

    await expect(page.getByText(unique).first()).toBeVisible({ timeout: 10000 });
  });
});
