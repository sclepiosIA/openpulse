import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const MODULE_UNDER_TEST = "./index.ts";
const INDEX_URL = new URL(MODULE_UNDER_TEST, import.meta.url);

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(INDEX_URL);
}

function replaceRequired(source: string, needle: string, replacement: string): string {
  if (!source.includes(needle)) {
    throw new Error(`Expected source to contain: ${needle}`);
  }
  return source.replace(needle, replacement);
}

function instrumentSource(source: string): string {
  let instrumented = source;

  // L'import relatif ajoute par la consolidation CORS ne se resout pas
  // depuis une URL `data:` : on le remplace par sa valeur.
  instrumented = instrumented.replace(
    `import { corsHeaders } from '../_shared/cors.ts'\n`,
    `const corsHeaders = { 'Access-Control-Allow-Origin': 'http://localhost:8080', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret' };\n`,
  );

  instrumented = replaceRequired(
    instrumented,
    `import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";`,
    `const sanitizeErrorForClient = (error: unknown) => error instanceof Error ? error.message : String(error);`,
  );

  instrumented = replaceRequired(
    instrumented,
    `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";`,
    `let __servedHandler: ((req: Request) => Response | Promise<Response>) | undefined;
const serve = (handler: (req: Request) => Response | Promise<Response>) => {
  __servedHandler = handler;
  return Promise.resolve();
};`,
  );

  instrumented = replaceRequired(
    instrumented,
    `import { createClient } from "@supabase/supabase-js";`,
    `const createClient = (...args: unknown[]) => {
  const stub = (globalThis as any).__supabaseCreateClientStub;
  if (!stub) throw new Error("Missing Supabase createClient stub");
  return stub(...args);
};`,
  );

  instrumented = replaceRequired(
    instrumented,
    `import { z } from "zod";`,
    `type __Issue = { path: string[]; message: string; code: string };
const z = {
  string() {
    return {
      __kind: "string",
      checks: [] as Array<Record<string, unknown>>,
      uuid(message: string) {
        return { ...this, checks: [...this.checks, { kind: "uuid", message }] };
      },
      min(value: number, message: string) {
        return { ...this, checks: [...this.checks, { kind: "min", value, message }] };
      },
    };
  },
  object(shape: Record<string, any>) {
    return {
      safeParse(input: unknown) {
        const errors: __Issue[] = [];
        const data: Record<string, unknown> = {};
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (typeof input !== "object" || input === null || Array.isArray(input)) {
          return {
            success: false,
            error: { errors: [{ path: [], message: "Expected object", code: "invalid_type" }] },
          };
        }

        for (const [key, schema] of Object.entries(shape)) {
          const value = (input as Record<string, unknown>)[key];

          if (typeof value !== "string") {
            errors.push({ path: [key], message: "Expected string", code: "invalid_type" });
            continue;
          }

          for (const check of schema.checks) {
            if (check.kind === "uuid" && !uuidRe.test(value)) {
              errors.push({ path: [key], message: String(check.message), code: "invalid_string" });
            }
            if (check.kind === "min" && value.length < Number(check.value)) {
              errors.push({ path: [key], message: String(check.message), code: "too_small" });
            }
          }

          data[key] = value;
        }

        if (errors.length > 0) {
          return { success: false, error: { errors } };
        }

        return { success: true, data };
      },
    };
  },
};`,
  );

  return `${instrumented}

export {
  ResetPasswordSchema,
  checkRateLimit,
  corsHeaders,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW,
};
export const __handler = __servedHandler;
export const __rateLimitMap = rateLimitMap;
export const __instrumentationNonce = "${crypto.randomUUID()}";
`;
}

async function loadInstrumentedModule(): Promise<any> {
  const source = await readIndexSource();
  const instrumented = instrumentSource(source);
  return await import(`data:application/typescript;charset=utf-8,${encodeURIComponent(instrumented)}`);
}

async function withSupabaseEnv<T>(fn: () => Promise<T>): Promise<T> {
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  Deno.env.set("SUPABASE_URL", "http://localhost.supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

  try {
    return await fn();
  } finally {
    if (previousUrl === undefined) {
      Deno.env.delete("SUPABASE_URL");
    } else {
      Deno.env.set("SUPABASE_URL", previousUrl);
    }

    if (previousKey === undefined) {
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousKey);
    }
  }
}

