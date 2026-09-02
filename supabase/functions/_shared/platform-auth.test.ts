import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  PLATFORM_CORS,
  checkIdempotency,
  errorResponse,
  hmacSha256Hex,
  issueSsoJwt,
  jsonResponse,
  preflight,
  sha256Hex,
  signWebhook,
  withApiKey,
} from "./platform-auth.ts";

function base64UrlDecodeToString(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
}

function hexToBase64Url(hex: string): string {
  const bytes = new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)));
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

Deno.test("PLATFORM_CORS exposes expected platform headers and methods", () => {
  assertNotEquals(PLATFORM_CORS["Access-Control-Allow-Origin"], "*");
  assertEquals(PLATFORM_CORS["Access-Control-Allow-Methods"], "GET, POST, PATCH, DELETE, OPTIONS");
  assertEquals(
    PLATFORM_CORS["Access-Control-Allow-Headers"].includes("x-api-key"),
    true,
  );
  assertEquals(
    PLATFORM_CORS["Access-Control-Allow-Headers"].includes("idempotency-key"),
    true,
  );
  assertEquals(
    PLATFORM_CORS["Access-Control-Allow-Headers"].includes("x-marque-signature"),
    true,
  );
});

Deno.test("jsonResponse serializes JSON body, status, CORS headers, and custom headers", async () => {
  const response = jsonResponse(
    { ok: true, count: 2 },
    201,
    { "X-Custom-Header": "custom-value" },
  );

  assertEquals(response.status, 201);
  assertEquals(response.headers.get("Content-Type"), "application/json");
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(response.headers.get("X-Custom-Header"), "custom-value");
  assertEquals(await response.json(), { ok: true, count: 2 });
});

Deno.test("errorResponse returns standardized sanitized error envelope", async () => {
  const response = errorResponse("Invalid or missing x-api-key", 401, "invalid_api_key");

  assertEquals(response.status, 401);
  assertEquals(response.headers.get("Content-Type"), "application/json");
  assertEquals(await response.json(), {
    error: "Invalid or missing x-api-key",
    code: "invalid_api_key",
  });
});

Deno.test("errorResponse uses null code when no error code is provided", async () => {
  const response = errorResponse("Internal error", 500);

  assertEquals(response.status, 500);
  assertEquals(await response.json(), {
    error: "Internal error",
    code: null,
  });
});

Deno.test("preflight returns OPTIONS response with CORS headers", async () => {
  const response = preflight(new Request("http://localhost/platform", { method: "OPTIONS" }));

  assertExists(response);
  assertEquals(response.status, 200);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(response.headers.get("Access-Control-Allow-Methods"), "GET, POST, PATCH, DELETE, OPTIONS");
  assertEquals(await response.text(), "ok");
});

Deno.test("preflight returns null for non-OPTIONS requests", () => {
  const response = preflight(new Request("http://localhost/platform", { method: "POST" }));

  assertEquals(response, null);
});

