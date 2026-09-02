/**
 * Tests unitaires `_shared/rewrite-tracking-links.ts` — Phase 2 CICD-02.
 * Offline. Sécurité critique : empêche que track-email-click serve d'open redirect.
 *
 * Le module lit `SUPABASE_URL` et `EMAIL_TRACKING_HMAC_SECRET` au moment de l'import,
 * on utilise donc un import dynamique APRÈS avoir setté les env vars.
 */
import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.env.set('SUPABASE_URL', 'https://test.supabase.co');
Deno.env.set('EMAIL_TRACKING_HMAC_SECRET', 'test-secret-do-not-use-in-prod');

const { rewriteLinksForTracking } = await import('./rewrite-tracking-links.ts');

Deno.test('rewriteLinksForTracking — réécrit un href http externe', async () => {
  const html = '<a href="https://example.com/page">click</a>';
  const out = await rewriteLinksForTracking(html, 'thread-1');
  assertStringIncludes(out, 'track-email-click');
  assertStringIncludes(out, 'u=');
  assertStringIncludes(out, 't=thread-1');
  assertStringIncludes(out, 's=');
  assertEquals(out.includes('href="https://example.com/page"'), false);
});

Deno.test('rewriteLinksForTracking — laisse intact mailto / tel / javascript / ancre', async () => {
  const cases = [
    '<a href="mailto:a@b.com">x</a>',
    '<a href="tel:+33123456789">x</a>',
    '<a href="javascript:alert(1)">x</a>',
    '<a href="#section">x</a>',
  ];
  for (const html of cases) {
    const out = await rewriteLinksForTracking(html, 't');
    assertEquals(out, html, `cas non préservé: ${html}`);
  }
});

Deno.test('rewriteLinksForTracking — ignore les liens d\'unsubscribe', async () => {
  const html = '<a href="https://example.com/unsubscribe?token=abc">se désabonner</a>';
  assertEquals(await rewriteLinksForTracking(html, 't'), html);

  const html2 = '<a href="https://example.com/desabonnement">x</a>';
  assertEquals(await rewriteLinksForTracking(html2, 't'), html2);
});

Deno.test('rewriteLinksForTracking — ignore les variables de template non résolues', async () => {
  const html = '<a href="{{ctaLink}}">x</a>';
  assertEquals(await rewriteLinksForTracking(html, 't'), html);
});

Deno.test('rewriteLinksForTracking — réécrit plusieurs liens en une passe', async () => {
  const html =
    '<a href="https://a.com">A</a> et <a href="https://b.com">B</a> et <a href="mailto:c@d.com">C</a>';
  const out = await rewriteLinksForTracking(html, 'thread-x');
  const trackedCount = (out.match(/track-email-click/g) || []).length;
  assertEquals(trackedCount, 2);
  assertStringIncludes(out, 'mailto:c@d.com');
});

Deno.test('rewriteLinksForTracking — HTML vide retourné tel quel', async () => {
  assertEquals(await rewriteLinksForTracking('', 't'), '');
});

Deno.test('rewriteLinksForTracking — signature HMAC b64url-safe (pas de +, /, =)', async () => {
  const html = '<a href="https://example.com/?q=1">x</a>';
  const out = await rewriteLinksForTracking(html, 't');
  const m = out.match(/s=([^"&]+)/);
  assert(m, 'param s manquant');
  assertEquals(/[+/=]/.test(m![1]), false);
  assert(m![1].length >= 20);
});