function installCreateClientStub(stub: (...args: unknown[]) => unknown): () => void {
  const g = globalThis as any;
  const hadPrevious = Object.prototype.hasOwnProperty.call(g, "__supabaseCreateClientStub");
  const previous = g.__supabaseCreateClientStub;

  g.__supabaseCreateClientStub = stub;

  return () => {
    if (hadPrevious) {
      g.__supabaseCreateClientStub = previous;
    } else {
      delete g.__supabaseCreateClientStub;
    }
  };
}

function createSupabaseStub(options: {
  adminUser?: Record<string, unknown> | null;
  userError?: unknown;
  isAdminStrict?: boolean;
  adminCheckError?: unknown;
  targetProfile?: Record<string, unknown> | null;
  profileError?: unknown;
  updatePasswordError?: { message: string } | null;
  updateProfileError?: unknown;
  calls?: Record<string, any>;
} = {}) {
  const calls = options.calls ?? {};
  calls.createdClients = [];
  calls.rpcs = [];
  calls.selects = [];
  calls.updatePasswords = [];
  calls.profileUpdates = [];

  const defaultAdminUser = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "admin@example.test",
  };

  const defaultTargetProfile = {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "22222222-2222-4222-8222-222222222222",
    email: "user@example.test",
    prenom: "Ada",
    nom: "Lovelace",
  };

  return (...args: unknown[]) => {
    calls.createdClients.push(args);

    return {
      auth: {
        getUser: async () => ({
          data: { user: options.adminUser === undefined ? defaultAdminUser : options.adminUser },
          error: options.userError ?? null,
        }),
        admin: {
          updateUserById: async (id: string, payload: Record<string, unknown>) => {
            calls.updatePasswords.push({ id, payload });
            return { error: options.updatePasswordError ?? null };
          },
        },
      },
      rpc: async (name: string, payload: Record<string, unknown>) => {
        calls.rpcs.push({ name, payload });
        return {
          data: options.isAdminStrict ?? true,
          error: options.adminCheckError ?? null,
        };
      },
      from: (table: string) => ({
        select: (columns: string) => ({
          eq: (column: string, value: unknown) => ({
            single: async () => {
              calls.selects.push({ table, columns, column, value });
              return {
                data: Object.prototype.hasOwnProperty.call(options, "targetProfile")
                  ? options.targetProfile
                  : defaultTargetProfile,
                error: options.profileError ?? null,
              };
            },
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: async (column: string, value: unknown) => {
            calls.profileUpdates.push({ table, payload, column, value });
            return { error: options.updateProfileError ?? null };
          },
        }),
      }),
    };
  };
}

async function responseJson(response: Response): Promise<any> {
  return await response.json();
}

Deno.test("index.ts declares the expected password reset validation and security contract", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes(`userId: z.string().uuid("ID utilisateur invalide")`), true);
  assertEquals(source.includes(`newPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères")`), true);
  assertEquals(source.includes(`const RATE_LIMIT_MAX = 10;`), true);
  assertEquals(source.includes(`const RATE_LIMIT_WINDOW = 60000;`), true);
  assertEquals(source.includes(`has_admin_role_strict`), true);
  assertEquals(source.includes(`must_change_password: true`), true);
  assertEquals(source.includes(`updateUserById`), true);
});

Deno.test("test harness fails loudly if the module shape changes", () => {
  assertThrows(
    () => instrumentSource(`serve(async () => new Response("ok"));`),
    Error,
    `sanitizeErrorForClient`,
  );
});

Deno.test("instrumented module loads from ./index.ts without opening a server", async () => {
  const mod = await loadInstrumentedModule();

  assertExists(mod.__handler);
  assertExists(mod.ResetPasswordSchema);
  assertExists(mod.checkRateLimit);
  assertEquals(mod.RATE_LIMIT_MAX, 10);
  assertEquals(mod.RATE_LIMIT_WINDOW, 60000);
});

