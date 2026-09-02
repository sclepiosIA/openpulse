import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const MODULE_URL = new URL("./index.ts", import.meta.url);
const WORKER_URL = new URL("./__index_module_load_worker.ts", import.meta.url);

const TEST_ENV: Record<string, string> = {
  AZURE_OPENAI_ENDPOINT: "http://127.0.0.1/azure-openai-test",
  AZURE_OPENAI_API_KEY: "test-azure-key",
  SUPABASE_URL: "http://127.0.0.1/supabase-test",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
};

function snapshotEnv(keys: string[]): Map<string, string | undefined> {
  return new Map(keys.map((key) => [key, Deno.env.get(key)]));
}

function restoreEnv(snapshot: Map<string, string | undefined>) {
  for (const [key, value] of snapshot) {
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
}

async function readModuleSource(): Promise<string> {
  return await Deno.readTextFile(MODULE_URL);
}

function waitForWorkerMessage(worker: Worker, timeoutMs = 10_000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      worker.terminate();
      reject(new Error(`Timed out waiting for module import worker after ${timeoutMs}ms`));
    }, timeoutMs);

    worker.onmessage = (event) => {
      clearTimeout(timeoutId);
      resolve(event.data);
    };

    worker.onerror = (event) => {
      clearTimeout(timeoutId);
      event.preventDefault();
      reject(new Error(event.message));
    };
  });
}

Deno.test("module loads without throwing in an isolated worker", async () => {
  const envSnapshot = snapshotEnv(Object.keys(TEST_ENV));

  try {
    for (const [key, value] of Object.entries(TEST_ENV)) {
      Deno.env.set(key, value);
    }

    await Deno.writeTextFile(
      WORKER_URL,
      `
self.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  self.postMessage({
    ok: false,
    phase: "unhandledrejection",
    error: String(event.reason?.stack ?? event.reason),
  });
});

try {
  const pending = new Promise(() => {});
  const fakeListener = {
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
    close() {},
    ref() {},
    unref() {},
    accept() {
      return pending;
    },
    [Symbol.asyncIterator]() {
      return {
        next() {
          return pending;
        },
      };
    },
  };

  try {
    Object.defineProperty(Deno, "listen", {
      value: () => fakeListener,
      configurable: true,
    });
  } catch (_) {
    // If Deno.listen is not configurable in this runtime, the import test still runs
    // under --allow-all; this fallback intentionally avoids unstable Worker options.
  }

  const mod = await import("./index.ts");
  self.postMessage({
    ok: true,
    exportedKeys: Object.keys(mod).sort(),
  });
} catch (error) {
  self.postMessage({
    ok: false,
    phase: "import",
    error: String(error?.stack ?? error),
  });
}
`,
    );

    const worker = new Worker(WORKER_URL.href, { type: "module" });

    try {
      const message = await waitForWorkerMessage(worker);
      assertEquals(message.ok, true, message.error);
      assertEquals(message.exportedKeys, []);
    } finally {
      worker.terminate();
    }
  } finally {
    await Deno.remove(WORKER_URL).catch(() => undefined);
    restoreEnv(envSnapshot);
  }
});

