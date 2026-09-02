import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeAnalyzeWithAI,
  executeExtractData,
  executeSummarizeContent,
} from "./document-ai-tools.ts";

const AZURE_KEYS = ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY"] as const;

function snapshotEnv(): Record<string, string | undefined> {
  return Object.fromEntries(AZURE_KEYS.map((key) => [key, Deno.env.get(key)]));
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
}

function setAzureEnv(): void {
  Deno.env.set(
    "AZURE_OPENAI_ENDPOINT",
    "https://azure.test/openai/deployments/gpt-5/chat/completions?api-version=preview",
  );
  Deno.env.set("AZURE_OPENAI_API_KEY", "test-api-key");
}

function installFetchStub(
  stub: (input: string | URL | Request, init?: RequestInit) => Promise<Response> | Response,
): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stub as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function azureJsonResponse(content: string, status = 200): Response {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content,
          },
        },
      ],
    }),
    {
      status,
      headers: {
        "content-type": "application/json",
      },
    },
  );
}

function testCtx() {
  return {
    supabase: {},
    userId: "user-test-123",
  } as any;
}

Deno.test("executeSummarizeContent returns a validation error for content shorter than 50 characters", async () => {
  let fetchCalled = false;
  const restoreFetch = installFetchStub(() => {
    fetchCalled = true;
    return azureJsonResponse("ne devrait pas être appelé");
  });

  try {
    const result = await executeSummarizeContent(testCtx(), {
      content: "Contenu trop court.",
    });

    assertEquals(result.success, false);
    assertEquals(
      result.error,
      "Le contenu est trop court pour être synthétisé (minimum 50 caractères)",
    );
    assertEquals(fetchCalled, false);
    assertExists(result.execution_time_ms);
  } finally {
    restoreFetch();
  }
});

Deno.test("executeSummarizeContent builds the Azure GPT request and returns summary metadata", async () => {
  const envSnapshot = snapshotEnv();
  setAzureEnv();

  let capturedInput: string | URL | Request | undefined;
  let capturedInit: RequestInit | undefined;

  const restoreFetch = installFetchStub((input, init) => {
    capturedInput = input;
    capturedInit = init;
    return azureJsonResponse("Résumé synthétique structuré en trois points clés.");
  });

  try {
    const content = "Ce document décrit la stratégie commerciale, les objectifs trimestriels, les risques opérationnels et les actions attendues par les équipes. ".repeat(
      90,
    );

    const result = await executeSummarizeContent(testCtx(), {
      content,
      content_type: "document",
      format: "structured",
      max_length: 120,
      language: "espagnol",
    });

    assertEquals(result.success, true);
    assertExists(result.data);

    const data = result.data as any;
    assertEquals(data.summary, "Résumé synthétique structuré en trois points clés.");
    assertEquals(data.content_type, "document");
    assertEquals(data.format, "structured");
    assertEquals(data.original_length, content.length);
    assertEquals(data.summary_length, "Résumé synthétique structuré en trois points clés.".length);

    assertEquals(
      capturedInput,
      "https://azure.test/openai/deployments/gpt-5/chat/completions?api-version=preview",
    );
    assertEquals(capturedInit?.method, "POST");
    assertEquals((capturedInit?.headers as Record<string, string>)["Content-Type"], "application/json");
    assertEquals((capturedInit?.headers as Record<string, string>)["api-key"], "test-api-key");

    const body = JSON.parse(String(capturedInit?.body));
    assertEquals(body.max_completion_tokens, 1500);
    assertEquals(body.reasoning_effort, "low");
    assertEquals(body.verbosity, "low");
    assertEquals(body.messages[0].role, "system");
    assertEquals(body.messages[1].role, "user");
    assertEquals(body.messages[0].content.includes("Ce contenu est un document"), true);
    assertEquals(body.messages[0].content.includes("Structure avec des sections"), true);
    assertEquals(body.messages[0].content.includes("environ 120 mots"), true);
    assertEquals(body.messages[0].content.includes("Réponds en espagnol"), true);
    assertEquals(body.messages[1].content.startsWith("Synthétise le contenu suivant:"), true);
    assertEquals(body.messages[1].content.length, "Synthétise le contenu suivant:\n\n".length + 10000);
  } finally {
    restoreFetch();
    restoreEnv(envSnapshot);
  }
});

Deno.test("executeAnalyzeWithAI returns validation error when content is insufficient", async () => {
  let fetchCalled = false;
  const restoreFetch = installFetchStub(() => {
    fetchCalled = true;
    return azureJsonResponse("ne devrait pas être appelé");
  });

  try {
    const result = await executeAnalyzeWithAI(testCtx(), {
      content: "Trop court",
      analysis_type: "sentiment",
    });

    assertEquals(result.success, false);
    assertEquals(result.error, "Contenu insuffisant pour l'analyse");
    assertEquals(fetchCalled, false);
    assertExists(result.execution_time_ms);
  } finally {
    restoreFetch();
  }
});

