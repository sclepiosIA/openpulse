import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const INDEX_URL = new URL("./index.ts", import.meta.url);

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(INDEX_URL);
}

function extractConstString(source: string, name: string): string {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*['"]([^'"]+)['"]\\s*;`));
  if (!match) {
    throw new Error(`Missing string constant: ${name}`);
  }
  return match[1];
}

function extractConstStringArray(source: string, name: string): string[] {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;`));
  if (!match) {
    throw new Error(`Missing string array constant: ${name}`);
  }

  return Array.from(match[1].matchAll(/['"]([^'"]+)['"]/g)).map((entry) => entry[1]);
}

function createNoopListener(): Deno.Listener {
  const iterator = {
    next: () => Promise.resolve({ done: true, value: undefined as unknown as Deno.Conn }),
  };

  return {
    rid: 0,
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
    close: () => {},
    ref: () => {},
    unref: () => {},
    accept: () => new Promise<Deno.Conn>(() => {}),
    [Symbol.asyncIterator]: () => iterator,
  } as unknown as Deno.Listener;
}

function setTemporaryEnv(values: Record<string, string>): () => void {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(values)) {
    previous.set(key, Deno.env.get(key));
    Deno.env.set(key, value);
  }

  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  };
}

function replaceDenoProperty(key: keyof typeof Deno, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(Deno, key);

  Object.defineProperty(Deno, key, {
    value,
    configurable: true,
    writable: true,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(Deno, key, descriptor);
    } else {
      delete (Deno as Record<string, unknown>)[key as string];
    }
  };
}

Deno.test("source declares expected Google OAuth endpoint and scopes", async () => {
  const source = await readIndexSource();

  assertEquals(
    extractConstString(source, "GOOGLE_AUTH_URL"),
    "https://accounts.google.com/o/oauth2/v2/auth",
  );

  assertEquals(extractConstStringArray(source, "GOOGLE_SCOPES"), [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
  ]);
});

Deno.test("source builds Google authorization URL with offline consent and authorization-code flow", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("new URLSearchParams({"), true);
  assertEquals(source.includes("client_id: GOOGLE_CLIENT_ID"), true);
  assertEquals(source.includes("redirect_uri: redirectUri"), true);
  assertEquals(source.includes("response_type: 'code'"), true);
  assertEquals(source.includes("scope: GOOGLE_SCOPES.join(' ')"), true);
  assertEquals(source.includes("access_type: 'offline'"), true);
  assertEquals(source.includes("prompt: 'consent'"), true);
  assertEquals(source.includes("state: state"), true);
  assertEquals(source.includes("`${SUPABASE_URL}/functions/v1/oauth-google-callback`"), true);
});

Deno.test("source enforces caller authentication and returns a 401 JSON response when absent", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("supabaseAuth.auth.getUser()"), true);
  assertEquals(source.includes("authError || !user"), true);
  assertEquals(source.includes("JSON.stringify({ success: false, error: 'Unauthorized' })"), true);
  assertEquals(source.includes("status: 401"), true);
  assertEquals(source.includes("'Content-Type': 'application/json'"), true);
});

Deno.test("source stores a single-use Google nonce bound to the authenticated user", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("const nonce = crypto.randomUUID();"), true);
  assertEquals(source.includes(".from('oauth_state_nonces')"), true);
  assertEquals(source.includes(".insert({ nonce, user_id: user.id, provider: 'google' })"), true);
  assertEquals(source.includes("if (nonceErr)"), true);
  assertEquals(source.includes("throw new Error('Failed to initialize OAuth state')"), true);
});

Deno.test("source signs OAuth state with HMAC SHA-256 and includes user id timestamp and nonce", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("const stateSecret = Deno.env.get('OAUTH_STATE_SECRET') || SERVICE_ROLE_KEY!;"), true);
  assertEquals(source.includes("const payload = { user_id: user.id, timestamp: Date.now(), nonce };"), true);
  assertEquals(source.includes("const payloadB64 = btoa(JSON.stringify(payload));"), true);
  assertEquals(source.includes("crypto.subtle.importKey"), true);
  assertEquals(source.includes("{ name: 'HMAC', hash: 'SHA-256' }"), true);
  assertEquals(source.includes("crypto.subtle.sign('HMAC'"), true);
  assertEquals(source.includes("const state = `${payloadB64}.${sigB64}`;"), true);
});

Deno.test("source handles CORS preflight and uses sanitized error responses", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("'Access-Control-Allow-Origin': origineAutorisee()"), true);
  assertEquals(
    source.includes("'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret'"),
    true,
  );
  assertEquals(source.includes("if (req.method === 'OPTIONS')"), true);
  assertEquals(source.includes("return new Response(null, { headers: corsHeaders });"), true);
  assertEquals(source.includes("buildErrorResponse('oauth-google-init', error, corsHeaders, 500)"), true);
});

Deno.test("source parser reports missing constants clearly", () => {
  assertThrows(
    () => extractConstString("const OTHER = 'value';", "GOOGLE_AUTH_URL"),
    Error,
    "Missing string constant: GOOGLE_AUTH_URL",
  );

  assertThrows(
    () => extractConstStringArray("const OTHER = [];", "GOOGLE_SCOPES"),
    Error,
    "Missing string array constant: GOOGLE_SCOPES",
  );
});

Deno.test("missing source file rejection is explicit", async () => {
  await assertRejects(
    () => Deno.readTextFile(new URL("./definitely-not-index.ts", import.meta.url)),
    Deno.errors.NotFound,
  );
});

Deno.test("module loads with Deno.listen, fetch, console and env stubbed offline", async () => {
  const listenCalls: Deno.ListenOptions[] = [];
  const listenTlsCalls: Deno.ListenTlsOptions[] = [];

  const restoreListen = replaceDenoProperty("listen", ((options: Deno.ListenOptions) => {
    listenCalls.push(options);
    return createNoopListener();
  }) as typeof Deno.listen);

  const restoreListenTls = replaceDenoProperty("listenTls", ((options: Deno.ListenTlsOptions) => {
    listenTlsCalls.push(options);
    return createNoopListener();
  }) as typeof Deno.listenTls);

  const restoreEnv = setTemporaryEnv({
    GOOGLE_CLIENT_ID: "test-google-client-id",
    SUPABASE_URL: "http://localhost:54321",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    SUPABASE_ANON_KEY: "test-anon-key",
    OAUTH_STATE_SECRET: "test-oauth-state-secret",
  });

  const originalFetch = globalThis.fetch;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )) as typeof fetch;

  console.log = () => {};
  console.error = () => {};

  try {
    const importedModule = await import("./index.ts");

    assertExists(importedModule);
    assertEquals(listenCalls.length, 1);
    assertEquals(listenCalls[0].port, 8000);
    assertEquals(listenTlsCalls.length, 0);
  } finally {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    globalThis.fetch = originalFetch;
    restoreEnv();
    restoreListenTls();
    restoreListen();
  }
});