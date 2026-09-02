import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

function readModuleSource(): string {
  return Deno.readTextFileSync(new URL("./index.ts", import.meta.url));
}

function findBalancedBlock(source: string, openIndex: number): string {
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") depth++;
    if (char === "}") depth--;

    if (depth === 0) {
      return source.slice(openIndex, i + 1);
    }
  }

  throw new Error("Unable to find balanced block");
}

function extractConstObject(source: string, name: string): Record<string, unknown> {
  const constIndex = source.indexOf(`const ${name}`);
  if (constIndex === -1) {
    throw new Error(`Unable to find const ${name}`);
  }

  const equalsIndex = source.indexOf("=", constIndex);
  const openIndex = source.indexOf("{", equalsIndex);
  if (equalsIndex === -1 || openIndex === -1) {
    throw new Error(`Unable to find object literal for ${name}`);
  }

  const objectLiteral = findBalancedBlock(source, openIndex);
  return new Function(`return (${objectLiteral});`)();
}

function extractFunctionSource(source: string, name: string): string {
  const functionIndex = source.indexOf(`function ${name}`);
  if (functionIndex === -1) {
    throw new Error(`Unable to find function ${name}`);
  }

  const openIndex = source.indexOf("{", functionIndex);
  if (openIndex === -1) {
    throw new Error(`Unable to find function body for ${name}`);
  }

  return source.slice(functionIndex, openIndex) + findBalancedBlock(source, openIndex);
}

function buildGetProvider(source: string): (endpoint: string) => string {
  const fnSource = extractFunctionSource(source, "getProvider")
    .replace(
      /function\s+getProvider\s*\(\s*endpoint\s*:\s*string\s*\)\s*:\s*string/,
      "function getProvider(endpoint)",
    );

  return new Function(`${fnSource}; return getProvider;`)();
}

function buildRewriteUrlForScope(
  source: string,
): (url: string, appScopes: string[]) => string {
  const mapping = extractConstObject(source, "DESKTOP_TO_MOBILE_URL");
  const fnSource = extractFunctionSource(source, "rewriteUrlForScope")
    .replace(
      /function\s+rewriteUrlForScope\s*\(\s*url\s*:\s*string\s*,\s*appScopes\s*:\s*string\[\]\s*\)\s*:\s*string/,
      "function rewriteUrlForScope(url, appScopes)",
    );

  return new Function(
    "DESKTOP_TO_MOBILE_URL",
    `${fnSource}; return rewriteUrlForScope;`,
  )(mapping);
}

async function withTemporaryEnv<T>(
  values: Record<string, string>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(values)) {
    previous.set(key, Deno.env.get(key));
    Deno.env.set(key, value);
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

async function withStubbedServerApis<T>(fn: () => Promise<T>): Promise<T> {
  const restorers: Array<() => void> = [];

  function replaceProperty(target: object, name: string, value: unknown): void {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, {
      value,
      configurable: true,
      writable: true,
    });

    restorers.push(() => {
      if (descriptor) {
        Object.defineProperty(target, name, descriptor);
      } else {
        delete (target as Record<string, unknown>)[name];
      }
    });
  }

  const neverAccept = () => new Promise<never>(() => {});

  const fakeListener = {
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 8000 },
    close() {},
    ref() {},
    unref() {},
    accept: neverAccept,
    [Symbol.asyncIterator]() {
      return {
        next: neverAccept,
      };
    },
  };

  const fakeNativeServer = {
    finished: new Promise<void>(() => {}),
    shutdown() {},
    ref() {},
    unref() {},
  };

  const originalFetch = globalThis.fetch;
  replaceProperty(globalThis, "fetch", () =>
    Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ));

  replaceProperty(console, "log", () => {});
  replaceProperty(console, "error", () => {});

  replaceProperty(Deno, "listen", () => fakeListener);
  replaceProperty(Deno, "listenTls", () => fakeListener);

  if ("serve" in Deno) {
    replaceProperty(Deno, "serve", () => fakeNativeServer);
  }

  try {
    return await fn();
  } finally {
    if (globalThis.fetch !== originalFetch) {
      for (const restore of restorers.reverse()) {
        restore();
      }
    } else {
      for (const restore of restorers.reverse()) {
        restore();
      }
    }
  }
}

Deno.test("getProvider classifies Apple, Mozilla and FCM endpoints", () => {
  const source = readModuleSource();
  const getProvider = buildGetProvider(source);

  assertEquals(
    getProvider("https://web.push.apple.com/3/device/example-token"),
    "apple",
  );
  assertEquals(
    getProvider("https://api.push.apple.com/3/device/example-token"),
    "apple",
  );
  assertEquals(
    getProvider("https://updates.push.services.mozilla.com/wpush/v2/example"),
    "mozilla",
  );
  assertEquals(
    getProvider("https://fcm.googleapis.com/fcm/send/example-token"),
    "fcm",
  );
  assertEquals(
    getProvider("https://example.invalid/custom-push-endpoint"),
    "fcm",
  );
});

