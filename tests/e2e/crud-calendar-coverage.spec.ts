import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * CRUD scaffold — création d'un événement calendrier. Gated par RUN_CRUD_E2E.
 */

test.describe('CRUD événement calendrier (gated)', () => {
  test.skip(process.env.RUN_CRUD_E2E !== 'true', 'RUN_CRUD_E2E != true');

  test('création d\'un événement', async ({ page }) => {
    const unique = `E2E-evt-${Date.now()}`;
    await loginAsAdmin(page);
    await page.goto('/calendrier');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

    const add = page.getByRole('button', { name: /nouvel? événement|ajouter|créer|new event/i }).first();
    await add.click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await dialog.getByLabel(/titre|title|sujet/i).first().fill(unique);
    await dialog.getByRole('button', { name: /enregistrer|créer|save/i }).first().click();
    await page.waitForTimeout(1500);
    await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
  });
});
