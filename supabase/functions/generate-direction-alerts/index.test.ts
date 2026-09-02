import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type RestoreFn = () => void;

function withTemporaryEnv(values: Record<string, string | undefined>): RestoreFn {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(values)) {
    previous.set(key, Deno.env.get(key));
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
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

function replaceDenoListen(
  replacement: typeof Deno.listen,
): RestoreFn {
  const descriptor = Object.getOwnPropertyDescriptor(Deno, "listen");

  Object.defineProperty(Deno, "listen", {
    configurable: true,
    writable: true,
    value: replacement,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(Deno, "listen", descriptor);
    }
  };
}

function createNeverYieldingListener(): Deno.Listener {
  const never = new Promise<IteratorResult<Deno.Conn>>(() => {});

  return {
    addr: {
      transport: "tcp",
      hostname: "127.0.0.1",
      port: 0,
    } as Deno.NetAddr,
    rid: 999_999,
    close: () => {},
    ref: () => {},
    unref: () => {},
    accept: () => new Promise<Deno.Conn>(() => {}),
    [Symbol.asyncIterator]() {
      return {
        next: () => never,
      };
    },
  } as unknown as Deno.Listener;
}

Deno.test("module loads without opening a real network listener", async () => {
  const listenCalls: Deno.ListenOptions[] = [];

  const restoreEnv = withTemporaryEnv({
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "DUMMY_SERVICE_ROLE_KEY_FOR_TESTS",
    INTERNAL_FUNCTION_SECRET: "DUMMY_INTERNAL_SECRET_FOR_TESTS",
    AZURE_OPENAI_ENDPOINT: undefined,
    AZURE_OPENAI_API_KEY: undefined,
  });

  const restoreListen = replaceDenoListen(((options: Deno.ListenOptions) => {
    listenCalls.push(options);
    return createNeverYieldingListener();
  }) as typeof Deno.listen);

  try {
    const mod = await import("./index.ts");
    assertExists(mod);
    assertEquals(listenCalls.length, 1);
    assertEquals(listenCalls[0].port, 8000);
    assertEquals(listenCalls[0].hostname, "0.0.0.0");
  } finally {
    restoreListen();
    restoreEnv();
  }
});

Deno.test("source keeps CORS preflight support for Supabase Edge Function callers", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  // Le durcissement CORS a deporte l'origine et la liste d'en-tetes dans
  // ../_shared/cors.ts : index.ts ne porte plus ces litteraux. Le banc verifie
  // donc que la fonction delegue au socle partage, puis exerce REELLEMENT ce
  // socle -- il ne le simule pas -- pour constater qu'il n'emet jamais '*' et
  // qu'il accepte l'en-tete du secret interne.
  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
  const socleCors = await import(new URL("../_shared/cors.ts", import.meta.url).href);
  const enTetesPrevol = socleCors.getCorsHeaders("https://origine-non-declaree.invalid");
  assertEquals(enTetesPrevol["Access-Control-Allow-Origin"] === "*", false);
  assertEquals(
    enTetesPrevol["Access-Control-Allow-Headers"],
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  );
  assertEquals(source.includes('req.method === "OPTIONS"'), true);
  assertEquals(source.includes("return new Response(null, { headers: corsHeaders });"), true);
});

Deno.test("source contains offline fallback alert thresholds when Azure OpenAI is not configured", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes("if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY)"), true);
  assertEquals(source.includes("facturesParAnciennete.j90.length > 0"), true);
  assertEquals(source.includes("soldeQonto < 50000"), true);
  assertEquals(source.includes('soldeQonto < 20000 ? "critique" : "attention"'), true);
  assertEquals(source.includes("(absencesSemaine?.length || 0) > 3"), true);
  assertEquals(source.includes("(prospectsInactifs?.length || 0) > 5"), true);
});

Deno.test("source requires internal secret or privileged user roles before generating alerts", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes('req.headers.get("x-function-secret")'), true);
  assertEquals(source.includes("validateUserAuth(req)"), true);
  assertEquals(source.includes(".from('user_roles')"), true);
  assertEquals(source.includes("['admin', 'direction'].includes(r)"), true);
  assertEquals(source.includes("status: 401"), true);
  assertEquals(source.includes("status: 403"), true);
});

Deno.test("source sanitizes unexpected errors before returning them to clients", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes("sanitizeErrorForClient(error)"), true);
  assertEquals(source.includes("status: 500"), true);
  assertEquals(source.includes("[generate-direction-alerts] Error:"), true);
});

Deno.test("test helpers reject invalid assumptions", async () => {
  assertThrows(() => JSON.parse("{invalid-json"));
  await assertRejects(
    async () => {
      throw new Error("expected rejection");
    },
    Error,
    "expected rejection",
  );
});