Deno.test("notification types target the expected PWA scopes without dedicated-app main fallback", () => {
  const source = readModuleSource();
  const scopes = extractConstObject(source, "TYPE_TO_SCOPES");

  assertEquals(scopes.email, ["mail"]);
  assertEquals(scopes.task, ["todos"]);
  assertEquals(scopes.pulse, ["pulse"]);
  assertEquals(scopes.pulse_visio, ["pulse"]);
  assertEquals(scopes.calendar, ["calendar"]);
  assertEquals(scopes.ai_suggestion, ["main"]);
  assertEquals(scopes.treasury, ["main"]);
  assertEquals(scopes.test, ["main", "mail", "todos", "pulse", "calendar"]);
});

Deno.test("desktop URLs are rewritten to mobile URLs for dedicated PWA scopes", () => {
  const source = readModuleSource();
  const rewriteUrlForScope = buildRewriteUrlForScope(source);

  assertEquals(
    rewriteUrlForScope("/emails/inbox/123", ["mail"]),
    "/m/mail/inbox/123",
  );
  assertEquals(
    rewriteUrlForScope("/pulse/channel/abc", ["pulse"]),
    "/m/pulse/channel/abc",
  );
  assertEquals(
    rewriteUrlForScope("/todos?filter=today", ["todos"]),
    "/m/todos?filter=today",
  );
  assertEquals(
    rewriteUrlForScope("/calendrier/2026-06-14", ["calendar"]),
    "/m/calendrier/2026-06-14",
  );
});

Deno.test("main PWA scope keeps desktop URLs unchanged", () => {
  const source = readModuleSource();
  const rewriteUrlForScope = buildRewriteUrlForScope(source);

  assertEquals(
    rewriteUrlForScope("/emails/inbox/123", ["main"]),
    "/emails/inbox/123",
  );
  assertEquals(
    rewriteUrlForScope("/pulse/channel/abc", ["main", "pulse"]),
    "/pulse/channel/abc",
  );
  assertEquals(
    rewriteUrlForScope("/unknown/path", ["mail"]),
    "/unknown/path",
  );
});

Deno.test("notification icon mapping uses dedicated app icons for known types", () => {
  const source = readModuleSource();
  const icons = extractConstObject(source, "TYPE_TO_ICON");

  assertEquals(icons.email, "/icons/app-mail-192.png");
  assertEquals(icons.pulse, "/icons/app-pulse-192.png");
  assertEquals(icons.pulse_visio, "/icons/app-pulse-192.png");
  assertEquals(icons.task, "/icons/app-todos-192.png");
  assertEquals(icons.calendar, "/icons/app-calendar-192.png");
  assertEquals(icons.treasury, undefined);
});

Deno.test("CORS headers come from the shared module without a wildcard origin", async () => {
  const source = readModuleSource();
  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
  assertEquals(source.includes("Access-Control-Allow-Origin"), false);

  const { corsHeaders } = await import(new URL("../_shared/cors.ts", import.meta.url).href);

  assertNotEquals(corsHeaders["Access-Control-Allow-Origin"], "*");
  assertEquals(
    corsHeaders["Access-Control-Allow-Headers"],
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  );
});

Deno.test("source exposes the expected pure internal symbols", () => {
  const source = readModuleSource();

  assertExists(extractFunctionSource(source, "getProvider"));
  assertExists(extractFunctionSource(source, "rewriteUrlForScope"));
  assertExists(extractConstObject(source, "TYPE_TO_SCOPES"));
  assertExists(extractConstObject(source, "TYPE_TO_ICON"));
  assertThrows(
    () => extractConstObject(source, "UNKNOWN_PUSH_MAPPING"),
    Error,
    "UNKNOWN_PUSH_MAPPING",
  );
});

Deno.test("missing module import rejects", async () => {
  await assertRejects(
    () => import("./__missing_send_push_notification_module__.ts"),
    TypeError,
  );
});

Deno.test("module loads without opening a real network listener", async () => {
  await withTemporaryEnv(
    {
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      VAPID_PUBLIC_KEY: "test-vapid-public-key",
      VAPID_PRIVATE_KEY: "test-vapid-private-key",
      VAPID_SUBJECT: "contact@example.test",
    },
    async () => {
      await withStubbedServerApis(async () => {
        const module = await import("./index.ts");
        assertExists(module);
      });
    },
  );
});