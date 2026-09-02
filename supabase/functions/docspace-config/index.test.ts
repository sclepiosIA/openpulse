import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type WorkerImportResult = {
  ok: boolean;
  name?: string;
  message?: string;
};

const ENV_KEYS = [
  "ONLYOFFICE_DOCSPACE_URL",
  "ONLYOFFICE_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
] as const;

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(new URL("./index.ts", import.meta.url));
}

function snapshotEnv(): Map<string, string | undefined> {
  return new Map(ENV_KEYS.map((key) => [key, Deno.env.get(key)]));
}

function restoreEnv(snapshot: Map<string, string | undefined>): void {
  for (const [key, value] of snapshot) {
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
}

async function importIndexInIsolatedWorker(): Promise<WorkerImportResult> {
  const workerFileUrl = new URL(`./.__docspace_config_import_worker_${crypto.randomUUID()}.mjs`, import.meta.url);

  const workerSource = `
    try {
      Deno.env.set("ONLYOFFICE_DOCSPACE_URL", "https://docspace.example.test");
      Deno.env.set("ONLYOFFICE_API_KEY", "test-api-key");
      Deno.env.set("SUPABASE_URL", "https://supabase.example.test");
      Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");

      const fakeListener = {
        addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
        rid: 0,
        close() {},
        ref() {},
        unref() {},
        accept() {
          return Promise.reject(new Error("Unexpected listener.accept call during module import"));
        },
        [Symbol.asyncIterator]() {
          return {
            next() {
              return Promise.resolve({ done: true, value: undefined });
            }
          };
        }
      };

      const replaceDenoProperty = (key, value) => {
        try {
          Object.defineProperty(Deno, key, { value, configurable: true, writable: true });
          return true;
        } catch (_) {
          try {
            Deno[key] = value;
            return true;
          } catch (_) {
            return false;
          }
        }
      };

      if (!replaceDenoProperty("listen", () => fakeListener)) {
        throw new Error("Unable to stub Deno.listen safely");
      }

      replaceDenoProperty("serve", () => ({
        finished: Promise.resolve(),
        shutdown() {},
        ref() {},
        unref() {}
      }));

      globalThis.fetch = () => Promise.reject(new Error("Unexpected fetch during module import"));

      await import("./index.ts");
      postMessage({ ok: true });
    } catch (error) {
      postMessage({
        ok: false,
        name: error?.name ?? "Error",
        message: error?.message ?? String(error)
      });
    }
  `;

  await Deno.writeTextFile(workerFileUrl, workerSource);

  const worker = new Worker(workerFileUrl.href, { type: "module" });

  try {
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error("Timed out while importing ./index.ts in isolated worker"));
      }, 5000);

      worker.onmessage = (event: MessageEvent<WorkerImportResult>) => {
        clearTimeout(timeout);
        worker.terminate();
        resolve(event.data);
      };

      worker.onerror = (event: ErrorEvent) => {
        clearTimeout(timeout);
        event.preventDefault();
        worker.terminate();
        reject(new Error(event.message));
      };
    });
  } finally {
    worker.terminate();
    await Deno.remove(workerFileUrl).catch(() => {});
  }
}

Deno.test("module loads offline without opening a real listener", async () => {
  const env = snapshotEnv();

  try {
    const result = await importIndexInIsolatedWorker();
    assertEquals(result, { ok: true });
  } finally {
    restoreEnv(env);
  }
});

Deno.test("source declares required DocSpace and Supabase environment keys", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes('Deno.env.get("ONLYOFFICE_DOCSPACE_URL")'), true);
  assertEquals(source.includes('Deno.env.get("ONLYOFFICE_API_KEY")'), true);
  assertEquals(source.includes('Deno.env.get("SUPABASE_URL")'), true);
  assertEquals(source.includes('Deno.env.get("SUPABASE_ANON_KEY")'), true);
});

Deno.test("source handles CORS preflight before authentication", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
  assertEquals(source.includes("Access-Control-Allow-Origin"), false);
  assertEquals(source.includes('if (req.method === "OPTIONS")'), true);
  assertEquals(source.includes("return new Response(null, { headers: corsHeaders })"), true);
});

Deno.test("source enforces Bearer authorization and returns 401 JSON errors", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes('authHeader?.startsWith("Bearer ")'), true);
  assertEquals(source.includes('JSON.stringify({ error: "Unauthorized" })'), true);
  assertEquals(source.includes("status: 401"), true);
  assertEquals(source.includes('"Content-Type": "application/json"'), true);
});

Deno.test("source validates Supabase user token with the Bearer token", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes('const token = authHeader.replace("Bearer ", "")'), true);
  assertEquals(source.includes("await supabase.auth.getUser(token)"), true);
  assertEquals(source.includes("claimsError || !claimsData?.user"), true);
});

Deno.test("source queries profile names by authenticated user id", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes('.from("profiles")'), true);
  assertEquals(source.includes('.select("nom, prenom")'), true);
  assertEquals(source.includes('.eq("id", user.id)'), true);
  assertEquals(source.includes(".single()"), true);
});

Deno.test("source builds DocSpace SDK v2 URL from configured DocSpace URL", async () => {
  const source = await readIndexSource();
  const sdkUrlExpression = source.match(/sdkUrl:\s*`\$\{DOCSPACE_URL\}\/static\/scripts\/sdk\/2\.0\.0\/api\.js`/);

  assertExists(sdkUrlExpression);
});

Deno.test("source formats user display name with profile fallback to email or default label", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("`${profile.prenom || ''} ${profile.nom || ''}`.trim()"), true);
  assertEquals(source.includes('user.email || "Utilisateur"'), true);
  assertEquals(source.includes("const userName = profile"), true);
});

Deno.test("source reports whether the DocSpace API key is configured without exposing it", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("hasApiKey: !!API_KEY"), true);
  assertEquals(source.includes("apiKey:"), false);
});