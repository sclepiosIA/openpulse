import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type * as IndexModule from "./index.ts";

const INDEX_PATH = new URL("./index.ts", import.meta.url);
const VALID_PROFILE_ID = "123e4567-e89b-12d3-a456-426614174000";
const OTHER_PROFILE_ID = "123e4567-e89b-12d3-a456-426614174999";

type EnvMap = Record<string, string | undefined>;

async function withEnv<T>(vars: EnvMap, fn: () => Promise<T> | T): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const key of Object.keys(vars)) {
    previous.set(key, Deno.env.get(key));
    const value = vars[key];
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

async function importTempModule(source: string): Promise<Record<string, unknown>> {
  const tempFile = await Deno.makeTempFile({ suffix: ".ts" });
  await Deno.writeTextFile(tempFile, source);

  try {
    const url = new URL(tempFile, "file://");
    url.search = crypto.randomUUID();
    return await import(url.href);
  } finally {
    await Deno.remove(tempFile).catch(() => undefined);
  }
}

async function loadHandler(): Promise<(req: Request) => Promise<Response>> {
  const source = await Deno.readTextFile(INDEX_PATH);

  let transformed = source
    // L'import relatif de ../_shared/cors.ts ne se resout pas depuis le fichier
    // temporaire ou ce banc charge le module : on l'ancre en URL absolue, afin de
    // charger le VRAI module partage plutot qu'un simulacre.
    .replace("'../_shared/cors.ts'", JSON.stringify(new URL("../_shared/cors.ts", INDEX_PATH).href))
    .replace(/^import .+;\s*$/gm, "");

  if (!transformed.includes("serve(async (req) => {")) {
    throw new Error("Unable to find serve handler declaration in index.ts");
  }

  transformed = transformed.replace(
    "serve(async (req) => {",
    "export const handler = async (req: Request): Promise<Response> => {",
  );

  if (!/\n\}\);\s*$/.test(transformed)) {
    throw new Error("Unable to replace serve handler closing token in index.ts");
  }

  transformed = transformed.replace(/\n\}\);\s*$/, "\n};");

  const prelude = `
const createClient = (...args: any[]) => (globalThis as any).__testCreateClient(...args);
const validateUserAuth = (req: Request) => (globalThis as any).__testValidateUserAuth(req);
const sanitizeErrorForClient = (error: unknown) => (globalThis as any).__testSanitizeErrorForClient(error);
`;

  const mod = await importTempModule(`${prelude}\n${transformed}`);
  assertExists(mod.handler);
  return mod.handler as (req: Request) => Promise<Response>;
}

