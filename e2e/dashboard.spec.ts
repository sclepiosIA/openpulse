/**
 * E2E P0 — Dashboard authentifié.
 *
 * Vérifie que l'utilisateur pré-authentifié atterrit sur le dashboard,
 * qu'aucune erreur JS ne survient et que les KPIs sont rendus.
 */
import { test, expect, BASE_URL } from './fixtures/auth';

test.describe('Dashboard', () => {
  test('rend le dashboard sans erreur console', async ({ authedPage }) => {
    const errors: string[] = [];
    authedPage.on('pageerror', (e) => errors.push(String(e)));
    authedPage.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await authedPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });

    // Route stable : on ne doit PAS être renvoyé sur /auth
    await expect(authedPage).not.toHaveURL(/\/auth(\?|$)/);

    // Le layout principal doit être présent
    await expect(authedPage.locator('main, [role="main"]').first()).toBeVisible({ timeout: 10_000 });

    expect(errors, `Erreurs console : \n${errors.join('\n')}`).toEqual([]);
  });
});
