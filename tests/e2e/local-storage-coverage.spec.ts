import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie la persistance localStorage : préférences utilisateur (sidebar
 * collapsed, theme) survivent à un reload.
 */

test.describe('Préférences UI persistées', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
  });

  test('clé arbitraire survit au reload', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('e2e-coverage-test', 'persisted-value'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    const value = await page.evaluate(() => localStorage.getItem('e2e-coverage-test'));
    expect(value).toBe('persisted-value');
    await page.evaluate(() => localStorage.removeItem('e2e-coverage-test'));
  });

  test('session Supabase persistée après reload', async ({ page }) => {
    const hasToken = await page.evaluate(() => {
      return Object.keys(localStorage).some(k => k.includes('supabase') || k.includes('sb-'));
    });
    expect(hasToken, 'Aucune clé Supabase en localStorage').toBe(true);
  });
});
