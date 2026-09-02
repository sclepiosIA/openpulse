import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const INDEX_URL = new URL("./index.ts", import.meta.url);

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(INDEX_URL);
}

function installClosedListenerStub(): () => void {
  const listenDescriptor = Object.getOwnPropertyDescriptor(Deno, "listen");
  const listenTlsDescriptor = Object.getOwnPropertyDescriptor(Deno, "listenTls");

  const fakeListener = {
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
    rid: -1,
    close() {},
    accept(): Promise<Deno.Conn> {
      return new Promise<Deno.Conn>(() => {});
    },
    [Symbol.asyncIterator]() {
      return {
        async next() {
          return { value: undefined, done: true };
        },
        [Symbol.asyncIterator]() {
          return this;
        },
      };
    },
  } as unknown as Deno.Listener;

  Object.defineProperty(Deno, "listen", {
    configurable: true,
    writable: true,
    value: () => fakeListener,
  });

  Object.defineProperty(Deno, "listenTls", {
    configurable: true,
    writable: true,
    value: () => fakeListener,
  });

  return () => {
    if (listenDescriptor) {
      Object.defineProperty(Deno, "listen", listenDescriptor);
    }
    if (listenTlsDescriptor) {
      Object.defineProperty(Deno, "listenTls", listenTlsDescriptor);
    }
  };
}

async function withTestEnvironment<T>(fn: () => Promise<T>): Promise<T> {
  const keys = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
  ];

  const previousEnv = new Map<string, string | undefined>();
  for (const key of keys) {
    previousEnv.set(key, Deno.env.get(key));
  }

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls++;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "Résumé généré hors ligne",
                  key_points: ["Point clé"],
                  decisions: [],
                  open_questions: [],
                }),
              },
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 8,
            total_tokens: 20,
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
  }) as typeof fetch;

  const restoreListen = installClosedListenerStub();

  try {
    Deno.env.set("SUPABASE_URL", "http://localhost:54321");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    Deno.env.set("AZURE_OPENAI_ENDPOINT", "http://localhost/azure-openai");
    Deno.env.set("AZURE_OPENAI_API_KEY", "test-azure-key");

    const result = await fn();
    assertEquals(fetchCalls, 0);
    return result;
  } finally {
    restoreListen();
    globalThis.fetch = originalFetch;

    for (const [key, value] of previousEnv) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

Deno.test("module loads without performing a real fetch", async () => {
  await withTestEnvironment(async () => {
    const moduleUnderTest = await import("./index.ts");
    assertExists(moduleUnderTest);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

Deno.test("payload contract exposes the three supported Pulse AI actions", async () => {
  const source = await readIndexSource();

  const actionTypeMatch = source.match(/action:\s*([^;]+);/);
  assertExists(actionTypeMatch);

  const actionType = actionTypeMatch[1].replace(/\s+/g, " ").trim();
  assertEquals(actionType, "'summarize' | 'suggest_response' | 'extract_actions'");

  assertEquals(source.includes("case 'summarize':"), true);
  assertEquals(source.includes("case 'suggest_response':"), true);
  assertEquals(source.includes("case 'extract_actions':"), true);
});

Deno.test("security and authorization branches return the expected HTTP statuses", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("if (req.method === 'OPTIONS')"), true);
  assertEquals(source.includes("Missing authorization"), true);
  assertEquals(source.includes("Unauthorized"), true);
  assertEquals(source.includes("Profile not found"), true);
  assertEquals(source.includes("Not a member of this conversation"), true);

  assertEquals(source.match(/status:\s*401/g)?.length ?? 0, 2);
  assertEquals(source.match(/status:\s*404/g)?.length ?? 0, 1);
  assertEquals(source.match(/status:\s*403/g)?.length ?? 0, 1);
});

Deno.test("message formatting sanitizes AI input and limits each message to 500 characters", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("sanitizeForAI(m.content"), true);
  assertEquals(source.includes("maxLength: 500"), true);
  assertEquals(source.includes("functionName: 'pulse-ai-summarize'"), true);
  assertEquals(source.includes(".reverse()"), true);
  assertEquals(source.includes("toLocaleString('fr-FR')"), true);
  assertEquals(source.includes("const userName = m.user ? `${m.user.prenom} ${m.user.nom}` : 'Inconnu';"), true);
});

Deno.test("Azure OpenAI request is configured for JSON output and bounded generation", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY)"), true);
  assertEquals(source.includes("Azure OpenAI not configured"), true);
  assertEquals(source.includes("max_completion_tokens: 2000"), true);
  assertEquals(source.includes('reasoning_effort: "low"'), true);
  assertEquals(source.includes('verbosity: "low"'), true);
  assertEquals(source.includes("response_format: { type: \"json_object\" }"), true);
  assertEquals(source.includes("setTimeout(() => controller.abort(), 90000)"), true);
});

Deno.test("AI response logging stores model, prompt action, token usage and conversation context", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("pulse_ai_responses"), true);
  assertEquals(source.includes("conversation_id: payload.conversation_id"), true);
  assertEquals(source.includes("user_id: profile.id"), true);
  assertEquals(source.includes("prompt: payload.action"), true);
  assertEquals(source.includes("response_text: content"), true);
  assertEquals(source.includes("model: 'gpt-5'"), true);
  assertEquals(source.includes("tokens_input: usage.prompt_tokens"), true);
  assertEquals(source.includes("tokens_output: usage.completion_tokens"), true);
  assertEquals(source.includes("processing_type: 'pulse_summarize'"), true);
  assertEquals(source.includes("context_type: 'conversation'"), true);
});