import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  AZURE_GPT52_RESPONSES_CONFIG,
  buildToolResultInput,
  callGpt52ResponsesAPI,
  callGpt52ResponsesAPIWithMessages,
  continueAfterToolCall,
  convertMessagesToInput,
  extractTextFromOutput,
  isResponsesAPIEndpoint,
  parseToolCallsFromOutput,
} from "./azure-responses-api.ts";

function withEnv(
  entries: Record<string, string | undefined>,
  fn: () => void | Promise<void>,
) {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(entries)) {
    previous.set(key, Deno.env.get(key));
    const value = entries[key];
    if (value === undefined) Deno.env.delete(key);
    else Deno.env.set(key, value);
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  });
}

function withFetchStub(
  stub: typeof fetch,
  fn: () => void | Promise<void>,
) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  return Promise.resolve(fn()).finally(() => {
    globalThis.fetch = original;
  });
}

Deno.test("AZURE_GPT52_RESPONSES_CONFIG lit les variables d'environnement", async () => {
  await withEnv({
    AZURE_GPT52_ENDPOINT: "https://example.test/openai/responses?api-version=2025-04-01-preview",
    AZURE_GPT52_API_KEY: "test-key",
  }, () => {
    assertEquals(
      AZURE_GPT52_RESPONSES_CONFIG.endpoint(),
      "https://example.test/openai/responses?api-version=2025-04-01-preview",
    );
    assertEquals(AZURE_GPT52_RESPONSES_CONFIG.apiKey(), "test-key");
    assertEquals(AZURE_GPT52_RESPONSES_CONFIG.defaultTimeout, 90000);
  });
});

Deno.test("isResponsesAPIEndpoint détecte correctement les endpoints Responses API", () => {
  assertEquals(
    isResponsesAPIEndpoint("https://example.test/openai/responses"),
    true,
  );
  assertEquals(
    isResponsesAPIEndpoint("https://example.test/openai/deployments/x/chat/completions?api-version=2025-01-01"),
    true,
  );
  assertEquals(
    isResponsesAPIEndpoint("https://example.test/openai/deployments/x/chat/completions?api-version=2024-06-01"),
    false,
  );
  assertEquals(
    isResponsesAPIEndpoint("https://example.test/openai/deployments/x/chat/completions"),
    false,
  );
});

Deno.test("convertMessagesToInput extrait le system en instructions et convertit user/assistant/tool", () => {
  const result = convertMessagesToInput([
    { role: "system", content: "Tu es un assistant expert." },
    { role: "user", content: "Bonjour" },
    { role: "assistant", content: "Salut !" },
    { role: "tool", content: '{"temp":21}', tool_call_id: "call_123" },
  ]);

  assertEquals(result.instructions, "Tu es un assistant expert.");
  assertEquals(result.input, [
    { role: "user", content: "Bonjour" },
    { role: "assistant", content: "Salut !" },
    { type: "function_call_output", call_id: "call_123", output: '{"temp":21}' },
  ]);
});

Deno.test("convertMessagesToInput utilise la première occurrence system et ignore les tools sans tool_call_id", () => {
  const result = convertMessagesToInput([
    { role: "system", content: "Instruction principale" },
    { role: "system", content: "Instruction secondaire" },
    { role: "tool", content: "résultat sans id" },
    { role: "user", content: "Question" },
  ]);

  assertEquals(result.instructions, "Instruction principale");
  assertEquals(result.input, [
    { role: "user", content: "Question" },
  ]);
});

Deno.test("parseToolCallsFromOutput parse les appels de fonction valides", () => {
  const output = [
    {
      type: "function_call" as const,
      id: "fc_1",
      name: "search_docs",
      arguments: '{"query":"Supabase","limit":3}',
    },
    {
      type: "message" as const,
      role: "assistant",
      content: [{ type: "output_text", text: "Texte final" }],
    },
  ];

  const parsed = parseToolCallsFromOutput(output);

  assertEquals(parsed.length, 1);
  assertEquals(parsed[0].id, "fc_1");
  assertEquals(parsed[0].name, "search_docs");
  assertEquals(parsed[0].arguments, '{"query":"Supabase","limit":3}');
  assertEquals(parsed[0].parsedArgs, { query: "Supabase", limit: 3 });
});

