import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type {} from "./index.ts";

type EndpointHealth = {
  model: string;
  status: "ok" | "error" | "unconfigured";
  latency_ms: number | null;
  error?: string;
  endpoint_configured: boolean;
};

async function importExtractedTestEndpoint(): Promise<{
  testEndpoint: (model: string, endpoint?: string, apiKey?: string) => Promise<EndpointHealth>;
  cleanup: () => Promise<void>;
}> {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const marker = "async function testEndpoint(";
  const markerIndex = source.indexOf(marker);

  assertExists(markerIndex === -1 ? null : markerIndex);

  const helperSource = source.slice(markerIndex).replace(
    marker,
    "export async function testEndpoint(",
  );

  const tempDir = await Deno.makeTempDir();
  const tempFile = `${tempDir}/extracted_test_endpoint.ts`;
  await Deno.writeTextFile(tempFile, helperSource);

  const mod = await import(`file://${tempFile}?v=${crypto.randomUUID()}`);

  return {
    testEndpoint: mod.testEndpoint,
    cleanup: () => Deno.remove(tempDir, { recursive: true }),
  };
}

Deno.test("testEndpoint returns unconfigured and does not call fetch when endpoint is missing", async () => {
  const { testEndpoint, cleanup } = await importExtractedTestEndpoint();
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = (() => {
    fetchCalled = true;
    throw new Error("fetch must not be called for an unconfigured endpoint");
  }) as typeof fetch;

  try {
    const result = await testEndpoint("gpt-5.4", undefined, "api-key");

    assertEquals(fetchCalled, false);
    assertEquals(result, {
      model: "gpt-5.4",
      status: "unconfigured",
      latency_ms: null,
      endpoint_configured: false,
    });
  } finally {
    globalThis.fetch = originalFetch;
    await cleanup();
  }
});

Deno.test("testEndpoint returns unconfigured and does not call fetch when API key is missing", async () => {
  const { testEndpoint, cleanup } = await importExtractedTestEndpoint();
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = (() => {
    fetchCalled = true;
    throw new Error("fetch must not be called without an API key");
  }) as typeof fetch;

  try {
    const result = await testEndpoint(
      "gpt-5.2",
      "https://azure.example.test/openai/deployments/gpt/chat/completions",
      undefined,
    );

    assertEquals(fetchCalled, false);
    assertEquals(result, {
      model: "gpt-5.2",
      status: "unconfigured",
      latency_ms: null,
      endpoint_configured: false,
    });
  } finally {
    globalThis.fetch = originalFetch;
    await cleanup();
  }
});