function installStubs(options: {
  auth?: Record<string, unknown>;
  profile?: Record<string, unknown> | null;
  overlappingAbsences?: Array<Record<string, unknown>>;
  employeeHistory?: Array<Record<string, unknown>>;
  canManage?: boolean;
} = {}) {
  const createClientCalls: Array<Record<string, unknown>> = [];
  const rpcCalls: string[] = [];
  const fromCalls: string[] = [];

  const fixtures = {
    auth: options.auth ?? { userId: VALID_PROFILE_ID },
    profile: options.profile ?? { prenom: "Ada", nom: "Lovelace", email: "ada@example.test" },
    overlappingAbsences: options.overlappingAbsences ?? [],
    employeeHistory: options.employeeHistory ?? [],
    canManage: options.canManage ?? false,
  };

  (globalThis as any).__testValidateUserAuth = () => Promise.resolve(fixtures.auth);
  (globalThis as any).__testSanitizeErrorForClient = (error: unknown) => {
    if (error instanceof Error) return error.message;
    return String(error);
  };

  (globalThis as any).__testCreateClient = (url: string, key: string, options?: unknown) => {
    createClientCalls.push({ url, key, options });

    return {
      rpc(name: string) {
        rpcCalls.push(name);
        return Promise.resolve({ data: fixtures.canManage, error: null });
      },

      from(table: string) {
        fromCalls.push(table);

        const query: Record<string, unknown> = {
          table,
          selectValue: "",
          filters: [],

          select(value: string) {
            this.selectValue = value;
            return this;
          },

          eq(column: string, value: unknown) {
            (this.filters as Array<Record<string, unknown>>).push({ method: "eq", column, value });
            return this;
          },

          gte(column: string, value: unknown) {
            (this.filters as Array<Record<string, unknown>>).push({ method: "gte", column, value });
            return this;
          },

          or(value: string) {
            (this.filters as Array<Record<string, unknown>>).push({ method: "or", value });
            return this;
          },

          neq(column: string, value: unknown) {
            (this.filters as Array<Record<string, unknown>>).push({ method: "neq", column, value });
            return this;
          },

          in(column: string, value: unknown) {
            (this.filters as Array<Record<string, unknown>>).push({ method: "in", column, value });
            return this;
          },

          limit(value: number) {
            (this.filters as Array<Record<string, unknown>>).push({ method: "limit", value });
            return this;
          },

          single() {
            return Promise.resolve({ data: fixtures.profile, error: null });
          },

          then(resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) {
            let data: unknown = null;

            if (table === "rh_absences") {
              data = String(this.selectValue).includes("profiles!rh_absences_profile_id_fkey")
                ? fixtures.overlappingAbsences
                : fixtures.employeeHistory;
            } else if (table === "profiles") {
              data = fixtures.profile;
            }

            return Promise.resolve({ data, error: null }).then(resolve, reject);
          },
        };

        return query;
      },
    };
  };

  return { createClientCalls, rpcCalls, fromCalls };
}

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/check-absence-conflicts", {
    method: "POST",
    headers: {
      "authorization": "Bearer unit-test-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json();
}

function extractBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`Unable to find start marker: ${startMarker}`);

  const valueStart = start + startMarker.length;
  const end = source.indexOf(endMarker, valueStart);
  if (end === -1) throw new Error(`Unable to find end marker: ${endMarker}`);

  return source.slice(valueStart, end);
}

function extractIsoDateRegex(source: string): RegExp {
  const match = source.match(/const ISO_DATE = \/(.+)\/;/);
  if (!match) throw new Error("Unable to find ISO_DATE regex");
  return new RegExp(match[1]);
}

function extractUuidRegex(source: string): RegExp {
  const pattern = extractBetween(source, "if (!/", "/i.test(profile_id))");
  return new RegExp(pattern, "i");
}

Deno.test("module source exposes strict validation rules for dates and UUIDs", async () => {
  const source = await Deno.readTextFile(INDEX_PATH);
  const isoDate = extractIsoDateRegex(source);
  const uuid = extractUuidRegex(source);

  assertEquals(isoDate.test("2025-01-31"), true);
  assertEquals(isoDate.test("2025-1-31"), false);
  assertEquals(isoDate.test("2025-01-31.or.profile_id.eq.x"), false);
  assertEquals(isoDate.test("2025-01-31T00:00:00Z"), false);

  assertEquals(uuid.test(VALID_PROFILE_ID), true);
  assertEquals(uuid.test("123E4567-E89B-12D3-A456-426614174000"), true);
  assertEquals(uuid.test("not-a-uuid"), false);
  assertEquals(uuid.test(`${VALID_PROFILE_ID}.or.role.eq.admin`), false);
});

Deno.test("test helper fails loudly when a validation marker is missing", () => {
  assertThrows(
    () => extractBetween("const value = 1;", "if (!/", "/i.test(profile_id))"),
    Error,
    "Unable to find start marker",
  );
});

Deno.test("malformed transformed module rejects during dynamic import", async () => {
  await assertRejects(
    () => importTempModule("export const handler = ;"),
    Error,
  );
});