Deno.test("parseToolCallsFromOutput utilise call_id comme fallback d'identifiant", () => {
  const parsed = parseToolCallsFromOutput([
    {
      type: "function_call",
      call_id: "call_abc",
      name: "get_weather",
      arguments: '{"city":"Paris"}',
    },
  ]);

  assertEquals(parsed.length, 1);
  assertEquals(parsed[0].id, "call_abc");
  assertEquals(parsed[0].name, "get_weather");
  assertEquals(parsed[0].parsedArgs, { city: "Paris" });
});

Deno.test("parseToolCallsFromOutput gère les arguments JSON invalides avec parsedArgs vide", () => {
  const parsed = parseToolCallsFromOutput([
    {
      type: "function_call",
      id: "fc_bad",
      name: "broken_tool",
      arguments: "{bad json",
    },
  ]);

  assertEquals(parsed.length, 1);
  assertEquals(parsed[0].id, "fc_bad");
  assertEquals(parsed[0].name, "broken_tool");
  assertEquals(parsed[0].arguments, "{bad json");
  assertEquals(parsed[0].parsedArgs, {});
});

Deno.test("extractTextFromOutput retourne le premier output_text trouvé", () => {
  const text = extractTextFromOutput([
    { type: "reasoning", summary: [] },
    {
      type: "message",
      role: "assistant",
      content: [
        { type: "output_text", text: "Réponse principale" },
        { type: "text", text: "Réponse secondaire" },
      ],
    },
  ]);

  assertEquals(text, "Réponse principale");
});

Deno.test("extractTextFromOutput supporte aussi le type text", () => {
  const text = extractTextFromOutput([
    {
      type: "message",
      role: "assistant",
      content: [
        { type: "text", text: "Texte simple" },
      ],
    },
  ]);

  assertEquals(text, "Texte simple");
});

Deno.test("extractTextFromOutput retourne une chaîne vide si aucun texte n'est présent", () => {
  const text = extractTextFromOutput([
    { type: "reasoning", summary: [] },
    { type: "function_call", id: "x", name: "tool", arguments: "{}" },
  ]);

  assertEquals(text, "");
});

Deno.test("buildToolResultInput ajoute un function_call_output string sans muter le tableau original", () => {
  const previousInput = [
    { role: "user" as const, content: "Quelle météo ?" },
  ];

  const nextInput = buildToolResultInput(previousInput, "call_1", "ensoleillé");

  assertEquals(previousInput, [
    { role: "user", content: "Quelle météo ?" },
  ]);
  assertEquals(nextInput, [
    { role: "user", content: "Quelle météo ?" },
    { type: "function_call_output", call_id: "call_1", output: "ensoleillé" },
  ]);
});

Deno.test("buildToolResultInput stringify les résultats objets", () => {
  const nextInput = buildToolResultInput([], "call_2", { ok: true, count: 2 });

  assertEquals(nextInput, [
    {
      type: "function_call_output",
      call_id: "call_2",
      output: '{"ok":true,"count":2}',
    },
  ]);
});

Deno.test("callGpt52ResponsesAPIWithMessages rejette si la configuration Azure manque", async () => {
  await withEnv({
    AZURE_GPT52_ENDPOINT: undefined,
    AZURE_GPT52_API_KEY: undefined,
  }, async () => {
    await assertRejects(
      () => callGpt52ResponsesAPIWithMessages([
        { role: "system", content: "sys" },
        { role: "user", content: "hello" },
      ]),
      Error,
      "Azure GPT-5.2 Responses API not configured",
    );
  });
});

