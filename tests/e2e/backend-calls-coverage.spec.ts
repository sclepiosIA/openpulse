import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'au moins un appel Supabase REST/RPC est effectué au chargement
 * des pages data-driven (signal d'intégration backend active).
 */

const ROUTES = ['/etablissements', '/prospects', '/emails', '/people', '/taches'];

test.describe('Backend Supabase appelé', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} appelle au moins une API Supabase`, async ({ page }) => {
      const calls: string[] = [];
      page.on('request', req => {
        const url = req.url();
        // Le motif historique `supabase.co` datait du backend cloud la plateforme initiale.
        // Depuis le cutover, l'API est self-hostée
        // (openpulse-gestion-platform-….cloudapp.azure.com) : plus AUCUNE requête ne
        // matchait, et ces tests échouaient en affirmant « aucun appel
        // Supabase » alors que l'intégration fonctionnait. On cible désormais
        // la forme des endpoints PostgREST/Edge, indépendamment de l'hôte.
        if (/\/(rest|functions)\/v1\//.test(url)) calls.push(url);
      });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(3000);
      expect(calls.length, `Aucun appel Supabase sur ${path}`).toBeGreaterThan(0);
    });
  }
});