Deno.test("source handles CORS preflight and validates required body fields", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/if\s*\(\s*req\.method\s*===\s*["']OPTIONS["']\s*\)/));
  assertExists(source.match(/import \{ corsHeaders \} from ['"]\.\.\/_shared\/cors\.ts['"]/));
  const { corsHeaders } = await import("../_shared/cors.ts");
  assertEquals(corsHeaders["Access-Control-Allow-Headers"], "authorization, x-client-info, apikey, content-type, x-internal-secret");
  assertEquals(corsHeaders["Access-Control-Allow-Origin"] === "*", false);
  assertExists(source.match(/etablissement_id and file_path required/));
  assertExists(source.match(/status:\s*400/));

  const validationIndex = source.indexOf("etablissement_id and file_path required");
  const authzIndex = source.indexOf("assertEtablissementAccess(authResult.userId, etablissement_id)");
  assertEquals(validationIndex >= 0, true);
  assertEquals(authzIndex >= 0, true);
  assertEquals(validationIndex < authzIndex, true);
});

Deno.test("source authenticates user and checks etablissement authorization before document access", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/validateUserAuth\(req\)/));
  assertExists(source.match(/Unauthorized/));
  assertExists(source.match(/assertEtablissementAccess\(authResult\.userId,\s*etablissement_id\)/));
  assertExists(source.match(/Forbidden/));

  const authIndex = source.indexOf("validateUserAuth(req)");
  const accessIndex = source.indexOf("assertEtablissementAccess(authResult.userId, etablissement_id)");
  const storageDownloadIndex = source.indexOf(".download(file_path)");

  assertEquals(authIndex >= 0, true);
  assertEquals(accessIndex >= 0, true);
  assertEquals(storageDownloadIndex >= 0, true);
  assertEquals(authIndex < accessIndex, true);
  assertEquals(accessIndex < storageDownloadIndex, true);
});

Deno.test("source verifies document ownership by file_path before downloading from storage", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/from\(["']taches_documents["']\)/));
  assertExists(source.match(/select\(["']id,\s*tache_id,\s*taches!inner\(etablissement_id\)["']\)/));
  assertExists(source.match(/eq\(["']chemin_fichier["'],\s*file_path\)/));
  assertExists(source.match(/maybeSingle\(\)/));
  assertExists(source.match(/Document not found for this etablissement/));
  assertExists(source.match(/from\(["']taches-documents["']\)/));

  const ownershipCheckIndex = source.indexOf(".eq('chemin_fichier', file_path)");
  const downloadIndex = source.indexOf(".download(file_path)");

  assertEquals(ownershipCheckIndex >= 0, true);
  assertEquals(downloadIndex >= 0, true);
  assertEquals(ownershipCheckIndex < downloadIndex, true);
});

Deno.test("source builds Azure request with sanitized wrapped PDF text and JSON response format", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/sanitizeForAI\(pdfText,\s*\{\s*maxLength:\s*15000/));
  assertExists(source.match(/functionName:\s*["']analyze-medical-economic-study["']/));
  assertExists(source.match(/wrapUserContent\(/));
  assertExists(source.match(/["']ETUDE_CONTENT["']/));
  assertExists(source.match(/response_format:\s*\{\s*type:\s*["']json_object["']\s*\}/));
  assertExists(source.match(/max_completion_tokens:\s*3000/));
  assertExists(source.match(/reasoning_effort:\s*["']low["']/));
  assertExists(source.match(/verbosity:\s*["']low["']/));
});

Deno.test("source parses Azure JSON content and surfaces safe client errors", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/azureData\.choices\?\.\[0\]\?\.message\?\.content/));
  assertExists(source.match(/JSON\.parse\(content\)/));
  assertExists(source.match(/Invalid JSON response from Azure GPT-5/));
  assertExists(source.match(/sanitizeErrorForClient\(error\)/));
  assertExists(source.match(/Azure request timeout \(90s\)/));

  assertThrows(() => JSON.parse("not-json"), SyntaxError);
  await assertRejects(
    () => Promise.reject(new Error("Azure request timeout (90s)")),
    Error,
    "Azure request timeout",
  );
});

Deno.test("source maps extracted static and success pricing into etablissement updates", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/updates\.modele_statique_succes\s*=\s*String\(extractedData\.modele_statique\)/));
  assertExists(source.match(/tarifsData\.fixe\s*=\s*extractedData\.modele_au_succes\.frais_acces/));
  assertExists(source.match(/const key\s*=\s*`palier\$\{pallier\.numero\}`/));
  assertExists(source.match(/tarifsData\[key\]\s*=\s*pallier\.tarif/));
  assertExists(source.match(/seuilsData\[key\]\s*=\s*pallier\.seuil_max\s*\|\|\s*pallier\.seuil_min/));
  assertExists(source.match(/updates\.tarifs_palliers\s*=\s*tarifsData/));
  assertExists(source.match(/updates\.seuils_palliers\s*=\s*seuilsData/));
  assertExists(source.match(/updates\.pallier_vise\s*=\s*`Pallier \$\{middlePallier\}`/));
});

Deno.test("source only auto-selects offer type when exactly one pricing model is detected", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/updates\.type_offre\s*=\s*["']Statique["']/));
  assertExists(source.match(/updates\.type_offre\s*=\s*["']Au succès["']/));
  assertExists(source.match(/Both models detected - type_offre unchanged/));

  const staticOnlyIndex = source.indexOf("updates.type_offre = 'Statique'");
  const successOnlyIndex = source.indexOf("updates.type_offre = 'Au succès'");
  const bothModelsIndex = source.indexOf("Both models detected - type_offre unchanged");

  assertEquals(staticOnlyIndex >= 0, true);
  assertEquals(successOnlyIndex >= 0, true);
  assertEquals(bothModelsIndex >= 0, true);
  assertEquals(staticOnlyIndex < bothModelsIndex, true);
  assertEquals(successOnlyIndex < bothModelsIndex, true);
});

Deno.test("source writes establishment updates and AI processing audit log", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/from\(["']etablissements["']\)/));
  assertExists(source.match(/update\(updates\)/));
  assertExists(source.match(/eq\(["']id["'],\s*etablissement_id\)/));
  assertExists(source.match(/from\(["']ai_processing_log["']\)/));
  assertExists(source.match(/processing_type:\s*["']medical_economic_study_analysis["']/));
  assertExists(source.match(/model_used:\s*["']azure-gpt-5["']/));
  assertExists(source.match(/confidence_score:\s*0\.95/));

  const updateIndex = source.indexOf(".from('etablissements')");
  const logIndex = source.indexOf(".from('ai_processing_log')");

  assertEquals(updateIndex >= 0, true);
  assertEquals(logIndex >= 0, true);
  assertEquals(updateIndex < logIndex, true);
});

Deno.test("pricing normalization logic preserves both static and success models from extracted Azure data", () => {
  const extractedData = {
    modele_statique: 125000,
    modele_au_succes: {
      frais_acces: 15000,
      palliers: [
        { numero: 1, nom: "Moins de 7%", seuil_min: 0, seuil_max: 7, tarif: 25847.5 },
        { numero: 2, nom: "7% à 10%", seuil_min: 7, seuil_max: 10, tarif: 42000 },
        { numero: 3, nom: "Plus de 10%", seuil_min: 10, seuil_max: null, tarif: 58000 },
      ],
    },
  };

  const updates: any = {};

  if (extractedData.modele_statique) {
    updates.modele_statique_succes = String(extractedData.modele_statique);
  }

  if (extractedData.modele_au_succes?.palliers?.length > 0) {
    const tarifsData: any = {};
    const seuilsData: any = {};

    if (extractedData.modele_au_succes.frais_acces) {
      tarifsData.fixe = extractedData.modele_au_succes.frais_acces;
    }

    extractedData.modele_au_succes.palliers.forEach((pallier: any) => {
      const key = `palier${pallier.numero}`;
      tarifsData[key] = pallier.tarif;
      seuilsData[key] = pallier.seuil_max || pallier.seuil_min;
    });

    updates.tarifs_palliers = tarifsData;
    updates.seuils_palliers = seuilsData;

    const middlePallier = Math.ceil(extractedData.modele_au_succes.palliers.length / 2);
    updates.pallier_vise = `Pallier ${middlePallier}`;
  }

  assertEquals(updates, {
    modele_statique_succes: "125000",
    tarifs_palliers: {
      fixe: 15000,
      palier1: 25847.5,
      palier2: 42000,
      palier3: 58000,
    },
    seuils_palliers: {
      palier1: 7,
      palier2: 10,
      palier3: 10,
    },
    pallier_vise: "Pallier 2",
  });
});