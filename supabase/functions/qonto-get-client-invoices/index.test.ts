import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const textDecoder = new TextDecoder();

function filePathFromUrl(url: URL): string {
  return decodeURIComponent(url.pathname);
}

function fileUrlFromPath(path: string): string {
  return new URL(`file://${path}`).href;
}

const moduleDir = filePathFromUrl(new URL(".", import.meta.url));
const sharedErrorSanitizerUrl = new URL("../_shared/error-sanitizer.ts", import.meta.url).href;

async function runEdgeFunctionScenario(scenarioCode: string) {
  const tempDir = await Deno.makeTempDir({ prefix: "qonto_get_client_invoices_test_" });
  const harnessPath = `${moduleDir}.__qonto_get_client_invoices_harness_${crypto.randomUUID()}.ts`;
  const serveStubPath = `${tempDir}/serve_stub.ts`;
  const errorSanitizerStubPath = `${tempDir}/error_sanitizer_stub.ts`;
  const importMapPath = `${tempDir}/import_map.json`;

  await Deno.writeTextFile(
    serveStubPath,
    `
export let capturedHandler = undefined;

export function serve(handler) {
  capturedHandler = handler;
  return Promise.resolve();
}
`,
  );

  await Deno.writeTextFile(
    errorSanitizerStubPath,
    `
export function buildErrorResponse(functionName, error, corsHeaders = {}, status = 500) {
  return new Response(
    JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      invoices: [],
      total_a_encaisser: 0,
      count: 0,
      functionName,
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
`,
  );

  await Deno.writeTextFile(
    importMapPath,
    JSON.stringify({
      imports: {
        "https://deno.land/std@0.168.0/http/server.ts": fileUrlFromPath(serveStubPath),
        [sharedErrorSanitizerUrl]: fileUrlFromPath(errorSanitizerStubPath),
        "../_shared/error-sanitizer.ts": fileUrlFromPath(errorSanitizerStubPath),
      },
    }),
  );

  await Deno.writeTextFile(
    harnessPath,
    `
import { capturedHandler } from ${JSON.stringify(fileUrlFromPath(serveStubPath))};

const originalFetch = globalThis.fetch;
const originalApiKey = Deno.env.get("QONTO_API_KEY");
const originalOrgId = Deno.env.get("QONTO_ORGANIZATION_ID");

try {
  await import("./index.ts");

  if (!capturedHandler) {
    throw new Error("serve handler was not captured");
  }

  ${scenarioCode}
} finally {
  globalThis.fetch = originalFetch;

  if (originalApiKey === undefined) {
    Deno.env.delete("QONTO_API_KEY");
  } else {
    Deno.env.set("QONTO_API_KEY", originalApiKey);
  }

  if (originalOrgId === undefined) {
    Deno.env.delete("QONTO_ORGANIZATION_ID");
  } else {
    Deno.env.set("QONTO_ORGANIZATION_ID", originalOrgId);
  }
}
`,
  );

  try {
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-all",
        "--no-check",
        "--import-map",
        importMapPath,
        harnessPath,
      ],
      stdout: "piped",
      stderr: "piped",
      clearEnv: true,
    });

    const output = await command.output();
    const stdout = textDecoder.decode(output.stdout);
    const stderr = textDecoder.decode(output.stderr);

    if (output.code !== 0) {
      throw new Error(`Harness failed with code ${output.code}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
    }

    const resultLine = stdout.split(/\r?\n/).find((line) => line.startsWith("RESULT:"));
    if (!resultLine) {
      throw new Error(`Harness did not emit a RESULT line\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
    }

    return JSON.parse(resultLine.slice("RESULT:".length));
  } finally {
    await Deno.remove(harnessPath).catch(() => {});
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
}

Deno.test("module loads and registers a Supabase Edge Function handler", async () => {
  const result = await runEdgeFunctionScenario(`
const hasHandler = typeof capturedHandler === "function";
console.log("RESULT:" + JSON.stringify({ hasHandler }));
`);

  assertEquals(result.hasHandler, true);
});

Deno.test("OPTIONS preflight returns ok with CORS headers", async () => {
  const result = await runEdgeFunctionScenario(`
const response = await capturedHandler(new Request("http://localhost/qonto-get-client-invoices", {
  method: "OPTIONS",
}));

console.log("RESULT:" + JSON.stringify({
  status: response.status,
  body: await response.text(),
  allowOrigin: response.headers.get("Access-Control-Allow-Origin"),
  allowHeaders: response.headers.get("Access-Control-Allow-Headers"),
}));
`);

  assertEquals(result.status, 200);
  assertEquals(result.body, "ok");
  assertNotEquals(result.allowOrigin, "*");
  assertEquals(
    result.allowHeaders.includes("authorization") &&
      result.allowHeaders.includes("content-type") &&
      result.allowHeaders.includes("x-supabase-client-runtime-version"),
    true,
  );
});

Deno.test("GET returns configuration error without calling Qonto when env vars are missing", async () => {
  const result = await runEdgeFunctionScenario(`
Deno.env.delete("QONTO_API_KEY");
Deno.env.delete("QONTO_ORGANIZATION_ID");

let fetchCalled = false;
globalThis.fetch = () => {
  fetchCalled = true;
  throw new Error("fetch should not be called");
};

const response = await capturedHandler(new Request("http://localhost/qonto-get-client-invoices", {
  method: "GET",
}));

console.log("RESULT:" + JSON.stringify({
  status: response.status,
  contentType: response.headers.get("Content-Type"),
  json: await response.json(),
  fetchCalled,
}));
`);

  assertEquals(result.status, 200);
  assertEquals(result.contentType, "application/json");
  assertEquals(result.fetchCalled, false);
  assertEquals(result.json, {
    success: false,
    error: "Configuration Qonto manquante",
    invoices: [],
    total_a_encaisser: 0,
    count: 0,
  });
});

