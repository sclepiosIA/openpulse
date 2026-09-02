import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

import type * as IndexModule from "./index.ts";

type _IndexModuleShape = typeof IndexModule;

const moduleUrl = new URL("./index.ts", import.meta.url);

async function readModuleSource(): Promise<string> {
  return await Deno.readTextFile(moduleUrl);
}

function buildLoginRedirectContract(originalUrl: URL): string {
  const next = encodeURIComponent(originalUrl.pathname + originalUrl.search);
  return `/auth?next=${next}`;
}

function escapeHtmlContract(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isNonceShapeAccepted(nonce: unknown): boolean {
  return typeof nonce === "string" && nonce.length >= 16 && nonce.length <= 128;
}

function validateRedirectUriContract(redirectUri: string, allowedRedirects: string[]): URL {
  let parsedRedirect: URL;
  try {
    parsedRedirect = new URL(redirectUri);
  } catch {
    throw new TypeError("Malformed redirect URI");
  }

  if (
    (parsedRedirect.protocol !== "https:" && parsedRedirect.protocol !== "http:") ||
    !allowedRedirects.includes(redirectUri)
  ) {
    throw new RangeError("Redirect URI not allowed");
  }

  return parsedRedirect;
}

async function readJsonStrict(response: Response): Promise<unknown> {
  return await response.json();
}

Deno.test("source defines a Supabase Edge HTTP handler and expected CORS headers", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/import\s+\{\s*serve\s*\}\s+from\s+"https:\/\/deno\.land\/std@0\.168\.0\/http\/server\.ts"/));
  assertExists(source.match(/import\s+\{\s*createClient\s*\}\s+from\s+"@supabase\/supabase-js"/));
  assertExists(source.match(/serve\s*\(\s*async\s*\(\s*req\s*\)\s*=>/));

  assertEquals(source.includes("origineAutorisee()"), true);
  assertEquals(
    source.includes('"authorization, x-client-info, apikey, content-type, x-internal-secret"'),
    true,
  );
});

Deno.test("login redirect preserves only path and query, then URL-encodes them", async () => {
  const source = await readModuleSource();
  assertExists(source.match(/function\s+buildLoginRedirect\s*\(\s*originalUrl:\s*URL\s*\):\s*string/));
  assertEquals(source.includes("originalUrl.pathname + originalUrl.search"), true);

  const originalUrl = new URL(
    "https://edge.example/oauth-authorize?client_id=abc&redirect_uri=https%3A%2F%2Fclient.example%2Fcb&scope=read%20write&state=a%26b",
  );

  assertEquals(
    buildLoginRedirectContract(originalUrl),
    "/auth?next=%2Foauth-authorize%3Fclient_id%3Dabc%26redirect_uri%3Dhttps%253A%252F%252Fclient.example%252Fcb%26scope%3Dread%2520write%26state%3Da%2526b",
  );
});

Deno.test("nonce validation rejects absent, short, long, consumed, and expired nonces", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/nonce\.length\s*<\s*16/));
  assertExists(source.match(/nonce\.length\s*>\s*128/));
  assertExists(source.match(/data\.consumed_at/));
  assertExists(source.match(/new Date\(data\.expires_at as string\)\.getTime\(\)\s*<\s*Date\.now\(\)/));
  assertExists(source.match(/update\s*\(\s*\{\s*consumed_at:\s*new Date\(\)\.toISOString\(\)\s*\}\s*\)/));

  assertEquals(isNonceShapeAccepted(null), false);
  assertEquals(isNonceShapeAccepted(undefined), false);
  assertEquals(isNonceShapeAccepted("short-nonce"), false);
  assertEquals(isNonceShapeAccepted("a".repeat(15)), false);
  assertEquals(isNonceShapeAccepted("a".repeat(16)), true);
  assertEquals(isNonceShapeAccepted("b".repeat(128)), true);
  assertEquals(isNonceShapeAccepted("c".repeat(129)), false);
});

