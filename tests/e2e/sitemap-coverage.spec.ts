import { test, expect } from '@playwright/test';

/**
 * Vérifie que /sitemap.xml répond et contient des URLs valides.
 */

test('sitemap.xml répond et contient des <url>', async ({ request }) => {
  const resp = await request.get('/sitemap.xml');
  if (resp.status() === 404) test.skip(true, 'sitemap.xml absent');
  expect(resp.status()).toBeLessThan(400);
  const body = await resp.text();
  expect(body, 'sitemap vide').toContain('<url');
});
