/**
 * Tests unitaires `_shared/generic-domains.ts` — Phase 2 CICD-02.
 * Offline. Garantit que la liste des domaines génériques n'est pas régressée
 * (utilisée par sync-emails/auto-match-emails pour éviter les faux auto-rattachements).
 */
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  GENERIC_DOMAINS,
  INTERNAL_MARQUE_DOMAINS,
  isGenericDomain,
  isMarqueDomain,
} from './generic-domains.ts';

Deno.test('GENERIC_DOMAINS contient les fournisseurs FR/EN majeurs', () => {
  for (const d of ['gmail.com', 'outlook.com', 'yahoo.fr', 'orange.fr', 'free.fr', 'icloud.com']) {
    assert(GENERIC_DOMAINS.includes(d), `manque ${d}`);
  }
});

Deno.test('isGenericDomain — case-insensitive', () => {
  assert(isGenericDomain('gmail.com'));
  assert(isGenericDomain('GMAIL.COM'));
  assert(isGenericDomain('Gmail.Com'));
});

Deno.test('isGenericDomain — false pour un domaine pro', () => {
  assertEquals(isGenericDomain('exploitant.example.org'), false);
  assertEquals(isGenericDomain('chu-lille.fr'), false);
  assertEquals(isGenericDomain(''), false);
});

Deno.test('isMarqueDomain — reconnaît les domaines internes', () => {
  assert(isMarqueDomain('marque.ai'));
  assert(isMarqueDomain('exploitant.example.org'));
  assert(isMarqueDomain('EXPLOITANT.EXAMPLE.ORG'));
  assertEquals(isMarqueDomain('gmail.com'), false);
});

Deno.test('INTERNAL_MARQUE_DOMAINS n\'est pas vide', () => {
  assert(INTERNAL_MARQUE_DOMAINS.length > 0);
});
