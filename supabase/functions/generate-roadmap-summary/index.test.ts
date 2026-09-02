import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const INDEX_URL = new URL("./index.ts", import.meta.url);

function fileUrlToPath(url: URL): string {
  let path = decodeURIComponent(url.pathname);
  if (Deno.build.os === "windows") {
    path = path.replace(/^\/([A-Za-z]:)/, "$1").replaceAll("/", "\\");
  }
  return path;
}

function pathToFileUrl(path: string): string {
  const normalized = path.replaceAll("\\", "/");

  if (/^[A-Za-z]:\//.test(normalized)) {
    const drive = normalized.slice(0, 2);
    const rest = normalized
      .slice(2)
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `file:///${drive}${rest}`;
  }

  const absolute = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `file://${absolute
    .split("/")
    .map((segment, index) => index === 0 ? "" : encodeURIComponent(segment))
    .join("/")}`;
}

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(INDEX_URL);
}

function extractDpis(source: string): string[] {
  const match = source.match(/const\s+DPIS\s*=\s*\[([\s\S]*?)\]\s+as\s+const/);
  if (!match) {
    throw new Error("DPIS declaration not found");
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function assertSourceMatches(source: string, regex: RegExp, message: string): void {
  assertExists(source.match(regex), message);
}

Deno.test("module declares the expected DPI targets", async () => {
  const source = await readIndexSource();

  assertEquals(extractDpis(source), ["hm", "resurgences", "easily", "mediboard"]);
});

Deno.test("DPI declaration parser fails loudly when the module shape changes", () => {
  assertThrows(
    () => extractDpis(`const OTHER = ["hm"] as const;`),
    Error,
    "DPIS declaration not found",
  );
});

Deno.test("source fetching is restricted to visible portal roadmap data and capped stories", async () => {
  const source = await readIndexSource();

  assertSourceMatches(
    source,
    /\.from\("rd_projets"\)[\s\S]*?\.eq\("dpi",\s*dpi\)[\s\S]*?\.eq\("visible_portail",\s*true\)/,
    "projects query must filter by dpi and visible_portail=true",
  );
  assertSourceMatches(
    source,
    /\.from\("rd_epics"\)[\s\S]*?\.in\("projet_id",\s*projetIds\)/,
    "epics query must be scoped to visible project ids",
  );
  assertSourceMatches(
    source,
    /\.from\("rd_sprints"\)[\s\S]*?\.in\("projet_id",\s*projetIds\)/,
    "sprints query must be scoped to visible project ids",
  );
  assertSourceMatches(
    source,
    /\.from\("rd_user_stories"\)[\s\S]*?\.order\("updated_at",\s*\{\s*ascending:\s*false\s*\}\)[\s\S]*?\.limit\(50\)/,
    "user stories query must order by updated_at descending and cap results at 50",
  );
});

Deno.test("prompt builder enforces structured anti-hallucination output", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("RÈGLES STRICTES ANTI-HALLUCINATION"), true);
  assertEquals(source.includes("Réponds UNIQUEMENT un JSON valide"), true);
  assertEquals(source.includes("UN thème = UN epic réel présent"), true);
  assertEquals(source.includes("UNIQUEMENT des stories réelles rattachées à cet epic"), true);
  assertSourceMatches(
    source,
    /themes_emerging[\s\S]{0,80}tableau VIDE \[\]/,
    "prompt must force themes_emerging to stay empty",
  );
  assertSourceMatches(
    source,
    /"backlog_signals"\s*:\s*\{/,
    "output schema must contain backlog_signals",
  );
  assertEquals(source.includes(`"dpi": "\${src.dpi}"`), true);
});

Deno.test("Azure request is configured for JSON output, timeout, retry, and robust parsing", async () => {
  const source = await readIndexSource();

  assertSourceMatches(
    source,
    /setTimeout\(\(\)\s*=>\s*controller\.abort\(\),\s*90000\)/,
    "Azure request must use a 90s abort timeout",
  );
  assertSourceMatches(source, /max_completion_tokens:\s*6000/, "Azure request must cap completion tokens");
  assertSourceMatches(source, /reasoning_effort:\s*"minimal"/, "Azure request must use minimal reasoning effort");
  assertSourceMatches(source, /verbosity:\s*"low"/, "Azure request must use low verbosity");
  assertSourceMatches(
    source,
    /response_format:\s*\{\s*type:\s*"json_object"\s*\}/,
    "Azure request must request a JSON object response",
  );
  assertSourceMatches(source, /azureResponse\.status\s*===\s*429/, "Azure request must retry on 429");
  assertSourceMatches(source, /JSON\.parse\(content\)/, "Azure content must be parsed as JSON");
  assertEquals(
    source.includes("content.match(/\\{[\\s\\S]*\\}/)"),
    true,
    "Azure parsing must attempt extraction of the first JSON object",
  );
  assertEquals(source.includes("stream:"), false, "Azure request must not rely on streaming");
});

Deno.test("empty summary fallback has deterministic public roadmap shape", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /function\s+emptySummary\(dpi:\s*Dpi\)/, "emptySummary helper must exist");
  assertEquals(
    source.includes(`headline: "Aucune fonctionnalité publiée n'est encore disponible pour ce périmètre."`),
    true,
  );
  assertSourceMatches(source, /themes:\s*\[\]/, "empty summary must expose no themes");
  assertSourceMatches(source, /next_releases:\s*\[\]/, "empty summary must expose no next releases");
  assertSourceMatches(source, /recently_shipped:\s*\[\]/, "empty summary must expose no shipped items");
  assertSourceMatches(
    source,
    /backlog_signals:\s*\{\s*total:\s*0,\s*high_priority:\s*0,\s*themes_emerging:\s*\[\]\s*\}/,
    "empty summary backlog signals must be zeroed",
  );
});

