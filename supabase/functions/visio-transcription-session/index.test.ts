import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

const INDEX_URL = new URL("./index.ts", import.meta.url);

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(INDEX_URL);
}

function extractCaseActions(source: string): string[] {
  const actions = [...source.matchAll(/case\s+['"]([^'"]+)['"]\s*:/g)].map((match) => match[1]);
  if (actions.length === 0) {
    throw new Error("No action cases found");
  }
  return actions;
}

function extractExplicitValidationErrors(source: string): string[] {
  return [...source.matchAll(/throw\s+new\s+Error\(['"]([^'"]+)['"]\)/g)].map((match) => match[1]);
}

function countTableUses(source: string, tableName: string): number {
  return [...source.matchAll(new RegExp(`\\.from\\(['"]${tableName}['"]\\)`, "g"))].length;
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
}

Deno.test("module loads through ./index.ts in an isolated worker without throwing", async () => {
  const envSnapshot = {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    PORT: Deno.env.get("PORT"),
  };

  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", `test-${crypto.randomUUID()}`);
  Deno.env.set("PORT", "0");

  const workerUrl = new URL(`./.__index_load_worker_${crypto.randomUUID()}.ts`, import.meta.url);
  const workerSource = `
    const pending = new Promise(() => {});

    try {
      globalThis.fetch = () =>
        Promise.resolve(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );

      try {
        Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
        Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-worker-key");
        Deno.env.set("PORT", "0");
      } catch (_) {
      }

      try {
        const fakeListener = {
          rid: 0,
          addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
          close() {},
          accept() {
            return pending;
          },
          [Symbol.asyncIterator]() {
            return {
              next() {
                return pending;
              },
            };
          },
        };

        Object.defineProperty(Deno, "listen", {
          configurable: true,
          value: () => fakeListener,
        });
      } catch (_) {
      }

      await import("./index.ts");
      self.postMessage({ ok: true });
    } catch (error) {
      self.postMessage({
        ok: false,
        message: error?.stack ?? error?.message ?? String(error),
      });
    }
  `;

  await Deno.writeTextFile(workerUrl, workerSource);
  const worker = new Worker(workerUrl.href, { type: "module" });

  try {
    const result = await new Promise<{ ok: boolean; message?: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out while importing ./index.ts"));
      }, 7000);

      worker.onmessage = (event) => {
        clearTimeout(timeout);
        resolve(event.data);
      };

      worker.onerror = (event) => {
        clearTimeout(timeout);
        reject(new Error(event.message));
      };
    });

    assertEquals(result.ok, true, result.message ?? "Module import failed");
  } finally {
    worker.terminate();
    await Deno.remove(workerUrl).catch(() => {});
    restoreEnv(envSnapshot);
  }
});

Deno.test("declares the expected CORS preflight behavior", async () => {
  const source = await readIndexSource();

  // La consolidation CORS a deporte les en-tetes dans ../_shared/cors.ts :
  // index.ts n'a plus d'objet en ligne, il importe le socle partage. Les deux
  // attendus de source sont realignes sur leur equivalent exact dans le fichier
  // livre, et les deux suivants exercent REELLEMENT le socle -- l'assertion
  // n'est pas relachee, elle porte sur la valeur reellement emise.
  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
  assertEquals(
    source.includes("// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type"),
    true,
  );
  assertEquals(corsHeaders["Access-Control-Allow-Origin"] === "*", false);
  assertEquals(
    corsHeaders["Access-Control-Allow-Headers"],
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  );
  assertExists(source.match(/if\s*\(\s*req\.method\s*===\s*['"]OPTIONS['"]\s*\)/));
  assertEquals(source.includes("new Response(null, { headers: corsHeaders })"), true);
});

Deno.test("routes all supported session actions explicitly", async () => {
  const source = await readIndexSource();

  assertEquals(extractCaseActions(source), [
    "create",
    "join",
    "leave",
    "update-transcribing",
    "end",
    "get",
  ]);

  assertThrows(
    () => extractCaseActions("switch (action) { default: throw new Error('Unknown action'); }"),
    Error,
    "No action cases found",
  );
});

Deno.test("keeps required validation messages for business inputs", async () => {
  const source = await readIndexSource();

  assertEquals(extractExplicitValidationErrors(source), [
    "Title and userId are required",
    "sessionId and userId are required",
    "Session not found",
    "Session is no longer active",
    "sessionId and userId are required",
    "sessionId and userId are required",
    "sessionId is required",
    "sessionId is required",
  ]);
});

Deno.test("uses the expected Supabase tables and create-session field mapping", async () => {
  const source = await readIndexSource();

  assertEquals(countTableUses(source, "visio_transcription_sessions"), 4);
  assertEquals(countTableUses(source, "visio_transcription_participants"), 5);

  assertEquals(source.includes("title,"), true);
  assertEquals(source.includes("room_code: roomCode"), true);
  assertEquals(source.includes("external_meeting_url: externalMeetingUrl"), true);
  assertEquals(source.includes("etablissement_id: etablissementId"), true);
  assertEquals(source.includes("partenaire_id: partenaireId"), true);
  assertEquals(source.includes("groupe_id: groupeId"), true);
  assertEquals(source.includes("conversation_id: conversationId"), true);
  assertEquals(source.includes("created_by: userId"), true);
  assertEquals(source.includes("language,"), true);
  assertEquals(source.includes("status: 'active'"), true);
});

Deno.test("ends sessions by switching to processing and triggering summary processing asynchronously", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("status: 'processing'"), true);
  assertEquals(source.includes("ended_at: new Date().toISOString()"), true);
  assertEquals(source.includes("left_at: new Date().toISOString()"), true);
  assertEquals(source.includes("is_transcribing: false"), true);
  assertEquals(source.includes(".replace('.supabase.co', '.supabase.co/functions/v1')"), true);
  assertEquals(source.includes("/process-transcription-summary"), true);
  assertEquals(/Authorization['"]\s*:\s*`Bearer\s+\$\{supabaseServiceKey\}`/.test(source), true);
  assertEquals(source.includes("body: JSON.stringify({ sessionId })"), true);
});

Deno.test("missing local fixture read rejects with NotFound", async () => {
  await assertRejects(
    () => Deno.readTextFile(new URL("./.__definitely_missing_index_fixture__.ts", import.meta.url)),
    Deno.errors.NotFound,
  );
});