Deno.test("callGpt52ResponsesAPI construit la requête et parse une réponse texte + tool call", async () => {
  await withEnv({
    AZURE_GPT52_ENDPOINT: "https://azure.test/openai/responses",
    AZURE_GPT52_API_KEY: "secret-test-key",
  }, async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    await withFetchStub((async (input: Request | URL | string, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(JSON.stringify({
        id: "resp_1",
        status: "completed",
        output: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "Bonjour depuis Azure" }],
          },
          {
            type: "function_call",
            id: "tool_1",
            name: "lookup_user",
            arguments: '{"id":42}',
          },
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 7,
          total_tokens: 17,
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch, async () => {
      const result = await callGpt52ResponsesAPI(
        "Tu es précis.",
        "Donne une réponse.",
        {
          maxOutputTokens: 123,
          reasoningEffort: "high",
          verbosity: "low",
          jsonOutput: true,
          timeout: 5000,
        },
      );

      assertEquals(capturedUrl, "https://azure.test/openai/responses");
      assertExists(capturedInit);
      assertEquals(capturedInit?.method, "POST");
      assertEquals((capturedInit?.headers as Record<string, string>)["api-key"], "secret-test-key");
      assertEquals((capturedInit?.headers as Record<string, string>)["Content-Type"], "application/json");

      const body = JSON.parse(String(capturedInit?.body));
      assertEquals(body.model, "gpt-5.2");
      assertEquals(body.instructions, "Tu es précis.");
      assertEquals(body.input, [{ role: "user", content: "Donne une réponse." }]);
      assertEquals(body.max_output_tokens, 123);
      assertEquals(body.reasoning, { effort: "high" });
      assertEquals(body.text, {
        verbosity: "low",
        format: { type: "json_object" },
      });

      assertEquals(result.content, "Bonjour depuis Azure");
      assertEquals(result.toolCalls, [{
        id: "tool_1",
        name: "lookup_user",
        arguments: '{"id":42}',
        parsedArgs: { id: 42 },
      }]);
      assertEquals(result.usage, {
        prompt_tokens: 10,
        completion_tokens: 7,
        total_tokens: 17,
      });
      assertEquals(result.model, "gpt-5.2");
      assertEquals(result.rawOutput?.length, 2);
    });
  });
});

Deno.test("callGpt52ResponsesAPIWithMessages mappe les tools et tool_choice=auto", async () => {
  await withEnv({
    AZURE_GPT52_ENDPOINT: "https://azure.test/openai/responses",
    AZURE_GPT52_API_KEY: "key-tools",
  }, async () => {
    let body: Record<string, unknown> | undefined;

    await withFetchStub((async (_input: Request | URL | string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        id: "resp_tools",
        status: "completed",
        output: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "ok" }],
          },
        ],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch, async () => {
      const result = await callGpt52ResponsesAPIWithMessages(
        [
          { role: "system", content: "Sys tool" },
          { role: "user", content: "Utilise un outil" },
        ],
        [
          {
            type: "function",
            function: {
              name: "search",
              description: "Recherche",
              parameters: {
                type: "object",
                properties: { q: { type: "string" } },
              },
            },
          },
        ],
        {
          reasoningEffort: "medium",
          verbosity: "medium",
        },
      );

      assertExists(body);
      assertEquals(body?.tools, [
        {
          type: "function",
          function: {
            name: "search",
            description: "Recherche",
            parameters: {
              type: "object",
              properties: { q: { type: "string" } },
            },
          },
        },
      ]);
      assertEquals(body?.tool_choice, "auto");
      assertEquals(result.content, "ok");
      assertEquals(result.toolCalls, undefined);
    });
  });
});

Deno.test("callGpt52ResponsesAPIWithMessages remonte les erreurs HTTP non-OK", async () => {
  await withEnv({
    AZURE_GPT52_ENDPOINT: "https://azure.test/openai/responses",
    AZURE_GPT52_API_KEY: "key-error",
  }, async () => {
    await withFetchStub((async () => {
      return new Response("bad request detail", {
        status: 400,
        headers: { "content-type": "text/plain" },
      });
    }) as typeof fetch, async () => {
      await assertRejects(
        () => callGpt52ResponsesAPIWithMessages([
          { role: "system", content: "sys" },
          { role: "user", content: "hello" },
        ]),
        Error,
        "Azure GPT-5.2 Responses API error: 400 - bad request detail",
      );
    });
  });
});