Deno.test("executeAnalyzeWithAI requests JSON output and parses valid JSON analysis", async () => {
  const envSnapshot = snapshotEnv();
  setAzureEnv();

  let capturedBody: any;

  const restoreFetch = installFetchStub((_input, init) => {
    capturedBody = JSON.parse(String(init?.body));
    return azureJsonResponse(
      JSON.stringify({
        sentiment: "positif",
        score: 0.82,
        reasons: ["Le texte mentionne une opportunité et une progression claire."],
      }),
    );
  });

  try {
    const content = "Le client confirme son intérêt pour l'offre premium. Il souhaite avancer rapidement, planifier une démonstration et valider les conditions commerciales cette semaine.";

    const result = await executeAnalyzeWithAI(testCtx(), {
      content,
      analysis_type: "sentiment",
      output_format: "json",
    });

    assertEquals(result.success, true);
    assertExists(result.data);

    const data = result.data as any;
    assertEquals(data.analysis_type, "sentiment");
    assertEquals(data.output_format, "json");
    assertEquals(data.analysis, {
      sentiment: "positif",
      score: 0.82,
      reasons: ["Le texte mentionne une opportunité et une progression claire."],
    });

    assertEquals(capturedBody.response_format, { type: "json_object" });
    assertEquals(capturedBody.max_completion_tokens, 1500);
    assertEquals(capturedBody.messages[0].content.includes("Analyse le sentiment général"), true);
    assertEquals(capturedBody.messages[0].content.includes("Retourne ta réponse en JSON valide."), true);
    assertEquals(capturedBody.messages[1].content.includes(content), true);
  } finally {
    restoreFetch();
    restoreEnv(envSnapshot);
  }
});

Deno.test("executeAnalyzeWithAI wraps invalid JSON output in raw field", async () => {
  const envSnapshot = snapshotEnv();
  setAzureEnv();

  const restoreFetch = installFetchStub(() => azureJsonResponse("analyse non json"));

  try {
    const result = await executeAnalyzeWithAI(testCtx(), {
      content: "Le compte rendu contient plusieurs tâches à réaliser, notamment relancer le fournisseur, confirmer le budget et préparer le planning.",
      analysis_type: "action_items",
      output_format: "json",
    });

    assertEquals(result.success, true);
    assertExists(result.data);

    const data = result.data as any;
    assertEquals(data.analysis, { raw: "analyse non json" });
    assertEquals(data.analysis_type, "action_items");
    assertEquals(data.output_format, "json");
  } finally {
    restoreFetch();
    restoreEnv(envSnapshot);
  }
});

Deno.test("executeAnalyzeWithAI uses the custom prompt when analysis_type is custom", async () => {
  const envSnapshot = snapshotEnv();
  setAzureEnv();

  let capturedBody: any;

  const restoreFetch = installFetchStub((_input, init) => {
    capturedBody = JSON.parse(String(init?.body));
    return azureJsonResponse("Analyse personnalisée terminée.");
  });

  try {
    const customPrompt = "Évalue la criticité opérationnelle et propose une priorité P1, P2 ou P3.";

    const result = await executeAnalyzeWithAI(testCtx(), {
      content: "Le serveur de production présente des latences élevées depuis deux heures et plusieurs utilisateurs signalent des erreurs intermittentes.",
      analysis_type: "custom",
      custom_prompt: customPrompt,
      output_format: "text",
    });

    assertEquals(result.success, true);
    assertEquals((result.data as any).analysis, "Analyse personnalisée terminée.");
    assertEquals(capturedBody.messages[0].content.includes(customPrompt), true);
    assertEquals(capturedBody.messages[0].content.includes("Réponds de manière claire et structurée."), true);
  } finally {
    restoreFetch();
    restoreEnv(envSnapshot);
  }
});

Deno.test("executeExtractData validates required content and schema before calling GPT", async () => {
  let fetchCalls = 0;
  const restoreFetch = installFetchStub(() => {
    fetchCalls += 1;
    return azureJsonResponse("ne devrait pas être appelé");
  });

  try {
    const noContent = await executeExtractData(testCtx(), {
      content: "",
      extraction_schema: {
        fields: [
          {
            name: "client",
            type: "string",
            description: "Nom du client",
            required: true,
          },
        ],
      },
    });

    assertEquals(noContent.success, false);
    assertEquals(noContent.error, "Contenu requis");

    const noSchema = await executeExtractData(testCtx(), {
      content: "Facture INV-2024-001 pour le client ACME, montant total 1200 euros.",
      extraction_schema: {
        fields: [],
      },
    });

    assertEquals(noSchema.success, false);
    assertEquals(noSchema.error, "Schéma d'extraction requis avec au moins un champ");
    assertEquals(fetchCalls, 0);
  } finally {
    restoreFetch();
  }
});

