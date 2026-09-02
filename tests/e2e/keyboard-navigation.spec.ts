import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * E2E navigation clavier sur les pages clés.
 * Vérifie que le focus est visible et que Tab atteint les éléments interactifs principaux.
 */

const ROUTES = ['/', '/etablissements', '/emails', '/people'];

test.describe('Keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const path of ROUTES) {
    test(`focus is reachable via Tab on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Tab plusieurs fois et vérifier qu'on atteint un élément focusable distinct
      const focused = new Set<string>();
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const tag = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          return `${el.tagName}:${el.getAttribute('aria-label') ?? el.textContent?.slice(0, 30) ?? ''}`;
        });
        if (tag) focused.add(tag);
      }
      expect(focused.size, `Aucun élément focusable atteint via Tab sur ${path}`).toBeGreaterThan(2);

      // Vérifier qu'un outline ou ring est appliqué au focus (focus visible)
      await page.keyboard.press('Tab');
      const hasVisibleFocus = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return false;
        const style = window.getComputedStyle(el);
        return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
      });
      expect(hasVisibleFocus, `Focus non visible sur ${path}`).toBe(true);
    });
  }
});