Deno.test("ResetPasswordSchema accepts a valid UUID and a password of at least 8 characters", async () => {
  const mod = await loadInstrumentedModule();

  const result = mod.ResetPasswordSchema.safeParse({
    userId: "11111111-1111-4111-8111-111111111111",
    newPassword: "MotDePasse123",
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    userId: "11111111-1111-4111-8111-111111111111",
    newPassword: "MotDePasse123",
  });
});

Deno.test("ResetPasswordSchema rejects malformed userId and short password with business messages", async () => {
  const mod = await loadInstrumentedModule();

  const result = mod.ResetPasswordSchema.safeParse({
    userId: "not-a-uuid",
    newPassword: "court",
  });

  assertEquals(result.success, false);
  assertEquals(
    result.error.errors.map((issue: { message: string }) => issue.message),
    [
      "ID utilisateur invalide",
      "Le mot de passe doit contenir au moins 8 caractères",
    ],
  );
});

Deno.test("checkRateLimit allows 10 attempts per admin and blocks the 11th within the same minute", async () => {
  const mod = await loadInstrumentedModule();
  mod.__rateLimitMap.clear();

  const originalNow = Date.now;
  try {
    Date.now = () => 1_700_000_000_000;

    const results = Array.from({ length: 11 }, () => mod.checkRateLimit("admin-1"));

    assertEquals(results.slice(0, 10), Array(10).fill(true));
    assertEquals(results[10], false);
    assertEquals(mod.checkRateLimit("admin-2"), true);
  } finally {
    Date.now = originalNow;
  }
});

Deno.test("checkRateLimit resets after the configured window", async () => {
  const mod = await loadInstrumentedModule();
  mod.__rateLimitMap.clear();

  const originalNow = Date.now;
  let now = 1_700_000_000_000;

  try {
    Date.now = () => now;

    for (let i = 0; i < 10; i++) {
      assertEquals(mod.checkRateLimit("admin-reset"), true);
    }
    assertEquals(mod.checkRateLimit("admin-reset"), false);

    now += 60_001;
    assertEquals(mod.checkRateLimit("admin-reset"), true);
  } finally {
    Date.now = originalNow;
  }
});

Deno.test("handler responds to OPTIONS with CORS headers and no Supabase access", async () => {
  const mod = await loadInstrumentedModule();

  const response = await mod.__handler(new Request("http://localhost", { method: "OPTIONS" }));

  assertEquals(response.status, 200);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(response.headers.get("Access-Control-Allow-Headers"), "authorization, x-client-info, apikey, content-type, x-internal-secret");
});

Deno.test("handler rejects missing Authorization header with 401", async () => {
  const mod = await loadInstrumentedModule();

  const response = await mod.__handler(new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: "11111111-1111-4111-8111-111111111111",
      newPassword: "MotDePasse123",
    }),
  }));

  const payload = await responseJson(response);

  assertEquals(response.status, 401);
  assertEquals(payload, {
    success: false,
    error: "Authentification requise",
  });
});

Deno.test("handler rejects unauthenticated Supabase user with 401", async () => {
  const mod = await loadInstrumentedModule();
  const restore = installCreateClientStub(createSupabaseStub({
    adminUser: null,
    userError: { message: "invalid token" },
  }));

  try {
    await withSupabaseEnv(async () => {
      const response = await mod.__handler(new Request("http://localhost", {
        method: "POST",
        headers: {
          authorization: "Bearer invalid",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: "11111111-1111-4111-8111-111111111111",
          newPassword: "MotDePasse123",
        }),
      }));

      const payload = await responseJson(response);

      assertEquals(response.status, 401);
      assertEquals(payload, {
        success: false,
        error: "Utilisateur non authentifié",
      });
    });
  } finally {
    restore();
  }
});

Deno.test("handler rejects non-admin user with strict 2FA requirement message", async () => {
  const mod = await loadInstrumentedModule();
  const calls: Record<string, any> = {};
  const restore = installCreateClientStub(createSupabaseStub({
    isAdminStrict: false,
    calls,
  }));

  try {
    await withSupabaseEnv(async () => {
      const response = await mod.__handler(new Request("http://localhost", {
        method: "POST",
        headers: {
          authorization: "Bearer user-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: "11111111-1111-4111-8111-111111111111",
          newPassword: "MotDePasse123",
        }),
      }));

      const payload = await responseJson(response);

      assertEquals(response.status, 403);
      assertEquals(payload.success, false);
      assertEquals(payload.error, "Accès refusé : privilèges admin avec 2FA requis");
      assertEquals(payload.details, "Vous devez être administrateur avec 2FA activé pour réinitialiser des mots de passe");
      assertEquals(calls.rpcs[0], {
        name: "has_admin_role_strict",
        payload: { _user_id: "00000000-0000-4000-8000-000000000001" },
      });
    });
  } finally {
    restore();
  }
});

