import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const RESULT_PREFIX = "RESULT:";

function toFileUrl(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  return new URL(`file://${normalized.startsWith("/") ? "" : "/"}${normalized}`).href;
}

function moduleDirPath(): string {
  return decodeURIComponent(new URL(".", import.meta.url).pathname);
}

function extractResult(stdout: string): any {
  const line = stdout
    .trimEnd()
    .split(/\r?\n/)
    .reverse()
    .find((entry) => entry.startsWith(RESULT_PREFIX));

  if (!line) {
    throw new Error(`Missing ${RESULT_PREFIX} line in child stdout:\n${stdout}`);
  }

  return JSON.parse(line.slice(RESULT_PREFIX.length));
}

async function runIsolatedScenario(scenarioSource: string): Promise<any> {
  const tempDir = await Deno.makeTempDir();
  const runnerUrl = new URL(`./.__index_isolated_${crypto.randomUUID()}.ts`, import.meta.url);
  const tempServePath = `${tempDir}/serve_stub.ts`;
  const tempAuthPath = `${tempDir}/auth_helpers_stub.ts`;
  const tempSanitizerPath = `${tempDir}/error_sanitizer_stub.ts`;
  const tempSupabasePath = `${tempDir}/supabase_stub.ts`;
  const tempImportMapPath = `${tempDir}/import_map.json`;

  try {
    await Deno.writeTextFile(
      tempServePath,
      `
export function serve(handler) {
  globalThis.__servedHandlers = globalThis.__servedHandlers ?? [];
  globalThis.__servedHandlers.push(handler);
  return Promise.resolve();
}
`,
    );

    await Deno.writeTextFile(
      tempAuthPath,
      `
export async function validateServiceOrUser(req) {
  const mode = req.headers.get("x-test-auth") ?? "user";
  if (mode === "unauthorized") {
    return { authorized: false };
  }
  if (mode === "service") {
    return { authorized: true, isServiceCall: true };
  }
  return { authorized: true, isServiceCall: false, userId: "user-from-auth" };
}
`,
    );

    await Deno.writeTextFile(
      tempSanitizerPath,
      `
export function sanitizeErrorForClient(error) {
  return error?.message ?? String(error);
}
`,
    );

    await Deno.writeTextFile(
      tempSupabasePath,
      `
export function createClient(url, key) {
  globalThis.__supabaseArgs = { url, key };
  return {
    from(table) {
      globalThis.__supabaseTable = table;
      return {
        insert(rows) {
          globalThis.__supabaseInserted = rows;
          return Promise.resolve({ error: null, data: null });
        },
      };
    },
  };
}
`,
    );

    const importMap = {
      imports: {
        "https://deno.land/std@0.168.0/http/server.ts": toFileUrl(tempServePath),
        "@supabase/supabase-js": toFileUrl(tempSupabasePath),
        [new URL("../_shared/error-sanitizer.ts", import.meta.url).href]: toFileUrl(tempSanitizerPath),
        [new URL("../_shared/auth-helpers.ts", import.meta.url).href]: toFileUrl(tempAuthPath),
      },
    };

    await Deno.writeTextFile(tempImportMapPath, JSON.stringify(importMap));

    await Deno.writeTextFile(
      runnerUrl,
      `
globalThis.__servedHandlers = [];

await import("./index.ts");

const handler = globalThis.__servedHandlers?.[0];
if (!handler) {
  throw new Error("serve handler was not registered");
}

function makeAudio(size, header = [0x1A, 0x45, 0xDF, 0xA3]) {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < header.length && i < bytes.length; i++) {
    bytes[i] = header[i];
  }
  for (let i = header.length; i < bytes.length; i++) {
    bytes[i] = i % 251;
  }

  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

${scenarioSource}
`,
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--quiet",
        "--no-check",
        `--import-map=${tempImportMapPath}`,
        "--allow-read",
        "--allow-env",
        decodeURIComponent(runnerUrl.pathname),
      ],
      cwd: moduleDirPath(),
      stdout: "piped",
      stderr: "piped",
    });

    const output = await command.output();
    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    if (output.code !== 0) {
      throw new Error(`Child process failed with code ${output.code}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
    }

    return extractResult(stdout);
  } finally {
    await Deno.remove(runnerUrl).catch(() => {});
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
}

Deno.test("test utility extracts isolated child results", () => {
  assertEquals(extractResult("log\nRESULT:{\"ok\":true}\n"), { ok: true });
  assertThrows(() => extractResult("log without sentinel"), Error, "Missing RESULT:");
});

Deno.test("isolated runner rejects child process failures", async () => {
  await assertRejects(
    () => runIsolatedScenario(`throw new Error("intentional isolated failure");`),
    Error,
    "intentional isolated failure",
  );
});

Deno.test("OPTIONS preflight returns CORS headers without requiring auth", async () => {
  const result = await runIsolatedScenario(`
const response = await handler(new Request("http://localhost", { method: "OPTIONS" }));
console.log("${RESULT_PREFIX}" + JSON.stringify({
  status: response.status,
  body: await response.text(),
  allowOrigin: response.headers.get("Access-Control-Allow-Origin"),
  allowHeaders: response.headers.get("Access-Control-Allow-Headers"),
}));
`);

  assertEquals(result.status, 200);
  assertEquals(result.body, "");
  assertNotEquals(result.allowOrigin, "*");
  assertEquals(result.allowHeaders, "authorization, x-client-info, apikey, content-type, x-internal-secret");
});

Deno.test("unauthorized requests return 401 JSON error", async () => {
  const result = await runIsolatedScenario(`
const response = await handler(new Request("http://localhost", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-test-auth": "unauthorized",
  },
  body: JSON.stringify({}),
}));