Deno.test("OPTIONS preflight returns CORS headers without authentication", async () => {
  installStubs({ auth: { error: "should-not-be-used" } });

  await withEnv({
    SUPABASE_URL: "http://supabase.local",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    SUPABASE_ANON_KEY: "anon",
    AZURE_OPENAI_ENDPOINT: undefined,
    AZURE_OPENAI_API_KEY: undefined,
  }, async () => {
    const handler = await loadHandler();
    const response = await handler(new Request("http://localhost/check-absence-conflicts", { method: "OPTIONS" }));

    assertEquals(response.status, 200);
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(response.headers.get("Access-Control-Allow-Headers"), "authorization, x-client-info, apikey, content-type, x-internal-secret");
    assertEquals(await response.text(), "");
  });
});

Deno.test("unauthenticated request returns 401 JSON error", async () => {
  installStubs({ auth: { error: "invalid token" } });

  await withEnv({
    SUPABASE_URL: "http://supabase.local",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    SUPABASE_ANON_KEY: "anon",
    AZURE_OPENAI_ENDPOINT: undefined,
    AZURE_OPENAI_API_KEY: undefined,
  }, async () => {
    const handler = await loadHandler();
    const response = await handler(postRequest({
      profile_id: VALID_PROFILE_ID,
      date_debut: "2025-02-10",
      date_fin: "2025-02-12",
      type_absence: "conges_payes",
    }));

    assertEquals(response.status, 401);
    assertEquals(await json(response), { error: "Unauthorized" });
    assertEquals(response.headers.get("Content-Type"), "application/json");
  });
});

Deno.test("missing required parameters are sanitized in a 500 response", async () => {
  installStubs();

  await withEnv({
    SUPABASE_URL: "http://supabase.local",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    SUPABASE_ANON_KEY: "anon",
    AZURE_OPENAI_ENDPOINT: undefined,
    AZURE_OPENAI_API_KEY: undefined,
  }, async () => {
    const handler = await loadHandler();
    const response = await handler(postRequest({
      profile_id: VALID_PROFILE_ID,
      date_debut: "2025-02-10",
      type_absence: "conges_payes",
    }));

    assertEquals(response.status, 500);
    assertEquals(await json(response), {
      error: "Missing required parameters",
      hasConflict: false,
      riskScore: 0,
      warnings: [],
      recommendation: "Impossible d'analyser les conflits",
    });
  });
});

Deno.test("invalid ISO date format returns 400 before database access", async () => {
  const stubs = installStubs();

  await withEnv({
    SUPABASE_URL: "http://supabase.local",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    SUPABASE_ANON_KEY: "anon",
    AZURE_OPENAI_ENDPOINT: undefined,
    AZURE_OPENAI_API_KEY: undefined,
  }, async () => {
    const handler = await loadHandler();
    const response = await handler(postRequest({
      profile_id: VALID_PROFILE_ID,
      date_debut: "2025-02-10.or.profile_id.eq.any",
      date_fin: "2025-02-12",
      type_absence: "conges_payes",
    }));

    assertEquals(response.status, 400);
    assertEquals(await json(response), { error: "Invalid date format (expected YYYY-MM-DD)" });
    assertEquals(stubs.createClientCalls.length, 0);
    assertEquals(stubs.fromCalls.length, 0);
  });
});

Deno.test("invalid profile_id returns 400 before database access", async () => {
  const stubs = installStubs();

  await withEnv({
    SUPABASE_URL: "http://supabase.local",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    SUPABASE_ANON_KEY: "anon",
    AZURE_OPENAI_ENDPOINT: undefined,
    AZURE_OPENAI_API_KEY: undefined,
  }, async () => {
    const handler = await loadHandler();
    const response = await handler(postRequest({
      profile_id: "not-a-valid-uuid",
      date_debut: "2025-02-10",
      date_fin: "2025-02-12",
      type_absence: "conges_payes",
    }));

    assertEquals(response.status, 400);
    assertEquals(await json(response), { error: "Invalid profile_id" });
    assertEquals(stubs.createClientCalls.length, 0);
    assertEquals(stubs.fromCalls.length, 0);
  });
});