Deno.test("GET fetches unpaid Qonto invoices and transforms them for the frontend", async () => {
  const result = await runEdgeFunctionScenario(`
Deno.env.set("QONTO_API_KEY", "key_test");
Deno.env.set("QONTO_ORGANIZATION_ID", "org_test");

let fetchUrl = null;
let fetchMethod = null;
let authorization = null;
let accept = null;

globalThis.fetch = async (input, init = {}) => {
  fetchUrl = typeof input === "string" ? input : input.url;
  fetchMethod = init.method ?? null;

  const headers = new Headers(init.headers);
  authorization = headers.get("Authorization");
  accept = headers.get("Accept");

  return new Response(JSON.stringify({
    client_invoices: [
      {
        id: "inv_001",
        number: "F-2024-001",
        status: "unpaid",
        total_amount: { value: "123.45", currency: "EUR" },
        total_amount_cents: 12345,
        issue_date: "2024-01-10",
        due_date: "2024-02-10",
        client: { name: "Acme SARL", email: "billing@acme.test" },
        file_url: "https://files.example.test/inv_001.pdf"
      },
      {
        id: "inv_002",
        number: "F-2024-002",
        status: "unpaid",
        total_amount: { value: "76.55", currency: "EUR" },
        total_amount_cents: 7655,
        issue_date: "2024-01-11",
        due_date: null,
        client: null
      }
    ],
    meta: {
      current_page: 1,
      total_pages: 1,
      total_count: 2,
      per_page: 100
    }
  }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
};

const response = await capturedHandler(new Request("http://localhost/qonto-get-client-invoices", {
  method: "GET",
}));

console.log("RESULT:" + JSON.stringify({
  status: response.status,
  contentType: response.headers.get("Content-Type"),
  fetchUrl,
  fetchMethod,
  authorization,
  accept,
  json: await response.json(),
}));
`);

  assertEquals(result.status, 200);
  assertEquals(result.contentType, "application/json");
  assertEquals(
    result.fetchUrl,
    "https://thirdparty.qonto.com/v2/client_invoices?filter[status]=unpaid&per_page=100",
  );
  assertEquals(result.fetchMethod, "GET");
  assertEquals(result.authorization, "org_test:key_test");
  assertEquals(result.accept, "application/json");

  assertEquals(result.json.success, true);
  assertEquals(result.json.count, 2);
  assertEquals(result.json.total_a_encaisser, 200);
  assertExists(result.json.meta);
  assertEquals(result.json.meta.total_count, 2);

  assertEquals(result.json.invoices[0], {
    id: "inv_001",
    numero: "F-2024-001",
    status: "unpaid",
    montant_ttc: 123.45,
    currency: "EUR",
    date_emission: "2024-01-10",
    date_echeance: "2024-02-10",
    client_name: "Acme SARL",
    client_email: "billing@acme.test",
    file_url: "https://files.example.test/inv_001.pdf",
  });

  assertEquals(result.json.invoices[1], {
    id: "inv_002",
    numero: "F-2024-002",
    status: "unpaid",
    montant_ttc: 76.55,
    currency: "EUR",
    date_emission: "2024-01-11",
    date_echeance: null,
    client_name: "Client inconnu",
    client_email: null,
    file_url: null,
  });
});

Deno.test("GET returns a business error payload when Qonto responds with a non-OK status", async () => {
  const result = await runEdgeFunctionScenario(`
Deno.env.set("QONTO_API_KEY", "key_test");
Deno.env.set("QONTO_ORGANIZATION_ID", "org_test");

globalThis.fetch = async () => {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "content-type": "text/plain" }
  });
};

const response = await capturedHandler(new Request("http://localhost/qonto-get-client-invoices", {
  method: "GET",
}));

console.log("RESULT:" + JSON.stringify({
  status: response.status,
  json: await response.json(),
}));
`);

  assertEquals(result.status, 200);
  assertEquals(result.json, {
    success: false,
    error: "Erreur Qonto: 401",
    invoices: [],
    total_a_encaisser: 0,
    count: 0,
  });
});

Deno.test("GET uses sanitized error response when fetch throws unexpectedly", async () => {
  const result = await runEdgeFunctionScenario(`
Deno.env.set("QONTO_API_KEY", "key_test");
Deno.env.set("QONTO_ORGANIZATION_ID", "org_test");

globalThis.fetch = async () => {
  throw new Error("network boom");
};

const response = await capturedHandler(new Request("http://localhost/qonto-get-client-invoices", {
  method: "GET",
}));

console.log("RESULT:" + JSON.stringify({
  status: response.status,
  allowOrigin: response.headers.get("Access-Control-Allow-Origin"),
  json: await response.json(),
}));
`);

  assertEquals(result.status, 500);
  assertNotEquals(result.allowOrigin, "*");
  assertEquals(result.json.success, false);
  assertEquals(result.json.error, "network boom");
  assertEquals(result.json.functionName, "qonto-get-client-invoices");
  assertEquals(result.json.invoices, []);
  assertEquals(result.json.total_a_encaisser, 0);
  assertEquals(result.json.count, 0);
});

Deno.test("test harness surfaces scenario failures", async () => {
  await assertRejects(
    () => runEdgeFunctionScenario(`throw new Error("intentional harness failure");`),
    Error,
    "intentional harness failure",
  );

  assertThrows(
    () => JSON.parse("{not-json"),
    SyntaxError,
  );
});