Deno.test("executeExtractData extracts structured JSON and reports missing required fields", async () => {
  const envSnapshot = snapshotEnv();
  setAzureEnv();

  let capturedBody: any;

  const restoreFetch = installFetchStub((_input, init) => {
    capturedBody = JSON.parse(String(init?.body));
    return azureJsonResponse(
      JSON.stringify({
        invoice_number: "INV-2024-042",
        total: null,
        paid: true,
      }),
    );
  });

  try {
    const result = await executeExtractData(testCtx(), {
      content: "Facture INV-2024-042 émise pour ACME. La facture est déjà payée, mais le montant total n'est pas lisible sur le document.",
      strict_mode: true,
      extraction_schema: {
        fields: [
          {
            name: "invoice_number",
            type: "string",
            description: "Numéro de facture",
            required: true,
          },
          {
            name: "total",
            type: "number",
            description: "Montant total de la facture",
            required: true,
          },
          {
            name: "paid",
            type: "boolean",
            description: "Indique si la facture est payée",
          },
        ],
      },
    });

    assertEquals(result.success, true);
    assertExists(result.data);

    const data = result.data as any;
    assertEquals(data.extracted, {
      invoice_number: "INV-2024-042",
      total: null,
      paid: true,
    });
    assertEquals(data.fields_found, 2);
    assertEquals(data.total_fields, 3);
    assertEquals(data.missing_required, ["total"]);

    assertEquals(capturedBody.response_format, { type: "json_object" });
    assertEquals(capturedBody.max_completion_tokens, 2000);
    assertEquals(capturedBody.messages[0].content.includes("Mode strict"), true);
    assertEquals(capturedBody.messages[0].content.includes("- invoice_number (string, requis): Numéro de facture"), true);
    assertEquals(capturedBody.messages[0].content.includes("- total (number, requis): Montant total de la facture"), true);
    assertEquals(capturedBody.messages[0].content.includes("- paid (boolean): Indique si la facture est payée"), true);
  } finally {
    restoreFetch();
    restoreEnv(envSnapshot);
  }
});

Deno.test("executeExtractData returns parsing error when GPT output is not valid JSON", async () => {
  const envSnapshot = snapshotEnv();
  setAzureEnv();

  const restoreFetch = installFetchStub(() => azureJsonResponse("ceci n'est pas un objet json"));

  try {
    const result = await executeExtractData(testCtx(), {
      content: "Contrat signé avec la société ACME le 12 janvier 2024 pour une durée de douze mois.",
      extraction_schema: {
        fields: [
          {
            name: "company",
            type: "string",
            description: "Nom de la société contractante",
            required: true,
          },
        ],
      },
    });

    assertEquals(result.success, false);
    assertEquals(result.error, "Impossible de parser les données extraites");
    assertExists(result.execution_time_ms);
  } finally {
    restoreFetch();
    restoreEnv(envSnapshot);
  }
});

Deno.test("GPT-backed tools return configuration errors without performing network calls", async () => {
  const envSnapshot = snapshotEnv();
  Deno.env.delete("AZURE_OPENAI_ENDPOINT");
  Deno.env.delete("AZURE_OPENAI_API_KEY");

  let fetchCalled = false;
  const restoreFetch = installFetchStub(() => {
    fetchCalled = true;
    return azureJsonResponse("ne devrait pas être appelé");
  });

  try {
    const result = await executeAnalyzeWithAI(testCtx(), {
      content: "Ce texte est suffisamment long pour déclencher une analyse par le modèle, mais la configuration Azure est absente.",
      analysis_type: "risks",
    });

    assertEquals(result.success, false);
    assertEquals(result.error, "Azure GPT-5 non configuré");
    assertEquals(fetchCalled, false);
  } finally {
    restoreFetch();
    restoreEnv(envSnapshot);
  }
});

Deno.test("GPT-backed tools surface non-OK Azure responses as tool errors", async () => {
  const envSnapshot = snapshotEnv();
  setAzureEnv();

  const restoreFetch = installFetchStub(() =>
    new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: {
        "content-type": "application/json",
      },
    })
  );

  try {
    const result = await executeSummarizeContent(testCtx(), {
      content: "Ce contenu est assez long pour être synthétisé. Il décrit une situation commerciale, des décisions prises, des points de blocage et plusieurs actions de suivi nécessaires.",
    });

    assertEquals(result.success, false);
    assertEquals(result.error, "GPT-5 API error: 500");
  } finally {
    restoreFetch();
    restoreEnv(envSnapshot);
  }
});

Deno.test("assert helpers imported from std are available for offline test failures", async () => {
  assertThrows(() => {
    throw new Error("offline guard");
  }, Error, "offline guard");

  await assertRejects(async () => {
    throw new Error("offline rejection");
  }, Error, "offline rejection");
});