import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODULE_DIR = fileURLToPath(new URL(".", import.meta.url));

const SERVE_STUB = `
export function serve(handler) {
  globalThis.__edgeFunctionHandler = handler;
  globalThis.__serveCalls = (globalThis.__serveCalls ?? 0) + 1;
  return Promise.resolve();
}
`;

const SUPABASE_STUB = `
class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.action = "select";
    this.selectArgs = undefined;
    this.ops = [];
  }

  select(columns, options) {
    this.action = "select";
    this.selectArgs = [columns, options];
    this.ops.push(["select", columns, options]);
    return this;
  }

  eq(column, value) {
    this.ops.push(["eq", column, value]);
    return this;
  }

  not(column, operator, value) {
    this.ops.push(["not", column, operator, value]);
    return this;
  }

  range(from, to) {
    this.ops.push(["range", from, to]);
    return this;
  }

  order(column, options) {
    this.ops.push(["order", column, options]);
    return this;
  }

  update(data) {
    this.action = "update";
    this.updateData = data;
    this.ops.push(["update", data]);
    return this;
  }

  insert(data) {
    this.action = "insert";
    this.insertData = data;
    this.ops.push(["insert", data]);
    return this;
  }

  async _result() {
    const scenario = globalThis.__supabaseScenario ?? {};
    globalThis.__queryLog = globalThis.__queryLog ?? [];
    globalThis.__queryLog.push({
      table: this.table,
      action: this.action,
      selectArgs: this.selectArgs,
      ops: this.ops,
      updateData: this.updateData,
      insertData: this.insertData,
    });

    if (this.table === "user_roles") {
      return {
        data: scenario.roles ?? [],
        error: scenario.rolesError ?? null,
      };
    }

    if (this.table === "rh_salaires_mensuels") {
      if (this.action === "update") {
        globalThis.__updates = globalThis.__updates ?? [];
        globalThis.__updates.push(this.updateData);
        return { error: scenario.updateError ?? null };
      }

      const isCountQuery = this.selectArgs?.[1]?.count === "exact" && this.selectArgs?.[1]?.head === true;
      if (isCountQuery) {
        return {
          count: scenario.totalCount ?? 0,
          error: scenario.countError ?? null,
        };
      }

      return {
        data: scenario.salaires ?? [],
        error: scenario.salairesError ?? null,
      };
    }

    if (this.table === "rh_bulletins_parsing_log") {
      globalThis.__parsingLogs = globalThis.__parsingLogs ?? [];
      globalThis.__parsingLogs.push(this.insertData);
      return { error: scenario.insertLogError ?? null };
    }

    return { data: null, error: null, count: null };
  }

  then(resolve, reject) {
    return this._result().then(resolve, reject);
  }
}

export function createClient(url, key, options) {
  globalThis.__createClientCalls = globalThis.__createClientCalls ?? [];
  globalThis.__createClientCalls.push({ url, key, options });

  const scenario = globalThis.__supabaseScenario ?? {};

  return {
    auth: {
      async getUser() {
        const currentScenario = globalThis.__supabaseScenario ?? scenario;
        return {
          data: { user: currentScenario.user ?? null },
          error: currentScenario.authError ?? null,
        };
      },
    },
    from(table) {
      return new QueryBuilder(table);
    },
    storage: {
      from(bucket) {
        return {
          async download(path) {
            globalThis.__downloads = globalThis.__downloads ?? [];
            globalThis.__downloads.push({ bucket, path });
            const currentScenario = globalThis.__supabaseScenario ?? {};
            return {
              data: currentScenario.downloadData ?? null,
              error: currentScenario.downloadError ?? { message: "download not mocked for this scenario" },
            };
          },
        };
      },
    },
  };
}
`;

const ERROR_SANITIZER_STUB = `
export function buildErrorResponse(functionName, error, corsHeaders = {}, status = 500) {
  return new Response(
    JSON.stringify({
      error: error?.message ?? String(error),
      function: functionName,
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}
`;

