import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const decoder = new TextDecoder();

function fileUrlToPath(url: URL): string {
  let pathname = decodeURIComponent(url.pathname);
  if (Deno.build.os === "windows" && pathname.startsWith("/")) {
    pathname = pathname.slice(1);
  }
  return pathname;
}

function pathToFileUrl(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const absolute = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `file://${encodeURI(absolute).replace(/#/g, "%23").replace(/\?/g, "%3F")}`;
}

function extractProbeResult(stdout: string): Record<string, unknown> {
  const line = stdout.split(/\r?\n/).find((entry) => entry.startsWith("PROBE_RESULT:"));
  if (!line) {
    throw new Error(`PROBE_RESULT marker not found in stdout: ${stdout}`);
  }
  return JSON.parse(line.slice("PROBE_RESULT:".length));
}

async function runIsolatedProbe(
  scenarioSource: string,
  options: { rateLimitStubSource?: string; supabaseStubSource?: string } = {},
): Promise<Record<string, unknown>> {
  const tempDir = await Deno.makeTempDir({ prefix: "help-me-create-document-test-" });
  const tempDirUrl = pathToFileUrl(tempDir.endsWith("/") ? tempDir : `${tempDir}/`);

  const serverStubUrl = new URL("server_stub.ts", tempDirUrl);
  const supabaseStubUrl = new URL("supabase_stub.ts", tempDirUrl);
  const azureStubUrl = new URL("azure_stub.ts", tempDirUrl);
  const errorStubUrl = new URL("error_stub.ts", tempDirUrl);
  const rateStubUrl = new URL("rate_stub.ts", tempDirUrl);
  const importMapUrl = new URL("import_map.json", tempDirUrl);

  const moduleDirUrl = new URL(".", import.meta.url);
  const indexUrl = new URL("./index.ts", import.meta.url);
  const azureSharedUrl = new URL("../_shared/azure-gpt5-mini.ts", indexUrl).href;
  const errorSharedUrl = new URL("../_shared/error-sanitizer.ts", indexUrl).href;
  const rateSharedUrl = new URL("../_shared/rate-limit.ts", indexUrl).href;
  const probeUrl = new URL(`.index-test-probe-${crypto.randomUUID()}.ts`, moduleDirUrl);

  try {
    await Deno.writeTextFile(
      serverStubUrl,
      `
export function serve(handler) {
  globalThis.__helpMeCreateDocumentHandler = handler;
  globalThis.__serveCalls = (globalThis.__serveCalls || 0) + 1;
  return Promise.resolve();
}
`,
    );

    await Deno.writeTextFile(
      supabaseStubUrl,
      options.supabaseStubSource ??
        `
const createClientCalls = [];
const fromCalls = [];
const authGetUserCalls = [];
const queryCalls = [];
globalThis.__supabaseCreateClientCalls = createClientCalls;
globalThis.__supabaseFromCalls = fromCalls;
globalThis.__supabaseAuthGetUserCalls = authGetUserCalls;
globalThis.__supabaseQueryCalls = queryCalls;

class QueryStub {
  constructor(table) {
    this.table = table;
  }
  _record(method, args) {
    queryCalls.push({ table: this.table, method, args: Array.from(args) });
    return this;
  }
  select() { return this._record("select", arguments); }
  order() { return this._record("order", arguments); }
  limit() { return this._record("limit", arguments); }
  eq() { return this._record("eq", arguments); }
  gte() { return this._record("gte", arguments); }
  lte() { return this._record("lte", arguments); }
  ilike() { return this._record("ilike", arguments); }
  or() { return this._record("or", arguments); }
  insert() { return this._record("insert", arguments); }
  update() { return this._record("update", arguments); }
  upsert() { return this._record("upsert", arguments); }
  delete() { return this._record("delete", arguments); }
  single() { return Promise.resolve({ data: null, error: null }); }
  maybeSingle() { return Promise.resolve({ data: null, error: null }); }
  then(resolve, reject) {
    return Promise.resolve({ data: [], error: null }).then(resolve, reject);
  }
}

export function createClient(url, key, config) {
  createClientCalls.push({ url, key, config });
  return {
    auth: {
      getUser: async (token) => {
        authGetUserCalls.push(token);
        return {
          data: { user: { id: "user-test-1", email: "user@example.test" } },
          error: null,
        };
      },
    },
    from: (table) => {
      fromCalls.push(table);
      return new QueryStub(table);
    },
  };
}
`,
    );

    await Deno.writeTextFile(
      azureStubUrl,
      `
export async function callGpt5Mini() {
  globalThis.__azureGptCalls = (globalThis.__azureGptCalls || 0) + 1;
  return "Document généré par le stub Azure GPT.";
}
`,
    );

    await Deno.writeTextFile(
      errorStubUrl,
      `
export function buildErrorResponse(error) {
  return new Response(JSON.stringify({
    error: "Erreur interne",
    detail: error instanceof Error ? error.message : String(error),
  }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}
`,
    );

    await Deno.writeTextFile(
      rateStubUrl,
      options.rateLimitStubSource ??
        `
const calls = [];
globalThis.__rateLimitCalls = calls;

export function checkRateLimit(key, options) {
  calls.push({ key, options });
  return { allowed: true, remaining: 9, retryAfterSec: 0 };
}
`,
    );

    await Deno.writeTextFile(
      importMapUrl,
      JSON.stringify(
        {
          imports: {
            "https://deno.land/std@0.168.0/http/server.ts": serverStubUrl.href,
            "https://esm.sh/@supabase/supabase-js@2": supabaseStubUrl.href,
            [azureSharedUrl]: azureStubUrl.href,
            [errorSharedUrl]: errorStubUrl.href,
            [rateSharedUrl]: rateStubUrl.href,
          },
        },
        null,
        2,
      ),
    );

    await Deno.writeTextFile(
      probeUrl,
      `
const results = {};
const originalFetch = globalThis.fetch;
globalThis.fetch = async () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

try {
  await import("./index.ts");

  const handler = globalThis.__helpMeCreateDocumentHandler;
  if (typeof handler !== "function") {
    throw new Error("HTTP handler was not captured by serve stub");
  }

  ${scenarioSource}

  console.log("PROBE_RESULT:" + JSON.stringify(results));
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  Deno.exit(1);
} finally {
  globalThis.fetch = originalFetch;
}
`,
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-all",
        "--no-check",
        "--import-map",
        fileUrlToPath(importMapUrl),
        fileUrlToPath(probeUrl),
      ],
      cwd: fileUrlToPath(moduleDirUrl),
      stdout: "piped",
      stderr: "piped",
      env: {
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_ANON_KEY: "anon-key-for-tests",
        NO_COLOR: "1",
      },
    });

    const output = await command.output();
    const stdout = decoder.decode(output.stdout);
    const stderr = decoder.decode(output.stderr);

    if (output.code !== 0) {
      throw new Error(`Probe failed with code ${output.code}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
    }

    return extractProbeResult(stdout);
  } finally {
    await Deno.remove(probeUrl, { recursive: false }).catch(() => {});
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
}

Deno.test("module loads and handler returns CORS, unauthorized and validation responses offline", async () => {
  const results = await runIsolatedProbe(`
const optionsResponse = await handler(new Request("http://localhost/help-me-create-document", {
  method: "OPTIONS",
}));
results.options = {
  status: optionsResponse.status,
  allowOrigin: optionsResponse.headers.get("Access-Control-Allow-Origin"),
  allowHeaders: optionsResponse.headers.get("Access-Control-Allow-Headers"),
  body: await optionsResponse.text(),
};

const unauthorizedResponse = await handler(new Request("http://localhost/help-me-create-document", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ document_type: "rapport", title: "Rapport", sources: ["emails"] }),
}));
results.unauthorized = {
  status: unauthorizedResponse.status,
  contentType: unauthorizedResponse.headers.get("Content-Type"),
  json: await unauthorizedResponse.json(),
};

