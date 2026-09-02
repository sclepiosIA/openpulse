import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture GED / documents : route canonique et absence de faux positif 404.
 */

test.describe('Documents (GED)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('/documents charge la GED et non la page 404', async ({ page }) => {
    const resp = await page.goto('/documents', { waitUntil: 'domcontentloaded' }).catch(() => null);
    if (resp && resp.status() >= 500) throw new Error(`HTTP ${resp.status()} sur /documents`);

    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
    await expect(page.getByText(/page introuvable|404/i)).toHaveCount(0);
    await expect(page).toHaveURL(/\/documents(?:[?#].*)?$/);
  });
});