async function runIsolatedEdgeModule(script: string): Promise<string> {
  const tempDir = await Deno.makeTempDir();
  const runnerPath = await Deno.makeTempFile({
    dir: MODULE_DIR,
    prefix: ".edge-test-runner-",
    suffix: ".ts",
  });

  try {
    const serveStubPath = join(tempDir, "serve-stub.ts");
    const supabaseStubPath = join(tempDir, "supabase-stub.ts");
    const errorSanitizerStubPath = join(tempDir, "error-sanitizer-stub.ts");
    const importMapPath = join(tempDir, "import_map.json");

    await Deno.writeTextFile(serveStubPath, SERVE_STUB);
    await Deno.writeTextFile(supabaseStubPath, SUPABASE_STUB);
    await Deno.writeTextFile(errorSanitizerStubPath, ERROR_SANITIZER_STUB);

    await Deno.writeTextFile(
      importMapPath,
      JSON.stringify({
        imports: {
          "https://deno.land/std@0.168.0/http/server.ts": pathToFileURL(serveStubPath).href,
          "@supabase/supabase-js": pathToFileURL(supabaseStubPath).href,
          [new URL("../_shared/error-sanitizer.ts", import.meta.url).href]: pathToFileURL(errorSanitizerStubPath).href,
        },
      }),
    );

    const runnerCode = `
Deno.chdir(${JSON.stringify(MODULE_DIR)});

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function json(response) {
  return await response.json();
}

${script}
`;

    await Deno.writeTextFile(runnerPath, runnerCode);

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-all",
        "--no-check",
        `--import-map=${importMapPath}`,
        runnerPath,
      ],
      stdout: "piped",
      stderr: "piped",
      env: {
        AZURE_OPENAI_ENDPOINT: "https://azure-openai.example.invalid/openai/deployments/test/chat/completions?api-version=2024-02-15-preview",
        AZURE_OPENAI_API_KEY: "test-azure-key",
        SUPABASE_URL: "https://supabase.example.invalid",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
        NO_COLOR: "1",
      },
    });

    const output = await command.output();
    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    assertEquals(
      output.code,
      0,
      `Isolated module execution failed.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`,
    );

    return stdout;
  } finally {
    await Deno.remove(runnerPath).catch(() => {});
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
}

Deno.test("module registers handler and handles CORS preflight plus missing authentication offline", async () => {
  await runIsolatedEdgeModule(`
await import("./index.ts");

assert(globalThis.__serveCalls === 1, "serve must be called exactly once");
assert(typeof globalThis.__edgeFunctionHandler === "function", "HTTP handler must be registered");

const optionsResponse = await globalThis.__edgeFunctionHandler(
  new Request("http://localhost/reanalyze-all-bulletins", { method: "OPTIONS" }),
);

assert(optionsResponse.status === 200, "OPTIONS response should be 200");
// Le socle durci n emet plus jamais l origine generique : on compare a ce que
// le VRAI module partage calcule (le runner est ecrit dans le repertoire de la
// fonction, l import relatif s y resout), et on exige que ce ne soit pas "*".
const socleCors = (await import("../_shared/cors.ts")).corsHeaders;
assert(socleCors["Access-Control-Allow-Origin"] !== "*", "CORS origin must never be the wildcard");
assert(
  optionsResponse.headers.get("Access-Control-Allow-Origin") === socleCors["Access-Control-Allow-Origin"],
  "CORS origin must be the origin declared by the operator",
);
assert(
  optionsResponse.headers.get("Access-Control-Allow-Headers") === "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "CORS allowed headers must match edge function contract",
);

const unauthorizedResponse = await globalThis.__edgeFunctionHandler(
  new Request("http://localhost/reanalyze-all-bulletins", { method: "POST" }),
);
const unauthorizedBody = await json(unauthorizedResponse);

assert(unauthorizedResponse.status === 401, "missing Authorization header should return 401");
assert(unauthorizedBody.error === "Authentication required", "missing auth error payload should be explicit");
assert((globalThis.__createClientCalls ?? []).length === 0, "Supabase client must not be created without Authorization");
`);
});

Deno.test("handler rejects authenticated non-admin users without processing bulletins", async () => {
  await runIsolatedEdgeModule(`
await import("./index.ts");

globalThis.__supabaseScenario = {
  user: { id: "user-employee-1" },
  roles: [{ role: "employee" }],
};

const response = await globalThis.__edgeFunctionHandler(
  new Request("http://localhost/reanalyze-all-bulletins", {
    method: "POST",
    headers: {
      Authorization: "Bearer user-token",
      "Content-Type": "application/json",
    },
    body: "{}",
  }),
);

const body = await json(response);

assert(response.status === 403, "non-admin user should be rejected with 403");
assert(body.error === "Admin access required", "non-admin error payload should be explicit");
assert(globalThis.__createClientCalls.length === 1, "Supabase client should be created once");
assert(
  globalThis.__createClientCalls[0].options.global.headers.Authorization === "Bearer user-token",
  "Authorization header should be forwarded to Supabase client",
);
assert(
  (globalThis.__queryLog ?? []).some((entry) => entry.table === "user_roles"),
  "user_roles table should be queried for admin check",
);
assert(
  !(globalThis.__queryLog ?? []).some((entry) => entry.table === "rh_salaires_mensuels"),
  "salary table must not be queried for non-admin users",
);
`);
});

