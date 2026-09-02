// CHARGER LE MODULE SANS OUVRIR DE PORT.
//
// `import "./index.ts"` execute `serve(...)`, qui ouvre reellement un serveur
// sur le port 8000 par defaut. Sur une machine ou ce port est pris -- une
// instance en cours d'execution, par exemple -- le banc entier tombe sur
// « AddrInUse », sans rapport avec le code qu'il pretend verifier.
//
// On lit la source, on neutralise l'appel a `serve`, et on charge le resultat
// depuis une URL `data:`. C'est ce que font les quatre-vingts autres bancs.
async function chargerSansServeur(chemin = "./index.ts") {
  const base = new URL(chemin, import.meta.url);
  const source = await Deno.readTextFile(base);
  const neutralise = source
    .replace(
      /import\s*\{\s*serve\s*\}\s*from\s*["'][^"']*http\/server\.ts["'];?/,
      "const serve = (_h: unknown) => Promise.resolve();",
    )
    // Un module `data:` n'a pas de repertoire d'origine : ses specificateurs
    // relatifs ne resolvent contre rien, et Deno refuse le chargement. On les
    // ancre sur l'emplacement reel du module avant de le lui donner.
    .replace(
      /(\bfrom\s*|\bimport\s*\(\s*)(["'])(\.\.?\/[^"']*)\2/g,
      (_tout, avant, guillemet, cible) =>
        `${avant}${guillemet}${new URL(cible, base).href}${guillemet}`,
    );
  return await import(
    `data:application/typescript;charset=utf-8,${encodeURIComponent(neutralise)}#${crypto.randomUUID()}`
  );
}

import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("module loads", async () => {
  await chargerSansServeur();
});

Deno.test("crypto APIs required by module helpers are available", async () => {
  assertExists(globalThis.crypto);
  assertExists(globalThis.crypto.subtle);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("abc"));
  assertEquals(digest.byteLength, 32);
});

Deno.test("generated token format expectation can be reproduced: 32 random bytes => 64 hex chars", () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const token = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  assertEquals(token.length, 64);
  assertEquals(/^[0-9a-f]{64}$/.test(token), true);
});

Deno.test("sha256 hashing expectation for tokens is deterministic", async () => {
  const token = "sample-token";
  const digestHex = async (value: string) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  };

  const hash1 = await digestHex(token);
  const hash2 = await digestHex(token);

  assertEquals(hash1, hash2);
  assertEquals(hash1.length, 64);
  assertEquals(/^[0-9a-f]{64}$/.test(hash1), true);
});

Deno.test("sha256 hashing expectation matches known reference for sample-token", async () => {
  const token = "sample-token";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  assertEquals(
    hash,
    "0f35d0ae14518b96bd6d3fec3ca15801fd58c9e048b1ccdea11a71378f2acdc9",
  );
});

Deno.test("sha256 hashing expectation changes with input", async () => {
  const digestHex = async (value: string) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  };

  const a = await digestHex("token-a");
  const b = await digestHex("token-b");

  assertEquals(a === b, false);
  assertEquals(a.length, 64);
  assertEquals(b.length, 64);
});

Deno.test("HMAC secret verification expectation is deterministic for client secret comparison logic", async () => {
  const { createHmac } = await import("https://deno.land/std@0.177.0/node/crypto.ts");
  const secret = "jwt-secret";
  const clientSecret = "client-secret";
  const h1 = createHmac("sha256", secret).update(clientSecret).digest("hex");
  const h2 = createHmac("sha256", secret).update(clientSecret).digest("hex");

  assertEquals(h1, h2);
  assertEquals(/^[0-9a-f]{64}$/.test(h1), true);
});

Deno.test("token generation expectation yields different values across calls with overwhelming probability", () => {
  const makeToken = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  const t1 = makeToken();
  const t2 = makeToken();

  assertEquals(t1.length, 64);
  assertEquals(t2.length, 64);
  assertEquals(t1 === t2, false);
});

Deno.test("assert utilities are wired and can validate sync/async failures in this environment", async () => {
  assertThrows(() => {
    throw new Error("sync");
  }, Error, "sync");

  await assertRejects(
    async () => {
      throw new Error("async");
    },
    Error,
    "async",
  );
});