import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const moduleUrl = new URL("./index.ts", import.meta.url);

async function readModuleSource(): Promise<string> {
  return await Deno.readTextFile(moduleUrl);
}

function extractAgentDefinitions(source: string): Array<{ id: string; name: string; emoji: string }> {
  return Array.from(
    source.matchAll(/agent_id:\s*'([^']+)',\s*agent_name:\s*'([^']+)',\s*emoji:\s*'([^']+)'/g),
  ).map((match) => ({
    id: match[1],
    name: match[2],
    emoji: match[3],
  }));
}

function extractSupabaseTables(source: string): string[] {
  return Array.from(source.matchAll(/\.from\('([^']+)'\)/g)).map((match) => match[1]);
}

function withEnv(values: Record<string, string>): () => void {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(values)) {
    previous.set(key, Deno.env.get(key));
    Deno.env.set(key, value);
  }

  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  };
}

function stubDenoListen(): () => void {
  const originalListen = Deno.listen;

  const fakeListener = {
    rid: -1,
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 8000 },
    close() {},
    accept(): Promise<Deno.Conn> {
      return new Promise<Deno.Conn>(() => {});
    },
    [Symbol.asyncIterator]() {
      return {
        async next() {
          return { done: true, value: undefined };
        },
      };
    },
  };

  Object.defineProperty(Deno, "listen", {
    value: () => fakeListener,
    configurable: true,
    writable: true,
  });

  return () => {
    Object.defineProperty(Deno, "listen", {
      value: originalListen,
      configurable: true,
      writable: true,
    });
  };
}

Deno.test("source defines the six JARVIS standup agents with expected identifiers, names, and emojis", async () => {
  const source = await readModuleSource();

  assertEquals(extractAgentDefinitions(source), [
    { id: "sophia", name: "SOPHIA", emoji: "👩‍💼" },
    { id: "marcus", name: "MARCUS", emoji: "👨‍💼" },
    { id: "olivia", name: "OLIVIA", emoji: "👩‍💻" },
    { id: "noah", name: "NOAH", emoji: "👨‍🔬" },
    { id: "emma", name: "EMMA", emoji: "👩‍🎨" },
    { id: "alex", name: "ALEX", emoji: "📊" },
  ]);
});

Deno.test("source queries the expected Supabase tables in the standup generation flow", async () => {
  const source = await readModuleSource();

  assertEquals(extractSupabaseTables(source), [
    "profiles",
    "etablissements",
    "etablissements",
    "etablissements",
    "rh_absences",
    "profiles",
    "profiles",
    "tresorerie_revenus",
    "factures",
    "factures",
    "rd_sprints",
    "rd_user_stories",
    "support_tickets",
    "support_tickets",
  ]);
});

Deno.test("source contains the expected authentication, user resolution, and filtering rules", async () => {
  const source = await readModuleSource();

  const expectedFragments = [
    "validateServiceOrUser(req)",
    "if (!auth.authorized)",
    "status: 401",
    "const user_id = (!auth.isServiceCall && auth.userId) ? auth.userId : request.user_id;",
    "status: 404",
    "sections.filter(s => include_agents.includes(s.agent_id))",
  ];

  assertEquals(
    expectedFragments.map((fragment) => source.includes(fragment)),
    [true, true, true, true, true, true],
  );
});

Deno.test("source contains the expected business alert thresholds and priority mapping", async () => {
  const source = await readModuleSource();

  const expectedFragments = [
    "7 * 24 * 60 * 60 * 1000",
    "30 * 24 * 60 * 60 * 1000",
    "progress > 0.5 && velocity < 70",
    "priority: 'critical'",
    "priority: 'high'",
    "priority: 'medium'",
    "alert.priority === 'critical' ? '🚨'",
    "alert.priority === 'high' ? '⚠️'",
    "'📌'",
  ];

  assertEquals(
    expectedFragments.map((fragment) => source.includes(fragment)),
    [true, true, true, true, true, true, true, true, true],
  );
});

Deno.test("source builds a French morning briefing with section highlights and alerts", async () => {
  const source = await readModuleSource();

  const briefingFunction = source.match(/function generateBriefingText[\s\S]*$/);
  assertExists(briefingFunction);

  const briefingSource = briefingFunction[0];

  assertEquals(briefingSource.includes("📋 **BRIEFING MATINAL**"), true);
  assertEquals(briefingSource.includes("Bonjour ${userName} ! Voici le point de l'équipe"), true);
  assertEquals(briefingSource.includes("**${section.agent_name}**"), true);
  assertEquals(briefingSource.includes("• ${highlight}"), true);
  assertEquals(briefingSource.includes("toLocaleDateString('fr-FR'"), true);
});

Deno.test("module loads without opening a real listener or making network calls", { sanitizeOps: false, sanitizeResources: false }, async () => {
  const restoreEnv = withEnv({
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    SUPABASE_ANON_KEY: "test-anon-key",
  });

  const restoreListen = stubDenoListen();
  const originalFetch = globalThis.fetch;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  globalThis.fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

  console.log = () => {};
  console.error = () => {};

  try {
    const mod = await import("./index.ts");
    assertEquals(typeof mod, "object");
  } finally {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    globalThis.fetch = originalFetch;
    restoreListen();
    restoreEnv();
  }
});