Deno.test("redirect URI validation allows only exact whitelisted http/https URLs", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/new URL\s*\(\s*redirectUri\s*\)/));
  assertExists(source.match(/parsedRedirect\.protocol\s*!==\s*"https:"/));
  assertExists(source.match(/parsedRedirect\.protocol\s*!==\s*"http:"/));
  assertExists(source.match(/!allowedRedirects\.includes\s*\(\s*redirectUri\s*\)/));
  assertExists(source.match(/Do NOT redirect to an untrusted URL/));

  const allowed = [
    "https://client.example/callback",
    "https://client.example/callback?fixed=1",
    "http://localhost:5173/oauth/callback",
  ];

  assertEquals(
    validateRedirectUriContract("https://client.example/callback", allowed).href,
    "https://client.example/callback",
  );
  assertEquals(
    validateRedirectUriContract("https://client.example/callback?fixed=1", allowed).href,
    "https://client.example/callback?fixed=1",
  );
  assertEquals(
    validateRedirectUriContract("http://localhost:5173/oauth/callback", allowed).href,
    "http://localhost:5173/oauth/callback",
  );

  assertThrows(
    () => validateRedirectUriContract("https://client.example/callback/extra", allowed),
    RangeError,
    "Redirect URI not allowed",
  );
  assertThrows(
    () => validateRedirectUriContract("https://evil.example/callback", allowed),
    RangeError,
    "Redirect URI not allowed",
  );
  assertThrows(
    () => validateRedirectUriContract("javascript:alert(1)", allowed),
    RangeError,
    "Redirect URI not allowed",
  );
  assertThrows(
    () => validateRedirectUriContract("data:text/html,<h1>x</h1>", allowed),
    RangeError,
    "Redirect URI not allowed",
  );
  assertThrows(
    () => validateRedirectUriContract("::::", allowed),
    TypeError,
    "Malformed redirect URI",
  );
});

Deno.test("consent page HTML escaping covers app name, scopes, form fields, and quotes", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/const\s+escHtml\s*=\s*\(s:\s*string\)\s*=>/));
  assertEquals(source.includes(".replace(/&/g, \"&amp;\")"), true);
  assertEquals(source.includes(".replace(/</g, \"&lt;\")"), true);
  assertEquals(source.includes(".replace(/>/g, \"&gt;\")"), true);
  assertEquals(source.includes(".replace(/\"/g, \"&quot;\")"), true);
  assertEquals(source.includes(".replace(/'/g, \"&#39;\")"), true);

  assertEquals(
    escapeHtmlContract(`<script>alert("x")</script> & O'Reilly`),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; O&#39;Reilly",
  );

  assertEquals(source.includes("${escHtml(app.name)}"), true);
  assertEquals(source.includes("${escHtml(scopeDescriptions[s] || s)}"), true);
  assertEquals(source.includes('value="${escHtml(clientId)}"'), true);
  assertEquals(source.includes('value="${escHtml(redirectUri)}"'), true);
  assertEquals(source.includes('value="${escHtml(state)}"'), true);
  assertEquals(source.includes('value="${escHtml(nonce ?? "")}"'), true);
});

Deno.test("OAuth request validation returns concrete RFC-style error payloads", async () => {
  const source = await readModuleSource();

  assertEquals(
    source.includes('{ error: "invalid_request", error_description: "Missing client_id or redirect_uri" }'),
    true,
  );
  assertEquals(
    source.includes('{ error: "unsupported_response_type", error_description: "Only \'code\' response type is supported" }'),
    true,
  );
  assertEquals(
    source.includes('{ error: "invalid_client", error_description: "Unknown or inactive client" }'),
    true,
  );
  assertEquals(
    source.includes('{ error: "invalid_redirect_uri", error_description: "Redirect URI not allowed" }'),
    true,
  );
  assertEquals(
    source.includes('{ error: "method_not_allowed" }'),
    true,
  );
});

Deno.test("prepare endpoint authenticates with bearer token and returns only an opaque nonce", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/req\.method\s*===\s*"POST"\s*&&\s*url\.searchParams\.get\("prepare"\)\s*===\s*"1"/));
  assertExists(source.match(/authHeader\?\.startsWith\("Bearer "\)/));
  assertExists(source.match(/supabase\.auth\.getUser\(token\)/));
  assertExists(source.match(/JSON\.stringify\(\{\s*nonce\s*\}\)/));
  assertEquals(source.includes("session_token"), false);
  assertEquals(source.includes("access_token="), false);
});

Deno.test("authorization code is scoped to authenticated user and expires after ten minutes", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/const\s+authCode\s*=\s*crypto\.randomUUID\(\)/));
  assertExists(source.match(/Date\.now\(\)\s*\+\s*10\s*\*\s*60\s*\*\s*1000/));
  assertExists(source.match(/from\("oauth_authorization_codes"\)\.insert/));
  assertEquals(source.includes("user_id: authedUser.userId"), true);
  assertEquals(source.includes("client_id: clientId"), true);
  assertEquals(source.includes("redirect_uri: redirectUri"), true);
  assertEquals(source.includes("scope: scope"), true);
  assertEquals(source.includes("expires_at: expiresAt.toISOString()"), true);
});

Deno.test("malformed JSON bodies are rejected by strict response JSON parsing", async () => {
  await assertRejects(
    () => readJsonStrict(new Response("{ not valid json")),
    SyntaxError,
  );
});