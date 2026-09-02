import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couvre les recherches/filtres globaux et locaux : on tape dans la première
 * search-box visible de chaque module et on vérifie qu'aucun crash ne
 * survient (pas d'ErrorBoundary, le shell reste monté, la liste se met à jour).
 *
 * On ne vérifie pas un résultat précis (dépendant des données) — l'objectif
 * est d'attraper les régressions de debounce / parsing / requête vide.
 */

type SearchTarget = {
  path: string;
  label: string;
  query: string;
};

const TARGETS: SearchTarget[] = [
  { path: '/etablissements', label: 'Établissements', query: 'a' },
  { path: '/prospects', label: 'Prospects', query: 'test' },
  { path: '/groupes', label: 'Groupes', query: 'a' },
  { path: '/partenaires', label: 'Partenaires', query: 'a' },
  { path: '/people', label: 'People', query: 'a' },
  { path: '/emails', label: 'Emails', query: 'facture' },
  { path: '/taches', label: 'Tâches', query: 'a' },
  { path: '/documents', label: 'Documents', query: 'pdf' },
  { path: '/contrats', label: 'Contrats', query: 'a' },
];

test.describe('Recherches & filtres', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const t of TARGETS) {
    test(`${t.label} — saisie dans la 1ʳᵉ search-box ne crashe pas`, async ({ page }) => {
      await page.goto(t.path);
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

      const search = page
        .getByPlaceholder(/recherch|search|filtrer|rechercher/i)
        .or(page.locator('input[type="search"]'))
        .first();

      if (!(await search.isVisible({ timeout: 4000 }).catch(() => false))) {
        test.skip(true, `Aucune search-box visible sur ${t.path}`);
      }

      await search.fill(t.query);
      // Laisse passer le debounce typique (300ms) + requête.
      await page.waitForTimeout(900);

      // Pas d'ErrorBoundary.
      await expect(page.getByText(/une erreur est survenue|oops|something went wrong/i))
        .toHaveCount(0);
      // Shell toujours là.
      await expect(page.locator('#main-content')).toBeVisible();

      // Vider la recherche ne doit pas crasher non plus.
      await search.fill('');
      await page.waitForTimeout(500);
      await expect(page.locator('#main-content')).toBeVisible();
    });
  }
});
