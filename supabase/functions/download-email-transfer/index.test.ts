import type * as IndexModule from "./index.ts";
import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type _IndexModuleShape = typeof IndexModule;

type PureHelpers = {
  verifyPassword(password: string, hash: string | null): Promise<boolean>;
  hashIp(ip: string): Promise<string>;
};

function extractFunctionBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`Missing start marker: ${startMarker}`);
  }

  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end === -1) {
    throw new Error(`Missing end marker: ${endMarker}`);
  }

  return source.slice(start, end).trim();
}

async function importPureHelpersFromSource(source: string): Promise<PureHelpers> {
  const verifyPasswordSource = extractFunctionBetween(
    source,
    "async function verifyPassword",
    "async function hashIp",
  ).replace(
    "async function verifyPassword",
    "export async function verifyPassword",
  );

  const hashIpSource = extractFunctionBetween(
    source,
    "async function hashIp",
    "serve(async",
  ).replace(
    "async function hashIp",
    "export async function hashIp",
  );

  const moduleSource = `${verifyPasswordSource}\n\n${hashIpSource}\n`;
  const bytes = new TextEncoder().encode(moduleSource);
  let base64 = "";
  for (const byte of bytes) {
    base64 += String.fromCharCode(byte);
  }

  return await import(`data:application/typescript;base64,${btoa(base64)}`);
}

let helpersPromise: Promise<PureHelpers> | undefined;

async function helpers(): Promise<PureHelpers> {
  helpersPromise ??= Deno.readTextFile(new URL("./index.ts", import.meta.url))
    .then(importPureHelpersFromSource);
  return await helpersPromise;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function makePasswordHash(salt: string, password: string): Promise<string> {
  return `sha256:${salt}:${await sha256Hex(`${salt}:${password}`)}`;
}

Deno.test("module source contains extractable pure helpers", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  const verifyPasswordSource = extractFunctionBetween(
    source,
    "async function verifyPassword",
    "async function hashIp",
  );
  const hashIpSource = extractFunctionBetween(
    source,
    "async function hashIp",
    "serve(async",
  );

  assertExists(verifyPasswordSource);
  assertExists(hashIpSource);
  assertEquals(verifyPasswordSource.includes("crypto.subtle.digest"), true);
  assertEquals(hashIpSource.includes('Deno.env.get("VAPID_SUBJECT")'), true);

  assertThrows(
    () => extractFunctionBetween(source, "async function missingHelper", "serve(async"),
    Error,
    "Missing start marker",
  );
});

Deno.test("pure helper extraction rejects invalid TypeScript source", async () => {
  await assertRejects(
    () =>
      importPureHelpersFromSource(`
async function verifyPassword(
async function hashIp
serve(async
`),
    Error,
  );
});

Deno.test("verifyPassword accepts transfers without password hash", async () => {
  const { verifyPassword } = await helpers();

  assertEquals(await verifyPassword("", null), true);
  assertEquals(await verifyPassword("anything", null), true);
});

Deno.test("verifyPassword validates a sha256:salt:digest password hash", async () => {
  const { verifyPassword } = await helpers();
  const hash = await makePasswordHash("unit-salt-1", "correct horse battery staple");

  assertEquals(hash.startsWith("sha256:unit-salt-1:"), true);
  assertEquals(hash.split(":")[2].length, 64);
  assertEquals(await verifyPassword("correct horse battery staple", hash), true);
  assertEquals(await verifyPassword("wrong password", hash), false);
  assertEquals(await verifyPassword("", hash), false);
});

Deno.test("verifyPassword rejects unsupported or malformed hashes", async () => {
  const { verifyPassword } = await helpers();

  assertEquals(await verifyPassword("secret", "sha256:only-two-parts"), false);
  assertEquals(await verifyPassword("secret", "md5:salt:0123456789abcdef"), false);
  assertEquals(await verifyPassword("secret", "sha256:salt:not-the-real-digest"), false);
  assertEquals(await verifyPassword("secret", ""), true);
});

Deno.test("hashIp returns deterministic 8-byte hexadecimal hash using VAPID_SUBJECT salt", async () => {
  const { hashIp } = await helpers();
  const key = "VAPID_SUBJECT";
  const previous = Deno.env.get(key);

  try {
    Deno.env.set(key, "mailto:test@example.invalid");

    const ip = "203.0.113.42";
    const expected = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(`${ip}mailto:test@example.invalid`),
        ),
      ),
    )
      .slice(0, 8)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    const first = await hashIp(ip);
    const second = await hashIp(ip);

    assertEquals(first, expected);
    assertEquals(second, expected);
    assertEquals(first.length, 16);
    assertEquals(/^[0-9a-f]{16}$/.test(first), true);
  } finally {
    if (previous === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, previous);
    }
  }
});

Deno.test("hashIp changes when VAPID_SUBJECT salt changes", async () => {
  const { hashIp } = await helpers();
  const key = "VAPID_SUBJECT";
  const previous = Deno.env.get(key);

  try {
    Deno.env.set(key, "salt-a");
    const withSaltA = await hashIp("198.51.100.7");

    Deno.env.set(key, "salt-b");
    const withSaltB = await hashIp("198.51.100.7");

    assertEquals(withSaltA.length, 16);
    assertEquals(withSaltB.length, 16);
    assertEquals(withSaltA === withSaltB, false);
  } finally {
    if (previous === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, previous);
    }
  }
});

Deno.test("edge function source declares expected public API responses and CORS policy", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes('"GET, POST, OPTIONS"'), true);
  assertEquals(source.includes('"authorization, x-client-info, apikey, content-type, x-transfer-password"'), true);
  assertEquals(source.includes("Token manquant"), true);
  assertEquals(source.includes("Transfert introuvable"), true);
  assertEquals(source.includes("Transfert révoqué ou expiré"), true);
  assertEquals(source.includes("Mot de passe requis"), true);
  assertEquals(source.includes("Fichier introuvable"), true);
  assertEquals(source.includes("Fichier indisponible"), true);
});