const missingParamsResponse = await handler(new Request("http://localhost/help-me-create-document", {
  method: "POST",
  headers: {
    "Authorization": "Bearer valid-test-token",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    document_type: "rapport",
    title: "Rapport trimestriel",
    sources: [],
  }),
}));
results.missingParams = {
  status: missingParamsResponse.status,
  contentType: missingParamsResponse.headers.get("Content-Type"),
  json: await missingParamsResponse.json(),
};

results.instrumentation = {
  serveCalls: globalThis.__serveCalls,
  createClientCalls: globalThis.__supabaseCreateClientCalls.length,
  authGetUserCalls: globalThis.__supabaseAuthGetUserCalls,
  fromCalls: globalThis.__supabaseFromCalls,
  rateLimitCalls: globalThis.__rateLimitCalls,
};
`);

  assertExists(results);

  assertEquals((results.options as any).status, 200);
  // La sonde charge le vrai ../_shared/cors.ts (il n'est pas dans la carte
  // d'import de substitution) : le prevol renvoie donc une origine DECLAREE,
  // jamais '*'. L'assertion suit la valeur reellement emise apres durcissement.
  assertEquals((results.options as any).allowOrigin === "*", false);
  assertEquals(String((results.options as any).allowOrigin).length > 0, true);
  assertEquals(String((results.options as any).allowHeaders).includes("authorization"), true);
  assertEquals(String((results.options as any).allowHeaders).includes("content-type"), true);
  assertEquals(String((results.options as any).allowHeaders).includes("x-internal-secret"), true);
  assertEquals((results.options as any).body, "");

  assertEquals((results.unauthorized as any).status, 401);
  assertEquals((results.unauthorized as any).json, { error: "Non autorisé" });
  assertEquals(String((results.unauthorized as any).contentType).includes("application/json"), true);

  assertEquals((results.missingParams as any).status, 400);
  assertEquals((results.missingParams as any).json, {
    error: "Paramètres manquants: document_type, title, sources",
  });
  assertEquals(String((results.missingParams as any).contentType).includes("application/json"), true);

  assertEquals((results.instrumentation as any).serveCalls, 1);
  assertEquals((results.instrumentation as any).createClientCalls, 1);
  assertEquals((results.instrumentation as any).authGetUserCalls, ["valid-test-token"]);
  assertEquals((results.instrumentation as any).fromCalls, []);
  assertEquals((results.instrumentation as any).rateLimitCalls.length, 1);
  assertEquals((results.instrumentation as any).rateLimitCalls[0].options, {
    limit: 10,
    windowSec: 60,
  });
});

Deno.test("handler returns 429 and does not create a Supabase client when rate limit is exceeded", async () => {
  const authHeader = "Bearer token-abcdefghijklmnopqrstuvwxyz-0123456789";
  const expectedRateKey = `help-me-create-document:${authHeader.slice(-32)}`;

  const results = await runIsolatedProbe(
    `
