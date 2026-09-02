// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type ServeHandler = (req: Request) => Response | Promise<Response>;

const originalEnv = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  EMAIL_ENCRYPTION_KEY: Deno.env.get("EMAIL_ENCRYPTION_KEY"),
};

function restoreEnv() {
  if (originalEnv.SUPABASE_URL === undefined) Deno.env.delete("SUPABASE_URL");
  else Deno.env.set("SUPABASE_URL", originalEnv.SUPABASE_URL);

  if (originalEnv.SUPABASE_SERVICE_ROLE_KEY === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", originalEnv.SUPABASE_SERVICE_ROLE_KEY);

  if (originalEnv.EMAIL_ENCRYPTION_KEY === undefined) Deno.env.delete("EMAIL_ENCRYPTION_KEY");
  else Deno.env.set("EMAIL_ENCRYPTION_KEY", originalEnv.EMAIL_ENCRYPTION_KEY);
}

function setupModuleMocks(options?: {
  account?: Record<string, unknown> | null;
  accountError?: unknown;
  encryptData?: unknown;
  encryptError?: unknown;
  updateError?: unknown;
  imapScenario?: "success" | "login-fail" | "connect-fail" | "timeout";
}) {
  const serveHandlers: ServeHandler[] = [];
  const writes: string[] = [];
  let closed = false;
  let released = false;
  let connectTlsCalls = 0;

  // Le module verifie desormais la PROPRIETE du compte : il lit `profile_id`
  // et `is_shared`, et compare `profile_id` a l'identite resolue depuis le
  // jeton. Le double de ce banc est reste sur la surface d'avant ce controle,
  // et neuf epreuves tombaient dessus. Le compte simule appartient donc a
  // l'appelant simule, et tout compte fourni par une epreuve herite de ces
  // deux champs sans avoir a les repeter -- sauf `null`, qui reste `null`
  // pour l'epreuve du 404.
  const compteParDefaut = {
    id: "acc-1",
    email_address: "user@example.com",
    imap_host: "imap.example.com",
    imap_port: 993,
    profile_id: "owner-1",
    is_shared: false,
  };
  const account = options?.account === null
    ? null
    : { ...compteParDefaut, ...(options?.account ?? {}) };

  const accountError = options?.accountError ?? null;
  const encryptData = options?.encryptData ?? "encrypted-secret";
  const encryptError = options?.encryptError ?? null;
  const updateError = options?.updateError ?? null;
  const imapScenario = options?.imapScenario ?? "success";

  const originalConnectTls = Deno.connectTls;
  const originalServe = (globalThis as { serve?: unknown }).serve;
  const originalCreateClient = (globalThis as { createClient?: unknown }).createClient;
  const originalBuildErrorResponse = (globalThis as { buildErrorResponse?: unknown }).buildErrorResponse;

  (globalThis as { serve: (handler: ServeHandler) => void }).serve = (handler: ServeHandler) => {
    serveHandlers.push(handler);
  };

  (globalThis as { createClient: () => unknown }).createClient = () => {
    return {
      auth: {
        getUser: async (token: string) => {
          assertExists(token);
          return { data: { user: { id: "owner-1" } }, error: null };
        },
      },
      from(table: string) {
        assertEquals(table, "user_email_accounts");
        return {
          select(columns: string) {
            assertEquals(columns, "id, email_address, imap_host, imap_port, profile_id, is_shared");
            return {
              eq(column: string, value: unknown) {
                assertEquals(column, "id");
                assertExists(value);
                return {
                  maybeSingle: async () => ({ data: account, error: accountError }),
                };
              },
            };
          },
          update(payload: Record<string, unknown>) {
            assertEquals(payload, {
              encrypted_password: encryptData,
              last_sync_at: null,
            });
            return {
              eq: async (column: string, value: unknown) => {
                assertEquals(column, "id");
                assertExists(value);
                return { error: updateError };
              },
            };
          },
        };
      },
      rpc(fn: string, args: Record<string, unknown>) {
        assertEquals(fn, "encrypt_email_password");
        assertExists(args.plain_password);
        assertEquals(args.encryption_key, Deno.env.get("EMAIL_ENCRYPTION_KEY"));
        return Promise.resolve({ data: encryptData, error: encryptError });
      },
    };
  };

  (globalThis as {
    buildErrorResponse: (
      name: string,
      error: unknown,
      headers: HeadersInit,
      status: number,
    ) => Response;
  }).buildErrorResponse = (_name, error, headers, status) => {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        source: "buildErrorResponse",
      }),
      {
        status,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  };

  Deno.connectTls = (async (_options: Deno.ConnectTlsOptions) => {
    connectTlsCalls++;

    let responses: string[] = [];
    if (imapScenario === "success") {
      responses = [
        "* OK IMAP4 ready\r\n",
        "A0000 OK LOGIN completed\r\n",
        "A0001 OK LOGOUT completed\r\n",
      ];
    } else if (imapScenario === "login-fail") {
      responses = [
        "* OK IMAP4 ready\r\n",
        "A0000 NO LOGIN failed\r\n",
      ];
    } else if (imapScenario === "connect-fail") {
      throw new Error("TLS connect failed");
    } else {
      responses = new Array(51).fill("* OK still waiting\r\n");
    }

    let index = 0;
    const reader = {
      read: async () => {
        if (index >= responses.length) {
          return { value: undefined, done: true } as ReadableStreamReadResult<Uint8Array>;
        }
        return {
          value: new TextEncoder().encode(responses[index++]),
          done: false,
        } as ReadableStreamReadResult<Uint8Array>;
      },
      releaseLock: () => {
        released = true;
      },
    };

    const conn = {
      readable: {
        getReader: () => reader,
      },
      write: async (data: Uint8Array) => {
        writes.push(new TextDecoder().decode(data));
        return data.length;
      },
      close: () => {
        closed = true;
      },
    };

    return conn as unknown as Deno.TlsConn;
  }) as typeof Deno.connectTls;

  return {
    async getHandler() {
      const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
      const patched = source
        // Les imports du fichier sont ecrits en quotes SIMPLES : les
        // substitutions qui visaient des quotes doubles ne correspondaient a
        // rien, et le module partait vers l'URL `data:` avec ses imports
        // relatifs intacts, donc irresolubles.
        .replace(`import { corsHeaders } from '../_shared/cors.ts'`, `const corsHeaders = { 'Access-Control-Allow-Origin': 'http://localhost:8080', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret' };`)
        .replace(
          `import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'`,
          "const { serve } = globalThis as { serve: (handler: (req: Request) => Response | Promise<Response>) => void };",
        )
        .replace(
          `import { createClient } from '@supabase/supabase-js'`,
          "const { createClient } = globalThis as { createClient: () => any };",
        )
        .replace(
          `import { buildErrorResponse } from '../_shared/error-sanitizer.ts'`,
          "const { buildErrorResponse } = globalThis as { buildErrorResponse: (name: string, error: unknown, headers: HeadersInit, status: number) => Response };",
        );
      const moduleUrl = `data:application/typescript;charset=utf-8,${encodeURIComponent(patched)}#${crypto.randomUUID()}`;
      await import(moduleUrl);
      assertEquals(serveHandlers.length > 0, true);
      return serveHandlers[serveHandlers.length - 1];
    },
    writes,
    getConnectTlsCalls: () => connectTlsCalls,
    getClosed: () => closed,
    getReleased: () => released,
    restore() {
      Deno.connectTls = originalConnectTls;

      if (originalServe === undefined) delete (globalThis as { serve?: unknown }).serve;
      else (globalThis as { serve?: unknown }).serve = originalServe;

      if (originalCreateClient === undefined) delete (globalThis as { createClient?: unknown }).createClient;
      else (globalThis as { createClient?: unknown }).createClient = originalCreateClient;

      if (originalBuildErrorResponse === undefined) {
        delete (globalThis as { buildErrorResponse?: unknown }).buildErrorResponse;
      } else {
        (globalThis as { buildErrorResponse?: unknown }).buildErrorResponse = originalBuildErrorResponse;
      }
    },
  };
}

