import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

function parseGeneratedEmailContent(content: string): { subject: string; body: string } {
  const lines = content.trim().split(/\r?\n/);
  let subject = "Reprise de contact";
  let body = content.trim();
  const firstLine = lines[0]?.trim() ?? "";
  const match = firstLine.match(/^(?:objet\s*:?\s*)?(.+)$/i);

  if (match && lines.length > 1) {
    subject = match[1].replace(/^["«]|["»]$/g, "").trim();
    body = lines.slice(1).join("\n").trim();
  }

  return { subject, body };
}

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(new URL("./index.ts", import.meta.url));
}

function assertSourceMatches(source: string, pattern: RegExp, description: string) {
  if (!pattern.test(source)) {
    throw new Error(`Missing source pattern: ${description}`);
  }
}

async function withTemporaryEnv(values: Record<string, string>, fn: () => Promise<void>): Promise<void> {
  const previous = new Map<string, string | undefined>();

  for (const key of Object.keys(values)) {
    previous.set(key, Deno.env.get(key));
    Deno.env.set(key, values[key]);
  }

  try {
    await fn();
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

function installFakeServerPrimitives(): () => void {
  const listenDescriptor = Object.getOwnPropertyDescriptor(Deno, "listen");
  const serveDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve");

  const pending = <T>() => new Promise<T>(() => {});

  const fakeListener = {
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
    rid: -1,
    close() {},
    accept() {
      return pending<Deno.Conn>();
    },
    [Symbol.asyncIterator]() {
      return {
        next() {
          return pending<IteratorResult<Deno.Conn>>();
        },
      };
    },
  } as unknown as Deno.Listener;

  const fakeServer = {
    finished: pending<void>(),
    shutdown: () => Promise.resolve(),
    ref() {},
    unref() {},
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
  };

  Object.defineProperty(Deno, "listen", {
    configurable: true,
    writable: true,
    value: () => fakeListener,
  });

  Object.defineProperty(Deno, "serve", {
    configurable: true,
    writable: true,
    value: () => fakeServer,
  });

  return () => {
    if (listenDescriptor) {
      Object.defineProperty(Deno, "listen", listenDescriptor);
    }

    if (serveDescriptor) {
      Object.defineProperty(Deno, "serve", serveDescriptor);
    } else {
      delete (Deno as unknown as Record<string, unknown>).serve;
    }
  };
}

Deno.test("module loads without opening a real HTTP listener", async () => {
  const restoreServerPrimitives = installFakeServerPrimitives();
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  console.log = () => {};
  console.error = () => {};

  try {
    await withTemporaryEnv(
      {
        AZURE_OPENAI_ENDPOINT: "http://127.0.0.1/fake-azure-openai",
        AZURE_OPENAI_API_KEY: "test-api-key",
        SUPABASE_URL: "http://127.0.0.1/fake-supabase",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
        INTERNAL_SECRET: "test-internal-secret",
      },
      async () => {
        const mod = await import("./index.ts");
        assertExists(mod);
      },
    );
  } finally {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    restoreServerPrimitives();
  }
});

Deno.test("email parser extracts an explicit Objet line and keeps the body", () => {
  const content = `Objet : Point rapide cette semaine

Bonjour,

Nous avons remarqué une baisse récente des échanges avec votre établissement.
Seriez-vous disponible pour un point de 15 minutes cette semaine ?

L'équipe OpenPulse`;

  const parsed = parseGeneratedEmailContent(content);

  assertEquals(parsed.subject, "Point rapide cette semaine");
  assertEquals(
    parsed.body,
    `Bonjour,

Nous avons remarqué une baisse récente des échanges avec votre établissement.
Seriez-vous disponible pour un point de 15 minutes cette semaine ?

L'équipe OpenPulse`,
  );
});

Deno.test("email parser removes surrounding French quotes from the subject", () => {
  const content = `Objet: « Reprise de contact sur votre accompagnement »

Bonjour,
Je vous propose un échange de 15 minutes cette semaine.`;

  const parsed = parseGeneratedEmailContent(content);

  assertEquals(parsed.subject, "Reprise de contact sur votre accompagnement");
  assertEquals(parsed.body, "Bonjour,\nJe vous propose un échange de 15 minutes cette semaine.");
});

Deno.test("email parser accepts a first line without Objet prefix when a body exists", () => {
  const content = `Suivi de votre accompagnement

Bonjour,
Pouvons-nous prévoir un point de 15 minutes cette semaine ?`;

  const parsed = parseGeneratedEmailContent(content);

  assertEquals(parsed.subject, "Suivi de votre accompagnement");
  assertEquals(parsed.body, "Bonjour,\nPouvons-nous prévoir un point de 15 minutes cette semaine ?");
});

Deno.test("email parser falls back to the default subject for single-line content", () => {
  const content = "Bonjour, je vous propose un point rapide cette semaine.";

  const parsed = parseGeneratedEmailContent(content);

  assertEquals(parsed.subject, "Reprise de contact");
  assertEquals(parsed.body, "Bonjour, je vous propose un point rapide cette semaine.");
});

Deno.test("source enforces internal secret and handles CORS preflight before business logic", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /if\s*\(\s*req\.method\s*===\s*["']OPTIONS["']\s*\)/, "OPTIONS preflight check");
  assertSourceMatches(source, /return\s+new\s+Response\s*\(\s*null\s*,\s*\{\s*headers\s*:\s*corsHeaders\s*\}\s*\)/s, "OPTIONS response uses CORS headers");
  assertSourceMatches(source, /requireInternalSecret\s*\(\s*req\s*,\s*corsHeaders\s*\)/, "internal secret validation");
  assertSourceMatches(source, /if\s*\(\s*denied\s*\)\s*return\s+denied\s*;/, "denied response returned before business logic");
  // Le durcissement CORS a remplace la declaration en ligne par un import de
  // ../_shared/cors.ts : ni l'origine generique ni la liste d'en-tetes ne sont
  // plus ecrites dans index.ts. Le banc verifie la delegation, puis charge le
  // vrai module partage pour constater que le contrat tenu est plus strict.
  assertSourceMatches(source, /import \{ corsHeaders \} from '\.\.\/_shared\/cors\.ts'/, "CORS headers taken from the shared module");
  const socleCors = await import(new URL("../_shared/cors.ts", import.meta.url).href);
  const enTetesPrevol = socleCors.getCorsHeaders("https://origine-non-declaree.invalid");
  assertEquals(enTetesPrevol["Access-Control-Allow-Origin"] === "*", false);
  assertSourceMatches(enTetesPrevol["Access-Control-Allow-Headers"], /x-internal-secret/, "internal secret header allowed");
});

Deno.test("source validates required configuration and etablissement_id", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /Deno\.env\.get\s*\(\s*["']AZURE_OPENAI_ENDPOINT["']\s*\)/, "Azure endpoint env lookup");
  assertSourceMatches(source, /Deno\.env\.get\s*\(\s*["']AZURE_OPENAI_API_KEY["']\s*\)/, "Azure API key env lookup");
  assertSourceMatches(source, /throw\s+new\s+Error\s*\(\s*["']Configuration Azure OpenAI manquante["']\s*\)/, "missing Azure config error");
  assertSourceMatches(source, /const\s*\{\s*etablissement_id\s*\}\s*=\s*await\s+req\.json\s*\(\s*\)\s*;/, "request JSON parsing");
  assertSourceMatches(source, /throw\s+new\s+Error\s*\(\s*["']etablissement_id requis["']\s*\)/, "missing etablissement_id error");
});

Deno.test("source builds the expected Supabase reads without performing real database calls in tests", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /createClient\s*\(\s*SUPABASE_URL\s*,\s*SUPABASE_SERVICE_ROLE_KEY\s*\)/, "Supabase service client creation");
  assertSourceMatches(source, /\.from\s*\(\s*["']etablissements["']\s*\)/, "etablissements table read");
  assertSourceMatches(source, /\.select\s*\(\s*["']nom,\s*ville,\s*type_offre,\s*statut,\s*csm_id["']\s*\)/, "etablissements selected columns");
  assertSourceMatches(source, /\.eq\s*\(\s*["']id["']\s*,\s*etablissement_id\s*\)\.maybeSingle\s*\(\s*\)/, "etablissement id filter");
  assertSourceMatches(source, /\.from\s*\(\s*["']churn_predictions["']\s*\)/, "churn_predictions table read");
  assertSourceMatches(source, /\.select\s*\(\s*["']score,\s*risk_level,\s*factors,\s*recommendations["']\s*\)/, "churn selected columns");
  assertSourceMatches(source, /\.eq\s*\(\s*["']etablissement_id["']\s*,\s*etablissement_id\s*\)\.maybeSingle\s*\(\s*\)/, "churn etablissement filter");
  assertSourceMatches(source, /throw\s+new\s+Error\s*\(\s*["']Établissement introuvable["']\s*\)/, "missing etablissement error");
});

Deno.test("source sends Azure GPT-5 request with bounded generation settings", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /fetch\s*\(\s*AZURE_OPENAI_ENDPOINT\s*,/, "Azure endpoint fetch");
  assertSourceMatches(source, /method\s*:\s*["']POST["']/, "Azure POST request");
  assertSourceMatches(source, /["']Content-Type["']\s*:\s*["']application\/json["']/, "JSON content type");
  assertSourceMatches(source, /["']api-key["']\s*:\s*AZURE_OPENAI_API_KEY/, "Azure API key header");
  assertSourceMatches(source, /max_completion_tokens\s*:\s*2000/, "bounded token budget");
  assertSourceMatches(source, /reasoning_effort\s*:\s*["']low["']/, "low reasoning effort");
  assertSourceMatches(source, /verbosity\s*:\s*["']medium["']/, "medium verbosity");
  assertSourceMatches(source, /new\s+AbortController\s*\(\s*\)/, "AbortController creation");
  assertSourceMatches(source, /setTimeout\s*\(\s*\(\s*\)\s*=>\s*controller\.abort\s*\(\s*\)\s*,\s*60000\s*\)/, "60s timeout abort");
  assertSourceMatches(source, /clearTimeout\s*\(\s*timeoutId\s*\)/, "timeout cleanup");
});

Deno.test("source prompt includes retention-email business constraints and customer context", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /Customer Success Manager senior chez OpenPulse/, "CSM persona");
  assertSourceMatches(source, /emails de rétention personnalisés/, "retention-email task");
  assertSourceMatches(source, /max 180 mots/, "maximum length");
  assertSourceMatches(source, /Établissement\s*:\s*\$\{etab\.nom\}/, "establishment name interpolation");
  assertSourceMatches(source, /Score de churn\s*:\s*\$\{churn\?\.score\s*\?\?\s*["']\?["']\}\s*\/\s*100/, "churn score interpolation");
  assertSourceMatches(source, /Tickets support ouverts\s*:\s*\$\{factors\.open_tickets\s*\?\?\s*0\}/, "open tickets factor");
  assertSourceMatches(source, /Factures impayées\s*\(>30j\)\s*:\s*\$\{factors\.unpaid_invoices\s*\?\?\s*0\}/, "unpaid invoices factor");
  assertSourceMatches(source, /Propose un point de 15 min cette semaine/, "15-minute meeting instruction");
  assertSourceMatches(source, /L['’]équipe OpenPulse/, "signature instruction");
});

Deno.test("source parses Azure content into subject and body", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /azureData\.choices\?\.\[0\]\?\.message\?\.content\s*\?\?\s*["']["']/, "Azure choices content extraction");
  assertSourceMatches(source, /let\s+subject\s*=\s*["']Reprise de contact["']/, "default subject");
  assertSourceMatches(source, /content\.trim\(\)\.split\s*\(\s*\/\\r\?\?\\n\/|content\.trim\(\)\.split\s*\(\s*\/\\r\?\\n\//, "line splitting");
  assertSourceMatches(source, /firstLine\.match\s*\(\s*\/\^\(\?:objet\\s\*/, "Objet prefix regex");
  assertSourceMatches(source, /replace\s*\(\s*\/\^\["«\]\|\["»\]\$\/g\s*,\s*["']["']\s*\)\.trim\s*\(\s*\)/, "subject quote trimming");
  assertSourceMatches(source, /body\s*=\s*lines\.slice\s*\(\s*1\s*\)\.join\s*\(\s*["']\\n["']\s*\)\.trim\s*\(\s*\)/, "body from remaining lines");
});

Deno.test("source contains expected sanitized error response path", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /import\s*\{\s*buildErrorResponse\s*\}\s*from\s*["']\.\.\/_shared\/error-sanitizer\.ts["']/, "error sanitizer import");
  assertSourceMatches(source, /catch\s*\(\s*e\s*:\s*unknown\s*\)/, "unknown catch variable");
  assertSourceMatches(source, /buildErrorResponse\s*\(\s*["']generate-retention-email["']\s*,\s*e\s*,\s*corsHeaders\s*,\s*500\s*\)/, "sanitized error response");
});

Deno.test("test helper throws when a required source pattern is absent", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /Azure GPT-5/, "module mentions Azure GPT-5");

  assertThrows(
    () => assertSourceMatches(source, /__fragment_absent_du_module__/, "absent fragment"),
    Error,
    "Missing source pattern",
  );
});

Deno.test("test helper rejects missing module imports", async () => {
  await assertRejects(
    () => import("./__missing_module_for_retention_email_test__.ts"),
    TypeError,
  );
});