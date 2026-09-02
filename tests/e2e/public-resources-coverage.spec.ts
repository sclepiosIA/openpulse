import { test, expect } from '@playwright/test';

/**
 * Vérifie que les ressources statiques publiques (robots, sitemap, manifest,
 * security.txt) répondent correctement.
 */

const RESOURCES = [
  { path: '/robots.txt', contains: /user-agent/i },
  { path: '/manifest.webmanifest', contains: /name|short_name/i },
  { path: '/security.txt', contains: /contact/i },
  { path: '/.well-known/security.txt', contains: /contact/i },
];

test.describe('Ressources publiques', () => {
  for (const r of RESOURCES) {
    test(`${r.path} répond et contient le bon format`, async ({ request }) => {
      const resp = await request.get(r.path);
      expect(resp.status(), `${r.path} HTTP ${resp.status()}`).toBeLessThan(400);
      const body = await resp.text();
      expect(body.length, `${r.path} vide`).toBeGreaterThan(10);
      expect(body).toMatch(r.contains);
    });
  }
});