Deno.test("module loads and registers a serve handler", async () => {
  const mocks = setupModuleMocks();
  try {
    const handler = await mocks.getHandler();
    assertExists(handler);
  } finally {
    mocks.restore();
    restoreEnv();
  }
});

Deno.test("OPTIONS returns CORS headers", async () => {
  const mocks = setupModuleMocks();
  try {
    const handler = await mocks.getHandler();
    const res = await handler(new Request("http://localhost", { method: "OPTIONS" }));
    assertEquals(res.status, 200);
    assertNotEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(
      res.headers.get("Access-Control-Allow-Headers"),
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
    );
  } finally {
    mocks.restore();
    restoreEnv();
  }
});

Deno.test("returns 401 when authorization header is missing", async () => {
  const mocks = setupModuleMocks();
  try {
    Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    Deno.env.set("EMAIL_ENCRYPTION_KEY", "enc-key");

    const handler = await mocks.getHandler();
    const res = await handler(new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }));
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body, { success: false, error: "Unauthorized" });
  } finally {
    mocks.restore();
    restoreEnv();
  }
});

Deno.test("returns 500 when EMAIL_ENCRYPTION_KEY is missing", async () => {
  const mocks = setupModuleMocks();
  try {
    Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    Deno.env.delete("EMAIL_ENCRYPTION_KEY");

    const handler = await mocks.getHandler();
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify({ account_id: "acc-1", new_password: "new-pass" }),
    });
    const res = await handler(req);
    assertEquals(res.status, 500);
    const body = await res.json();
    assertEquals(body, {
      success: false,
      error: "EMAIL_ENCRYPTION_KEY non configurée",
    });
  } finally {
    mocks.restore();
    restoreEnv();
  }
});