console.log("${RESULT_PREFIX}" + JSON.stringify({
  status: response.status,
  body: await response.json(),
  contentType: response.headers.get("Content-Type"),
  allowOrigin: response.headers.get("Access-Control-Allow-Origin"),
}));
`);

  assertEquals(result.status, 401);
  assertEquals(result.body, { error: "Unauthorized" });
  assertEquals(result.contentType, "application/json");
  assertNotEquals(result.allowOrigin, "*");
});

Deno.test("missing audio is sanitized and returned as a 500 error", async () => {
  const result = await runIsolatedScenario(`
const response = await handler(new Request("http://localhost", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ sessionId: "session-1", speakerName: "Alice" }),
}));

console.log("${RESULT_PREFIX}" + JSON.stringify({
  status: response.status,
  body: await response.json(),
}));
`);

  assertEquals(result.status, 500);
  assertEquals(result.body.success, false);
  assertEquals(result.body.error, "Audio data is required");
});

Deno.test("missing Azure endpoint returns non-blocking configuration error", async () => {
  const result = await runIsolatedScenario(`
Deno.env.delete("AZURE_TRANSCRIBE_ENDPOINT");
Deno.env.delete("AZURE_TRANSCRIBE_API_KEY");
Deno.env.delete("AZURE_OPENAI_API_KEY");

const response = await handler(new Request("http://localhost", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    audio: makeAudio(1200),
    sessionId: "session-1",
    speakerName: "Alice",
  }),
}));

console.log("${RESULT_PREFIX}" + JSON.stringify({
  status: response.status,
  body: await response.json(),
}));
`);

  assertEquals(result.status, 200);
  assertEquals(result.body.success, false);
  assertEquals(result.body.configured, false);
  assertEquals(result.body.error, "Azure transcription not configured. Please add AZURE_TRANSCRIBE_ENDPOINT secret.");
});

Deno.test("missing Azure API key returns non-blocking configuration error", async () => {
  const result = await runIsolatedScenario(`
Deno.env.set("AZURE_TRANSCRIBE_ENDPOINT", "https://azure.local/transcriptions");
Deno.env.delete("AZURE_TRANSCRIBE_API_KEY");
Deno.env.delete("AZURE_OPENAI_API_KEY");