Deno.test("handler returns 400 with validation details for invalid request body", async () => {
  const mod = await loadInstrumentedModule();
  mod.__rateLimitMap.clear();

  const restore = installCreateClientStub(createSupabaseStub());

  try {
    await withSupabaseEnv(async () => {
      const response = await mod.__handler(new Request("http://localhost", {
        method: "POST",
        headers: {
          authorization: "Bearer admin-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: "bad-id",
          newPassword: "123",
        }),
      }));

      const payload = await responseJson(response);

      assertEquals(response.status, 400);
      assertEquals(payload.success, false);
      assertEquals(payload.error, "Données invalides");
      assertEquals(
        payload.details.map((issue: { message: string }) => issue.message),
        [
          "ID utilisateur invalide",
          "Le mot de passe doit contenir au moins 8 caractères",
        ],
      );
    });
  } finally {
    restore();
  }
});

Deno.test("handler returns success and updates password plus must_change_password flag", async () => {
  const mod = await loadInstrumentedModule();
  mod.__rateLimitMap.clear();

  const calls: Record<string, any> = {};
  const targetProfile = {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "22222222-2222-4222-8222-222222222222",
    email: "ada@example.test",
    prenom: "Ada",
    nom: "Lovelace",
  };
  const restore = installCreateClientStub(createSupabaseStub({
    targetProfile,
    calls,
  }));

  try {
    await withSupabaseEnv(async () => {
      const response = await mod.__handler(new Request("http://localhost", {
        method: "POST",
        headers: {
          authorization: "Bearer admin-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: targetProfile.id,
          newPassword: "NouveauPass123",
        }),
      }));

      const payload = await responseJson(response);

      assertEquals(response.status, 200);
      assertEquals(payload.success, true);
      assertEquals(
        payload.message,
        "Mot de passe réinitialisé pour Ada Lovelace. L'utilisateur devra changer son mot de passe à la prochaine connexion.",
      );
      assertEquals(payload.user, {
        id: targetProfile.id,
        email: targetProfile.email,
        prenom: targetProfile.prenom,
        nom: targetProfile.nom,
      });
      assertEquals(calls.updatePasswords, [
        {
          id: targetProfile.user_id,
          payload: { password: "NouveauPass123" },
        },
      ]);
      assertEquals(calls.profileUpdates.length, 1);
      assertEquals(calls.profileUpdates[0].table, "profiles");
      assertEquals(calls.profileUpdates[0].column, "id");
      assertEquals(calls.profileUpdates[0].value, targetProfile.id);
      assertEquals(calls.profileUpdates[0].payload.must_change_password, true);
      assertExists(calls.profileUpdates[0].payload.updated_at);
    });
  } finally {
    restore();
  }
});

Deno.test("handler does not let an admin reset their own password through this function", async () => {
  const mod = await loadInstrumentedModule();
  mod.__rateLimitMap.clear();

  const calls: Record<string, any> = {};
  const adminUser = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "admin@example.test",
  };
  const restore = installCreateClientStub(createSupabaseStub({
    adminUser,
    targetProfile: {
      id: "11111111-1111-4111-8111-111111111111",
      user_id: adminUser.id,
      email: "admin@example.test",
      prenom: "Admin",
      nom: "Root",
    },
    calls,
  }));

  try {
    await withSupabaseEnv(async () => {
      const response = await mod.__handler(new Request("http://localhost", {
        method: "POST",
        headers: {
          authorization: "Bearer admin-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: "11111111-1111-4111-8111-111111111111",
          newPassword: "NouveauPass123",
        }),
      }));

      const payload = await responseJson(response);

      assertEquals(response.status, 200);
      assertEquals(payload.success, false);
      assertEquals(payload.error, "Action non autorisée");
      assertEquals(
        payload.details,
        "Vous ne pouvez pas réinitialiser votre propre mot de passe via cette fonction. Utilisez la fonction de changement de mot de passe.",
      );
      assertEquals(calls.updatePasswords, []);
      assertEquals(calls.profileUpdates, []);
    });
  } finally {
    restore();
  }
});

