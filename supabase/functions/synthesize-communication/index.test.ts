import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type RestoreEntry = {
  key: "serve" | "listen" | "serveHttp";
  value: unknown;
};

async function invokeServedModule(request: Request): Promise<Response> {
  const originalValues: RestoreEntry[] = [
    { key: "serve", value: (Deno as unknown as Record<string, unknown>).serve },
    { key: "listen", value: (Deno as unknown as Record<string, unknown>).listen },
    { key: "serveHttp", value: (Deno as unknown as Record<string, unknown>).serveHttp },
  ];

  let timeoutId: number | undefined;
  let settled = false;
  let acceptCount = 0;
  let httpEventCount = 0;

  const responsePromise = new Promise<Response>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("Timed out waiting for edge function response"));
      }
    }, 2_000);

    const resolveResponse = (response: Response) => {
      if (!settled) {
        settled = true;
        resolve(response);
      }
    };

    const rejectResponse = (error: unknown) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    const requestEvent = {
      request,
      respondWith: (responseOrPromise: Response | Promise<Response>) => {
        Promise.resolve(responseOrPromise).then(resolveResponse, rejectResponse);
        return Promise.resolve();
      },
    };

    const fakeConn = {
      rid: -1,
      localAddr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
      remoteAddr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
      close: () => {},
      read: () => Promise.resolve(null),
      write: () => Promise.resolve(0),
      readable: new ReadableStream(),
      writable: new WritableStream(),
    };

    const fakeListener = {
      rid: -1,
      addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
      close: () => {},
      accept: () => {
        if (acceptCount++ === 0) {
          return Promise.resolve(fakeConn);
        }
        return new Promise(() => {});
      },
      [Symbol.asyncIterator]() {
        return {
          next: () => {
            if (acceptCount++ === 0) {
              return Promise.resolve({ value: fakeConn, done: false });
            }
            return new Promise(() => {});
          },
        };
      },
    };

    const fakeHttpConn = {
      rid: -1,
      close: () => {},
      nextRequest: () => {
        if (httpEventCount++ === 0) {
          return Promise.resolve(requestEvent);
        }
        return Promise.resolve(null);
      },
      [Symbol.asyncIterator]() {
        return {
          next: () => {
            if (httpEventCount++ === 0) {
              return Promise.resolve({ value: requestEvent, done: false });
            }
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    };

    Object.defineProperty(Deno, "serve", {
      configurable: true,
      writable: true,
      value: (first: unknown, second?: unknown) => {
        const handler = typeof first === "function" ? first : second;
        if (typeof handler === "function") {
          Promise.resolve(handler(request)).then(resolveResponse, rejectResponse);
        }
        return {
          finished: Promise.resolve(),
          shutdown: () => {},
          ref: () => {},
          unref: () => {},
        };
      },
    });

    Object.defineProperty(Deno, "listen", {
      configurable: true,
      writable: true,
      value: () => fakeListener,
    });

    Object.defineProperty(Deno, "serveHttp", {
      configurable: true,
      writable: true,
      value: () => fakeHttpConn,
    });
  });

  try {
    await import(`./index.ts?test=${crypto.randomUUID()}`);
    return await responsePromise;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    for (const entry of originalValues) {
      Object.defineProperty(Deno, entry.key, {
        configurable: true,
        writable: true,
        value: entry.value,
      });
    }
  }
}

Deno.test("OPTIONS preflight returns CORS headers without external calls", async () => {
  const response = await invokeServedModule(
    new Request("http://localhost/synthesize-communication", {
      method: "OPTIONS",
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "");
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(
    response.headers.get("Access-Control-Allow-Headers"),
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  );
});

Deno.test("POST without Authorization bearer returns 401 JSON error", async () => {
  const response = await invokeServedModule(
    new Request("http://localhost/synthesize-communication", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etablissement_id: "etab_123" }),
    }),
  );

  assertEquals(response.status, 401);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertExists(response.headers.get("Content-Type"));

  const body = await response.json();
  assertEquals(body, { error: "Non autorisé" });
});

Deno.test("POST with non-Bearer Authorization returns 401 before Supabase access", async () => {
  const response = await invokeServedModule(
    new Request("http://localhost/synthesize-communication", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Token invalid",
      },
      body: JSON.stringify({ etablissement_id: "etab_123" }),
    }),
  );

  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: "Non autorisé" });
});

Deno.test("source enforces expected access-control and data-fetching contract", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes("authHeader?.startsWith('Bearer ')"), true);
  assertEquals(source.includes("userClient.auth.getClaims(token)"), true);
  assertEquals(source.includes("can_view_etablissement_data"), true);
  assertEquals(source.includes("_etablissement_id: etablissement_id"), true);
  assertEquals(source.includes(".from('email_threads')"), true);
  assertEquals(source.includes(".from('customer_activities')"), true);
  assertEquals(source.includes(".from('etablissements')"), true);
  assertEquals(source.includes(".limit(20)"), true);
  assertEquals(source.includes("SUPABASE_SERVICE_ROLE_KEY"), true);
});

Deno.test("source builds AI request with JSON response format, timeout, and retry on rate limit", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes("AZURE_OPENAI_ENDPOINT"), true);
  assertEquals(source.includes("AZURE_OPENAI_API_KEY"), true);
  assertEquals(source.includes("setTimeout(() => controller.abort(), 90000)"), true);
  assertEquals(source.includes("azureResponse.status === 429"), true);
  assertEquals(source.includes("max_completion_tokens: 2000"), true);
  assertEquals(source.includes("reasoning_effort: 'medium'"), true);
  assertEquals(source.includes("verbosity: 'low'"), true);
  assertEquals(source.includes("response_format: { type: 'json_object' }"), true);
  assertEquals(source.includes("JSON.parse(content)"), true);
});

Deno.test("source prompt contains business-specific synthesis schema and fallbacks", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes("Aucun email récent"), true);
  assertEquals(source.includes("Aucune activité récente"), true);
  assertEquals(source.includes("Établissement"), true);
  assertEquals(source.includes('"summary"'), true);
  assertEquals(source.includes('"key_points"'), true);
  assertEquals(source.includes('"pending_actions"'), true);
  assertEquals(source.includes('"sentiment"'), true);
  assertEquals(source.includes('"last_contact_date"'), true);
  assertEquals(source.includes('"positif" | "neutre" | "négatif" | "mitigé"'), true);
  assertEquals(source.includes("substring(0, 200)"), true);
});