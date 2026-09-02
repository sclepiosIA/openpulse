/**
 * Tests unitaires `_shared/email-validator.ts` — Phase 2 CICD-02.
 * Pas de réseau : valide les schémas zod + helpers d'attachments.
 */
import {
  assert,
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { z } from 'npm:zod@3.25.76';
import {
  calculateTotalAttachmentSize,
  formatValidationErrors,
  validateEmailDraft,
  validateEmailSend,
  validateTotalAttachmentSize,
} from './email-validator.ts';

Deno.test('validateEmailSend — accepte un payload minimal valide', () => {
  const ok = validateEmailSend({
    to: ['user@example.com'],
    subject: 'hi',
    body: 'hello',
  });
  assertEquals(ok.to.length, 1);
});

Deno.test('validateEmailSend — rejette `to` vide ou email invalide', () => {
  assertThrows(() => validateEmailSend({ to: [], subject: 's', body: 'b' }), z.ZodError);
  assertThrows(
    () => validateEmailSend({ to: ['not-an-email'], subject: 's', body: 'b' }),
    z.ZodError,
  );
});

Deno.test('validateEmailSend — rejette subject > 255 ou body > 500KB', () => {
  assertThrows(
    () => validateEmailSend({ to: ['a@b.com'], subject: 'x'.repeat(256), body: 'b' }),
    z.ZodError,
  );
  assertThrows(
    () => validateEmailSend({ to: ['a@b.com'], subject: 's', body: 'x'.repeat(500001) }),
    z.ZodError,
  );
});

Deno.test('validateEmailSend — rejette une pièce jointe > 25MB', () => {
  assertThrows(
    () =>
      validateEmailSend({
        to: ['a@b.com'],
        subject: 's',
        body: 'b',
        attachments: [{
          filename: 'big.bin',
          size: 26 * 1024 * 1024,
          mime_type: 'application/octet-stream',
          data: 'x',
        }],
      }),
    z.ZodError,
  );
});

Deno.test('validateEmailDraft — tous champs optionnels', () => {
  const ok = validateEmailDraft({});
  assertEquals(Object.keys(ok).length, 0);
});

Deno.test('calculateTotalAttachmentSize — somme correcte / undefined → 0', () => {
  assertEquals(calculateTotalAttachmentSize(undefined), 0);
  assertEquals(calculateTotalAttachmentSize([]), 0);
  assertEquals(
    calculateTotalAttachmentSize([{ size: 1000 }, { size: 2500 }, { size: 500 }]),
    4000,
  );
});

Deno.test('validateTotalAttachmentSize — true si ≤ 25MB, false sinon', () => {
  assert(validateTotalAttachmentSize([{ size: 24 * 1024 * 1024 }]));
  assertEquals(
    validateTotalAttachmentSize([{ size: 13 * 1024 * 1024 }, { size: 13 * 1024 * 1024 }]),
    false,
  );
});

Deno.test('formatValidationErrors — concatène path + message', () => {
  try {
    validateEmailSend({ to: [], subject: 's', body: 'b' });
  } catch (e) {
    if (e instanceof z.ZodError) {
      const out = formatValidationErrors(e);
      assertStringIncludes(out, 'to');
    }
  }
});
