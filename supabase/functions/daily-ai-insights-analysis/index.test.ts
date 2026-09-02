import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const MODULE_LOADED_MARKER = "__DAILY_AI_INSIGHTS_INDEX_TS_LOADED__";

async function readSource(): Promise<string> {
  return await Deno.readTextFile(new URL("./index.ts", import.meta.url));
}

function currentTestDirectory(): string {
  const url = new URL(".", import.meta.url);
  return decodeURIComponent(url.pathname);
}

async function readTextUntil(
  stream: ReadableStream<Uint8Array>,
  marker: string,
  timeoutMs: number,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";
  let timeoutId: number | undefined;

  const readPromise = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += decoder.decode(value, { stream: true });
      if (output.includes(marker)) return output;
    }

    throw new Error(`Process stdout closed before marker "${marker}" was emitted. Output:\n${output}`);
  })();

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timed out waiting for marker "${marker}". Output so far:\n${output}`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([readPromise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    try {
      await reader.cancel();
    } catch {
      // Ignore cleanup errors from the subprocess pipe.
    }
  }
}

async function importModuleInIsolatedProcess(): Promise<string> {
  const tempFileName = `.__daily_ai_insights_load_${crypto.randomUUID()}.ts`;
  const tempFileUrl = new URL(tempFileName, import.meta.url);
  const code = `
    await import("./index.ts");
    console.log(${JSON.stringify(MODULE_LOADED_MARKER)});
    await new Promise(() => {});
  `;

  await Deno.writeTextFile(tempFileUrl, code);

  const child = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-all", "--no-check", tempFileName],
    cwd: currentTestDirectory(),
    stdout: "piped",
    stderr: "piped",
    env: {
      SUPABASE_URL: "http://localhost",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      INTERNAL_FUNCTION_SECRET: "test-internal-function-secret",
    },
  }).spawn();

  const statusPromise = child.status;
  const stderrPromise = new Response(child.stderr).text().catch((error) => String(error));

  try {
    return await readTextUntil(child.stdout, MODULE_LOADED_MARKER, 60_000);
  } catch (error) {
    try {
      child.kill("SIGTERM");
    } catch {
      // Process may already have exited.
    }

    await statusPromise.catch(() => undefined);
    const stderr = await stderrPromise;

    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nSubprocess stderr:\n${stderr}`,
    );
  } finally {
    try {
      child.kill("SIGTERM");
    } catch {
      // Process may already have exited.
    }

    await statusPromise.catch(() => undefined);
    await stderrPromise.catch(() => undefined);

    try {
      await Deno.remove(tempFileUrl);
    } catch {
      // Ignore cleanup errors.
    }
  }
}

function extractAnalysisTypes(source: string): string[] {
  const match = source.match(/const\s+analysisTypes\s*=\s*\[([^\]]+)\]/);
  assertExists(match);
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

function deduplicateUserIds(
  rows: Array<{
    commercial_id?: string | null;
    chef_projet_id?: string | null;
    csm_id?: string | null;
  }>,
): string[] {
  const userIdSet = new Set<string>();

  rows.forEach((e) => {
    if (e.commercial_id) userIdSet.add(e.commercial_id);
    if (e.chef_projet_id) userIdSet.add(e.chef_projet_id);
    if (e.csm_id) userIdSet.add(e.csm_id);
  });

  return Array.from(userIdSet);
}

function buildStats(
  etablissements: Array<{
    statut: string;
    pourcentage_progression?: number | null;
  }>,
) {
  return {
    totalEtablissements: etablissements.length,
    prospects: etablissements.filter((e) => e.statut === "Prospect").length,
    enProduction: etablissements.filter((e) => e.statut === "En production").length,
    enDeploiement: etablissements.filter((e) => e.statut === "En déploiement").length,
    pauseCommerciale: etablissements.filter((e) => e.statut === "Pause commerciale").length,
    progressionMoyenne: etablissements.reduce(
      (sum, e) => sum + (e.pourcentage_progression || 0),
      0,
    ) / etablissements.length,
  };
}

Deno.test("module loads without throwing in an isolated process", async () => {
  const output = await importModuleInIsolatedProcess();

  assertEquals(output.includes(MODULE_LOADED_MARKER), true);
});

Deno.test("defines the expected daily AI insight analysis types", async () => {
  const source = await readSource();

  assertEquals(extractAnalysisTypes(source), [
    "trends",
    "alerts",
    "recommendations",
    "anomalies",
  ]);
});

Deno.test("throws when analysis types cannot be extracted from source", () => {
  assertThrows(
    () => extractAnalysisTypes("const otherValue = true"),
    Error,
  );
});