const limitedResponse = await handler(new Request("http://localhost/help-me-create-document", {
  method: "POST",
  headers: {
    "Authorization": ${JSON.stringify(authHeader)},
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    document_type: "rapport",
    title: "Rapport de test",
    sources: ["emails"],
  }),
}));

results.limited = {
  status: limitedResponse.status,
  retryAfter: limitedResponse.headers.get("Retry-After"),
  contentType: limitedResponse.headers.get("Content-Type"),
  json: await limitedResponse.json(),
};

results.instrumentation = {
  rateLimitCalls: globalThis.__rateLimitCalls,
  createClientCalls: globalThis.__supabaseCreateClientCalls.length,
  fromCalls: globalThis.__supabaseFromCalls,
};
`,
    {
      rateLimitStubSource: `
const calls = [];
globalThis.__rateLimitCalls = calls;

export function checkRateLimit(key, options) {
  calls.push({ key, options });
  return { allowed: false, retryAfterSec: 42 };
}
`,
    },
  );

  assertEquals((results.limited as any).status, 429);
  assertEquals((results.limited as any).retryAfter, "42");
  assertEquals((results.limited as any).json, {
    error: "Trop de requêtes, veuillez patienter.",
  });
  assertEquals(String((results.limited as any).contentType).includes("application/json"), true);

  assertEquals((results.instrumentation as any).rateLimitCalls, [
    {
      key: expectedRateKey,
      options: { limit: 10, windowSec: 60 },
    },
  ]);
  assertEquals((results.instrumentation as any).createClientCalls, 0);
  assertEquals((results.instrumentation as any).fromCalls, []);
});

Deno.test("handler rejects invalid Supabase authentication before reading the body", async () => {
  const results = await runIsolatedProbe(
    `
