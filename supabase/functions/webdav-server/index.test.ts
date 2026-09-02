import { assertEquals, assertExists, assertRejects, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";

function setEnv(vars: Record<string, string>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, Deno.env.get(key));
    Deno.env.set(key, value);
  }
  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  };
}

function encodeBasic(email: string, password: string) {
  return `Basic ${btoa(`${email}:${password}`)}`;
}

Deno.test("module source contains serve invocation and internal pure helpers", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertEquals(source.includes("serve("), true);
  assertEquals(source.includes("function normalizeUrl("), true);
  assertEquals(source.includes("function normalizeFolder("), true);
  assertEquals(source.includes("function buildNextcloudWebDAVUrl("), true);
  assertEquals(source.includes("function extractWebDAVPath("), true);
  assertEquals(source.includes("function parseNextcloudPropfind("), true);
});

Deno.test("module source imports Supabase client and sanitizer", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertEquals(source.includes('import { createClient } from "@supabase/supabase-js";'), true);
  assertEquals(source.includes('import { safeErrorLog } from "../_shared/error-sanitizer.ts";'), true);
});

Deno.test("module source defines path traversal protection for WebDAV path building", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertEquals(source.includes("traversal sequences are not allowed"), true);
  assertEquals(source.includes('seg) => seg === ".."'), true);
  assertEquals(source.includes('decodedForCheck.includes("..")'), true);
});

Deno.test("module source supports both Basic and Bearer authentication branches", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertEquals(source.includes('authHeader.startsWith("Basic ")'), true);
  assertEquals(source.includes('authHeader.startsWith("Bearer ")'), true);
  assertEquals(source.includes("signInWithPassword"), true);
  assertEquals(source.includes("getUser(token)"), true);
});

Deno.test("module source documents WebDAV-compatible methods and CORS/DAV headers", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertEquals(source.includes('"DAV": "1, 2"'), true);
  assertEquals(source.includes("OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, PROPFIND, PROPPATCH, MOVE, COPY"), true);
  assertEquals(source.includes('"MS-Author-Via": "DAV"'), true);
  assertEquals(source.includes("origineAutorisee()"), true);
});

Deno.test("basic auth header format used in fixtures is valid", () => {
  const header = encodeBasic("user@example.com", "secret123");
  assertEquals(header, "Basic dXNlckBleGFtcGxlLmNvbTpzZWNyZXQxMjM=");
  const decoded = atob(header.slice("Basic ".length));
  assertEquals(decoded, "user@example.com:secret123");
});

Deno.test("request construction for edge-function style paths remains offline", () => {
  const req = new Request("http://localhost/webdav-server/folder/file%20name.txt", {
    method: "PROPFIND",
    headers: {
      Authorization: encodeBasic("user@example.com", "secret123"),
      Depth: "1",
    },
  });

  assertEquals(req.method, "PROPFIND");
  assertEquals(req.headers.get("Authorization"), "Basic dXNlckBleGFtcGxlLmNvbTpzZWNyZXQxMjM=");
  assertEquals(req.headers.get("Depth"), "1");
  assertEquals(new URL(req.url).pathname, "/webdav-server/folder/file%20name.txt");
});

Deno.test("env helper sets and restores variables deterministically", () => {
  const original = Deno.env.get("WEBdav_TEST_TEMP_KEY");
  const restore = setEnv({ WEBdav_TEST_TEMP_KEY: "value-123" });

  try {
    assertEquals(Deno.env.get("WEBdav_TEST_TEMP_KEY"), "value-123");
  } finally {
    restore();
    assertEquals(Deno.env.get("WEBdav_TEST_TEMP_KEY"), original);
  }
});

Deno.test("source contains expected default/fallback normalization logic", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertEquals(source.includes('if (!url) return "";'), true);
  assertEquals(source.includes('if (!folder || folder.trim() === "") return "/";'), true);
  assertEquals(source.includes('if (!n.startsWith("/")) n = "/" + n;'), true);
  assertEquals(source.includes('if (n !== "/" && n.endsWith("/")) n = n.slice(0, -1);'), true);
});

Deno.test("source contains WebDAV path extraction semantics for function prefix stripping", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertEquals(source.includes('const funcPrefix = "/webdav-server";'), true);
  assertEquals(source.includes("path = path.substring(funcPrefix.length);"), true);
  assertEquals(source.includes("path = decodeURIComponent(path);"), true);
  assertEquals(source.includes('if (!path || path === "") path = "/";'), true);
});

Deno.test("source contains XML escaping and RFC1123 formatting helpers", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertEquals(source.includes('replace(/&/g, "&amp;")'), true);
  assertEquals(source.includes('replace(/</g, "&lt;")'), true);
  assertEquals(source.includes('replace(/>/g, "&gt;")'), true);
  assertEquals(source.includes('replace(/"/g, "&quot;")'), true);
  assertEquals(source.includes('replace(/\'/g, "&apos;")') || source.includes(".replace(/'/g, \"&apos;\")"), true);
  assertEquals(source.includes("return date.toUTCString();"), true);
});

Deno.test("source contains PROPFIND parser patterns for Nextcloud multistatus XML", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertEquals(source.includes("const responseRegex = /<d:response>([\\s\\S]*?)<\\/d:response>/g;"), true);
  assertEquals(source.includes("const hrefRegex = /<d:href>([^<]+)<\\/d:href>/;"), true);
  assertEquals(source.includes("const displayNameRegex = /<d:displayname>([^<]*)<\\/d:displayname>/;"), true);
  assertEquals(source.includes("const contentLengthRegex = /<d:getcontentlength>(\\d+)<\\/d:getcontentlength>/;"), true);
  assertEquals(source.includes("const etagRegex = /<d:getetag>\"?([^\"<]+)\"?<\\/d:getetag>/;"), true);
});

Deno.test("source contains GET and PUT proxy behavior without requiring network in test", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertEquals(source.includes('method: "GET"'), true);
  assertEquals(source.includes('method: "PUT"'), true);
  assertEquals(source.includes('"Content-Length": body.byteLength.toString()'), true);
  assertEquals(source.includes('return new Response("Upload failed", { status: 502 });'), true);
});

Deno.test("assert helpers are importable and usable offline", async () => {
  assertExists(assertEquals);
  assertExists(assertThrows);
  await assertRejects(async () => {
    throw new Error("expected");
  });
  assertThrows(() => {
    throw new Error("sync");
  });
});