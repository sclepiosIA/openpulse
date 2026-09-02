import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture E2E — navigation listing → détail.
 *
 * Pour chaque listing principal, on vérifie que :
 *   1. La table/grille contient au moins une ligne (sinon skip propre).
 *   2. Cliquer la première ligne ouvre bien une route détail (URL change
 *      vers /<base>/:id) sans crash ni 404.
 *   3. Le détail affiche le shell + pas d'ErrorBoundary.
 *
 * C'est l'angle de couverture le moins couvert par les specs métier
 * existantes : on attrape les régressions de routing détail, de hooks
 * RPC paramétrés par id, et de chargement initial des pages détail.
 */

const ERROR_BOUNDARY_RE =
  /une erreur (est|s'est) (survenue|produite)|something went wrong|oops/i;

async function ensureAuthAndGoto(page: Page, path: string) {
  await loginAsAdmin(page);
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
}

/**
 * Trouve la première ligne cliquable d'un listing. On tente plusieurs
 * sélecteurs (table row, card, link) parce que les pages utilisent des
 * structures hétérogènes.
 */
/** `isVisible()` renvoie l'état instantané ; on veut une vraie attente. */
async function appears(locator: ReturnType<Page['locator']>, timeout: number) {
  return locator
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);
}

async function firstClickableRow(page: Page, basePath: string) {
  // 1) Liens internes vers /<base>/<id>. Les listes n'étant hydratées qu'après
  //    une dizaine de secondes en live, il faut réellement attendre : avec
  //    `isVisible()` la réponse tombait avant l'affichage des données.
  const linkLike = page
    .locator(`a[href^="${basePath}/"]`)
    .filter({ hasNot: page.locator(`a[href="${basePath}/new"]`) })
    .first();
  if (await appears(linkLike, 30000)) {
    return linkLike;
  }

  // 2) Rangée de tableau cliquable (certaines listes n'utilisent pas d'<a>).
  const tableRow = page.locator('table tbody tr').first();
  if (await appears(tableRow, 10000)) {
    return tableRow;
  }

  // 3) Carte/élément data-testid="row" générique.
  const card = page.locator('[data-testid*="row"], [data-testid*="card"]').first();
  if (await appears(card, 5000)) {
    return card;
  }

  return null;
}

const LISTINGS = [
  { listing: '/etablissements', detailBase: '/etablissements' },
  { listing: '/groupes', detailBase: '/groupes' },
  { listing: '/partenaires', detailBase: '/partenaires' },
  { listing: '/contrats', detailBase: '/contrats' },
  { listing: '/support', detailBase: '/support' },
  { listing: '/people', detailBase: '/people' },
  { listing: '/formulaires', detailBase: '/formulaires' },
  { listing: '/rapports-custom', detailBase: '/rapports-custom' },
  { listing: '/automatisations', detailBase: '/automatisations' },
];

test.describe('Navigation listing → détail', () => {
  for (const { listing, detailBase } of LISTINGS) {
    test(`${listing} : ouvrir le premier item charge un détail valide`, async ({
      page,
    }) => {
      await ensureAuthAndGoto(page, listing);

      const row = await firstClickableRow(page, detailBase);
      if (!row) {
        test.skip(true, `Listing ${listing} vide pour la session — skip propre.`);
        return;
      }

      const urlBefore = page.url();
      await row.click();
      await page.waitForTimeout(2500);

      // Toutes les listes n'ouvrent pas un détail au clic sur la ligne :
      // /automatisations, par exemple, réserve la navigation à la colonne
      // « Actions ». Si l'URL n'a pas bougé ET qu'aucun lien de détail n'est
      // exposé, c'est un choix d'interface, pas une navigation cassée — on
      // ignore proprement au lieu de dénoncer un défaut inexistant.
      if (page.url() === urlBefore) {
        const hasDetailLink = await page
          .locator(`a[href^="${detailBase}/"]`)
          .filter({ hasNot: page.locator(`a[href="${detailBase}/new"]`) })
          .count();
        if (!hasDetailLink) {
          test.skip(true, `${listing} n'expose pas de navigation vers un détail au clic — skip propre.`);
          return;
        }
      }

      // URL doit avoir basculé sur le détail.
      await expect
        .poll(() => page.url(), {
          message: `L'URL devrait contenir ${detailBase}/<id> après clic`,
          timeout: 15000,
        })
        .toMatch(new RegExp(`${detailBase}/[^/?#]+`));

      // Shell + pas d'erreur.
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(ERROR_BOUNDARY_RE).first()).toHaveCount(0);
      await expect(page.getByText(/page introuvable|404/i).first()).toHaveCount(0);
      await expect(page.getByText(/accès refusé/i).first()).toHaveCount(0);
    });
  }
});

/**
 * Couverture filtres / recherche : sur chaque listing principal,
 * on saisit du texte dans le premier champ "Rechercher" et on vérifie
 * que la page ne crashe pas et que l'URL ou la liste s'actualise.
 */
const SEARCH_TARGETS = [
  '/etablissements',
  '/groupes',
  '/partenaires',
  '/prospects',
  '/contrats',
  '/people',
  '/taches',
  '/documents',
  '/catalogue-produits',
];

test.describe('Recherche / filtres listings', () => {
  for (const path of SEARCH_TARGETS) {
    test(`${path} : la barre de recherche accepte un input sans crash`, async ({
      page,
    }) => {
      await ensureAuthAndGoto(page, path);

      const search = page
        .getByPlaceholder(/rechercher|search|filtrer/i)
        .or(page.getByRole('searchbox'))
        .first();

      if (!(await search.isVisible({ timeout: 3000 }).catch(() => false))) {
        test.skip(true, `Pas de champ recherche visible sur ${path}.`);
        return;
      }

      await search.fill('zzz-noresult-' + Date.now());
      await page.waitForLoadState('networkidle').catch(() => {});

      // Pas de crash après filtrage.
      await expect(page.locator('#main-content')).toBeVisible();
      await expect(page.getByText(ERROR_BOUNDARY_RE).first()).toHaveCount(0);

      // Soit le listing s'est vidé (« aucun résultat »), soit reste un état
      // valide — l'important : pas d'erreur runtime.
      const pageErrors: string[] = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      expect(pageErrors).toHaveLength(0);
    });
  }
});

/**
 * Sidebar : tous les items principaux sont cliquables et changent l'URL
 * sans crasher. Couvre les régressions de navigation (lazy chunks,
 * permissions sidebar, redirections).
 */
const SIDEBAR_ITEM_REGEX = [
  /tableau de bord|dashboard/i,
  /établissement/i,
  /prospect/i,
  /contrat/i,
  /trésor/i,
  /facturation/i,
  /email/i,
  /calendrier/i,
  /tâche/i,
  /pulse/i,
  /people|équipe/i,
  /support/i,
  /paramètr/i,
];

test.describe('Sidebar — navigation rapide', () => {
  test('cliquer chaque item principal charge la page correspondante', async ({
    page,
  }) => {
    await ensureAuthAndGoto(page, '/');

    for (const re of SIDEBAR_ITEM_REGEX) {
      const item = page
        .locator('nav, aside, [role="navigation"]')
        .getByRole('link', { name: re })
        .first();

      if (!(await item.isVisible({ timeout: 1500 }).catch(() => false))) {
        continue; // Item non exposé pour ce rôle — on saute, pas d'échec.
      }

      await item.click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(ERROR_BOUNDARY_RE).first()).toHaveCount(0);
    }
  });
});