const response = await handler(new Request("http://localhost", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    audio: makeAudio(1200),
    sessionId: "session-1",
    speakerName: "Alice",
  }),
}));

console.log("${RESULT_PREFIX}" + JSON.stringify({
  status: response.status,
  body: await response.json(),
}));
`);

  assertEquals(result.status, 200);
  assertEquals(result.body.success, false);
  assertEquals(result.body.configured, false);
  assertEquals(result.body.error, "Azure API key not configured.");
});

Deno.test("audio chunks smaller than 1000 bytes are skipped and never sent to Azure", async () => {
  const result = await runIsolatedScenario(`
Deno.env.set("AZURE_TRANSCRIBE_ENDPOINT", "https://azure.local/transcriptions");
Deno.env.set("AZURE_TRANSCRIBE_API_KEY", "azure-test-key");

let fetchCount = 0;
globalThis.fetch = async () => {
  fetchCount++;
  return new Response(JSON.stringify({ text: "should not happen" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const response = await handler(new Request("http://localhost", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    audio: makeAudio(999),
    sessionId: "session-small",
    speakerName: "Alice",
  }),
}));

console.log("${RESULT_PREFIX}" + JSON.stringify({
  status: response.status,
  body: await response.json(),
  fetchCount,
}));
`);

  assertEquals(result.status, 200);
  assertEquals(result.body.success, false);
  assertEquals(result.body.error, "Audio chunk too small");
  assertEquals(result.body.skipped, true);
  assertEquals(result.fetchCount, 0);
});

Deno.test("successful diarized transcription maps utterances and saves segments to Supabase", async () => {
  const result = await runIsolatedScenario(`
Deno.env.set("AZURE_TRANSCRIBE_ENDPOINT", "https://azure.local/transcriptions");
Deno.env.set("AZURE_TRANSCRIBE_API_KEY", "azure-test-key");
Deno.env.set("SUPABASE_URL", "https://supabase.local");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");

const fetchCalls = [];
globalThis.fetch = async (url, init) => {
  const form = init.body;
  const file = form.get("file");
  fetchCalls.push({
    url: String(url),
    method: init.method,
    authorization: init.headers.Authorization,
    model: form.get("model"),
    responseFormat: form.get("response_format"),
    language: form.get("language"),
    chunkingStrategy: form.get("chunking_strategy"),
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  });

  return new Response(JSON.stringify({
    text: "Bonjour le monde",
    duration: 2.5,
    language: "fr",
    utterances: [
      { speaker: "speaker_1", text: "Bonjour", start: 0.1, end: 0.7 },
      { text: "le monde", start: 0.8, end: 1.4, confidence: 0.88 },
    ],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const response = await handler(new Request("http://localhost", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-test-auth": "service",
  },
  body: JSON.stringify({
    audio: makeAudio(1200),
    sessionId: "session-123",
    speakerName: "Alice",
    language: "fr",
    userId: "service-user-42",
  }),
}));

console.log("${RESULT_PREFIX}" + JSON.stringify({
  status: response.status,
  body: await response.json(),
  fetchCalls,
  supabaseArgs: globalThis.__supabaseArgs,
  supabaseTable: globalThis.__supabaseTable,
  inserted: globalThis.__supabaseInserted,
}));
`);

  assertEquals(result.status, 200);
  assertEquals(result.body.success, true);
  assertEquals(result.body.text, "Bonjour le monde");
  assertEquals(result.body.duration, 2.5);
  assertEquals(result.body.language, "fr");

  assertEquals(result.fetchCalls.length, 1);
  assertEquals(result.fetchCalls[0].url, "https://azure.local/transcriptions");
  assertEquals(result.fetchCalls[0].method, "POST");
  assertEquals(result.fetchCalls[0].authorization, "Bearer azure-test-key");
  assertEquals(result.fetchCalls[0].model, "gpt-4o-transcribe-diarize");
  assertEquals(result.fetchCalls[0].responseFormat, "json");
  assertEquals(result.fetchCalls[0].language, "fr");
  assertEquals(result.fetchCalls[0].chunkingStrategy, "auto");
  assertEquals(result.fetchCalls[0].fileName, "audio.webm");
  assertEquals(result.fetchCalls[0].fileType, "audio/webm");
  assertEquals(result.fetchCalls[0].fileSize, 1200);

  assertEquals(result.body.segments, [
    {
      speaker: "speaker_1",
      text: "Bonjour",
      start: 0.1,
      end: 0.7,
      confidence: 1,
    },
    {
      speaker: "Alice",
      text: "le monde",
      start: 0.8,
      end: 1.4,
      confidence: 0.88,
    },
  ]);

  assertEquals(result.supabaseArgs, {
    url: "https://supabase.local",
    key: "service-role-test-key",
  });
  assertEquals(result.supabaseTable, "visio_transcription_segments");
  assertEquals(result.inserted, [
    {
      session_id: "session-123",
      user_id: "service-user-42",
      speaker_name: "Alice",
      speaker_id: "speaker_1",
      text: "Bonjour",
      start_time_ms: 100,
      end_time_ms: 700,
      is_partial: false,
      confidence: 1,
    },
    {
      session_id: "session-123",
      user_id: "service-user-42",
      speaker_name: "Alice",
      speaker_id: "Alice",
      text: "le monde",
      start_time_ms: 800,
      end_time_ms: 1400,
      is_partial: false,
      confidence: 0.88,
    },
  ]);
});

Deno.test("Azure non-OK response is returned as a non-blocking application error", async () => {
  const result = await runIsolatedScenario(`
Deno.env.set("AZURE_TRANSCRIBE_ENDPOINT", "https://azure.local/transcriptions");
Deno.env.set("AZURE_TRANSCRIBE_API_KEY", "azure-test-key");

globalThis.fetch = async () => {
  return new Response("invalid audio format", {
    status: 400,
    headers: { "content-type": "text/plain" },
  });
};

const response = await handler(new Request("http://localhost", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    audio: makeAudio(1200),
    speakerName: "Alice",
    language: "fr",
  }),
}));

