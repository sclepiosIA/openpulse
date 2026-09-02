import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const AGENT_IDS = ["sophia", "marcus", "olivia", "noah", "emma", "alex"] as const;
type AgentId = typeof AGENT_IDS[number];

function toFileUrl(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  const absolute = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return new URL(`file://${absolute}`).href;
}

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(new URL("./index.ts", import.meta.url));
}

function extractConstObjectBlock(source: string, constName: string): string {
  const constIndex = source.indexOf(`const ${constName}`);
  if (constIndex === -1) {
    throw new Error(`${constName} not found`);
  }

  const equalsIndex = source.indexOf("=", constIndex);
  if (equalsIndex === -1) {
    throw new Error(`${constName} assignment not found`);
  }

  const openIndex = source.indexOf("{", equalsIndex);
  if (openIndex === -1) {
    throw new Error(`${constName} object literal not found`);
  }

  let depth = 0;
  let inString: "'" | '"' | "`" | null = null;
  let escaped = false;

  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      inString = char;
      continue;
    }

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        return source.slice(openIndex, i + 1);
      }
    }
  }

  throw new Error(`${constName} object literal is not closed`);
}

function extractAgentKeywords(source: string): Record<AgentId, string[]> {
  const block = extractConstObjectBlock(source, "AGENT_KEYWORDS");
  const result = {} as Record<AgentId, string[]>;

  for (const agentId of AGENT_IDS) {
    const match = block.match(new RegExp(`${agentId}\\s*:\\s*\\[([^\\]]*)\\]`, "m"));
    if (!match) {
      throw new Error(`Keywords for ${agentId} not found`);
    }

    const keywords = [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
    if (keywords.length === 0) {
      throw new Error(`Keywords for ${agentId} are empty`);
    }

    result[agentId] = keywords;
  }

  return result;
}

function extractAgentInfo(source: string): Record<AgentId, { name: string; emoji: string; domain: string }> {
  const block = extractConstObjectBlock(source, "AGENT_INFO");
  const result = {} as Record<AgentId, { name: string; emoji: string; domain: string }>;

  for (const agentId of AGENT_IDS) {
    const match = block.match(
      new RegExp(
        `${agentId}\\s*:\\s*\\{\\s*name:\\s*'([^']+)'\\s*,\\s*emoji:\\s*'([^']+)'\\s*,\\s*domain:\\s*'([^']+)'\\s*\\}`,
        "m",
      ),
    );

    if (!match) {
      throw new Error(`Agent info for ${agentId} not found`);
    }

    result[agentId] = {
      name: match[1],
      emoji: match[2],
      domain: match[3],
    };
  }

  return result;
}

function detectRequiredAgentsLikeModule(query: string, keywords: Record<AgentId, string[]>): AgentId[] {
  const normalizedQuery = query.toLowerCase();
  const detectedAgents = new Set<AgentId>();

  for (const agentId of AGENT_IDS) {
    for (const keyword of keywords[agentId]) {
      if (normalizedQuery.includes(keyword)) {
        detectedAgents.add(agentId);
        break;
      }
    }
  }

  if (
    normalizedQuery.includes("brief") ||
    normalizedQuery.includes("standup") ||
    normalizedQuery.includes("point")
  ) {
    return [...AGENT_IDS];
  }

  if (detectedAgents.size === 0) {
    detectedAgents.add("sophia");
  }

  return Array.from(detectedAgents);
}

async function importIndexInSandbox(): Promise<string> {
  const source = await readIndexSource();
  const tempRoot = await Deno.makeTempDir({ prefix: "jarvis-prime-test-" });
  const functionDir = `${tempRoot}/function`;
  const sharedDir = `${tempRoot}/_shared`;

  try {
    await Deno.mkdir(functionDir, { recursive: true });
    await Deno.mkdir(sharedDir, { recursive: true });

    await Deno.writeTextFile(`${functionDir}/index.ts`, source);

    await Deno.writeTextFile(
      `${functionDir}/server_stub.ts`,
      `
export function serve(handler) {
  globalThis.__jarvisPrimeHandler = handler;
  return {
    finished: Promise.resolve(),
    close() {},
    shutdown() {
      return Promise.resolve();
    },
  };
}
`,
    );

    await Deno.writeTextFile(
      `${functionDir}/supabase_stub.ts`,
      `
export function createClient() {
  return {
    from() {
      throw new Error("Supabase stub should not be called during module import");
    },
  };
}
`,
    );

    await Deno.writeTextFile(
      `${sharedDir}/auth-helpers.ts`,
      `
export async function validateServiceOrUser() {
  return {
    authorized: true,
    isServiceCall: true,
    userId: "test-user",
  };
}
`,
    );

    await Deno.writeTextFile(
      `${sharedDir}/error-sanitizer.ts`,
      `
export function buildErrorResponse(functionName, error, headers = {}, status = 500) {
  const message = error instanceof Error ? error.message : String(error);
  return new Response(JSON.stringify({ error: message, functionName }), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
`,
    );

    // Le durcissement CORS a ajoute un import de ../_shared/cors.ts : le bac a
    // sable doit exercer le VRAI socle, pas une doublure.
    await Deno.writeTextFile(
      `${sharedDir}/cors.ts`,
      await Deno.readTextFile(new URL("../_shared/cors.ts", import.meta.url)),
    );

    const importMapPath = `${functionDir}/import_map.json`;
    await Deno.writeTextFile(
      importMapPath,
      JSON.stringify({
        imports: {
          "https://deno.land/std@0.168.0/http/server.ts": toFileUrl(`${functionDir}/server_stub.ts`),
          "@supabase/supabase-js": toFileUrl(`${functionDir}/supabase_stub.ts`),
        },
      }),
    );

    const runnerPath = `${functionDir}/sandbox_runner.ts`;
    await Deno.writeTextFile(
      runnerPath,
      `
Deno.env.set("SUPABASE_URL", "http://localhost");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
Deno.env.delete("AZURE_OPENAI_ENDPOINT");
Deno.env.delete("AZURE_OPENAI_API_KEY");

try {
  await import("./index.ts");
  const handlerRegistered = typeof globalThis.__jarvisPrimeHandler === "function";
  console.log(JSON.stringify({ loaded: true, handlerRegistered }));
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  Deno.exit(1);
}
`,
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: ["run", "--allow-all", "--no-check", `--import-map=${importMapPath}`, runnerPath],
      cwd: functionDir,
      stdout: "piped",
      stderr: "piped",
    });

    const output = await command.output();
    const stdout = new TextDecoder().decode(output.stdout).trim();
    const stderr = new TextDecoder().decode(output.stderr).trim();

    if (!output.success) {
      throw new Error(`Sandbox import failed: ${stderr || stdout}`);
    }

    return stdout;
  } finally {
    await Deno.remove(tempRoot, { recursive: true }).catch(() => {});
  }
}

