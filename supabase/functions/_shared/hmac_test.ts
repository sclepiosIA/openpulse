import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  computeHmacSignature,
  timingSafeEqual,
  verifyHmacSignature,
  verifyInternalSecret,
} from './hmac.ts';

const SECRET = 'super-secret-key-do-not-leak';
const PAYLOAD = '{"event":"contract.signed","id":"abc"}';

Deno.test('computeHmacSignature is deterministic', async () => {
  const a = await computeHmacSignature(PAYLOAD, SECRET);
  const b = await computeHmacSignature(PAYLOAD, SECRET);
  assertEquals(a, b);
  assertEquals(a.length, 64); // 32 bytes hex
});

Deno.test('verifyHmacSignature accepts valid signature without prefix', async () => {
  const sig = await computeHmacSignature(PAYLOAD, SECRET);
  const res = await verifyHmacSignature(PAYLOAD, sig, SECRET);
  assertEquals(res.ok, true);
});

Deno.test('verifyHmacSignature accepts valid signature with sha256= prefix', async () => {
  const sig = await computeHmacSignature(PAYLOAD, SECRET);
  const res = await verifyHmacSignature(PAYLOAD, `sha256=${sig}`, SECRET);
  assertEquals(res.ok, true);
});

Deno.test('verifyHmacSignature rejects tampered payload', async () => {
  const sig = await computeHmacSignature(PAYLOAD, SECRET);
  const res = await verifyHmacSignature(PAYLOAD + 'tampered', sig, SECRET);
  assertEquals(res.ok, false);
});

Deno.test('verifyHmacSignature rejects wrong secret', async () => {
  const sig = await computeHmacSignature(PAYLOAD, SECRET);
  const res = await verifyHmacSignature(PAYLOAD, sig, 'other-secret');
  assertEquals(res.ok, false);
});

Deno.test('verifyHmacSignature rejects missing signature', async () => {
  const res = await verifyHmacSignature(PAYLOAD, null, SECRET);
  assertEquals(res.ok, false);
  if (!res.ok) assertEquals(res.reason, 'missing_signature');
});

Deno.test('verifyHmacSignature enforces maxAgeSeconds', async () => {
  const sig = await computeHmacSignature(PAYLOAD, SECRET);
  const tooOld = Math.floor(Date.now() / 1000) - 3600;
  const res = await verifyHmacSignature(PAYLOAD, sig, SECRET, {
    maxAgeSeconds: 300,
    timestamp: tooOld,
  });
  assertEquals(res.ok, false);
  if (!res.ok) assertEquals(res.reason, 'timestamp_expired');
});

Deno.test('verifyHmacSignature accepts fresh timestamp', async () => {
  const sig = await computeHmacSignature(PAYLOAD, SECRET);
  const res = await verifyHmacSignature(PAYLOAD, sig, SECRET, {
    maxAgeSeconds: 300,
    timestamp: Math.floor(Date.now() / 1000),
  });
  assertEquals(res.ok, true);
});

Deno.test('timingSafeEqual: same string', () => {
  assertEquals(timingSafeEqual('abc', 'abc'), true);
});

Deno.test('timingSafeEqual: different length', () => {
  assertEquals(timingSafeEqual('abc', 'abcd'), false);
});

Deno.test('timingSafeEqual: different chars', () => {
  assertEquals(timingSafeEqual('abc', 'abd'), false);
});

Deno.test('verifyInternalSecret: matching secret', () => {
  const res = verifyInternalSecret('shared-token', 'shared-token');
  assertEquals(res.ok, true);
});

Deno.test('verifyInternalSecret: missing header', () => {
  const res = verifyInternalSecret(null, 'shared-token');
  assertEquals(res.ok, false);
  if (!res.ok) assertEquals(res.reason, 'missing_header');
});

Deno.test('verifyInternalSecret: secret not configured', () => {
  const res = verifyInternalSecret('shared-token', undefined);
  assertEquals(res.ok, false);
  if (!res.ok) assertEquals(res.reason, 'secret_not_configured');
});
