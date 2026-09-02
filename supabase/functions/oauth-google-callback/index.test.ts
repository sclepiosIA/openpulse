import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type * as IndexModule from "./index.ts";

type _IndexModule = typeof IndexModule;

async function loadTestableModule(): Promise<any> {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  let body = source.replace(/^import\s+[^;]+;\s*$/gm, "");
  body = body.replace(
    "function getAppUrl(): string {",
    "export function getAppUrl(): string {",
  );
  body = body.replace(
    "function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {",
    "export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {",
  );
  body = body.replace(
    "serve(async (req) => {",
    "export const handler = async (req: Request): Promise<Response> => {",
  );

  const lastServeClose = body.lastIndexOf("});");
  if (lastServeClose === -1) {
    throw new Error("Unable to transform serve(...) wrapper for offline tests");
  }
  body = `${body.slice(0, lastServeClose)}};${body.slice(lastServeClose + 3)}`;

  const stubbedModule = `
type MockState = {
  createClientCalls: Array<{ url: string; key: string }>;
  nonceResult: { data: unknown; error: unknown };
  consumeResult: { data: unknown; error: unknown };
  upsertError: unknown;
  upserts: Array<{ table: string; values: unknown; options: unknown }>;
  updates: Array<{ table: string; values: unknown; filters: Array<unknown> }>;
  rpcs: Array<{ name: string; args: Array<unknown> }>;
};

function defaultMockState(): MockState {
  return {
    createClientCalls: [],
    nonceResult: { data: null, error: null },
    consumeResult: { data: null, error: null },
    upsertError: null,
    upserts: [],
    updates: [],
    rpcs: [],
  };
}

let __supabaseState: MockState = defaultMockState();
let __encryptedTokens: string[] = [];

export function __resetMocks() {
  __supabaseState = defaultMockState();
  __encryptedTokens = [];
}

export function __setSupabaseMockState(partial: Partial<MockState>) {
  Object.assign(__supabaseState, partial);
}

export function __getSupabaseMockState() {
  return __supabaseState;
}

export function __getEncryptedTokens() {
  return __encryptedTokens;
}

function createClient(url: string, key: string) {
  __supabaseState.createClientCalls.push({ url, key });

  return {
    from(table: string) {
      const builder = {
        __operation: "select",
        __filters: [] as Array<unknown>,
        __updateValues: undefined as unknown,

        select(_columns: string) {
          return this;
        },

        eq(column: string, value: unknown) {
          this.__filters.push({ op: "eq", column, value });
          return this;
        },

        is(column: string, value: unknown) {
          this.__filters.push({ op: "is", column, value });
          return this;
        },

        update(values: unknown) {
          this.__operation = "update";
          this.__updateValues = values;
          __supabaseState.updates.push({ table, values, filters: this.__filters });
          return this;
        },

        upsert(values: unknown, options: unknown) {
          __supabaseState.upserts.push({ table, values, options });
          return Promise.resolve({ error: __supabaseState.upsertError });
        },

        maybeSingle() {
          if (table === "oauth_state_nonces" && this.__operation === "update") {
            return Promise.resolve(__supabaseState.consumeResult);
          }
          return Promise.resolve(__supabaseState.nonceResult);
        },
      };

      return builder;
    },

    rpc(name: string, ...args: Array<unknown>) {
      __supabaseState.rpcs.push({ name, args });
      return Promise.resolve({ data: null, error: null });
    },
  };
}

async function encryptToken(token: string) {
  __encryptedTokens.push(token);
  return \`encrypted:\${token}\`;
}

function safeErrorLog(context: string, error: unknown) {
  return {
    context,
    message: error instanceof Error ? error.message : String(error),
  };
}

${body}

// unique import instance: ${crypto.randomUUID()}
`;

  return await import(
    `data:application/typescript;charset=utf-8,${encodeURIComponent(stubbedModule)}`
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function createSignedState(
  payload: { user_id: string; timestamp: number; nonce: string },
  secret: string,
): Promise<string> {
  const payloadB64 = btoa(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64)),
  );
  return `${payloadB64}.${bytesToBase64(signature)}`;
}

