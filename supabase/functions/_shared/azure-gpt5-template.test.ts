import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const TEST_AZURE_ENDPOINT = "https://azure.example.test/openai/deployments/gpt-5/chat/completions?api-version=2025-01-01";
const TEST_AZURE_API_KEY = "test-azure-api-key";
const TEST_SUPABASE_URL = "https://project.supabase.test";
const TEST_SUPABASE_SERVICE_ROLE_KEY = "test-supabase-service-role-key";
const RESULT_MARKER = "__RESULT__";

function parseScenarioResult(stdout: string): unknown {
  const markerLine = stdout
    .trimEnd()
    .split(/\r?\n/)
    .reverse()
    .find((line) => line.startsWith(RESULT_MARKER));

  if (!markerLine) {
    throw new Error("Missing scenario result marker");
  }

  return JSON.parse(markerLine.slice(RESULT_MARKER.length));
}

async function runIsolatedScenario(scenarioCode: string): Promise<any> {
  const tempDir = await Deno.makeTempDir({ prefix: "azure-gpt5-template-test-" });

  try {
    await Deno.mkdir(`${tempDir}/stubs`, { recursive: true });

    const moduleSource = await Deno.readTextFile(new URL("./azure-gpt5-template.ts", import.meta.url));
    await Deno.writeTextFile(`${tempDir}/azure-gpt5-template.ts`, moduleSource);

    await Deno.writeTextFile(
      `${tempDir}/stubs/server.ts`,
      `
export function serve(handler) {
  globalThis.__servedHandler = handler;
  globalThis.__serveCallCount = (globalThis.__serveCallCount ?? 0) + 1;
  return {
    finished: Promise.resolve(),
    shutdown() {
      globalThis.__servedHandler = undefined;
    },
  };
}
`,
    );

    await Deno.writeTextFile(
      `${tempDir}/stubs/supabase-js.ts`,
      `
export function createClient(url, key, options) {
  globalThis.__supabaseCreateClientCalls = globalThis.__supabaseCreateClientCalls ?? [];
  globalThis.__supabaseCreateClientCalls.push({ url, key, options });

  return {
    auth: {
      getUser: async () => {
        if (globalThis.__supabaseAuthThrows) {
          throw new Error(globalThis.__supabaseAuthThrows);
        }

        return globalThis.__supabaseAuthResult ?? {
          data: { user: { id: "test-user-id", email: "user@example.test" } },
          error: null,
        };
      },
    },
    from() {
      return this;
    },
    select() {
      return this;
    },
    eq() {
      return this;
    },
    then(resolve) {
      return Promise.resolve({ data: [], error: null }).then(resolve);
    },
  };
}
`,
    );

    await Deno.writeTextFile(
      `${tempDir}/error-sanitizer.ts`,
      `
export function sanitizeErrorForClient(error) {
  if (error instanceof Error) {
    return "SANITIZED:" + error.message;
  }

  return "SANITIZED:Unknown error";
}
`,
    );

    await Deno.writeTextFile(
      `${tempDir}/cors.ts`,
      await Deno.readTextFile(new URL("./cors.ts", import.meta.url)),
    );

    await Deno.writeTextFile(
      `${tempDir}/import_map.json`,
      JSON.stringify(
        {
          imports: {
            "https://deno.land/std@0.168.0/http/server.ts": "./stubs/server.ts",
            "@supabase/supabase-js": "./stubs/supabase-js.ts",
            "../_shared/cors.ts": "./cors.ts",
          },
        },
        null,
        2,
      ),
    );

    await Deno.writeTextFile(
      `${tempDir}/runner.ts`,
      `
const originalFetch = globalThis.fetch;

function emit(value) {
  console.log(${JSON.stringify(RESULT_MARKER)} + JSON.stringify(value));
}

async function loadHandler() {
  await import("./azure-gpt5-template.ts");

  if (typeof globalThis.__servedHandler !== "function") {
    throw new Error("serve handler was not registered");
  }

  return globalThis.__servedHandler;
}

try {
  Deno.env.set("AZURE_OPENAI_ENDPOINT", ${JSON.stringify(TEST_AZURE_ENDPOINT)});
  Deno.env.set("AZURE_OPENAI_API_KEY", ${JSON.stringify(TEST_AZURE_API_KEY)});
  Deno.env.set("SUPABASE_URL", ${JSON.stringify(TEST_SUPABASE_URL)});
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", ${JSON.stringify(TEST_SUPABASE_SERVICE_ROLE_KEY)});

  ${scenarioCode}
} catch (error) {
  console.error(error?.stack ?? String(error));
  Deno.exit(1);
} finally {
  globalThis.fetch = originalFetch;
}
`,
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--no-check",
        "--quiet",
        "--allow-env",
        `--allow-read=${tempDir}`,
        `--import-map=${tempDir}/import_map.json`,
        `${tempDir}/runner.ts`,
      ],
      cwd: tempDir,
      stdout: "piped",
      stderr: "piped",
    });

    const output = await command.output();
    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    if (!output.success) {
      throw new Error(`isolated scenario exited with code ${output.code}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
    }

    return parseScenarioResult(stdout);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}

Deno.test("module loads with mocked Edge runtime and registers exactly one handler", async () => {
  const result = await runIsolatedScenario(`
const handler = await loadHandler();

emit({
  handlerType: typeof handler,
  serveCallCount: globalThis.__serveCallCount,
});
`);

  assertEquals(result.handlerType, "function");
  assertEquals(result.serveCallCount, 1);
});

Deno.test("OPTIONS preflight returns CORS headers without authentication", async () => {
  const result = await runIsolatedScenario(`
let fetchCallCount = 0;
globalThis.fetch = () => {
  fetchCallCount++;
  throw new Error("fetch should not be called for OPTIONS");
};

const handler = await loadHandler();
const response = await handler(new Request("http://localhost", { method: "OPTIONS" }));

emit({
  status: response.status,
  body: await response.text(),
  allowOrigin: response.headers.get("access-control-allow-origin"),
  allowHeaders: response.headers.get("access-control-allow-headers"),
  fetchCallCount,
  supabaseCreateClientCalls: globalThis.__supabaseCreateClientCalls?.length ?? 0,
});
`);

  assertEquals(result.status, 200);
  assertEquals(result.body, "");
  assertNotEquals(result.allowOrigin, "*");
  assertEquals(result.allowHeaders, "authorization, x-client-info, apikey, content-type, x-internal-secret");
  assertEquals(result.fetchCallCount, 0);
  assertEquals(result.supabaseCreateClientCalls, 0);
});

Deno.test("POST without Authorization returns 401 and does not call Supabase or Azure", async () => {
  const result = await runIsolatedScenario(`
let fetchCallCount = 0;
globalThis.fetch = () => {
  fetchCallCount++;
  throw new Error("fetch should not be called without Authorization");
};

const handler = await loadHandler();
const response = await handler(new Request("http://localhost", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ input_text: "Texte métier" }),
}));

