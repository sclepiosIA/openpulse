import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture E2E — liens internes visibles.
 *
 * Parcourt les liens visibles depuis plusieurs pages racines, puis visite un
 * échantillon dédupliqué pour vérifier qu'aucun lien exposé à l'utilisateur
 * connecté ne mène vers une 404, un écran blanc, un accès refusé ou un crash.
 */

const ERROR_BOUNDARY_RE =
  /une erreur (est|s'est) (survenue|produite)|something went wrong|oops/i;
const NOT_FOUND_RE = /page introuvable|404|n'existe pas/i;

const SEED_ROUTES = [
  '/',
  '/etablissements',
  '/prospects',
  '/emails',
  '/todos',
  '/people',
  '/tresorerie',
  '/support',
  '/documents',
  '/rapports-custom',
  '/social',
  '/automatisations',
  '/parametres',
];

const EXPLICIT_INTERNAL_LINKS = [
  '/dashboard',
  '/clients',
  '/commercial',
  '/booking',
  '/taches',
  '/cfo',
  '/csm',
  '/churn-predictor',
  '/m/mail',
  '/m/todos',
  '/m/pulse',
  '/m/calendrier',
  '/m/documents',
  '/m/install',
];

type CollectedLinks = {
  links: string[];
  brokenAnchors: string[];
};

async function collectVisibleInternalLinks(page: Page, path: string): Promise<CollectedLinks> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

  return page.locator('a[href]').evaluateAll((anchors) => {
    const current = new URL(window.location.href);
    const links = new Set<string>();
    const brokenAnchors: string[] = [];

    for (const anchor of anchors as HTMLAnchorElement[]) {
      const href = anchor.getAttribute('href')?.trim() ?? '';
      const style = window.getComputedStyle(anchor);
      const visible =
        anchor.getClientRects().length > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';

      if (!visible) continue;
      if (!href) continue;

      if (href.startsWith('#')) {
        const id = decodeURIComponent(href.slice(1));
        if (id && !document.getElementById(id)) brokenAnchors.push(`${current.pathname} → ${href}`);
        continue;
      }

      if (/^(mailto|tel|blob|data):/i.test(href)) continue;
      if (/^javascript:/i.test(href)) {
        brokenAnchors.push(`${current.pathname} → ${href}`);
        continue;
      }

      let url: URL;
      try {
        url = new URL(href, current);
      } catch {
        brokenAnchors.push(`${current.pathname} → ${href}`);
        continue;
      }

      if (url.origin !== current.origin) continue;
      if (url.pathname.startsWith('/assets/')) continue;
      if (/\.(pdf|csv|xlsx?|docx?|zip|ics|png|jpe?g|webp|svg)(\?|$)/i.test(url.pathname)) continue;

      links.add(`${url.pathname}${url.search}`);
    }

    return { links: [...links], brokenAnchors };
  });
}

test.describe('Liens internes visibles — pas de lien mort', () => {
  test('les liens exposés depuis les pages racines chargent une route valide', async ({ page }) => {
    await loginAsAdmin(page);

    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    const candidates = new Set<string>(EXPLICIT_INTERNAL_LINKS);
    const brokenAnchors: string[] = [];

    for (const seed of SEED_ROUTES) {
      const denied = page.getByText(/accès refusé/i).first();
      const collected = await collectVisibleInternalLinks(page, seed).catch(() => ({
        links: [],
        brokenAnchors: [],
      }));

      if (await denied.isVisible({ timeout: 500 }).catch(() => false)) continue;

      collected.links.forEach((link) => candidates.add(link));
      brokenAnchors.push(...collected.brokenAnchors);
    }

    expect(brokenAnchors, `Ancres internes cassées:\n${brokenAnchors.join('\n')}`).toHaveLength(0);

    const sample = [...candidates]
      .filter((link) => !/^\/f\//.test(link))
      .slice(0, 60);

    for (const link of sample) {
      const beforeErrorCount = runtimeErrors.length;
      const response = await page.goto(link, { waitUntil: 'domcontentloaded' });
      if (response && response.status() >= 500) {
        throw new Error(`HTTP ${response.status()} sur lien interne ${link}`);
      }
      await page.waitForLoadState('networkidle').catch(() => {});

      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(ERROR_BOUNDARY_RE).first()).toHaveCount(0);
      await expect(page.getByText(NOT_FOUND_RE).first()).toHaveCount(0);
      await expect(page.getByText(/accès refusé/i).first()).toHaveCount(0);

      const newErrors = runtimeErrors.slice(beforeErrorCount);
      expect(newErrors, `Erreurs runtime après navigation vers ${link}:\n${newErrors.join('\n')}`).toHaveLength(0);
    }
  });
});