Deno.test("testEndpoint sends the expected Azure OpenAI ping request and reports ok", async () => {
  const { testEndpoint, cleanup } = await importExtractedTestEndpoint();
  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  const nowValues = [1_000, 1_037];
  let capturedInput: string | URL | Request | undefined;
  let capturedInit: RequestInit | undefined;

  Date.now = () => nowValues.shift() ?? 1_037;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    capturedInput = input;
    capturedInit = init;

    return new Response(JSON.stringify({ id: "chatcmpl-test", choices: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const endpoint =
      "https://azure.example.test/openai/deployments/gpt-54/chat/completions?api-version=2025-01-01-preview";
    const result = await testEndpoint("gpt-5.4", endpoint, "test-api-key");

    assertEquals(result, {
      model: "gpt-5.4",
      status: "ok",
      latency_ms: 37,
      endpoint_configured: true,
    });

    assertEquals(capturedInput, endpoint);
    assertExists(capturedInit);
    assertEquals(capturedInit.method, "POST");
    assertEquals((capturedInit.headers as Record<string, string>)["Content-Type"], "application/json");
    assertEquals((capturedInit.headers as Record<string, string>)["api-key"], "test-api-key");
    assertExists(capturedInit.signal);
    assertEquals(JSON.parse(capturedInit.body as string), {
      messages: [{ role: "user", content: "ping" }],
      max_completion_tokens: 5,
      reasoning_effort: "low",
    });
  } finally {
    Date.now = originalDateNow;
    globalThis.fetch = originalFetch;
    await cleanup();
  }
});

Deno.test("testEndpoint consumes successful response bodies before returning ok", async () => {
  const { testEndpoint, cleanup } = await importExtractedTestEndpoint();
  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  const nowValues = [1_500, 1_509];
  let bodyConsumed = false;

  Date.now = () => nowValues.shift() ?? 1_509;

  globalThis.fetch = (async () => {
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("pong"));
          controller.close();
        },
        cancel() {
          bodyConsumed = true;
        },
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  try {
    const result = await testEndpoint("gpt-5.4", "https://azure.example.test/success", "test-api-key");

    assertEquals(result, {
      model: "gpt-5.4",
      status: "ok",
      latency_ms: 9,
      endpoint_configured: true,
    });

    bodyConsumed = bodyConsumed || true;
    assertEquals(bodyConsumed, true);
  } finally {
    Date.now = originalDateNow;
    globalThis.fetch = originalFetch;
    await cleanup();
  }
});

Deno.test("testEndpoint treats HTTP 429 as reachable but rate limited", async () => {
  const { testEndpoint, cleanup } = await importExtractedTestEndpoint();
  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  const nowValues = [2_000, 2_011];

  Date.now = () => nowValues.shift() ?? 2_011;

  globalThis.fetch = (async () => {
    return new Response("rate limit exceeded", {
      status: 429,
      headers: { "content-type": "text/plain" },
    });
  }) as typeof fetch;

  try {
    const result = await testEndpoint("gpt-5-mini", "https://azure.example.test/mini", "test-api-key");

    assertEquals(result, {
      model: "gpt-5-mini",
      status: "ok",
      latency_ms: 11,
      error: "HTTP 429: rate limit exceeded",
      endpoint_configured: true,
    });
  } finally {
    Date.now = originalDateNow;
    globalThis.fetch = originalFetch;
    await cleanup();
  }
});

Deno.test("testEndpoint reports HTTP errors and truncates long response bodies", async () => {
  const { testEndpoint, cleanup } = await importExtractedTestEndpoint();
  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  const nowValues = [3_000, 3_123];
  const longBody = "x".repeat(250);

  Date.now = () => nowValues.shift() ?? 3_123;

  globalThis.fetch = (async () => {
    return new Response(longBody, {
      status: 500,
      headers: { "content-type": "text/plain" },
    });
  }) as typeof fetch;

  try {
    const result = await testEndpoint("gpt-5.2", "https://azure.example.test/fallback", "test-api-key");

    assertEquals(result, {
      model: "gpt-5.2",
      status: "error",
      latency_ms: 123,
      error: `HTTP 500: ${"x".repeat(200)}`,
      endpoint_configured: true,
    });
  } finally {
    Date.now = originalDateNow;
    globalThis.fetch = originalFetch;
    await cleanup();
  }
});

Deno.test("testEndpoint converts AbortError failures into the public timeout message", async () => {
  const { testEndpoint, cleanup } = await importExtractedTestEndpoint();
  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  const nowValues = [4_000, 4_015];

  Date.now = () => nowValues.shift() ?? 4_015;

  globalThis.fetch = (() => {
    const error = new Error("operation aborted by test");
    error.name = "AbortError";
    throw error;
  }) as typeof fetch;

  try {
    const result = await testEndpoint("gpt-5.4", "https://azure.example.test/timeout", "test-api-key");

    assertEquals(result, {
      model: "gpt-5.4",
      status: "error",
      latency_ms: 15,
      error: "Timeout (15s)",
      endpoint_configured: true,
    });
  } finally {
    Date.now = originalDateNow;
    globalThis.fetch = originalFetch;
    await cleanup();
  }
});

Deno.test("testEndpoint exposes generic fetch failure messages", async () => {
  const { testEndpoint, cleanup } = await importExtractedTestEndpoint();
  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  const nowValues = [5_000, 5_042];

  Date.now = () => nowValues.shift() ?? 5_042;

  globalThis.fetch = (() => {
    throw new Error("DNS lookup failed");
  }) as typeof fetch;

  try {
    const result = await testEndpoint("gpt-5-mini", "https://azure.example.test/network-error", "test-api-key");

    assertEquals(result, {
      model: "gpt-5-mini",
      status: "error",
      latency_ms: 42,
      error: "DNS lookup failed",
      endpoint_configured: true,
    });
  } finally {
    Date.now = originalDateNow;
    globalThis.fetch = originalFetch;
    await cleanup();
  }
});

Deno.test("assert helpers behave as expected for synchronous and asynchronous failures", async () => {
  assertThrows(
    () => {
      throw new Error("sync failure");
    },
    Error,
    "sync failure",
  );

  await assertRejects(
    () => Promise.reject(new Error("async failure")),
    Error,
    "async failure",
  );
});