emit({
  status: response.status,
  body: await response.json(),
  contentType: response.headers.get("content-type"),
  allowOrigin: response.headers.get("access-control-allow-origin"),
  fetchCallCount,
  supabaseCreateClientCalls: globalThis.__supabaseCreateClientCalls?.length ?? 0,
});
`);

  assertEquals(result.status, 401);
  assertEquals(result.body, { error: "Authentication required" });
  assertEquals(result.contentType, "application/json");
  assertNotEquals(result.allowOrigin, "*");
  assertEquals(result.fetchCallCount, 0);
  assertEquals(result.supabaseCreateClientCalls, 0);
});

Deno.test("invalid Supabase authentication returns 401 before reading input or calling Azure", async () => {
  const result = await runIsolatedScenario(`
globalThis.__supabaseAuthResult = {
  data: { user: null },
  error: { message: "invalid jwt" },
};

let fetchCallCount = 0;
globalThis.fetch = () => {
  fetchCallCount++;
  throw new Error("fetch should not be called with invalid auth");
};

const handler = await loadHandler();
const response = await handler(new Request("http://localhost", {
  method: "POST",
  headers: {
    "authorization": "Bearer invalid-token",
    "content-type": "application/json",
  },
  body: JSON.stringify({ input_text: "Texte métier" }),
}));

emit({
  status: response.status,
  body: await response.json(),
  fetchCallCount,
  supabaseCreateClientCalls: globalThis.__supabaseCreateClientCalls,
});
`);

  assertEquals(result.status, 401);
  assertEquals(result.body, { error: "Invalid authentication" });
  assertEquals(result.fetchCallCount, 0);
  assertEquals(result.supabaseCreateClientCalls.length, 1);
  assertEquals(result.supabaseCreateClientCalls[0].url, TEST_SUPABASE_URL);
  assertEquals(result.supabaseCreateClientCalls[0].key, TEST_SUPABASE_SERVICE_ROLE_KEY);
  assertEquals(result.supabaseCreateClientCalls[0].options.global.headers.Authorization, "Bearer invalid-token");
});

Deno.test("authenticated POST without input_text returns 400 and never calls Azure", async () => {
  const result = await runIsolatedScenario(`