Deno.test("module loads from ./index.ts with offline stubs and registers the Supabase Edge handler", async () => {
  const stdout = await importIndexInSandbox();
  const lastLine = stdout.split("\n").filter(Boolean).at(-1);
  assertExists(lastLine);

  const result = JSON.parse(lastLine);
  assertEquals(result.loaded, true);
  assertEquals(result.handlerRegistered, true);
});

Deno.test("agent keyword catalog contains the expected business routing terms", async () => {
  const source = await readIndexSource();
  const keywords = extractAgentKeywords(source);

  assertEquals(keywords.sophia.includes("pipeline"), true);
  assertEquals(keywords.sophia.includes("prospect"), true);
  assertEquals(keywords.marcus.includes("salaire"), true);
  assertEquals(keywords.marcus.includes("paie"), true);
  assertEquals(keywords.olivia.includes("facture"), true);
  assertEquals(keywords.olivia.includes("trésorerie"), true);
  assertEquals(keywords.noah.includes("sprint"), true);
  assertEquals(keywords.emma.includes("support"), true);
  assertEquals(keywords.alex.includes("kpi"), true);
});

Deno.test("agent metadata exposes the expected names, emojis, and domains", async () => {
  const source = await readIndexSource();
  const info = extractAgentInfo(source);

  assertEquals(info.sophia, { name: "SOPHIA", emoji: "👩‍💼", domain: "CRM & Commercial" });
  assertEquals(info.marcus, { name: "MARCUS", emoji: "👨‍💼", domain: "RH & People" });
  assertEquals(info.olivia, { name: "OLIVIA", emoji: "👩‍💻", domain: "Trésorerie & Finance" });
  assertEquals(info.noah, { name: "NOAH", emoji: "👨‍🔬", domain: "R&D & Produit" });
  assertEquals(info.emma, { name: "EMMA", emoji: "👩‍🎨", domain: "Support & Clients" });
  assertEquals(info.alex, { name: "ALEX", emoji: "📊", domain: "Analytics & BI" });
});