console.log("${RESULT_PREFIX}" + JSON.stringify({
  status: response.status,
  body: await response.json(),
}));
`);

  assertEquals(result.status, 200);
  assertEquals(result.body.success, false);
  assertEquals(result.body.error, "Azure transcription failed: 400");
  assertEquals(result.body.azureStatus, 400);
  assertEquals(result.body.details, "invalid audio format");
});

Deno.test("text-only Azure response is converted to a single segment without database insert when no sessionId", async () => {
  const result = await runIsolatedScenario(`
Deno.env.set("AZURE_TRANSCRIBE_ENDPOINT", "https://azure.local/transcriptions");
Deno.env.set("AZURE_OPENAI_API_KEY", "fallback-openai-key");

globalThis.fetch = async (url, init) => {
  return new Response(JSON.stringify({
    text: "Transcription simple",
    duration: 6.2,
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const response = await handler(new Request("http://localhost", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    audio: makeAudio(1200),
    speakerName: "Bob",
    language: "fr",
  }),
}));

console.log("${RESULT_PREFIX}" + JSON.stringify({
  status: response.status,
  body: await response.json(),
  inserted: globalThis.__supabaseInserted ?? null,
}));
`);

  assertEquals(result.status, 200);
  assertEquals(result.body.success, true);
  assertEquals(result.body.text, "Transcription simple");
  assertEquals(result.body.language, "fr");
  assertEquals(result.body.segments, [
    {
      speaker: "Bob",
      text: "Transcription simple",
      start: 0,
      end: 6.2,
      confidence: 1,
    },
  ]);
  assertEquals(result.inserted, null);
  assertExists(result.body.duration);
});