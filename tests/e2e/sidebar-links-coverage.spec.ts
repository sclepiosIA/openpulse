import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture sidebar : on déroule chaque section et on clique sur chaque
 * lien visible pour vérifier qu'aucun lien de menu ne mène à un crash.
 *
 * Note : le contenu exact des sections étant dynamique (RBAC), on parcourt
 * tous les `<a>` à l'intérieur du `<nav>` ou `[data-sidebar]`.
 */

test.describe('Sidebar — tous les liens visibles', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('chaque lien sidebar charge sans crash', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

    // La barre latérale rend ses entrées après le chargement des permissions :
    // prendre le premier conteneur correspondant sans attendre renvoyait un
    // élément encore vide, d'où 0 lien collecté.
    const nav = page.locator('[data-sidebar="sidebar"], aside, nav[aria-label]').first();
    if (!(await nav.isVisible({ timeout: 15000 }).catch(() => false))) {
      test.skip(true, 'Sidebar non visible (mobile ?)');
    }
    await expect(nav.locator('a[href^="/"]').first()).toBeVisible({ timeout: 30000 });

    // Récupère les hrefs internes uniques.
    const hrefs = await nav.locator('a[href^="/"]').evaluateAll((els) =>
      Array.from(new Set(els.map((a) => (a as HTMLAnchorElement).getAttribute('href')!)))
        .filter((h) => h && !h.startsWith('//') && !h.startsWith('/auth'))
    );

    expect(hrefs.length).toBeGreaterThan(3);

    const failures: string[] = [];
    // 30 navigations à ~8 s chacune contre le live : le budget par défaut ne
    // suffit pas, on l'élargit explicitement pour ce parcours.
    test.setTimeout(10 * 60 * 1000);
    // Limite à 30 pour la durée du test.
    for (const href of hrefs.slice(0, 30)) {
      const resp = await page.goto(href, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (resp && resp.status() >= 500) {
        failures.push(`${href} → HTTP ${resp.status()}`);
        continue;
      }
      // `isVisible()` renvoie l'état INSTANTANÉ : son option `timeout` ne fait
      // pas attendre. Chaque page était donc déclarée « shell absent » avant
      // d'avoir eu le temps de monter (7 à 11 s en live). `waitFor` attend
      // réellement.
      const shellOk = await page
        .locator('#main-content')
        .waitFor({ state: 'visible', timeout: 25000 })
        .then(() => true)
        .catch(() => false);
      const boundary = await page.getByText(/une erreur est survenue|oops/i).count();
      const notFound = await page.getByText(/page introuvable|^404$/i).count();
      if (!shellOk) failures.push(`${href} → shell absent`);
      if (boundary > 0) failures.push(`${href} → ErrorBoundary`);
      if (notFound > 0) failures.push(`${href} → 404`);
    }

    expect(failures, `Liens sidebar défaillants:\n  - ${failures.join('\n  - ')}`).toHaveLength(0);
  });
});
