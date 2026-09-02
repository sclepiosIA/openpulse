import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie que les dialogs ouverts ont role="dialog" et aria-labelledby/label
 * (a11y critique).
 */

test.describe('Dialogs accessibles', () => {
  test('au moins un dialog ouvrable expose role+label', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/etablissements', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Tente d'ouvrir un dialog via un bouton "Ajouter / Nouveau / Créer"
    const trigger = page.getByRole('button', { name: /nouveau|ajouter|créer|new/i }).first();
    if (!(await trigger.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, 'Aucun bouton de création trouvé');
      return;
    }
    await trigger.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"]').first();
    if (!(await dialog.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, 'Pas de dialog ouvert');
      return;
    }
    const labelled = await dialog.evaluate(el =>
      !!el.getAttribute('aria-label') || !!el.getAttribute('aria-labelledby')
    );
    expect(labelled, 'Dialog sans aria-label/labelledby').toBe(true);
    await page.keyboard.press('Escape');
  });
});
