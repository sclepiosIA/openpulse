import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const routes = ['/', '/etablissements', '/emails', '/people', '/taches', '/calendrier', '/tresorerie', '/parametres'];

for (const route of routes) {
  test(`no console error on ${route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const t = msg.text();
        if (/ResizeObserver|Playwright|JWT|upstream/.test(t)) return;
        errors.push(t);
      }
    });
    await loginAsAdmin(page);
    // Le test porte sur la ROUTE, pas sur la phase d'authentification. Sur une
    // suite longue, le `storageState` partagé finit par présenter un refresh
    // token expiré : Supabase répond alors 400 `refresh_token_not_found` et
    // `loginAsAdmin` se reconnecte proprement — mais l'erreur était comptée
    // au débit de la page, qui n'y est pour rien. On repart d'une ardoise
    // vierge une fois la session établie.
    errors.length = 0;
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}
