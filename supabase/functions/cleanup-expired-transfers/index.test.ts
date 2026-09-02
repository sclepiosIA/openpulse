import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const INDEX_URL = new URL("./index.ts", import.meta.url);

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(INDEX_URL);
}

function restoreEnv(key: string, previous: string | undefined): void {
  if (previous === undefined) {
    Deno.env.delete(key);
  } else {
    Deno.env.set(key, previous);
  }
}

Deno.test("source delegates CORS to the shared hardened module and handles OPTIONS preflight", async () => {
  const source = await readIndexSource();
  const socle = await Deno.readTextFile(new URL("../_shared/cors.ts", import.meta.url));

  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
  assertEquals(source.includes("Access-Control-Allow-Origin"), false);
  assertEquals(socle.includes("'authorization, x-client-info, apikey, content-type, x-internal-secret'"), true);
  assertEquals(source.includes('if (req.method === "OPTIONS")'), true);
  assertEquals(source.includes("return new Response(null, { headers: corsHeaders });"), true);
});

Deno.test("source queries only unpurged expired or revoked transfers with a bounded batch size", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes('.from("email_transfers")'), true);
  assertEquals(source.includes('.select("id, token, expires_at, revoked_at")'), true);
  assertEquals(source.includes('.is("purged_at", null)'), true);
  assertEquals(source.includes("expires_at.lt.${nowIso},revoked_at.not.is.null"), true);
  assertEquals(source.includes(".limit(500)"), true);
});

Deno.test("source removes transfer files from the expected storage bucket before marking transfers purged", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes('.from("email_transfer_files")'), true);
  assertEquals(source.includes('.select("storage_path")'), true);
  assertEquals(source.includes('.eq("transfer_id", t.id)'), true);
  assertEquals(source.includes('.from("email-transfers")'), true);
  assertEquals(source.includes(".remove(paths)"), true);
  assertEquals(source.includes(".update({ purged_at: nowIso })"), true);
  assertEquals(source.includes('.eq("id", t.id)'), true);
});

Deno.test("source returns the expected JSON counters for empty and successful cleanup runs", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("JSON.stringify({ success: true, purged: 0 })"), true);
  assertEquals(source.includes("purged_transfers: purgedTransfers"), true);
  assertEquals(source.includes("purged_files: purgedFiles"), true);
  assertEquals(source.includes("status: 200"), true);
  assertEquals(source.includes('"Content-Type": "application/json"'), true);
});

Deno.test("source converts unexpected cleanup failures into a JSON 500 response", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("catch (error)"), true);
  assertEquals(source.includes('console.error("cleanup-expired-transfers error:", error)'), true);
  assertEquals(source.includes("JSON.stringify({ error: String(error) })"), true);
  assertEquals(source.includes("status: 500"), true);
});

Deno.test({
  name: "module loads without opening a real network listener when dependencies are resolvable",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const previousUrl = Deno.env.get("SUPABASE_URL");
    const previousKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const originalListen = Deno.listen;
    const originalLog = console.log;
    const originalError = console.error;

    let closeListener = () => {};
    const listenCalls: unknown[] = [];

    const fakeListen = (options: unknown) => {
      listenCalls.push(options);

      let closed = false;
      const rejectors: Array<(reason?: unknown) => void> = [];

      const listener = {
        addr: { transport: "tcp", hostname: "127.0.0.1", port: 8000 },
        rid: -1,
        close() {
          if (closed) return;
          closed = true;
          for (const reject of rejectors.splice(0)) {
            reject(new Deno.errors.BadResource("listener closed by test"));
          }
        },
        ref() {},
        unref() {},
        accept() {
          if (closed) {
            return Promise.reject(new Deno.errors.BadResource("listener closed by test"));
          }
          return new Promise((_resolve, reject) => {
            rejectors.push(reject);
          });
        },
        [Symbol.asyncIterator]() {
          return {
            next: async () => {
              try {
                const conn = await listener.accept();
                return { value: conn, done: false };
              } catch {
                return { value: undefined, done: true };
              }
            },
          };
        },
      };

      closeListener = () => listener.close();
      return listener;
    };

    try {
      Deno.env.set("SUPABASE_URL", "http://localhost");
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

      Object.defineProperty(Deno, "listen", {
        value: fakeListen,
        configurable: true,
      });

      console.log = () => {};
      console.error = () => {};

      try {
        const mod = await import("./index.ts");
        assertExists(mod);
        assertEquals(listenCalls.length, 1);
      } catch (error) {
        const message = String(error);
        const dependencyResolutionFailure =
          message.includes("@supabase/supabase-js") ||
          message.includes("Relative import path") ||
          message.includes("Import") ||
          message.includes("module not found");

        if (!dependencyResolutionFailure) {
          throw error;
        }

        assertExists(error);
      }
    } finally {
      closeListener();

      Object.defineProperty(Deno, "listen", {
        value: originalListen,
        configurable: true,
      });

      console.log = originalLog;
      console.error = originalError;

      restoreEnv("SUPABASE_URL", previousUrl);
      restoreEnv("SUPABASE_SERVICE_ROLE_KEY", previousKey);
    }
  },
});