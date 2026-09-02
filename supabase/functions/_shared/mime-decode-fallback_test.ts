import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  decodeHeaderValue,
  decodeEmailContent,
  decodeBody,
  sanitizeDateString,
  cleanText,
  cleanImapResponse,
  parseEmailAddress,
  parseHeaders,
  extractThreadId,
} from "./mime-decode-fallback.ts";

// ============ decodeHeaderValue (RFC 2047) ============
Deno.test("decodeHeaderValue - decodes B (base64) UTF-8", () => {
  // "Réunion" in UTF-8 base64
  const encoded = "=?UTF-8?B?UsOpdW5pb24=?=";
  assertEquals(decodeHeaderValue(encoded), "Réunion");
});

Deno.test("decodeHeaderValue - decodes Q (quoted-printable) UTF-8", () => {
  // "Café" → C, =C3=A9, f, é? -> "Caf=C3=A9"
  const encoded = "=?UTF-8?Q?Caf=C3=A9?=";
  assertEquals(decodeHeaderValue(encoded), "Café");
});

Deno.test("decodeHeaderValue - underscore becomes space in Q", () => {
  const encoded = "=?UTF-8?Q?Hello_World?=";
  assertEquals(decodeHeaderValue(encoded), "Hello World");
});

Deno.test("decodeHeaderValue - passthrough plain ASCII", () => {
  assertEquals(decodeHeaderValue("Plain subject"), "Plain subject");
});

Deno.test("decodeHeaderValue - empty input", () => {
  assertEquals(decodeHeaderValue(""), "");
});

Deno.test("decodeHeaderValue - fixes double-encoded UTF-8 (Ã©→é)", () => {
  assertEquals(decodeHeaderValue("Caf\u00C3\u00A9"), "Café");
});

// ============ decodeEmailContent ============
Deno.test("decodeEmailContent - base64", () => {
  // "hello" base64
  assertEquals(decodeEmailContent("aGVsbG8=", "base64"), "hello");
});

Deno.test("decodeEmailContent - quoted-printable removes soft breaks", () => {
  const out = decodeEmailContent("hello=\r\nworld", "quoted-printable");
  assertEquals(out, "helloworld");
});

Deno.test("decodeEmailContent - quoted-printable decodes hex bytes", () => {
  // Note: QP decode produces raw bytes as chars; no UTF-8 reassembly here.
  assertEquals(decodeEmailContent("Caf=C3=A9", "quoted-printable"), "Caf\u00C3\u00A9");
});

Deno.test("decodeEmailContent - 7bit/unknown passthrough", () => {
  assertEquals(decodeEmailContent("plain", "7bit"), "plain");
  assertEquals(decodeEmailContent("plain", ""), "plain");
});

Deno.test("decodeBody - alias for decodeEmailContent", () => {
  assertEquals(decodeBody("aGVsbG8=", "base64"), "hello");
});

// ============ sanitizeDateString ============
Deno.test("sanitizeDateString - removes parenthetical TZ name", () => {
  assertEquals(
    sanitizeDateString("Mon, 15 Jul 2026 10:00:00 +0000 (UTC)"),
    "Mon, 15 Jul 2026 10:00:00 +0000"
  );
});

// ============ cleanText ============
Deno.test("cleanText - normalizes CRLF and strips control chars", () => {
  const input = "line1\r\nline2\rline3\u0001trailing";
  const out = cleanText(input);
  assertEquals(out, "line1\nline2\nline3trailing");
});

// ============ cleanImapResponse ============
Deno.test("cleanImapResponse - strips IMAP tagged trailers", () => {
  const out = cleanImapResponse("body content\nA0042 OK FETCH completed");
  assert(!out.includes("A0042"));
  assert(out.includes("body content"));
});

// ============ parseEmailAddress ============
Deno.test("parseEmailAddress - name + email", () => {
  const r = parseEmailAddress('"Alice Dupont" <alice@example.com>');
  assertEquals(r.email, "alice@example.com");
  assertEquals(r.name, "Alice Dupont");
});

Deno.test("parseEmailAddress - bare email", () => {
  const r = parseEmailAddress("bob@example.com");
  assertEquals(r.email, "bob@example.com");
  assertEquals(r.name, null);
});

Deno.test("parseEmailAddress - empty", () => {
  const r = parseEmailAddress("");
  assertEquals(r.email, "");
  assertEquals(r.name, null);
});

// ============ parseHeaders ============
Deno.test("parseHeaders - parses headers and lowercases keys", () => {
  const raw = "From: alice@example.com\r\nSubject: Hello\r\n\r\nbody";
  const h = parseHeaders(raw);
  assertEquals(h["from"], "alice@example.com");
  assertEquals(h["subject"], "Hello");
});

Deno.test("parseHeaders - handles folded continuation lines", () => {
  const raw = "Subject: First\r\n line continuation\r\n\r\nbody";
  const h = parseHeaders(raw);
  assertEquals(h["subject"], "First line continuation");
});

// ============ extractThreadId ============
Deno.test("extractThreadId - uses References first <id>", () => {
  const id = extractThreadId(
    { references: "<root@example.com> <reply@example.com>" },
    "current@example.com"
  );
  assertEquals(id, "root@example.com");
});

Deno.test("extractThreadId - falls back to In-Reply-To", () => {
  const id = extractThreadId(
    { "in-reply-to": "<parent@example.com>" },
    "current@example.com"
  );
  assertEquals(id, "parent@example.com");
});

Deno.test("extractThreadId - falls back to messageId", () => {
  const id = extractThreadId({}, "current@example.com");
  assertEquals(id, "current@example.com");
});
