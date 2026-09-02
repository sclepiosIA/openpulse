import { test, expect } from '@playwright/test';

/**
 * Couverture E2E — routes publiques (sans authentification).
 *
 * Ces routes sont exposées sans session : il faut qu'elles chargent
 * sans rediriger vers /auth, sans afficher de shell admin, et sans
 * crasher quand un slug invalide est fourni.
 *
 * Périmètre :
 *   - Mentions légales / politique de confidentialité (RGPD).
 *   - DPO Martinique (page de conformité dédiée).
 *   - Prise de RDV publique via /rdv (l'alias interne /booking reste protégé).
 *   - Formation publique + résurgences.
 *   - Émargement interne protégé, avec contrôle explicite de redirection.
 *   - Enquête satisfaction solution.
 *   - Protection par défaut des routes internes inconnues.
 */

// Empêche le storageState authentifié par défaut du global-setup.
test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(60_000);

const ERROR_BOUNDARY_RE =
  /une erreur (est|s'est) (survenue|produite)|something went wrong|oops/i;

const ROUTE_RENDER_TIMEOUT_MS = 30_000;

const PUBLIC_ROUTES = [
  { path: '/mentions-legales', label: 'Mentions légales', mustContain: /mentions légales|éditeur|hébergeur/i },
  { path: '/politique-confidentialite', label: 'Politique confidentialité', mustContain: /confidentialité|rgpd|données personnelles/i },
  { path: '/dpo-martinique', label: 'DPO Martinique', mustContain: /dpo|données|protection/i },
  { path: '/rdv', label: 'Prise de rendez-vous publique', mustContain: /prise de rendez-vous|identifiant fourni/i },
  { path: '/formation', label: 'Espace formation', mustContain: /formation|module|apprentissage|connexion/i },
  { path: '/formation-resurgences', label: 'Résurgences', mustContain: /résurgence|formation|module/i },
  { path: '/enquete-satisfaction-solution', label: 'Enquête satisfaction', mustContain: /satisfaction|enquête|note/i },
];

const AUTHENTICATED_ROUTES = [
  { path: '/booking', label: 'Alias interne de prise de rendez-vous' },
  { path: '/utilisateurs/emargement', label: 'Émargement utilisateurs interne' },
  { path: '/emargement', label: 'Alias interne d’émargement' },
  { path: '/visio/room-inexistant', label: 'Salle visio interne inconnue' },
];

test.describe('Routes publiques — chargement sans authentification', () => {
  for (const { path, label, mustContain } of PUBLIC_ROUTES) {
    test(`${label} (${path}) charge sans auth`, async ({ page }) => {
      const jsErrors: string[] = [];
      page.on('pageerror', (e) => jsErrors.push(e.message));

      await page.goto(path, { waitUntil: 'domcontentloaded' });

      // Le shell Azure peut afficher brièvement « Chargement... » après DOMContentLoaded.
      // On attend le contenu métier plutôt qu'un networkidle précoce et non déterministe.
      const marker = page.getByText(mustContain).first();
      await expect(marker).toBeVisible({ timeout: ROUTE_RENDER_TIMEOUT_MS });

      // Ne doit PAS rediriger vers /auth (route publique).
      expect(
        page.url(),
        `Route publique ${path} a redirigé vers /auth`,
      ).not.toMatch(/\/auth\b/);

      // Pas d'ErrorBoundary.
      await expect(page.getByText(ERROR_BOUNDARY_RE).first()).toHaveCount(0);

      // Pas d'erreur JS bloquante.
      expect(jsErrors, `Erreurs JS sur ${path}:\n${jsErrors.join('\n')}`).toHaveLength(0);
    });
  }
});

test.describe('Routes internes — refus sans authentification', () => {
  for (const { path, label } of AUTHENTICATED_ROUTES) {
    test(`${label} (${path}) redirige vers l'auth`, async ({ page }) => {
      const jsErrors: string[] = [];
      page.on('pageerror', (e) => jsErrors.push(e.message));

      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/auth(?:\?|$)/, { timeout: ROUTE_RENDER_TIMEOUT_MS });

      const finalUrl = new URL(page.url());
      expect(finalUrl.pathname).toBe('/auth');
      expect(finalUrl.searchParams.get('returnTo')).toBe(path);
      expect(jsErrors, `Erreurs JS sur la redirection ${path}:\n${jsErrors.join('\n')}`).toHaveLength(0);
    });
  }
});

test.describe('Routes publiques — slugs invalides ne crashent pas', () => {
  const INVALID_SLUGS = [
    { path: '/f/slug-inexistant-xyz', terminal: /formulaire n'existe pas|n'est plus disponible/i },
    { path: '/rdv/slug-inexistant-xyz', terminal: /page non trouvée|réservation n'existe pas/i },
    { path: '/transfer/token-invalide-xyz', terminal: /transfert indisponible|lien de transfert invalide/i },
    { path: '/formation/post/post-inexistant', terminal: /post introuvable|post demandé n'existe pas|erreur de chargement/i },
  ];

  for (const { path, terminal } of INVALID_SLUGS) {
    test(`${path} affiche un état d'erreur propre (pas de crash blanc)`, async ({ page }) => {
      const jsErrors: string[] = [];
      page.on('pageerror', (e) => jsErrors.push(e.message));

      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText(terminal).first()).toBeVisible({
        timeout: ROUTE_RENDER_TIMEOUT_MS,
      });

      // Une route publique invalide doit rendre un état explicite, jamais le login.
      expect(page.url(), `Route publique invalide ${path} a redirigé vers /auth`).not.toMatch(/\/auth\b/);
      await expect(page.getByText(ERROR_BOUNDARY_RE).first()).toHaveCount(0);

      // Pas de crash JS.
      expect(jsErrors).toHaveLength(0);
    });
  }
});

test.describe('Route inconnue — protection par défaut', () => {
  test('une URL interne inconnue refuse une session anonyme', async ({ page }) => {
    const path = '/cette-route-nexiste-absolument-pas-xyz';
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth(?:\?|$)/, { timeout: ROUTE_RENDER_TIMEOUT_MS });

    const finalUrl = new URL(page.url());
    expect(finalUrl.pathname).toBe('/auth');
    expect(finalUrl.searchParams.get('returnTo')).toBe(path);
  });
});