Deno.test("handler returns a business failure when target profile is not found", async () => {
  const mod = await loadInstrumentedModule();
  mod.__rateLimitMap.clear();

  const calls: Record<string, any> = {};
  const restore = installCreateClientStub(createSupabaseStub({
    targetProfile: null,
    calls,
  }));

  try {
    await withSupabaseEnv(async () => {
      const response = await mod.__handler(new Request("http://localhost", {
        method: "POST",
        headers: {
          authorization: "Bearer admin-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: "11111111-1111-4111-8111-111111111111",
          newPassword: "NouveauPass123",
        }),
      }));

      const payload = await responseJson(response);

      assertEquals(response.status, 200);
      assertEquals(payload, {
        success: false,
        error: "Utilisateur non trouvé",
        details: "Aucun profil trouvé avec cet identifiant",
      });
      assertEquals(calls.updatePasswords, []);
    });
  } finally {
    restore();
  }
});

Deno.test("handler returns a business failure when password update fails", async () => {
  const mod = await loadInstrumentedModule();
  mod.__rateLimitMap.clear();

  const calls: Record<string, any> = {};
  const restore = installCreateClientStub(createSupabaseStub({
    updatePasswordError: { message: "password policy failed" },
    calls,
  }));

  try {
    await withSupabaseEnv(async () => {
      const response = await mod.__handler(new Request("http://localhost", {
        method: "POST",
        headers: {
          authorization: "Bearer admin-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: "11111111-1111-4111-8111-111111111111",
          newPassword: "NouveauPass123",
        }),
      }));

      const payload = await responseJson(response);

      assertEquals(response.status, 200);
      assertEquals(payload, {
        success: false,
        error: "Erreur lors de la mise à jour du mot de passe",
        details: "password policy failed",
      });
      assertEquals(calls.profileUpdates, []);
    });
  } finally {
    restore();
  }
});

Deno.test("handler catches malformed JSON and sanitizes the unexpected error for the client", async () => {
  const mod = await loadInstrumentedModule();
  mod.__rateLimitMap.clear();

  const restore = installCreateClientStub(createSupabaseStub());

  try {
    await withSupabaseEnv(async () => {
      const response = await mod.__handler(new Request("http://localhost", {
        method: "POST",
        headers: {
          authorization: "Bearer admin-token",
          "content-type": "application/json",
        },
        body: "{not-json",
      }));

      const payload = await responseJson(response);

      assertEquals(response.status, 500);
      assertEquals(payload.success, false);
      assertEquals(payload.error, "Erreur serveur inattendue");
      assertExists(payload.details);
    });
  } finally {
    restore();
  }
});

Deno.test("handler enforces rate limiting before parsing the request body", async () => {
  const mod = await loadInstrumentedModule();
  mod.__rateLimitMap.clear();

  const restore = installCreateClientStub(createSupabaseStub());

  try {
    await withSupabaseEnv(async () => {
      const makeRequest = () =>
        new Request("http://localhost", {
          method: "POST",
          headers: {
            authorization: "Bearer admin-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            userId: "11111111-1111-4111-8111-111111111111",
            newPassword: "NouveauPass123",
          }),
        });

      for (let i = 0; i < 10; i++) {
        const response = await mod.__handler(makeRequest());
        assertEquals(response.status, 200);
      }

      const limitedResponse = await mod.__handler(makeRequest());
      const payload = await responseJson(limitedResponse);

      assertEquals(limitedResponse.status, 429);
      assertEquals(payload, {
        success: false,
        error: "Trop de tentatives. Veuillez réessayer dans 1 minute.",
      });
    });
  } finally {
    restore();
  }
});

Deno.test("assertRejects is available for async failure assertions in this Deno test environment", async () => {
  await assertRejects(
    async () => {
      throw new Error("async assertion check");
    },
    Error,
    "async assertion check",
  );
});