async function withEnv<T>(
  values: Record<string, string>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(values)) {
    previous.set(key, Deno.env.get(key));
    Deno.env.set(key, values[key]);
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
}

Deno.test("getAppUrl retourne l'URL applicative attendue", async () => {
  const mod = await loadTestableModule();

  assertEquals(mod.getAppUrl(), "https://pp-gestion.exploitant.example.org");
});

Deno.test("timingSafeEqual compare correctement les signatures binaires", async () => {
  const mod = await loadTestableModule();

  assertEquals(
    mod.timingSafeEqual(
      new Uint8Array([12, 34, 56, 78]),
      new Uint8Array([12, 34, 56, 78]),
    ),
    true,
  );
  assertEquals(
    mod.timingSafeEqual(
      new Uint8Array([12, 34, 56, 78]),
      new Uint8Array([12, 34, 56, 79]),
    ),
    false,
  );
  assertEquals(
    mod.timingSafeEqual(
      new Uint8Array([12, 34, 56, 78]),
      new Uint8Array([12, 34, 56]),
    ),
    false,
  );
});

Deno.test("handler redirige une erreur OAuth provider sans appeler Google ni Supabase", async () => {
  const mod = await loadTestableModule();
  mod.__resetMocks();

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (() => {
    fetchCalls++;
    return Promise.resolve(new Response("unexpected"));
  }) as typeof fetch;

  try {
    await withEnv(
      {
        SUPABASE_URL: "https://supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        GOOGLE_CLIENT_ID: "google-client-id",
        GOOGLE_CLIENT_SECRET: "google-client-secret",
      },
      async () => {
        const response = await mod.handler(
          new Request("http://localhost?error=access_denied"),
        );

        assertEquals(response.status, 302);
        assertEquals(
          response.headers.get("location"),
          "https://pp-gestion.exploitant.example.org/parametres/visioconference?error=access_denied",
        );
        assertEquals(fetchCalls, 0);
        assertEquals(mod.__getSupabaseMockState().createClientCalls.length, 0);
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("handler rejette un state à signature invalide avant tout échange réseau", async () => {
  const mod = await loadTestableModule();
  mod.__resetMocks();

  const validState = await createSignedState(
    {
      user_id: "user-123",
      timestamp: Date.now(),
      nonce: "nonce-123",
    },
    "oauth-state-secret",
  );
  const invalidState = `${validState.slice(0, -1)}x`;

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (() => {
    fetchCalls++;
    return Promise.resolve(new Response("unexpected"));
  }) as typeof fetch;

  try {
    await withEnv(
      {
        SUPABASE_URL: "https://supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        GOOGLE_CLIENT_ID: "google-client-id",
        GOOGLE_CLIENT_SECRET: "google-client-secret",
        OAUTH_STATE_SECRET: "oauth-state-secret",
      },
      async () => {
        const response = await mod.handler(
          new Request(`http://localhost?code=auth-code&state=${encodeURIComponent(invalidState)}`),
        );

        assertEquals(response.status, 302);
        assertEquals(
          response.headers.get("location"),
          "https://pp-gestion.exploitant.example.org/parametres/visioconference?error=oauth_failed",
        );
        assertEquals(fetchCalls, 0);
        assertEquals(mod.__getSupabaseMockState().createClientCalls.length, 0);
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("handler échange le code Google, chiffre les tokens et upsert la connexion OAuth", async () => {
  const mod = await loadTestableModule();
  mod.__resetMocks();

  const userId = "user-google-456";
  const nonce = "nonce-google-456";
  const stateSecret = "oauth-state-secret";
  const signedState = await createSignedState(
    {
      user_id: userId,
      timestamp: Date.now(),
      nonce,
    },
    stateSecret,
  );

  mod.__setSupabaseMockState({
    nonceResult: {
      data: {
        nonce,
        user_id: userId,
        provider: "google",
        consumed_at: null,
        created_at: new Date().toISOString(),
      },
      error: null,
    },
    consumeResult: {
      data: { nonce },
      error: null,
    },
  });

  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    fetchCalls.push({ url, init });

    if (url === "https://oauth2.googleapis.com/token") {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: "google-access-token",
            refresh_token: "google-refresh-token",
            expires_in: 3600,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    }

    if (url === "https://www.googleapis.com/oauth2/v2/userinfo") {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "google-user-id",
            email: "user@example.test",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    }

    return Promise.resolve(new Response("unexpected url", { status: 500 }));
  }) as typeof fetch;

  try {
    await withEnv(
      {
        SUPABASE_URL: "https://project.supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        GOOGLE_CLIENT_ID: "google-client-id",
        GOOGLE_CLIENT_SECRET: "google-client-secret",
        OAUTH_STATE_SECRET: stateSecret,
      },
      async () => {
        const response = await mod.handler(
          new Request(
            `http://localhost?code=google-auth-code&state=${encodeURIComponent(signedState)}`,
          ),
        );

        assertEquals(response.status, 302);
        assertEquals(
          response.headers.get("location"),
          "https://pp-gestion.exploitant.example.org/parametres/visioconference?success=google",
        );

        assertEquals(fetchCalls.length, 2);
        assertEquals(fetchCalls[0].url, "https://oauth2.googleapis.com/token");
        assertEquals(fetchCalls[0].init?.method, "POST");

        const tokenBody = fetchCalls[0].init?.body as URLSearchParams;
        assertEquals(tokenBody.get("code"), "google-auth-code");
        assertEquals(tokenBody.get("client_id"), "google-client-id");
        assertEquals(tokenBody.get("client_secret"), "google-client-secret");
        assertEquals(
          tokenBody.get("redirect_uri"),
          "https://project.supabase.test/functions/v1/oauth-google-callback",
        );
        assertEquals(tokenBody.get("grant_type"), "authorization_code");

        assertEquals(fetchCalls[1].url, "https://www.googleapis.com/oauth2/v2/userinfo");
        assertEquals(
          (fetchCalls[1].init?.headers as Record<string, string>).Authorization,
          "Bearer google-access-token",
        );

        const mockState = mod.__getSupabaseMockState();
        assertEquals(mockState.createClientCalls, [
          {
            url: "https://project.supabase.test",
            key: "service-role-test-key",
          },
        ]);

        assertEquals(mockState.updates.length, 1);
        assertEquals(mockState.updates[0].table, "oauth_state_nonces");
        assertExists((mockState.updates[0].values as { consumed_at?: string }).consumed_at);

        assertEquals(mockState.upserts.length, 1);
        assertEquals(mockState.upserts[0].table, "user_oauth_connections");
        assertEquals(mockState.upserts[0].options, { onConflict: "user_id,provider" });

        const upsertValues = mockState.upserts[0].values as Record<string, unknown>;
        assertEquals(upsertValues.user_id, userId);
        assertEquals(upsertValues.provider, "google");
        assertEquals(upsertValues.access_token_encrypted, "encrypted:google-access-token");
        assertEquals(upsertValues.refresh_token_encrypted, "encrypted:google-refresh-token");
        assertEquals(upsertValues.provider_email, "user@example.test");
        assertEquals(upsertValues.provider_user_id, "google-user-id");
        assertEquals(upsertValues.scopes, ["calendar.events", "userinfo.email", "openid"]);
        assertExists(upsertValues.token_expires_at);
        assertExists(upsertValues.updated_at);

        assertEquals(mod.__getEncryptedTokens(), [
          "google-access-token",
          "google-refresh-token",
        ]);

        assertEquals(mockState.rpcs, [
          {
            name: "cleanup_oauth_state_nonces",
            args: [],
          },
        ]);
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});