Deno.test("readTextUntil rejects when a stream closes before the expected marker", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("partial output only"));
      controller.close();
    },
  });

  await assertRejects(
    () => readTextUntil(stream, "missing-marker", 1_000),
    Error,
    'Process stdout closed before marker "missing-marker"',
  );
});

Deno.test("configures CORS and unauthorized JSON response consistently", async () => {
  const source = await readSource();
  const socle = await Deno.readTextFile(new URL("../_shared/cors.ts", import.meta.url));

  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
  assertEquals(source.includes("Access-Control-Allow-Origin"), false);
  assertEquals(
    socle.includes(
      "'authorization, x-client-info, apikey, content-type, x-internal-secret'",
    ),
    true,
  );
  assertEquals(source.includes("JSON.stringify({ error: 'Unauthorized' })"), true);
  assertEquals(source.includes("status: 401"), true);
  assertEquals(source.includes("'Content-Type': 'application/json'"), true);
});

Deno.test("accepts either service-role bearer auth or internal function secret", async () => {
  const source = await readSource();

  assertEquals(source.includes("const providedSecret = req.headers.get('x-function-secret')"), true);
  assertEquals(source.includes("const auth = req.headers.get('authorization') ?? ''"), true);
  assertEquals(source.includes("const isServiceRole = auth === `Bearer ${supabaseServiceKey}`"), true);
  assertEquals(
    source.includes("if (!isServiceRole && (!internalSecret || providedSecret !== internalSecret))"),
    true,
  );
});

Deno.test("deduplicates active user ids from commercial, project lead, and CSM roles", async () => {
  const source = await readSource();

  assertEquals(source.includes(".select('commercial_id, chef_projet_id, csm_id')"), true);
  assertEquals(source.includes("const userIdSet = new Set<string>()"), true);
  assertEquals(source.includes("if (e.commercial_id) userIdSet.add(e.commercial_id)"), true);
  assertEquals(source.includes("if (e.chef_projet_id) userIdSet.add(e.chef_projet_id)"), true);
  assertEquals(source.includes("if (e.csm_id) userIdSet.add(e.csm_id)"), true);
  assertEquals(source.includes("const uniqueUserIds = Array.from(userIdSet)"), true);

  assertEquals(
    deduplicateUserIds([
      { commercial_id: "user-a", chef_projet_id: "user-b", csm_id: "user-c" },
      { commercial_id: "user-a", chef_projet_id: null, csm_id: "user-d" },
      { commercial_id: "", chef_projet_id: "user-b", csm_id: undefined },
    ]),
    ["user-a", "user-b", "user-c", "user-d"],
  );
});

Deno.test("builds business stats from the expected establishment statuses", async () => {
  const source = await readSource();

  assertEquals(source.includes("totalEtablissements: etablissements.length"), true);
  assertEquals(source.includes("e.statut === 'Prospect'"), true);
  assertEquals(source.includes("e.statut === 'En production'"), true);
  assertEquals(source.includes("e.statut === 'En déploiement'"), true);
  assertEquals(source.includes("e.statut === 'Pause commerciale'"), true);
  assertEquals(
    source.includes("etablissements.reduce((sum, e) => sum + (e.pourcentage_progression || 0), 0) / etablissements.length"),
    true,
  );

  assertEquals(
    buildStats([
      { statut: "Prospect", pourcentage_progression: 20 },
      { statut: "En production", pourcentage_progression: 100 },
      { statut: "En déploiement", pourcentage_progression: 60 },
      { statut: "Pause commerciale", pourcentage_progression: null },
      { statut: "Prospect" },
    ]),
    {
      totalEtablissements: 5,
      prospects: 2,
      enProduction: 1,
      enDeploiement: 1,
      pauseCommerciale: 1,
      progressionMoyenne: 36,
    },
  );
});

Deno.test("invokes analyze-rapports-insights with the expected monthly filter payload", async () => {
  const source = await readSource();

  assertEquals(source.includes("supabase.functions.invoke('analyze-rapports-insights'"), true);
  assertEquals(
    source.includes("filters: { periodPreset: 'month', includeProspects: true, productionOnly: false }"),
    true,
  );
  assertEquals(source.includes("analysis_type: analysisType"), true);
});

Deno.test("records success, skipped, and failed analysis outcomes", async () => {
  const source = await readSource();

  assertEquals(source.includes("success: [] as string[]"), true);
  assertEquals(source.includes("failed: [] as string[]"), true);
  assertEquals(source.includes("skipped: [] as string[]"), true);
  assertEquals(source.includes("results.success.push(`${userId}:${analysisType}`)"), true);
  assertEquals(source.includes("results.skipped.push(`${userId}:${analysisType}`)"), true);
  assertEquals(source.includes("results.failed.push(`${userId}:${analysisType}`)"), true);
});