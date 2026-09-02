import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const INDEX_URL = new URL("./index.ts", import.meta.url);

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(INDEX_URL);
}

function parseTriggerEntityTypeMap(source: string): Record<string, string> {
  const start = source.indexOf("function getTriggerEntityType");
  if (start === -1) {
    throw new Error("getTriggerEntityType function was not found");
  }

  const end = source.indexOf("\n}", start);
  if (end === -1) {
    throw new Error("getTriggerEntityType function body is incomplete");
  }

  const body = source.slice(start, end);
  const map: Record<string, string> = {};

  for (const match of body.matchAll(/case\s+['"]([^'"]+)['"]:\s*return\s+['"]([^'"]+)['"]/g)) {
    map[match[1]] = match[2];
  }

  const defaultMatch = body.match(/default:\s*return\s+['"]([^'"]+)['"]/);
  if (defaultMatch) {
    map.default = defaultMatch[1];
  }

  return map;
}

function snapshotEnv(keys: string[]): Record<string, string | undefined> {
  const snapshot: Record<string, string | undefined> = {};
  for (const key of keys) {
    snapshot[key] = Deno.env.get(key);
  }
  return snapshot;
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
}

Deno.test("source declares the expected Edge Function security pipeline", async () => {
  const source = await readIndexSource();

  assertExists(source.match(/serve\s*\(\s*async\s*\(\s*req\s*\)\s*=>/));
  assertEquals(source.includes("if (req.method === 'OPTIONS')"), true);
  assertEquals(source.includes("validateServiceOrUser(req)"), true);
  assertEquals(source.includes("if (!auth.authorized)"), true);
  assertEquals(source.includes("status: 401"), true);
  assertEquals(source.includes("buildErrorResponse('jarvis-agent'"), true);
  assertEquals(source.includes("createClient(supabaseUrl, supabaseKey)"), true);
});

Deno.test("source maps Jarvis trigger types to persisted entity types", async () => {
  const source = await readIndexSource();
  const map = parseTriggerEntityTypeMap(source);

  assertEquals(map.new_email, "email_thread");
  assertEquals(map.task_due, "tache");
  assertEquals(map.calendar_reminder, "calendar_event");
  assertEquals(map.support_ticket, "support_ticket");
  assertEquals(map.default, "manual");
});

Deno.test("source keeps the expected CORS and Supabase client headers", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("'Access-Control-Allow-Origin': origineAutorisee()"), true);
  assertEquals(source.includes("authorization, x-client-info, apikey, content-type, x-internal-secret"), true);
  assertEquals(source.includes("x-supabase-client-platform"), true);
  assertEquals(source.includes("x-supabase-client-runtime-version"), true);
});

Deno.test("source contains manual quick-action CRM enrichment rules", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("quickAction === 'summarize_emails'"), true);
  assertEquals(source.includes("context.unread_threads"), true);
  assertEquals(source.includes("context.unread_count"), true);

  assertEquals(source.includes("quickAction === 'prioritize_tasks'"), true);
  assertEquals(source.includes("context.pending_tasks"), true);
  assertEquals(source.includes("context.tasks_count"), true);

  assertEquals(source.includes("quickAction === 'check_support'"), true);
});

Deno.test("source parser fails loudly when trigger mapping is missing", () => {
  assertThrows(
    () => parseTriggerEntityTypeMap("function unrelated() { return 'manual'; }"),
    Error,
    "getTriggerEntityType",
  );
});

Deno.test("relative index module path exists", async () => {
  const source = await readIndexSource();

  assertExists(source);
  assertEquals(source.startsWith("/**"), true);
  await assertRejects(
    () => Deno.readTextFile(new URL("./index.missing.ts", import.meta.url)),
    Deno.errors.NotFound,
  );
});

Deno.test("module loads in an isolated worker with local listener stubs", async () => {
  const envKeys = [
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const envSnapshot = snapshotEnv(envKeys);
  const workerUrl = new URL("./.jarvis_index_import_worker.test.ts", import.meta.url);

  const workerCode = `
let listenCalls = 0;
let serveCalls = 0;

const never = new Promise(() => {});
const fakeListener = {
  addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
  rid: -1,
  accept() {
    listenCalls++;
    return never;
  },
  close() {},
  [Symbol.asyncIterator]() {
    return {
      next() {
        listenCalls++;
        return never;
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  },
};

function safeReplace(name, value) {
  try {
    Object.defineProperty(Deno, name, {
      value,
      configurable: true,
      writable: true,
    });
  } catch (_) {
    try {
      Deno[name] = value;
    } catch (_) {
      // ignored; import will report a real failure if the listener cannot be stubbed
    }
  }
}

safeReplace("listen", () => {
  listenCalls++;
  return fakeListener;
});

safeReplace("listenTls", () => {
  listenCalls++;
  return fakeListener;
});

safeReplace("serve", () => {
  serveCalls++;
  return {
    finished: never,
    shutdown: () => Promise.resolve(),
    ref() {},
    unref() {},
  };
});

try {
  await import("./index.ts");
  self.postMessage({ ok: true, listenCalls, serveCalls });
} catch (error) {
  self.postMessage({
    ok: false,
    name: error?.name ?? "Error",
    message: error?.message ?? String(error),
    stack: error?.stack ?? null,
    listenCalls,
    serveCalls,
  });
}
`;

  try {
    Deno.env.set("AZURE_OPENAI_ENDPOINT", "https://azure-openai.example.invalid");
    Deno.env.set("AZURE_OPENAI_API_KEY", "test-api-key");
    Deno.env.set("SUPABASE_URL", "https://supabase.example.invalid");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

    await Deno.writeTextFile(workerUrl, workerCode);

    const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const worker = new Worker(workerUrl.href, {
        type: "module",
      });

      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error("Timed out while importing ./index.ts in isolated worker"));
      }, 20_000);

      worker.onmessage = (event) => {
        clearTimeout(timeout);
        worker.terminate();
        resolve(event.data as Record<string, unknown>);
      };

      worker.onerror = (event) => {
        clearTimeout(timeout);
        worker.terminate();
        event.preventDefault();
        reject(new Error(event.message));
      };
    });

    assertExists(result);
    assertEquals(result.ok, true, JSON.stringify(result));
  } finally {
    restoreEnv(envSnapshot);
    await Deno.remove(workerUrl).catch(() => {});
  }
});