Deno.test("handler returns successful paginated result for admin when batch is empty", async () => {
  await runIsolatedEdgeModule(`
await import("./index.ts");

globalThis.__supabaseScenario = {
  user: { id: "admin-1" },
  roles: [{ role: "admin" }],
  totalCount: 7,
  salaires: [],
};

const response = await globalThis.__edgeFunctionHandler(
  new Request("http://localhost/reanalyze-all-bulletins", {
    method: "POST",
    headers: {
      Authorization: "Bearer admin-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ batch_size: 2, offset: 4 }),
  }),
);

const body = await json(response);

assert(response.status === 200, "admin empty batch should return 200");
assert(body.success === true, "success flag should be true");
assert(body.results.total === 7, "total count should come from count query");
assert(body.results.processed === 0, "empty fetched batch should process zero rows");
assert(body.results.offset === 4, "offset should come from request body");
assert(body.results.batch_size === 2, "batch size should come from request body");
assert(body.results.updated === 0, "no rows should be updated");
assert(body.results.failed === 0, "no rows should fail");
assert(body.results.skipped === 0, "no rows should be skipped");
assert(body.results.has_more === true, "offset 4 plus batch size 2 should leave more rows out of total 7");
assert(Array.isArray(body.results.errors) && body.results.errors.length === 0, "empty batch should have no errors");
assert(typeof body.processing_duration_ms === "number", "processing duration should be numeric");

const salaryQueries = (globalThis.__queryLog ?? []).filter((entry) => entry.table === "rh_salaires_mensuels");
assert(salaryQueries.length === 2, "handler should count total rows and fetch one salary batch");
assert(
  salaryQueries.some((entry) => entry.selectArgs?.[1]?.count === "exact" && entry.selectArgs?.[1]?.head === true),
  "count query should request exact head count",
);
assert(
  salaryQueries.some((entry) => entry.ops.some((op) => op[0] === "range" && op[1] === 4 && op[2] === 5)),
  "batch query should use inclusive range offset to offset + batchSize - 1",
);
`);
});

Deno.test("handler skips salary rows without an associated document and avoids storage access", async () => {
  await runIsolatedEdgeModule(`
await import("./index.ts");

globalThis.__supabaseScenario = {
  user: { id: "admin-2" },
  roles: [{ role: "admin" }],
  totalCount: 1,
  salaires: [{
    id: "salary-without-document",
    profile_id: "profile-1",
    mois: "2024-05-01",
    source_document_id: "document-1",
    net_paye: 2100,
    salaire_net: 2050,
    rh_documents_employes: null,
  }],
};

const response = await globalThis.__edgeFunctionHandler(
  new Request("http://localhost/reanalyze-all-bulletins", {
    method: "POST",
    headers: {
      Authorization: "Bearer admin-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ batch_size: 3, offset: 0 }),
  }),
);

const body = await json(response);

assert(response.status === 200, "admin batch with skipped row should return 200");
assert(body.success === true, "success flag should remain true when a row is skipped");
assert(body.results.total === 1, "total should be preserved");
assert(body.results.processed === 1, "one fetched salary should be counted as processed");
assert(body.results.updated === 0, "row without document should not be updated");
assert(body.results.failed === 0, "row without document should not be marked failed");
assert(body.results.skipped === 1, "row without document should be skipped");
assert(body.results.has_more === false, "single-row batch should not have more rows");
assert((globalThis.__downloads ?? []).length === 0, "storage download must not be attempted for missing document");
assert((globalThis.__updates ?? []).length === 0, "database update must not be attempted for missing document");
assert((globalThis.__parsingLogs ?? []).length === 0, "parsing log must not be inserted for skipped row");
`);
});

Deno.test("source keeps expected pagination defaults and timeout guard", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes("const TIMEOUT_MS = 90000"), true);
  assertEquals(source.includes("const batchSize = body.batch_size || 3"), true);
  assertEquals(source.includes("const offset = body.offset || 0"), true);
  assertEquals(source.includes(".range(offset, offset + batchSize - 1)"), true);
  assertExists(source.match(/has_more:\s*\(offset \+ batchSize\) < \(totalCount \|\| 0\)/));
});

Deno.test("source maps GPT extracted salary fields only to existing monthly salary columns", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes("updateData.salaire_brut = extractedData.salaire_brut;"), true);
  assertEquals(source.includes("updateData.salaire_net = extractedData.salaire_net;"), true);
  assertEquals(source.includes("updateData.net_paye = extractedData.salaire_net_a_payer;"), true);
  assertEquals(source.includes("updateData.cotisations_salariales = extractedData.cotisations_salariales;"), true);
  assertEquals(source.includes("updateData.cotisations_patronales = extractedData.cotisations_patronales;"), true);
  assertEquals(source.includes("updateData.primes = extractedData.primes;"), true);
  assertEquals(source.includes("updateData.heures_supplementaires = extractedData.heures_supplementaires;"), true);
  assertEquals(source.includes("updateData.heures_travaillees"), false);
  assertEquals(source.includes("updateData.taux_horaire"), false);
});

Deno.test("test harness assertion helpers are available", () => {
  assertThrows(() => {
    throw new Error("expected synchronous failure");
  }, Error);

  assertRejects(
    () => Promise.reject(new Error("expected asynchronous failure")),
    Error,
  );
});