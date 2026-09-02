import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture des détails entité : on prend la 1ʳᵉ ligne/carte de chaque
 * liste, on clique pour ouvrir la page de détail, et on vérifie qu'elle
 * monte sans crash (shell + pas d'ErrorBoundary).
 *
 * Skip propre si la liste est vide (sandbox sans données).
 */

type Entity = {
  list: string;
  label: string;
  /** Regex pour matcher un lien/ligne cliquable. */
  rowSelector: string;
};

const ENTITIES: Entity[] = [
  { list: '/etablissements', label: 'Établissement', rowSelector: 'a[href^="/etablissements/"]' },
  { list: '/prospects', label: 'Prospect', rowSelector: 'a[href^="/prospects/"]' },
  { list: '/groupes', label: 'Groupe', rowSelector: 'a[href^="/groupes/"]' },
  { list: '/partenaires', label: 'Partenaire', rowSelector: 'a[href^="/partenaires/"]' },
  { list: '/people', label: 'Personne', rowSelector: 'a[href^="/people/"]' },
  { list: '/contrats', label: 'Contrat', rowSelector: 'a[href^="/contrats/"]' },
  { list: '/taches', label: 'Tâche', rowSelector: 'a[href^="/taches/"]' },
];

test.describe('Pages de détail entités', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const e of ENTITIES) {
    test(`${e.label} — détail de la 1ʳᵉ ligne ne crashe pas`, async ({ page }) => {
      await page.goto(e.list);
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1200);

      const first = page.locator(e.rowSelector).first();
      const count = await first.count();
      if (count === 0) {
        test.skip(true, `Liste ${e.list} vide dans la sandbox`);
      }

      const href = await first.getAttribute('href');
      if (!href || href === e.list || href === `${e.list}/`) {
        test.skip(true, 'Aucun lien de détail exploitable');
      }

      await first.click();
      await page.waitForURL(/.+\/.+/, { timeout: 10000 }).catch(() => {});
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/une erreur est survenue|oops|something went wrong/i)).toHaveCount(0);
      await expect(page.getByText(/page introuvable|^404$/i)).toHaveCount(0);
    });
  }
});