Deno.test("caller cannot query another profile without RH authorization", async () => {
  const stubs = installStubs({
    auth: { userId: VALID_PROFILE_ID },
    canManage: false,
  });

  await withEnv({
    SUPABASE_URL: "http://supabase.local",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    SUPABASE_ANON_KEY: "anon",
    AZURE_OPENAI_ENDPOINT: undefined,
    AZURE_OPENAI_API_KEY: undefined,
  }, async () => {
    const handler = await loadHandler();
    const response = await handler(postRequest({
      profile_id: OTHER_PROFILE_ID,
      date_debut: "2025-03-10",
      date_fin: "2025-03-12",
      type_absence: "rtt",
    }));

    assertEquals(response.status, 403);
    assertEquals(await json(response), { error: "Forbidden" });
    assertEquals(stubs.rpcCalls, ["can_manage_rh_data"]);
    assertEquals(stubs.createClientCalls.length, 2);
    assertEquals(stubs.createClientCalls[0].key, "service-role");
    assertEquals(stubs.createClientCalls[1].key, "anon");
  });
});

Deno.test("fallback analysis reports team overlap and end-of-month risk without Azure", async () => {
  const stubs = installStubs({
    auth: { userId: VALID_PROFILE_ID },
    overlappingAbsences: [
      {
        date_debut: "2025-05-26",
        date_fin: "2025-05-28",
        type_absence: "conges_payes",
        statut: "validee",
        profiles: { prenom: "Grace", nom: "Hopper" },
      },
      {
        date_debut: "2025-05-29",
        date_fin: "2025-05-30",
        type_absence: "rtt",
        statut: "en_attente",
        profiles: { prenom: "Katherine", nom: "Johnson" },
      },
    ],
    employeeHistory: [
      { type_absence: "rtt", nombre_jours: 2, date_debut: "2024-08-01", date_fin: "2024-08-02" },
      { type_absence: "conges_payes", nombre_jours: 5, date_debut: "2024-12-23", date_fin: "2024-12-27" },
    ],
  });

  await withEnv({
    SUPABASE_URL: "http://supabase.local",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    SUPABASE_ANON_KEY: "anon",
    AZURE_OPENAI_ENDPOINT: undefined,
    AZURE_OPENAI_API_KEY: undefined,
  }, async () => {
    const handler = await loadHandler();
    const response = await handler(postRequest({
      profile_id: VALID_PROFILE_ID,
      date_debut: "2025-05-27",
      date_fin: "2025-05-30",
      type_absence: "conges_payes",
    }));

    assertEquals(response.status, 200);
    assertEquals(await json(response), {
      hasConflict: true,
      riskScore: 75,
      warnings: [
        "2 collègue(s) absent(s) sur cette période",
        "Période de fin de mois (clôtures comptables)",
      ],
      recommendation: "Quelques points d'attention identifiés, la demande peut être soumise",
    });
    assertEquals(stubs.rpcCalls.length, 0);
    assertEquals(stubs.fromCalls, ["profiles", "rh_absences", "rh_absences"]);
  });
});

Deno.test("fallback analysis returns no conflict for mid-month period with no overlap", async () => {
  installStubs({
    auth: { userId: VALID_PROFILE_ID },
    overlappingAbsences: [],
    employeeHistory: [],
  });

  await withEnv({
    SUPABASE_URL: "http://supabase.local",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    SUPABASE_ANON_KEY: "anon",
    AZURE_OPENAI_ENDPOINT: undefined,
    AZURE_OPENAI_API_KEY: undefined,
  }, async () => {
    const handler = await loadHandler();
    const response = await handler(postRequest({
      profile_id: VALID_PROFILE_ID,
      date_debut: "2025-06-10",
      date_fin: "2025-06-12",
      type_absence: "rtt",
    }));

    assertEquals(response.status, 200);
    assertEquals(await json(response), {
      hasConflict: false,
      riskScore: 0,
      warnings: [],
      recommendation: "Aucun conflit détecté, la demande peut être validée",
    });
  });
});

