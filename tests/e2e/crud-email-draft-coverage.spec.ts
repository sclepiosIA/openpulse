import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * CRUD scaffold — création d'un brouillon email. Gated par RUN_CRUD_E2E.
 */

test.describe('CRUD brouillon email (gated)', () => {
  test.skip(process.env.RUN_CRUD_E2E !== 'true', 'RUN_CRUD_E2E != true');

  test('création puis fermeture d\'un brouillon', async ({ page }) => {
    const unique = `E2E-mail-${Date.now()}`;
    await loginAsAdmin(page);
    await page.goto('/emails');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

    const compose = page.getByRole('button', { name: /nouveau mail|écrire|composer|new email/i }).first();
    await compose.click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await dialog.getByLabel(/sujet|subject|objet/i).first().fill(unique);
    // Fermer sans envoyer (sauvegarde brouillon)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
  });
});
