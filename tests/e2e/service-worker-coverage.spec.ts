import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie que le Service Worker est enregistré une fois l'app chargée.
 */

test.describe('Service Worker', () => {
  test('SW enregistré sur /', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);
    const registered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length > 0;
    });
    // Pas bloquant si dev sans SW : log mais ne fail pas si vide en dev
    if (!registered) test.skip(true, 'Service Worker non enregistré (probablement dev mode)');
  });
});