Deno.test("returns 400 when account_id or new_password is missing", async () => {
  const mocks = setupModuleMocks();
  try {
    Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    Deno.env.set("EMAIL_ENCRYPTION_KEY", "enc-key");

    const handler = await mocks.getHandler();
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify({ account_id: "acc-1" }),
    });
    const res = await handler(req);
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body, {
      success: false,
      error: "account_id et new_password requis",
    });
  } finally {
    mocks.restore();
    restoreEnv();
  }
});

Deno.test("returns 404 when account is not found", async () => {
  const mocks = setupModuleMocks({ account: null, accountError: { message: "not found" } });
  try {
    Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    Deno.env.set("EMAIL_ENCRYPTION_KEY", "enc-key");

    const handler = await mocks.getHandler();
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify({ account_id: "acc-404", new_password: "new-pass" }),
    });
    const res = await handler(req);
    assertEquals(res.status, 404);
    const body = await res.json();
    assertEquals(body, {
      success: false,
      error: "Compte non trouvé",
    });
  } finally {
    mocks.restore();
    restoreEnv();
  }
});

Deno.test("returns 400 when IMAP login fails", async () => {
  const mocks = setupModuleMocks({ imapScenario: "login-fail" });
  try {
    Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    Deno.env.set("EMAIL_ENCRYPTION_KEY", "enc-key");

    const handler = await mocks.getHandler();
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify({ account_id: "acc-1", new_password: "bad-pass" }),
    });
    const res = await handler(req);
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.success, false);
    assertEquals(body.hint, "Vérifiez le mot de passe et réessayez");
    assertEquals(body.error, "Échec de connexion IMAP: IMAP command failed: A0000 NO LOGIN failed");
    assertEquals(mocks.writes[0], 'A0000 LOGIN "user@example.com" "bad-pass"\r\n');
  } finally {
    mocks.restore();
    restoreEnv();
  }
});

Deno.test("returns 400 when IMAP TLS connection fails", async () => {
  const mocks = setupModuleMocks({ imapScenario: "connect-fail" });
  try {
    Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    Deno.env.set("EMAIL_ENCRYPTION_KEY", "enc-key");

    const handler = await mocks.getHandler();
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify({ account_id: "acc-1", new_password: "good-pass" }),
    });
    const res = await handler(req);
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.success, false);
    assertEquals(body.error, "Échec de connexion IMAP: TLS connect failed");
    assertEquals(body.hint, "Vérifiez le mot de passe et réessayez");
  } finally {
    mocks.restore();
    restoreEnv();
  }
});

