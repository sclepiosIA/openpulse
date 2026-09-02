/**
 * Tests unitaires `_shared/error-sanitizer.ts` — Phase 2 CICD-02.
 *
 * Pas de réseau, pas de secrets : ces tests s'exécutent partout (offline,
 * runner self-hosted, dev). Ils sont **bloquants** et garantissent la non-
 * régression du mapping `sanitizeErrorForClient` qui protège les clients
 * d'une fuite d'erreur Azure / IMAP / JWT en clair.
 */
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { origineAutorisee } from './cors.ts'
import {
  buildErrorResponse,
  safeErrorLog,
  sanitizeErrorForClient,
} from './error-sanitizer.ts';

Deno.test('sanitizeErrorForClient — mappe Azure OpenAI vers message générique', () => {
  const msg = sanitizeErrorForClient(new Error('Azure OpenAI returned 503 Service Unavailable'));
  assertEquals(msg, 'AI service temporarily unavailable. Please try again.');
});

Deno.test('sanitizeErrorForClient — mappe 429 / rate limit', () => {
  assertEquals(
    sanitizeErrorForClient(new Error('Got HTTP 429 from upstream')),
    'Service rate limit reached. Please try again shortly.',
  );
  assertEquals(
    sanitizeErrorForClient(new Error('rate limit exceeded')),
    'Too many requests. Please wait a moment and try again.',
  );
});

Deno.test('sanitizeErrorForClient — mappe AbortError / timeout', () => {
  const err = new Error('The signal has been aborted');
  err.name = 'AbortError';
  // Le message ne contient pas "abort" mais .name oui — on teste que le pattern textuel marche aussi
  assertEquals(
    sanitizeErrorForClient(new Error('Request timeout after 30s')),
    'Request timed out. Please try again.',
  );
  // AbortError dans .message
  assertEquals(
    sanitizeErrorForClient(new Error('AbortError: signal aborted')),
    'Request timed out. Please try again.',
  );
});

Deno.test('sanitizeErrorForClient — mappe IMAP / JWT / Unauthorized', () => {
  assertEquals(
    sanitizeErrorForClient(new Error('IMAP connection refused')),
    'Email server connection failed. Please check your settings.',
  );
  assertEquals(
    sanitizeErrorForClient(new Error('Invalid JWT signature')),
    'Authentication error. Please sign in again.',
  );
  assertEquals(
    sanitizeErrorForClient(new Error('Unauthorized: missing token')),
    'You are not authorized to perform this action.',
  );
});

Deno.test('sanitizeErrorForClient — fallback générique si aucun pattern', () => {
  assertEquals(
    sanitizeErrorForClient(new Error('some internal weird crash with /var/lib/postgres/data/stack')),
    'An unexpected error occurred. Please try again.',
  );
  assertEquals(
    sanitizeErrorForClient('plain string'),
    'An unexpected error occurred. Please try again.',
  );
  assertEquals(
    sanitizeErrorForClient(undefined),
    'An unexpected error occurred. Please try again.',
  );
});

Deno.test('sanitizeErrorForClient — ne fuite jamais le path interne dans la réponse', () => {
  const internal = sanitizeErrorForClient(
    new Error('failed at /home/deno/supabase/functions/foo/index.ts:42:13 (Azure OpenAI)'),
  );
  // doit retourner le message générique Azure, jamais le path
  assertEquals(internal.includes('/home/'), false);
  assertEquals(internal.includes('.ts:'), false);
  assertStringIncludes(internal, 'AI service temporarily unavailable');
});

Deno.test('safeErrorLog — inclut function + timestamp et errorName/errorMessage', () => {
  const log = safeErrorLog('test-fn', new Error('boom'));
  assertEquals(log.function, 'test-fn');
  assertEquals(log.errorName, 'Error');
  assertEquals(log.errorMessage, 'boom');
  assertEquals(typeof log.timestamp, 'string');
});

Deno.test('safeErrorLog — gère un error non-Error (string/number)', () => {
  const log = safeErrorLog('test-fn', 'oops');
  assertEquals(log.errorType, 'string');
  assertEquals(log.errorString, 'oops');

  const log2 = safeErrorLog('test-fn', 42);
  assertEquals(log2.errorType, 'number');
  assertEquals(log2.errorString, '42');
});

Deno.test('safeErrorLog — tronque les strings à 200 chars', () => {
  const long = 'x'.repeat(500);
  const log = safeErrorLog('test-fn', long);
  assertEquals((log.errorString as string).length, 200);
});

Deno.test('buildErrorResponse — Response JSON avec status + corsHeaders', async () => {
  const cors = { 'Access-Control-Allow-Origin': origineAutorisee() };
  const resp = buildErrorResponse('test-fn', new Error('IMAP down'), cors, 502);
  assertEquals(resp.status, 502);
  assertEquals(resp.headers.get('content-type'), 'application/json');
  assertEquals(resp.headers.get('access-control-allow-origin'), origineAutorisee());
  const body = await resp.json();
  assertEquals(body.error, 'Email server connection failed. Please check your settings.');
});

Deno.test('buildErrorResponse — status par défaut 500', () => {
  const resp = buildErrorResponse('test-fn', new Error('x'), {});
  assertEquals(resp.status, 500);
});
