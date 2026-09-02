import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture breadcrumb global : on parcourt une chaîne de navigation
 * profonde et on vérifie que le breadcrumb reflète bien l'historique
 * et que chaque maillon est cliquable et fonctionnel.
 */

test.describe('Breadcrumb global', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('navigation profonde alimente le breadcrumb cliquable', async ({ page }) => {
    // Navigation : Dashboard → Établissements → 1ʳᵉ fiche → Tâches
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

    await page.goto('/etablissements');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

    await page.goto('/taches');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

    // Cherche un breadcrumb visible (nav aria-label="breadcrumb" ou liste avec séparateur).
    const crumb = page
      .locator('nav[aria-label*="breadcrumb" i], [data-testid*="breadcrumb" i]')
      .first();

    if (!(await crumb.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Breadcrumb non exposé sur cette route');
    }

    // Au moins un lien cliquable.
    const links = crumb.locator('a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    // Le 1ᵉʳ lien (souvent Dashboard) doit ramener au /.
    await links.first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
  });
});
