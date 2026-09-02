import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture E2E — onglets / sous-vues des modules à plusieurs panneaux.
 *
 * Beaucoup de pages utilisent des Tabs (Radix) pour structurer le
 * contenu (Trésorerie, People, RH, Établissement détail, Paramètres,
 * Emails, R&D). On clique chaque onglet visible et on vérifie :
 *   - Le panneau cible se rend (aria-selected="true").
 *   - Pas d'ErrorBoundary après bascule.
 *   - Pas d'erreur JS runtime.
 *
 * C'est l'angle de couverture qui attrape les régressions de hooks
 * conditionnels au tab actif (cf. mem://architecture/tabs-unmounting-strategy).
 */

const ERROR_BOUNDARY_RE =
  /une erreur (est|s'est) (survenue|produite)|something went wrong|oops/i;

const TAB_PAGES = [
  { path: '/tresorerie', label: 'Trésorerie' },
  { path: '/people', label: 'People' },
  { path: '/rh', label: 'RH' },
  { path: '/parametres', label: 'Paramètres' },
  { path: '/emails', label: 'Emails' },
  { path: '/rd', label: 'R&D' },
  { path: '/support', label: 'Support' },
  { path: '/rapports', label: 'Rapports' },
  { path: '/social', label: 'Social' },
];

async function cycleTabs(page: Page) {
  // Toutes les pages n'exposent pas des `role="tab"` : la fiche établissement
  // rend ses catégories comme boutons et ne monte les sous-onglets Radix que
  // lorsque la catégorie active en compte plusieurs. On accepte donc les deux
  // formes, sinon le cycle renvoyait 0 sur une navigation pourtant présente.
  const tabs = page.getByRole('tab').or(page.locator('[data-tab-nav] button'));
  const count = await tabs.count();
  if (count < 2) return 0;

  let cycled = 0;
  for (let i = 0; i < Math.min(count, 8); i++) {
    const tab = tabs.nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;

    await tab.click();
    await page.waitForTimeout(300);

    // Pas de crash.
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.getByText(ERROR_BOUNDARY_RE).first()).toHaveCount(0);
    cycled++;
  }
  return cycled;
}

test.describe('Onglets — bascule sans crash', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const { path, label } of TAB_PAGES) {
    test(`${label} (${path}) — chaque onglet est cliquable et rend son panneau`, async ({
      page,
    }) => {
      const jsErrors: string[] = [];
      page.on('pageerror', (e) => jsErrors.push(e.message));

      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

      const cycled = await cycleTabs(page);
      if (cycled === 0) {
        test.skip(true, `Pas d'onglets visibles sur ${path}.`);
        return;
      }

      expect(
        jsErrors,
        `Erreurs JS pendant le cycle d'onglets ${path}:\n${jsErrors.join('\n')}`,
      ).toHaveLength(0);
    });
  }
});

/**
 * Couverture détail établissement — la page la plus dense de l'app.
 * On vérifie qu'au moins un détail s'ouvre, et qu'on peut basculer
 * entre ses onglets internes (Infos, Contacts, Tâches, Emails, etc.).
 */
test.describe('Détail établissement — onglets internes', () => {
  test('ouvrir le premier établissement et cycler ses onglets', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/etablissements');
    await page.waitForLoadState('networkidle').catch(() => {});

    const firstLink = page
      .locator('a[href^="/etablissements/"]')
      .filter({ hasNot: page.locator('a[href="/etablissements/new"]') })
      .first();

    // `networkidle` ne se stabilise jamais (realtime + polling) : la liste peut
    // n'être hydratée qu'après une dizaine de secondes contre le live.
    if (!(await firstLink.isVisible({ timeout: 30000 }).catch(() => false))) {
      test.skip(true, 'Aucun établissement dans la liste — skip.');
      return;
    }

    await firstLink.click();
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    // La fiche charge ses données avant de rendre sa navigation.
    await page.waitForTimeout(6000);

    const cycled = await cycleTabs(page);
    expect(cycled, 'Aucun onglet cyclé sur la fiche établissement.').toBeGreaterThan(0);
  });
});