const invalidAuthResponse = await handler(new Request("http://localhost/help-me-create-document", {
  method: "POST",
  headers: {
    "Authorization": "Bearer invalid-token-for-test",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    document_type: "rapport",
    title: "Rapport de test",
    sources: ["emails"],
  }),
}));

results.invalidAuth = {
  status: invalidAuthResponse.status,
  contentType: invalidAuthResponse.headers.get("Content-Type"),
  json: await invalidAuthResponse.json(),
};

results.instrumentation = {
  createClientCalls: globalThis.__supabaseCreateClientCalls,
  authGetUserCalls: globalThis.__supabaseAuthGetUserCalls,
  fromCalls: globalThis.__supabaseFromCalls,
  rateLimitCalls: globalThis.__rateLimitCalls,
};
`,
    {
      supabaseStubSource: `
const createClientCalls = [];
const fromCalls = [];
const authGetUserCalls = [];
globalThis.__supabaseCreateClientCalls = createClientCalls;
globalThis.__supabaseFromCalls = fromCalls;
globalThis.__supabaseAuthGetUserCalls = authGetUserCalls;

export function createClient(url, key, config) {
  createClientCalls.push({ url, key, config });
  return {
    auth: {
      getUser: async (token) => {
        authGetUserCalls.push(token);
        return {
          data: { user: null },
          error: { message: "invalid jwt" },
        };
      },
    },
    from: (table) => {
      fromCalls.push(table);
      return {
        then(resolve, reject) {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
    },
  };
}
`,
    },
  );

  assertEquals((results.invalidAuth as any).status, 401);
  assertEquals((results.invalidAuth as any).json, { error: "Authentification invalide" });
  assertEquals(String((results.invalidAuth as any).contentType).includes("application/json"), true);

  assertEquals((results.instrumentation as any).authGetUserCalls, ["invalid-token-for-test"]);
  assertEquals((results.instrumentation as any).fromCalls, []);
  assertEquals((results.instrumentation as any).rateLimitCalls.length, 1);
  assertEquals((results.instrumentation as any).createClientCalls.length, 1);
  assertEquals((results.instrumentation as any).createClientCalls[0].url, "http://127.0.0.1:54321");
  assertEquals((results.instrumentation as any).createClientCalls[0].key, "anon-key-for-tests");
  assertEquals(
    (results.instrumentation as any).createClientCalls[0].config.global.headers.Authorization,
    "Bearer invalid-token-for-test",
  );
});

Deno.test("test harness rejects malformed probe output and propagates probe failures", async () => {
  assertThrows(
    () => extractProbeResult("ordinary log without marker"),
    Error,
    "PROBE_RESULT",
  );

  await assertRejects(
    () =>
      runIsolatedProbe(`
throw new Error("intentional probe failure");
`),
    Error,
    "intentional probe failure",
  );
});