let fetchCallCount = 0;
globalThis.fetch = () => {
  fetchCallCount++;
  throw new Error("fetch should not be called when input_text is missing");
};

const handler = await loadHandler();
const response = await handler(new Request("http://localhost", {
  method: "POST",
  headers: {
    "authorization": "Bearer valid-token",
    "content-type": "application/json",
  },
  body: JSON.stringify({ other_field: "ignored" }),
}));

emit({
  status: response.status,
  body: await response.json(),
  fetchCallCount,
  supabaseCreateClientCalls: globalThis.__supabaseCreateClientCalls.length,
});
`);

  assertEquals(result.status, 400);
  assertEquals(result.body, { error: "Input text required" });
  assertEquals(result.fetchCallCount, 0);
  assertEquals(result.supabaseCreateClientCalls, 1);
});

Deno.test("successful request builds Azure GPT-5 payload and returns trimmed content with usage", async () => {
  const result = await runIsolatedScenario(`
const fetchCalls = [];

globalThis.fetch = async (url, init) => {
  fetchCalls.push({
    url: String(url),
    method: init.method,
    headers: init.headers,
    body: JSON.parse(init.body),
    hasAbortSignal: Boolean(init.signal),
  });

  return new Response(JSON.stringify({
    choices: [
      { message: { content: "  Réponse traitée\\n" } },
    ],
    usage: {
      prompt_tokens: 12,
      completion_tokens: 5,
      total_tokens: 17,
    },
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const handler = await loadHandler();
const response = await handler(new Request("http://localhost", {
  method: "POST",
  headers: {
    "authorization": "Bearer valid-token",
    "content-type": "application/json",
  },
  body: JSON.stringify({ input_text: "Texte d'entrée métier" }),
}));

emit({
  status: response.status,
  response: await response.json(),
  contentType: response.headers.get("content-type"),
  allowOrigin: response.headers.get("access-control-allow-origin"),
  fetchCallCount: fetchCalls.length,
  fetch: fetchCalls[0],
  supabaseCreateClientCall: globalThis.__supabaseCreateClientCalls[0],
});
`);

  assertEquals(result.status, 200);
  assertEquals(result.contentType, "application/json");
  assertNotEquals(result.allowOrigin, "*");
  assertEquals(result.response, {
    success: true,
    result: "Réponse traitée",
    usage: {
      prompt_tokens: 12,
      completion_tokens: 5,
      total_tokens: 17,
    },
  });

  assertEquals(result.fetchCallCount, 1);
  assertEquals(result.fetch.url, TEST_AZURE_ENDPOINT);
  assertEquals(result.fetch.method, "POST");
  assertEquals(result.fetch.headers["Content-Type"], "application/json");
  assertEquals(result.fetch.headers["api-key"], TEST_AZURE_API_KEY);
  assertEquals(result.fetch.hasAbortSignal, true);
  assertEquals(result.fetch.body.max_completion_tokens, 3000);
  assertEquals(result.fetch.body.reasoning_effort, "low");
  assertEquals(result.fetch.body.verbosity, "low");
  assertEquals(result.fetch.body.messages.length, 2);
  assertEquals(result.fetch.body.messages[0].role, "system");
  assertEquals(result.fetch.body.messages[0].content.startsWith("Tu es un assistant IA expert."), true);
  assertEquals(result.fetch.body.messages[1], {
    role: "user",
    content: "[PRÉPARER LE CONTEXTE POUR L'IA]\n\nTexte à traiter:\nTexte d'entrée métier",
  });
  assertEquals(result.supabaseCreateClientCall.options.global.headers.Authorization, "Bearer valid-token");
});

Deno.test("Azure 429 response is retried once and second successful response is returned", async () => {
  const result = await runIsolatedScenario(`
const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (callback, ms, ...args) => {
  return originalSetTimeout(callback, ms === 1000 ? 0 : ms, ...args);
};

const fetchCalls = [];

globalThis.fetch = async (url, init) => {
  fetchCalls.push({
    url: String(url),
    method: init.method,
    body: JSON.parse(init.body),
    hasAbortSignal: Boolean(init.signal),
  });

  if (fetchCalls.length === 1) {
    return new Response(JSON.stringify({ error: "rate limited" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    choices: [
      { message: { content: "Réponse après retry" } },
    ],
    usage: {
      prompt_tokens: 20,
      completion_tokens: 6,
      total_tokens: 26,
    },
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const handler = await loadHandler();
const response = await handler(new Request("http://localhost", {
  method: "POST",
  headers: {
    "authorization": "Bearer valid-token",
    "content-type": "application/json",
  },
  body: JSON.stringify({ input_text: "Déclencher retry" }),
}));

emit({
  status: response.status,
  response: await response.json(),
  fetchCallCount: fetchCalls.length,
  firstCall: fetchCalls[0],
  secondCall: fetchCalls[1],
});
`);

  assertEquals(result.status, 200);
  assertEquals(result.response, {
    success: true,
    result: "Réponse après retry",
    usage: {
      prompt_tokens: 20,
      completion_tokens: 6,
      total_tokens: 26,
    },
  });
  assertEquals(result.fetchCallCount, 2);
  assertEquals(result.firstCall.url, TEST_AZURE_ENDPOINT);
  assertEquals(result.secondCall.url, TEST_AZURE_ENDPOINT);
  assertEquals(result.firstCall.hasAbortSignal, true);
  assertEquals(result.secondCall.hasAbortSignal, false);
  assertEquals(result.secondCall.body.reasoning_effort, "low");
  assertEquals(result.secondCall.body.verbosity, "low");
  assertEquals(result.secondCall.body.max_completion_tokens, 3000);
});

Deno.test("Azure response without string content is sanitized into a 500 response", async () => {
  const result = await runIsolatedScenario(`
globalThis.fetch = async () => {
  return new Response(JSON.stringify({
    choices: [
      { message: { content: null } },
    ],
    usage: {
      prompt_tokens: 3,
      completion_tokens: 0,
      total_tokens: 3,
    },
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const handler = await loadHandler();
const response = await handler(new Request("http://localhost", {
  method: "POST",
  headers: {
    "authorization": "Bearer valid-token",
    "content-type": "application/json",
  },
  body: JSON.stringify({ input_text: "Texte valide" }),
}));

emit({
  status: response.status,
  body: await response.json(),
  contentType: response.headers.get("content-type"),
  allowOrigin: response.headers.get("access-control-allow-origin"),
});
`);

  assertEquals(result.status, 500);
  assertEquals(result.body, { error: "SANITIZED:No content in Azure response" });
  assertEquals(result.contentType, "application/json");
  assertNotEquals(result.allowOrigin, "*");
});

Deno.test("non-OK Azure response is sanitized into a 500 response", async () => {
  const result = await runIsolatedScenario(`
globalThis.fetch = async () => {
  return new Response("upstream unavailable", {
    status: 503,
    headers: { "content-type": "text/plain" },
  });
};

const handler = await loadHandler();
const response = await handler(new Request("http://localhost", {
  method: "POST",
  headers: {
    "authorization": "Bearer valid-token",
    "content-type": "application/json",
  },
  body: JSON.stringify({ input_text: "Texte valide" }),
}));

emit({
  status: response.status,
  body: await response.json(),
});
`);

  assertEquals(result.status, 500);
  assertEquals(result.body, { error: "SANITIZED:Azure OpenAI API error: 503" });
});

Deno.test("Supabase auth exception is sanitized and Azure is not called", async () => {
  const result = await runIsolatedScenario(`
globalThis.__supabaseAuthThrows = "auth service unavailable";

let fetchCallCount = 0;
globalThis.fetch = () => {
  fetchCallCount++;
  throw new Error("fetch should not be called when auth throws");
};

const handler = await loadHandler();
const response = await handler(new Request("http://localhost", {
  method: "POST",
  headers: {
    "authorization": "Bearer valid-token",
    "content-type": "application/json",
  },
  body: JSON.stringify({ input_text: "Texte valide" }),
}));

emit({
  status: response.status,
  body: await response.json(),
  fetchCallCount,
});
`);

  assertEquals(result.status, 500);
  assertEquals(result.body, { error: "SANITIZED:auth service unavailable" });
  assertEquals(result.fetchCallCount, 0);
});

Deno.test("test harness parser rejects output without result marker", () => {
  assertThrows(
    () => parseScenarioResult("ordinary log line\nanother log line"),
    Error,
    "Missing scenario result marker",
  );
});

Deno.test("test harness surfaces isolated process failures", async () => {
  await assertRejects(
    () => runIsolatedScenario(`throw new Error("intentional isolated failure");`),
    Error,
    "intentional isolated failure",
  );
});

Deno.test("module source exists next to this test file and contains GPT-5 request constants", async () => {
  const source = await Deno.readTextFile(new URL("./azure-gpt5-template.ts", import.meta.url));

  assertExists(source);
  assertEquals(source.includes("serve(async (req) =>"), true);
  assertEquals(source.includes("max_completion_tokens: 3000"), true);
  assertEquals(source.includes('reasoning_effort: "low"'), true);
  assertEquals(source.includes('verbosity: "low"'), true);
});