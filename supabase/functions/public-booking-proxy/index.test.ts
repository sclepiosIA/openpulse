import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const ENV_KEYS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

function snapshotEnv() {
  return new Map(ENV_KEYS.map((key) => [key, Deno.env.get(key)]));
}

function restoreEnv(snapshot: Map<string, string | undefined>) {
  for (const [key, value] of snapshot.entries()) {
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
}

function installOfflineRuntimeStubs() {
  const originalFetch = globalThis.fetch;
  const originalServeDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve");

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  Object.defineProperty(Deno, "serve", {
    configurable: true,
    writable: true,
    value: () => ({
      addr: { hostname: "127.0.0.1", port: 0, transport: "tcp" },
      finished: Promise.resolve(),
      shutdown: () => {},
      ref: () => {},
      unref: () => {},
    }),
  });

  return () => {
    globalThis.fetch = originalFetch;
    if (originalServeDescriptor) {
      Object.defineProperty(Deno, "serve", originalServeDescriptor);
    }
  };
}

function extractFunctionSource(source: string, functionName: string): string {
  const marker = `function ${functionName}`;
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`Missing function ${functionName}`);
  }

  const openBrace = source.indexOf("{", start);
  if (openBrace < 0) {
    throw new Error(`Missing body for function ${functionName}`);
  }

  let depth = 0;
  for (let i = openBrace; i < source.length; i++) {
    const char = source[i];
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth === 0) {
      return source.slice(start, i + 1);
    }
  }

  throw new Error(`Unclosed body for function ${functionName}`);
}

async function loadPureHelpers() {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const helperNames = [
    "sanitizePage",
    "sanitizeSlot",
    "sanitizeHost",
    "isUuid",
    "isIsoDate",
    "isEmail",
    "clean",
    "parisWallClockToUtc",
    "parisDayOfWeek",
  ];

  const extractedSource = [
    ...helperNames.map((name) => extractFunctionSource(source, name)),
    `export { ${helperNames.join(", ")} };`,
  ].join("\n\n");

  const tempFile = await Deno.makeTempFile({ suffix: ".ts" });
  await Deno.writeTextFile(tempFile, extractedSource);

  try {
    const moduleUrl = new URL(tempFile, "file://");
    moduleUrl.searchParams.set("v", crypto.randomUUID());
    return await import(moduleUrl.href);
  } finally {
    await Deno.remove(tempFile).catch(() => {});
  }
}

Deno.test("module loads with required Supabase env and offline runtime stubs", async () => {
  const envSnapshot = snapshotEnv();
  const restoreRuntime = installOfflineRuntimeStubs();

  try {
    Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key-not-a-secret");

    const mod = await import("./index.ts");
    assertExists(mod);
  } finally {
    restoreRuntime();
    restoreEnv(envSnapshot);
  }
});

Deno.test("sanitize helpers remove user_id and expose only safe host display fields", async () => {
  const helpers = await loadPureHelpers();

  assertEquals(
    helpers.sanitizePage({
      id: "page-id",
      slug: "demo-page",
      title: "Page publique",
      user_id: "private-user-id",
    }),
    {
      id: "page-id",
      slug: "demo-page",
      title: "Page publique",
    },
  );

  assertEquals(
    helpers.sanitizeSlot({
      id: "slot-id",
      day_of_week: 1,
      start_time: "09:00",
      end_time: "12:00",
      user_id: "private-user-id",
    }),
    {
      id: "slot-id",
      day_of_week: 1,
      start_time: "09:00",
      end_time: "12:00",
    },
  );

  assertEquals(
    helpers.sanitizeHost({
      id: "host-link-id",
      role: "primary",
      is_required: true,
      user_id: "private-host-user-id",
      profile: {
        nom: "Curie",
        prenom: "Marie",
        avatar_url: undefined,
        email: "private@example.test",
        phone: "0102030405",
      },
    }),
    {
      id: "host-link-id",
      role: "primary",
      is_required: true,
      profile: {
        nom: "Curie",
        prenom: "Marie",
        avatar_url: null,
      },
    },
  );

  assertEquals(helpers.sanitizePage(null), null);
  assertEquals(helpers.sanitizeSlot(undefined), null);
  assertEquals(helpers.sanitizeHost(null), null);
});

Deno.test("validation helpers accept valid public inputs and reject malformed values", async () => {
  const helpers = await loadPureHelpers();

  assertEquals(helpers.isUuid("123e4567-e89b-12d3-a456-426614174000"), true);
  assertEquals(helpers.isUuid("123E4567-E89B-12D3-A456-426614174000"), true);
  assertEquals(helpers.isUuid("123e4567-e89b-12d3-a456"), false);
  assertEquals(helpers.isUuid(123), false);

  assertEquals(helpers.isIsoDate("2024-02-29T10:15:00.000Z"), true);
  assertEquals(helpers.isIsoDate("not-a-date"), false);
  assertEquals(helpers.isIsoDate(null), false);

  assertEquals(helpers.isEmail("patient@example.com"), true);
  assertEquals(helpers.isEmail("patient@example"), false);
  assertEquals(helpers.isEmail("not-an-email"), false);
  assertEquals(helpers.isEmail("a".repeat(245) + "@example.com"), false);

  assertEquals(helpers.clean("  Rendez-vous de suivi  "), "Rendez-vous de suivi");
  assertEquals(helpers.clean("  abcdef  ", 3), "abc");
  assertEquals(helpers.clean("   "), null);
  assertEquals(helpers.clean({ value: "abc" }), null);
});

Deno.test("Paris timezone helpers convert wall-clock booking times to UTC across winter and summer offsets", async () => {
  const helpers = await loadPureHelpers();

  assertEquals(
    helpers.parisWallClockToUtc("2024-01-15", 9, 30).toISOString(),
    "2024-01-15T08:30:00.000Z",
  );

  assertEquals(
    helpers.parisWallClockToUtc("2024-07-15", 9, 30).toISOString(),
    "2024-07-15T07:30:00.000Z",
  );

  assertEquals(helpers.parisDayOfWeek("2024-01-01"), 0);
  assertEquals(helpers.parisDayOfWeek("2024-01-07"), 6);
  assertEquals(helpers.parisDayOfWeek("2024-03-31"), 6);
});

Deno.test("test harness fails loudly when an expected pure helper is absent from source", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertThrows(
    () => extractFunctionSource(source, "helperThatDoesNotExist"),
    Error,
    "Missing function helperThatDoesNotExist",
  );

  await assertRejects(
    async () => {
      const tempFile = await Deno.makeTempFile({ suffix: ".ts" });
      try {
        await Deno.writeTextFile(tempFile, "throw new Error('synthetic import failure');");
        const moduleUrl = new URL(tempFile, "file://");
        moduleUrl.searchParams.set("v", crypto.randomUUID());
        await import(moduleUrl.href);
      } finally {
        await Deno.remove(tempFile).catch(() => {});
      }
    },
    Error,
    "synthetic import failure",
  );
});