Deno.test("returns 400 when IMAP response times out", async () => {
  const mocks = setupModuleMocks({ imapScenario: "timeout" });
  try {
    Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    Deno.env.set("EMAIL_ENCRYPTION_KEY", "enc-key");

    const handler = await mocks.getHandler();
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify({ account_id: "acc-1", new_password: "good-pass" }),
    });
    const res = await handler(req);
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.success, false);
    assertEquals(body.error, "Échec de connexion IMAP: IMAP response timeout");
  } finally {
    mocks.restore();
    restoreEnv();
  }
});

Deno.test("returns 500 when encryption RPC fails", async () => {
  const mocks = setupModuleMocks({ encryptData: null, encryptError: { message: "rpc failed" } });
  try {
    Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    Deno.env.set("EMAIL_ENCRYPTION_KEY", "enc-key");

    const handler = await mocks.getHandler();
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify({ account_id: "acc-1", new_password: "good-pass" }),
    });
    const res = await handler(req);
    assertEquals(res.status, 500);
    const body = await res.json();
    assertEquals(body, {
      success: false,
      error: "Erreur de chiffrement du mot de passe",
    });
  } finally {
    mocks.restore();
    restoreEnv();
  }
});

Deno.test("returns 500 when account update fails", async () => {
  const mocks = setupModuleMocks({ updateError: { message: "update failed" } });
  try {
    Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    Deno.env.set("EMAIL_ENCRYPTION_KEY", "enc-key");

    const handler = await mocks.getHandler();
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify({ account_id: "acc-1", new_password: "good-pass" }),
    });
    const res = await handler(req);
    assertEquals(res.status, 500);
    const body = await res.json();
    assertEquals(body, {
      success: false,
      error: "Erreur de mise à jour du compte",
    });
  } finally {
    mocks.restore();
    restoreEnv();
  }
});

Deno.test("returns success and performs IMAP login/logout/update flow", async () => {
  const mocks = setupModuleMocks({
    account: {
      id: "acc-1",
      email_address: "user@example.com",
      imap_host: "imap.example.com",
      imap_port: 993,
    },
    encryptData: "ciphertext-123",
    imapScenario: "success",
  });

  try {
    Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    Deno.env.set("EMAIL_ENCRYPTION_KEY", "enc-key");

    const handler = await mocks.getHandler();
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: JSON.stringify({ account_id: "acc-1", new_password: "good-pass" }),
    });
    const res = await handler(req);
    assertEquals(res.status, 200);

    const body = await res.json();
    assertEquals(body, {
      success: true,
      message: "Mot de passe mis à jour pour user@example.com",
      email: "user@example.com",
    });

    assertEquals(mocks.getConnectTlsCalls(), 1);
    assertEquals(mocks.writes[0], 'A0000 LOGIN "user@example.com" "good-pass"\r\n');
    assertEquals(mocks.writes[1], "A0001 LOGOUT\r\n");
    assertEquals(mocks.getReleased(), true);
    assertEquals(mocks.getClosed(), true);
  } finally {
    mocks.restore();
    restoreEnv();
  }
});

Deno.test("catch-all error path uses buildErrorResponse for invalid JSON body", async () => {
  const mocks = setupModuleMocks();
  try {
    Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    Deno.env.set("EMAIL_ENCRYPTION_KEY", "enc-key");

    const handler = await mocks.getHandler();
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: "{invalid json",
    });
    const res = await handler(req);
    assertEquals(res.status, 500);
    const body = await res.json();
    assertEquals(body.success, false);
    assertEquals(body.source, "buildErrorResponse");
    assertExists(body.error);
  } finally {
    mocks.restore();
    restoreEnv();
  }
});

Deno.test("sanity assert helpers are available", async () => {
  assertThrows(() => {
    throw new Error("boom");
  }, Error, "boom");

  await assertRejects(async () => {
    throw new Error("async boom");
  }, Error, "async boom");
});