Deno.test("agent detection routes CRM, finance, product, support, and analytics questions deterministically", async () => {
  const source = await readIndexSource();
  const keywords = extractAgentKeywords(source);

  assertEquals(
    detectRequiredAgentsLikeModule("Quel est le pipeline commercial des prospects ?", keywords),
    ["sophia"],
  );

  assertEquals(
    detectRequiredAgentsLikeModule("Analyse des factures, paiements et trésorerie Qonto", keywords),
    ["marcus", "olivia", "alex"],
  );

  assertEquals(
    detectRequiredAgentsLikeModule("Analyse des factures et de la trésorerie Qonto", keywords),
    ["olivia", "alex"],
  );

  assertEquals(
    detectRequiredAgentsLikeModule("Sprint backlog, user story et vélocité de release", keywords),
    ["noah"],
  );

  assertEquals(
    detectRequiredAgentsLikeModule("Bug critique support avec problème de satisfaction client", keywords),
    ["sophia", "emma"],
  );

  assertEquals(
    detectRequiredAgentsLikeModule("KPI de performance et rapport statistique", keywords),
    ["alex"],
  );
});

Deno.test("global brief, standup, and point queries mobilize all six agents", async () => {
  const source = await readIndexSource();
  const keywords = extractAgentKeywords(source);

  assertEquals(
    detectRequiredAgentsLikeModule("Brief quotidien de direction", keywords),
    [...AGENT_IDS],
  );

  assertEquals(
    detectRequiredAgentsLikeModule("Standup du matin avec toutes les équipes", keywords),
    [...AGENT_IDS],
  );

  assertEquals(
    detectRequiredAgentsLikeModule("Point hebdomadaire complet", keywords),
    [...AGENT_IDS],
  );
});

Deno.test("unknown queries fallback to Sophia as default orchestrated agent", async () => {
  const source = await readIndexSource();
  const keywords = extractAgentKeywords(source);

  assertEquals(
    detectRequiredAgentsLikeModule("Peux-tu m'aider sur une demande générale sans domaine précis ?", keywords),
    ["sophia"],
  );
});

Deno.test("source defines the expected CORS headers for Supabase Edge requests", async () => {
  const source = await readIndexSource();
  const socleCors = await Deno.readTextFile(new URL("../_shared/cors.ts", import.meta.url));

  assertExists(source.match(/import \{ corsHeaders \} from ['"]\.\.\/_shared\/cors\.ts['"]/));
  assertEquals(/Access-Control-Allow-Origin['"]:\s*['"]\*['"]/.test(source), false);
  assertEquals(/Access-Control-Allow-Origin['"]:\s*['"]\*['"]/.test(socleCors), false);
  assertExists(socleCors.match(/Access-Control-Allow-Origin['"]:\s*origine/));
  assertExists(source.match(/authorization/));
  assertExists(source.match(/apikey/));
  assertExists(source.match(/content-type/));
  assertExists(source.match(/x-supabase-client-platform-version/));
  assertExists(source.match(/x-supabase-client-runtime-version/));
});

Deno.test("source parser throws a clear error when required agent constants are missing", () => {
  assertThrows(
    () => extractAgentKeywords("const OTHER_CONSTANT = {};"),
    Error,
    "AGENT_KEYWORDS not found",
  );

  assertThrows(
    () => extractAgentInfo("const AGENT_KEYWORDS = {};"),
    Error,
    "AGENT_INFO not found",
  );
});

Deno.test("relative module source path must exist", async () => {
  const source = await readIndexSource();
  assertExists(source);
  assertEquals(source.includes("JARVIS PRIME"), true);

  await assertRejects(
    () => Deno.readTextFile(new URL("./__missing_index__.ts", import.meta.url)),
    Deno.errors.NotFound,
  );
});