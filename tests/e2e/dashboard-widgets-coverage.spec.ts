import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie que les widgets dashboard rendent sans skeleton bloqué (toujours
 * du contenu réel après 5s).
 */

test.describe('Dashboard widgets', () => {
  test('widgets dashboard contiennent du contenu après 5s', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(5000);
    // On compte les blocs "Card" shadcn présents
    const cards = await page.locator('[class*="card"], [data-slot="card"]').count();
    expect(cards, 'Aucun widget Card sur dashboard').toBeGreaterThan(0);
    await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
  });
});