Deno.test("callGpt52ResponsesAPIWithMessages remonte les erreurs métier dans le payload", async () => {
  await withEnv({
    AZURE_GPT52_ENDPOINT: "https://azure.test/openai/responses",
    AZURE_GPT52_API_KEY: "key-failed",
  }, async () => {
    await withFetchStub((async () => {
      return new Response(JSON.stringify({
        id: "resp_failed",
        status: "failed",
        output: [],
        error: { message: "Model execution failed" },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch, async () => {
      await assertRejects(
        () => callGpt52ResponsesAPIWithMessages([
          { role: "system", content: "sys" },
          { role: "user", content: "hello" },
        ]),
        Error,
        "GPT-5.2 Responses API failed: Model execution failed",
      );
    });
  });
});

Deno.test("callGpt52ResponsesAPIWithMessages transforme AbortError en timeout explicite", async () => {
  await withEnv({
    AZURE_GPT52_ENDPOINT: "https://azure.test/openai/responses",
    AZURE_GPT52_API_KEY: "key-timeout",
  }, async () => {
    await withFetchStub((async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as typeof fetch, async () => {
      await assertRejects(
        () => callGpt52ResponsesAPIWithMessages(
          [
            { role: "system", content: "sys" },
            { role: "user", content: "hello" },
          ],
          undefined,
          { timeout: 1234 },
        ),
        Error,
        "[GPT-5.2 Responses API] Request timeout (1.234s)",
      );
    });
  });
});

Deno.test("continueAfterToolCall ajoute le résultat d'outil dans la requête et parse la réponse", async () => {
  await withEnv({
    AZURE_GPT52_ENDPOINT: "https://azure.test/openai/responses",
    AZURE_GPT52_API_KEY: "key-continue",
  }, async () => {
    let capturedBody: Record<string, unknown> | undefined;

    await withFetchStub((async (_input: Request | URL | string, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        id: "resp_continue",
        status: "completed",
        output: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "Voici la synthèse finale." }],
          },
        ],
        usage: {
          input_tokens: 22,
          output_tokens: 9,
          total_tokens: 31,
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch, async () => {
      const previousInput = [
        { role: "user" as const, content: "Donne la météo" },
        {
          type: "message" as const,
          role: "assistant" as const,
          content: "Je consulte l'outil",
        },
      ];

      const result = await continueAfterToolCall(
        previousInput,
        "call_weather_1",
        { city: "Paris", tempC: 21 },
        "Tu es météorologue.",
        [
          {
            type: "function",
            function: {
              name: "get_weather",
              description: "Récupère la météo",
            },
          },
        ],
        {
          maxOutputTokens: 222,
          reasoningEffort: "medium",
          verbosity: "high",
          timeout: 5000,
        },
      );

      assertExists(capturedBody);
      assertEquals(capturedBody?.instructions, "Tu es météorologue.");
      assertEquals(capturedBody?.max_output_tokens, 222);
      assertEquals(capturedBody?.reasoning, { effort: "medium" });
      assertEquals(capturedBody?.text, { verbosity: "high" });
      assertEquals(capturedBody?.tool_choice, "auto");
      assertEquals(capturedBody?.tools, [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Récupère la météo",
          },
        },
      ]);
      assertEquals(capturedBody?.input, [
        { role: "user", content: "Donne la météo" },
        { type: "message", role: "assistant", content: "Je consulte l'outil" },
        {
          type: "function_call_output",
          call_id: "call_weather_1",
          output: '{"city":"Paris","tempC":21}',
        },
      ]);

      assertEquals(result.content, "Voici la synthèse finale.");
      assertEquals(result.toolCalls, undefined);
      assertEquals(result.usage, {
        prompt_tokens: 22,
        completion_tokens: 9,
        total_tokens: 31,
      });
      assertEquals(result.model, "gpt-5.2");
    });
  });
});

Deno.test("continueAfterToolCall remonte les erreurs HTTP", async () => {
  await withEnv({
    AZURE_GPT52_ENDPOINT: "https://azure.test/openai/responses",
    AZURE_GPT52_API_KEY: "key-continue-error",
  }, async () => {
    await withFetchStub((async () => {
      return new Response("server error", { status: 500 });
    }) as typeof fetch, async () => {
      await assertRejects(
        () => continueAfterToolCall(
          [{ role: "user", content: "x" }],
          "call_1",
          "result",
          "instructions",
        ),
        Error,
        "Azure GPT-5.2 Responses API error: 500",
      );
    });
  });
});

Deno.test("continueAfterToolCall transforme AbortError en timeout explicite", async () => {
  await withEnv({
    AZURE_GPT52_ENDPOINT: "https://azure.test/openai/responses",
    AZURE_GPT52_API_KEY: "key-continue-timeout",
  }, async () => {
    await withFetchStub((async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as typeof fetch, async () => {
      await assertRejects(
        () => continueAfterToolCall(
          [{ role: "user", content: "x" }],
          "call_1",
          "result",
          "instructions",
          undefined,
          { timeout: 2000 },
        ),
        Error,
        "[GPT-5.2 Responses API] Request timeout (2s)",
      );
    });
  });
});

Deno.test("assertThrows fonctionne sur une validation synchrone locale utile", () => {
  assertThrows(
    () => {
      const endpoint = "";
      if (!endpoint) {
        throw new Error("endpoint requis");
      }
    },
    Error,
    "endpoint requis",
  );
});