Deno.test("sha256Hex returns known SHA-256 test vectors", async () => {
  assertEquals(
    await sha256Hex(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  assertEquals(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assertEquals(
    await sha256Hex("platform-api-key"),
    "ef4e829d805ce8c80ecf21b2d83849d042c8d146612aa56d0a7e9cfc79f0899e",
  );
});

Deno.test("hmacSha256Hex returns known HMAC-SHA256 digest", async () => {
  const digest = await hmacSha256Hex("key", "The quick brown fox jumps over the lazy dog");

  assertEquals(
    digest,
    "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
  );
});

Deno.test("signWebhook creates deterministic timestamped webhook signature", async () => {
  const originalNow = Date.now;
  Date.now = () => 1_700_000_000_999;

  try {
    const signature = await signWebhook("webhook-secret", '{"event":"created"}');
    const expectedHmac = await hmacSha256Hex("webhook-secret", '1700000000.{"event":"created"}');

    assertEquals(signature, `t=1700000000,v1=${expectedHmac}`);
  } finally {
    Date.now = originalNow;
  }
});

Deno.test("issueSsoJwt rejects when PLATFORM_SSO_JWT_SECRET is not configured", async () => {
  const previousSecret = Deno.env.get("PLATFORM_SSO_JWT_SECRET");
  Deno.env.delete("PLATFORM_SSO_JWT_SECRET");

  try {
    await assertRejects(
      () => issueSsoJwt({ sub: "user-1" }),
      Error,
      "PLATFORM_SSO_JWT_SECRET not configured",
    );
  } finally {
    if (previousSecret === undefined) {
      Deno.env.delete("PLATFORM_SSO_JWT_SECRET");
    } else {
      Deno.env.set("PLATFORM_SSO_JWT_SECRET", previousSecret);
    }
  }
});

Deno.test("issueSsoJwt creates a signed HS256 JWT with standard claims and 5 minute expiration", async () => {
  const previousSecret = Deno.env.get("PLATFORM_SSO_JWT_SECRET");
  const originalNow = Date.now;

  Deno.env.set("PLATFORM_SSO_JWT_SECRET", "unit-test-sso-secret");
  Date.now = () => 1_700_000_000_000;

  try {
    const { token, exp } = await issueSsoJwt({
      sub: "user-123",
      email: "user@example.test",
      role: "admin",
    });

    const parts = token.split(".");
    assertEquals(parts.length, 3);
    assertEquals(exp, 1_700_000_300);

    const header = JSON.parse(base64UrlDecodeToString(parts[0]));
    const claims = JSON.parse(base64UrlDecodeToString(parts[1]));

    assertEquals(header, { alg: "HS256", typ: "JWT" });
    assertEquals(claims.iss, "gestion");
    assertEquals(claims.aud, "product");
    assertEquals(claims.iat, 1_700_000_000);
    assertEquals(claims.exp, 1_700_000_300);
    assertEquals(claims.sub, "user-123");
    assertEquals(claims.email, "user@example.test");
    assertEquals(claims.role, "admin");

    const expectedSignatureHex = await hmacSha256Hex("unit-test-sso-secret", `${parts[0]}.${parts[1]}`);
    assertEquals(parts[2], hexToBase64Url(expectedSignatureHex));
  } finally {
    Date.now = originalNow;
    if (previousSecret === undefined) {
      Deno.env.delete("PLATFORM_SSO_JWT_SECRET");
    } else {
      Deno.env.set("PLATFORM_SSO_JWT_SECRET", previousSecret);
    }
  }
});

Deno.test("withApiKey returns preflight response without invoking handler", async () => {
  let handlerCalled = false;
  const response = await withApiKey(
    new Request("http://localhost/platform", { method: "OPTIONS" }),
    async () => {
      handlerCalled = true;
      return jsonResponse({ ok: true });
    },
  );

  assertEquals(handlerCalled, false);
  assertEquals(response.status, 200);
  assertEquals(await response.text(), "ok");
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
});

Deno.test("withApiKey returns 401 when x-api-key is missing and does not call handler", async () => {
  let handlerCalled = false;
  const response = await withApiKey(
    new Request("http://localhost/platform", { method: "POST" }),
    async () => {
      handlerCalled = true;
      return jsonResponse({ ok: true });
    },
  );

  assertEquals(handlerCalled, false);
  assertEquals(response.status, 401);
  assertEquals(await response.json(), {
    error: "Invalid or missing x-api-key",
    code: "invalid_api_key",
  });
});

Deno.test("checkIdempotency returns null key and null cached response when header is absent", async () => {
  const result = await checkIdempotency(
    new Request("http://localhost/platform/orders", { method: "POST" }),
    "orders.create",
  );

  assertEquals(result, { key: null, cached: null });
});

Deno.test("base64UrlDecodeToString helper throws for invalid JWT payload JSON after decoding", () => {
  assertThrows(
    () => JSON.parse(base64UrlDecodeToString("bm90LWpzb24")),
    SyntaxError,
  );
});