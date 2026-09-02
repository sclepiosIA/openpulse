import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture E2E — alias, routes legacy et redirections.
 *
 * Objectif : verrouiller les anciennes URLs encore référencées par la
 * navigation, les audits browser-use ou les utilisateurs. Une route legacy
 * doit soit rediriger vers sa page canonique, soit afficher un refus RBAC
 * contrôlé si le compte E2E n'a pas le rôle requis — jamais une 404, jamais
 * un écran blanc, jamais un ErrorBoundary.
 */

type AliasRoute = {
  source: string;
  finalUrl: RegExp;
  guarded?: boolean;
};

const ERROR_BOUNDARY_RE =
  /une erreur (est|s'est) (survenue|produite)|something went wrong|oops/i;
const NOT_FOUND_RE = /page introuvable|404|n'existe pas/i;

const ALIAS_ROUTES: AliasRoute[] = [
  { source: '/dashboard', finalUrl: /\/$/ },
  { source: '/auth', finalUrl: /\/$/ },
  { source: '/login', finalUrl: /\/$/ },
  { source: '/user/login', finalUrl: /\/$/ },
  { source: '/clients', finalUrl: /\/clients(?:[?#].*)?$/ },
  { source: '/commercial', finalUrl: /\/commercial(?:[?#].*)?$/ },
  { source: '/etablissement', finalUrl: /\/etablissements(?:[?#].*)?$/ },
  { source: '/booking', finalUrl: /\/prise-rdv(?:[?#].*)?$/ },
  { source: '/taches', finalUrl: /\/todos(?:[?#].*)?$/ },
  { source: '/rh', finalUrl: /\/rh(?:[?#].*)?$/, guarded: true },
  // L'onglet paie de People a pour identifiant `salaires` (cf. PEOPLE_TABS) :
  // `tab=paie` ne correspondait à aucun onglet et People repliait sur `analyses`.
  { source: '/rh/paie', finalUrl: /\/people\?tab=salaires$/, guarded: true },
  { source: '/admin', finalUrl: /\/parametres(?:[?#].*)?$/, guarded: true },
  { source: '/pipeline', finalUrl: /\/(prospects|pipeline)(?:[?#].*)?$/, guarded: true },
  { source: '/pipeline/contrats', finalUrl: /\/(contrats|prospects)(?:[?#].*)?$/, guarded: true },
  { source: '/cfo', finalUrl: /\/tresorerie(?:[?#].*)?$/, guarded: true },
  { source: '/csm', finalUrl: /\/playbooks-csm(?:[?#].*)?$/, guarded: true },
  { source: '/churn-predictor', finalUrl: /\/churn(?:[?#].*)?$/, guarded: true },
  { source: '/tresorerie/facturation/contrats', finalUrl: /\/contrats(?:[?#].*)?$/, guarded: true },
  { source: '/support/E2E-LEGACY-TICKET', finalUrl: /\/support\?ticket=E2E-LEGACY-TICKET$/, guarded: true },
];

async function assertNoCrash(page: Page) {
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(ERROR_BOUNDARY_RE).first()).toHaveCount(0);
  await expect(page.getByText(NOT_FOUND_RE).first()).toHaveCount(0);
}

test.describe('Routes legacy / alias — pas de 404 ni crash', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const { source, finalUrl, guarded } of ALIAS_ROUTES) {
    test(`${source} résout vers une destination contrôlée`, async ({ page }) => {
      const runtimeErrors: string[] = [];
      page.on('pageerror', (error) => runtimeErrors.push(error.message));

      const response = await page.goto(source, { waitUntil: 'domcontentloaded' });
      if (response && response.status() >= 500) {
        throw new Error(`HTTP ${response.status()} sur ${source}`);
      }
      await page.waitForLoadState('networkidle').catch(() => {});

      await assertNoCrash(page);

      const denied = await page
        .getByText(/accès refusé/i)
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false);

      if (!guarded || !denied) {
        await expect
          .poll(() => page.url(), {
            message: `${source} devrait résoudre vers ${finalUrl}`,
            timeout: 8000,
          })
          .toMatch(finalUrl);
      }

      expect(runtimeErrors, `Erreurs runtime sur ${source}:\n${runtimeErrors.join('\n')}`).toHaveLength(0);
    });
  }
});