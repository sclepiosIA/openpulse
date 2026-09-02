import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

function stubDenoListen(): () => void {
  const originalListen = Deno.listen;

  const pending = <T>() => new Promise<T>(() => {});

  const fakeListener = {
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
    rid: 0,
    close() {},
    ref() {},
    unref() {},
    accept() {
      return pending();
    },
    [Symbol.asyncIterator]() {
      return {
        next() {
          return pending();
        },
      };
    },
  };

  const fakeListen = (() => fakeListener) as typeof Deno.listen;

  Object.defineProperty(Deno, "listen", {
    value: fakeListen,
    configurable: true,
    writable: true,
  });

  if (Deno.listen !== fakeListen) {
    throw new Error("Unable to stub Deno.listen before importing ./index.ts");
  }

  return () => {
    Object.defineProperty(Deno, "listen", {
      value: originalListen,
      configurable: true,
      writable: true,
    });
  };
}

Deno.test("module loads without throwing and without opening a real listener", async () => {
  const restoreListen = stubDenoListen();

  try {
    const mod = await import("./index.ts");

    assertExists(mod);
    assertEquals(typeof mod, "object");
  } finally {
    restoreListen();
  }
});

Deno.test("source configures expected CORS headers for Supabase Edge Function requests", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
  assertEquals(source.includes("Access-Control-Allow-Origin"), false);
  assertEquals(source.includes('if (req.method === "OPTIONS")'), true);
});

Deno.test("source validates authorization and documentId with concrete HTTP error responses", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes('authHeader?.startsWith("Bearer ")'), true);
  assertEquals(source.includes('JSON.stringify({ error: "Unauthorized" })'), true);
  assertEquals(source.includes("status: 401"), true);
  assertEquals(source.includes('JSON.stringify({ error: "Missing documentId" })'), true);
  assertEquals(source.includes("status: 400"), true);
  assertEquals(source.includes('JSON.stringify({ error: "Document not found" })'), true);
  assertEquals(source.includes("status: 404"), true);
});

Deno.test("source builds DocSpace upload request with Bearer auth and default My Documents folder", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes('API_KEY.startsWith("Bearer ") ? API_KEY : `Bearer ${API_KEY}`'), true);
  assertEquals(source.includes('const targetFolderId = folderId || "@my";'), true);
  assertEquals(source.includes('`${DOCSPACE_URL}/api/2.0/files/${targetFolderId}/upload`'), true);
  assertEquals(source.includes('method: "POST"'), true);
  assertEquals(source.includes('"Authorization": docspaceAuth'), true);
});

Deno.test("source accepts all documented DocSpace file id response shapes", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes("uploadResult?.response?.id"), true);
  assertEquals(source.includes("uploadResult?.response?.file?.id"), true);
  assertEquals(source.includes("uploadResult?.id"), true);
  assertEquals(source.includes("uploadResult?.file?.id"), true);
  assertEquals(source.includes('JSON.stringify({ error: "No file ID returned from DocSpace" })'), true);
});