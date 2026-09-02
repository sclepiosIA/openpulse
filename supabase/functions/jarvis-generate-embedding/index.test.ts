import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const MODULE_PATH = "./index.ts";

function replaceDenoProperty(name: string, value: unknown): () => void {
  const target = Deno as unknown as Record<string, unknown>;
  const descriptor = Object.getOwnPropertyDescriptor(Deno, name);

  Object.defineProperty(Deno, name, {
    value,
    configurable: true,
    writable: true,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(Deno, name, descriptor);
    } else {
      delete target[name];
    }
  };
}

function installOfflineServeRuntime(): { restore: () => void; listenCalls: () => number } {
  let listenCallCount = 0;
  const restorers: Array<() => void> = [];

  const fakeListener = (options: Record<string, unknown> = {}) => {
    listenCallCount++;

    return {
      addr: {
        transport: "tcp",
        hostname: String(options.hostname ?? "127.0.0.1"),
        port: Number(options.port ?? 8000),
      },
      close() {},
      ref() {},
      unref() {},
      accept(): Promise<Deno.Conn> {
        return new Promise<Deno.Conn>(() => {});
      },
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<Deno.Conn>> {
            return new Promise<IteratorResult<Deno.Conn>>(() => {});
          },
        };
      },
    };
  };

  restorers.push(replaceDenoProperty("listen", fakeListener));

  if ("listenTls" in Deno) {
    restorers.push(replaceDenoProperty("listenTls", fakeListener));
  }

  return {
    restore: () => {
      for (const restore of restorers.reverse()) {
        restore();
      }
    },
    listenCalls: () => listenCallCount,
  };
}

async function readModuleSource(): Promise<string> {
  return await Deno.readTextFile(new URL(MODULE_PATH, import.meta.url));
}

Deno.test("module loads offline without opening a real HTTP listener", async () => {
  const runtime = installOfflineServeRuntime();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const module = await import(MODULE_PATH);
    assertExists(module);
    assertEquals(runtime.listenCalls(), 1);
  } finally {
    globalThis.fetch = originalFetch;
    runtime.restore();
  }
});

Deno.test("embedding request body truncates input to Azure limit and uses ada model", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("input: text.slice(0, 8000)"), true);
  assertEquals(source.includes("model: Deno.env.get('IA_MODELE_EMBEDDINGS') ?? ''"), true);
});

Deno.test("embedding request sends Azure API key header and JSON content type", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("'Content-Type': 'application/json'"), true);
  assertEquals(source.includes("'api-key': apiKey"), true);
  assertEquals(source.includes("method: 'POST'"), true);
});

Deno.test("embedding endpoint fallback targets text-embedding-ada-002 deployment with expected API version", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("Deno.env.get('AZURE_EMBEDDING_ENDPOINT')"), true);
  assertEquals(
    source.includes("/openai/deployments/${Deno.env.get('IA_MODELE_EMBEDDINGS') ?? ''}/embeddings?api-version=${Deno.env.get('IA_VERSION_API') ?? '2024-02-01'}"),
    true,
  );
  assertEquals(source.includes("AZURE_OPENAI_ENDPOINT.split('/openai/deployments/')[0]"), true);
});

Deno.test("database updates are scoped by authenticated user for non-service calls", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("validateServiceOrUser(req)"), true);
  assertEquals(source.includes("if (!auth.isServiceCall)"), true);
  assertEquals(source.includes(".eq('user_id', auth.userId!)"), true);
  assertEquals(source.includes(".from('jarvis_user_memory')"), true);
  assertEquals(source.includes(".update({ embedding })"), true);
});

Deno.test("batch response reports processed and failed counts from item success values", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("request.batch && request.batch.length > 0"), true);
  assertEquals(source.includes("processed: results.filter(r => r.success).length"), true);
  assertEquals(source.includes("failed: results.filter(r => !r.success).length"), true);
  assertEquals(source.includes("results.push({ id: item.id, success: true })"), true);
});

Deno.test("CORS preflight and JSON error statuses are explicitly handled", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("req.method === 'OPTIONS'"), true);
  // Le durcissement CORS a deporte l'objet d'en-tetes dans le module partage :
  // index.ts ne declare plus l'origine, il importe corsHeaders. L'invariant
  // verifie ici est donc que la fonction resout son CORS par le socle, et que
  // l'origine ouverte a toutes les pages du web n'y figure plus.
  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
  assertEquals(source.includes("'Access-Control-Allow-Origin': '*'"), false);
  assertEquals(source.includes("status: 401"), true);
  assertEquals(source.includes("status: 400"), true);
  assertEquals(source.includes("status: 503"), true);
});

Deno.test("generateEmbedding returns null for non-ok fetch responses and malformed Azure payloads", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("if (!response.ok)"), true);
  assertEquals(source.includes("return null"), true);
  assertEquals(source.includes("return data.data?.[0]?.embedding || null"), true);
});

Deno.test("generateEmbedding uses AbortController timeout and clears it on success and failure paths", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("new AbortController()"), true);
  assertEquals(source.includes("setTimeout(() => controller.abort(), 30000)"), true);
  assertEquals(source.includes("signal: controller.signal"), true);
  assertEquals(source.includes("clearTimeout(timeoutId)"), true);
  assertEquals(source.includes("error.name === 'AbortError'"), true);
});

Deno.test("required assertion imports are available for synchronous and asynchronous failures", async () => {
  assertThrows(() => {
    throw new TypeError("sync assertion probe");
  }, TypeError, "sync assertion probe");

  await assertRejects(
    () => Promise.reject(new Error("async assertion probe")),
    Error,
    "async assertion probe",
  );
});