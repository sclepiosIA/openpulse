import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Regression test — audit run-1782663570.
 *
 * Le hook `useSupportOpenCount` réutilisait un channel Supabase Realtime
 * (`support-tickets-badge`) déjà souscrit lors d'un remount (StrictMode /
 * navigation rapide), provoquant l'exception
 *   "cannot add postgres_changes callbacks ... after subscribe()"
 * non capturée → l'ErrorBoundary global cassait tout le shell admin sur
 * ~20 routes.
 *
 * Ce test reproduit le scénario en chaînant navigations rapides (force
 * mount/unmount du hook qui vit dans le shell) sur les routes admin
 * historiquement impactées, et vérifie que :
 *   1. aucun fallback ErrorBoundary global ne s'affiche,
 *   2. aucune exception "after subscribe()" n'est levée côté console,
 *   3. le shell `#main-content` reste rendu.
 */

const ADMIN_ROUTES = [
  '/dashboard',
  '/people',
  '/rd',
  '/support',
  '/prospects',
  '/etablissements',
  '/todos',
  '/agenda',
  '/gestion-utilisateurs',
  '/logs-systeme',
  '/rgpd',
  '/configuration-systeme',
  '/gestion-securite',
  '/parametres/monitor',
  '/gestion-notifications',
  '/api-developer',
];

const ERROR_BOUNDARY_REGEX =
  /Une erreur est survenue|Quelque chose s'est mal passé|Recharger la page|Réessayer/i;

test.describe('Realtime remount (StrictMode) — pas d\'ErrorBoundary global', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('navigation rapide entre routes admin ne casse pas le shell', async ({ page }) => {
    const realtimeErrors: string[] = [];
    page.on('pageerror', (err) => {
      const msg = String(err?.message || err);
      if (/after subscribe\(\)|postgres_changes callbacks/i.test(msg)) {
        realtimeErrors.push(msg);
      }
    });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (/after subscribe\(\)|postgres_changes callbacks/i.test(text)) {
        realtimeErrors.push(text);
      }
    });

    // 2 passes : la 2e provoque systématiquement des remounts du shell
    // (et donc du hook `useSupportOpenCount`) sur des routes déjà visitées.
    for (let pass = 0; pass < 2; pass++) {
      for (const route of ADMIN_ROUTES) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
        const eb = page.locator(`text=${ERROR_BOUNDARY_REGEX}`);
        const ebCount = await eb.count();
        expect(ebCount, `ErrorBoundary actif sur ${route} (pass ${pass + 1})`).toBe(0);
      }
    }

    expect(
      realtimeErrors,
      `Exception realtime "after subscribe()" détectée : ${realtimeErrors.join(' | ')}`,
    ).toEqual([]);
  });

  test('reload répétés sur /support ne ré-ajoutent pas de callback realtime', async ({ page }) => {
    const realtimeErrors: string[] = [];
    page.on('pageerror', (err) => {
      const msg = String(err?.message || err);
      if (/after subscribe\(\)|postgres_changes callbacks/i.test(msg)) {
        realtimeErrors.push(msg);
      }
    });

    await page.goto('/support', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

    for (let i = 0; i < 4; i++) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      const eb = page.locator(`text=${ERROR_BOUNDARY_REGEX}`);
      expect(await eb.count(), `ErrorBoundary actif après reload #${i + 1}`).toBe(0);
    }

    expect(realtimeErrors, realtimeErrors.join(' | ')).toEqual([]);
  });
});