Deno.test("Azure analysis uses generated context and clamps risk score to 100", async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<{ input: unknown; init?: RequestInit; body: Record<string, unknown> }> = [];

  installStubs({
    auth: { userId: VALID_PROFILE_ID },
    profile: { prenom: "Ada", nom: "Lovelace", email: "ada@example.test" },
    overlappingAbsences: [
      {
        date_debut: "2025-07-14",
        date_fin: "2025-07-18",
        type_absence: "conges_payes",
        statut: "validee",
        profiles: { prenom: "Grace", nom: "Hopper" },
      },
    ],
    employeeHistory: [
      { type_absence: "conges_payes", nombre_jours: 12, date_debut: "2025-01-02", date_fin: "2025-01-15" },
      { type_absence: "rtt", nombre_jours: 3, date_debut: "2025-03-10", date_fin: "2025-03-12" },
    ],
  });

  globalThis.fetch = ((input: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    fetchCalls.push({ input, init, body });

    return Promise.resolve(new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              hasConflict: true,
              riskScore: 150,
              warnings: ["Sous-effectif probable"],
              recommendation: "Décaler si possible",
            }),
          },
        },
      ],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
  }) as typeof fetch;

  try {
    await withEnv({
      SUPABASE_URL: "http://supabase.local",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      SUPABASE_ANON_KEY: "anon",
      AZURE_OPENAI_ENDPOINT: "https://azure-openai.local/deployments/gpt-5/chat/completions",
      AZURE_OPENAI_API_KEY: "unit-test-api-key",
    }, async () => {
      const handler = await loadHandler();
      const response = await handler(postRequest({
        profile_id: VALID_PROFILE_ID,
        date_debut: "2025-07-14",
        date_fin: "2025-07-18",
        type_absence: "conges_payes",
      }));

      assertEquals(response.status, 200);
      assertEquals(await json(response), {
        hasConflict: true,
        riskScore: 100,
        warnings: ["Sous-effectif probable"],
        recommendation: "Décaler si possible",
      });

      assertEquals(fetchCalls.length, 1);
      assertEquals(fetchCalls[0].input, "https://azure-openai.local/deployments/gpt-5/chat/completions");
      assertEquals(fetchCalls[0].body.max_completion_tokens, 500);
      assertEquals(fetchCalls[0].body.reasoning_effort, "low");
      assertEquals(fetchCalls[0].body.verbosity, "low");
      assertEquals(fetchCalls[0].body.response_format, { type: "json_object" });

      const messages = fetchCalls[0].body.messages as Array<Record<string, string>>;
      assertEquals(messages[0].role, "system");
      assertEquals(messages[1].role, "user");
      assertEquals(messages[1].content.includes("Ada Lovelace"), true);
      assertEquals(messages[1].content.includes("Grace Hopper"), true);
      assertEquals(messages[1].content.includes("\"totalDays\": 15"), true);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("Azure response without content is converted to sanitized 500 fallback", async () => {
  const originalFetch = globalThis.fetch;

  installStubs({
    auth: { userId: VALID_PROFILE_ID },
    overlappingAbsences: [],
    employeeHistory: [],
  });

  globalThis.fetch = (() => {
    return Promise.resolve(new Response(JSON.stringify({ choices: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
  }) as typeof fetch;

  try {
    await withEnv({
      SUPABASE_URL: "http://supabase.local",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      SUPABASE_ANON_KEY: "anon",
      AZURE_OPENAI_ENDPOINT: "https://azure-openai.local/deployments/gpt-5/chat/completions",
      AZURE_OPENAI_API_KEY: "unit-test-api-key",
    }, async () => {
      const handler = await loadHandler();
      const response = await handler(postRequest({
        profile_id: VALID_PROFILE_ID,
        date_debut: "2025-07-10",
        date_fin: "2025-07-11",
        type_absence: "rtt",
      }));

      assertEquals(response.status, 500);
      assertEquals(await json(response), {
        error: "No content in Azure response",
        hasConflict: false,
        riskScore: 0,
        warnings: [],
        recommendation: "Impossible d'analyser les conflits",
      });
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});