Deno.test("generation falls back without Azure when no source data exists and persists source count", async () => {
  const source = await readIndexSource();

  assertSourceMatches(
    source,
    /if\s*\(sourceCount\s*===\s*0\)\s*\{[\s\S]*?summary\s*=\s*emptySummary\(dpi\);[\s\S]*?model\s*=\s*"empty-fallback";[\s\S]*?\}/,
    "generateForDpi must use deterministic empty fallback when there is no source data",
  );
  assertSourceMatches(
    source,
    /source_count:\s*sourceCount/,
    "upsert payload must persist source_count",
  );
  assertSourceMatches(
    source,
    /\.from\("roadmap_ai_summaries"\)[\s\S]*?\.upsert\([\s\S]*?\{\s*onConflict:\s*"dpi"\s*\}/,
    "summary must be upserted with dpi conflict handling",
  );
});

Deno.test("handler protects non-OPTIONS requests and supports single or all DPI generation", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /if\s*\(req\.method\s*===\s*"OPTIONS"\)/, "handler must answer CORS preflight");
  assertSourceMatches(
    source,
    /requireInternalSecret\(req,\s*corsHeaders\)/,
    "handler must require the internal secret",
  );
  assertSourceMatches(
    source,
    /if\s*\(!AZURE_OPENAI_ENDPOINT\s*\|\|\s*!AZURE_OPENAI_API_KEY\)/,
    "handler must fail fast when Azure is not configured",
  );
  assertSourceMatches(
    source,
    /body\?\.dpi\s*\?\s*\[body\.dpi\s+as\s+Dpi\]\s*:\s*\[\.\.\.DPIS\]/,
    "handler must support one requested dpi or all configured dpis",
  );
  assertSourceMatches(
    source,
    /buildErrorResponse\('generate-roadmap-summary',\s*error,\s*corsHeaders,\s*500\)/,
    "handler must sanitize unexpected errors",
  );
});

Deno.test("module file is reachable and missing sibling modules reject", async () => {
  const source = await readIndexSource();

  assertExists(source);
  await assertRejects(
    () => Deno.readTextFile(new URL("./__missing_index_dependency__.ts", import.meta.url)),
    Deno.errors.NotFound,
  );
});

Deno.test("module loads in an isolated subprocess without calling external APIs or databases", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "generate-roadmap-summary-test-" });
  const sep = Deno.build.os === "windows" ? "\\" : "/";
  const serverStubPath = `${tempDir}${sep}server_stub.ts`;
  const supabaseStubPath = `${tempDir}${sep}supabase_stub.ts`;
  const runnerPath = `${tempDir}${sep}runner.ts`;
  const importMapPath = `${tempDir}${sep}import_map.json`;

  await Deno.writeTextFile(
    serverStubPath,
    `
export function serve(handler) {
  globalThis.__generateRoadmapSummaryHandler = handler;
  return Promise.resolve();
}
`,
  );

  await Deno.writeTextFile(
    supabaseStubPath,
    `
export function createClient() {
  throw new Error("createClient should not be called during module import");
}
`,
  );

  await Deno.writeTextFile(
    importMapPath,
    JSON.stringify({
      imports: {
        "https://deno.land/std@0.168.0/http/server.ts": pathToFileUrl(serverStubPath),
        "@supabase/supabase-js": pathToFileUrl(supabaseStubPath),
      },
    }),
  );

  await Deno.writeTextFile(
    runnerPath,
    `
try {
  await import(${JSON.stringify(INDEX_URL.href)});
  if (typeof globalThis.__generateRoadmapSummaryHandler !== "function") {
    throw new Error("serve stub did not receive the Edge Function handler");
  }
  Deno.exit(0);
} catch (error) {
  console.error(error?.stack ?? error?.message ?? String(error));
  Deno.exit(1);
}
`,
  );

  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-all", "--no-check", `--import-map=${importMapPath}`, runnerPath],
    cwd: fileUrlToPath(new URL(".", import.meta.url)),
    stdout: "piped",
    stderr: "piped",
    env: {
      AZURE_OPENAI_ENDPOINT: "https://example.invalid/openai/deployments/test/chat/completions?api-version=2024-01-01",
      AZURE_OPENAI_API_KEY: "test-azure-key",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      INTERNAL_FUNCTION_SECRET: "test-internal-secret",
    },
  });

  const child = command.spawn();
  let timeoutId: number | undefined;

  try {
    const output = await Promise.race([
      child.output(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          try {
            child.kill("SIGKILL");
          } catch {
            // process already exited
          }
          reject(new Error("Timed out while importing ./index.ts"));
        }, 10_000);
      }),
    ]);

    const stderr = new TextDecoder().decode(output.stderr);
    const stdout = new TextDecoder().decode(output.stdout);
    assertEquals(output.code, 0, `${stderr}\n${stdout}`);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    await Deno.remove(tempDir, { recursive: true });
  }
});