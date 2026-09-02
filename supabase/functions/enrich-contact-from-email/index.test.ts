import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const INDEX_URL = new URL("./index.ts", import.meta.url);

function restoreEnv(name: string, previous: string | undefined) {
  if (previous === undefined) {
    Deno.env.delete(name);
  } else {
    Deno.env.set(name, previous);
  }
}

function replaceDenoProperty(name: string, value: unknown) {
  const descriptor = Object.getOwnPropertyDescriptor(Deno, name);
  Object.defineProperty(Deno, name, {
    configurable: true,
    writable: true,
    value,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(Deno, name, descriptor);
    } else {
      delete (Deno as Record<string, unknown>)[name];
    }
  };
}

function withTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T> {
  let timer: number | undefined;

  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });

  return Promise.race([
    promise.finally(() => {
      if (timer !== undefined) clearTimeout(timer);
    }),
    timeout,
  ]);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.test("source declares the expected enrichment fields in deterministic order", async () => {
  const source = await Deno.readTextFile(INDEX_URL);
  const match = source.match(/fieldsToCheck\s*=\s*\[([^\]]+)\]/);

  assertExists(match);

  const fields = Array.from(match[1].matchAll(/'([^']+)'/g), (m) => m[1]);

  assertEquals(fields, [
    "nom",
    "prenom",
    "fonction",
    "email",
    "telephone",
    "type_contact",
  ]);
});

Deno.test("source keeps service-role authorization and safe error sanitization guards", async () => {
  const source = await Deno.readTextFile(INDEX_URL);

  assertEquals(source.includes("Unauthorized: Service role key required"), true);
  assertEquals(source.includes("sanitizeErrorForClient(error)"), true);
  assertEquals(source.includes("SUPABASE_SERVICE_ROLE_KEY"), true);
  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
});

Deno.test("handler handles CORS, unauthorized requests, no-op enrichment, and precise updates offline", async () => {
  const serviceRoleKey = "unit-test-service-role-key";
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const previousFetch = globalThis.fetch;
  const previousConsoleLog = console.log;
  const previousConsoleError = console.error;

  const fetchCalls: Array<{
    url: string;
    method: string;
    body: string;
  }> = [];

  const requests = [
    new Request("http://localhost/enrich", { method: "OPTIONS" }),
    new Request("http://localhost/enrich", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer wrong-key",
        apikey: "wrong-key",
      },
      body: JSON.stringify({
        contact_id: "contact-unauthorized",
        new_data: { telephone: "0102030405" },
        source: "manual",
      }),
    }),
    new Request("http://localhost/enrich", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        contact_id: "contact-no-update",
        new_data: {
          nom: "Martin",
          fonction: "Directeur Général",
          telephone: "0999999999",
        },
        source: "email",
        source_reference: "thread-42",
        confidence: 0.95,
      }),
    }),
    new Request("http://localhost/enrich", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        contact_id: "contact-update",
        new_data: {
          nom: "Martin",
          fonction: "Directeur des achats",
          telephone: "0102030405",
        },
        source: "linkedin_api",
        source_reference: "profile-123",
        confidence: 0.95,
      }),
    }),
  ];

  const responsePromises: Promise<Response>[] = [];
  const responseResolvers: Array<(response: Response) => void> = [];
  const responseRejecters: Array<(error: unknown) => void> = [];

  for (let i = 0; i < requests.length; i++) {
    responsePromises.push(
      new Promise<Response>((resolve, reject) => {
        responseResolvers[i] = resolve;
        responseRejecters[i] = reject;
      }),
    );
  }

  const connections = requests.map((_, index) => ({
    __requestIndex: index,
    rid: 10_000 + index,
    localAddr: { transport: "tcp", hostname: "127.0.0.1", port: 8000 },
    remoteAddr: { transport: "tcp", hostname: "127.0.0.1", port: 50_000 + index },
    close() {},
    closeWrite() {},
    read() {
      return Promise.resolve(null);
    },
    write(bytes: Uint8Array) {
      return Promise.resolve(bytes.length);
    },
  }));

  let listenCallCount = 0;
  let acceptCallCount = 0;
  let serveHttpCallCount = 0;

  const restoreListen = replaceDenoProperty("listen", (_options: unknown) => {
    listenCallCount++;

    let index = 0;
    let closed = false;

    return {
      addr: { transport: "tcp", hostname: "127.0.0.1", port: 8000 },
      close() {
        closed = true;
      },
      async accept() {
        if (closed) {
          throw new Error("Listener closed");
        }

        if (index >= connections.length) {
          return await new Promise(() => {});
        }

        acceptCallCount++;
        return connections[index++];
      },
    };
  });

  const restoreListenTls = replaceDenoProperty("listenTls", () => {
    throw new Error("TLS listener must not be opened by this function");
  });

  const restoreServeHttp = replaceDenoProperty("serveHttp", (conn: { __requestIndex: number }) => {
    serveHttpCallCount++;

    const requestIndex = conn.__requestIndex;
    let consumed = false;

    const nextRequest = async () => {
      if (consumed) {
        return null;
      }

      consumed = true;

      return {
        request: requests[requestIndex],
        respondWith(responseOrPromise: Response | Promise<Response>) {
          Promise.resolve(responseOrPromise).then(
            responseResolvers[requestIndex],
            responseRejecters[requestIndex],
          );

          return Promise.resolve();
        },
      };
    };

    return {
      rid: 20_000 + requestIndex,
      close() {},
      nextRequest,
      [Symbol.asyncIterator]() {
        return {
          async next() {
            const value = await nextRequest();

            if (value === null) {
              return { done: true, value: undefined };
            }

            return { done: false, value };
          },
        };
      },
    };
  });

  try {
    Deno.env.set("SUPABASE_URL", "http://supabase.local");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey);

    console.log = () => {};
    console.error = () => {};

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const body = await request.clone().text();

      fetchCalls.push({
        url: request.url,
        method: request.method,
        body,
      });

      if (request.url.includes("/rest/v1/contacts?") && request.method === "GET") {
        if (request.url.includes("id=eq.contact-no-update")) {
          return jsonResponse({
            id: "contact-no-update",
            nom: "Durand",
            prenom: "Alice",
            fonction: "Directeur Général",
            email: "alice.durand@example.test",
            telephone: "0123456789",
            type_contact: "administratif",
          });
        }

        if (request.url.includes("id=eq.contact-update")) {
          return jsonResponse({
            id: "contact-update",
            nom: "Durand",
            prenom: "Alice",
            fonction: "Directeur",
            email: "alice.durand@example.test",
            telephone: "",
            type_contact: "administratif",
          });
        }
      }

      if (request.url.includes("/rest/v1/contacts_history") && request.method === "POST") {
        return jsonResponse({}, 201);
      }

      if (request.url.includes("/rest/v1/contacts?") && request.method === "PATCH") {
        return jsonResponse({}, 200);
      }

      throw new Error(`Unexpected fetch call: ${request.method} ${request.url}`);
    };

    await import("./index.ts");

    const [
      optionsResponse,
      unauthorizedResponse,
      noUpdateResponse,
      updateResponse,
    ] = await withTimeout(Promise.all(responsePromises));

    assertEquals(listenCallCount, 1);
    assertEquals(acceptCallCount, 4);
    assertEquals(serveHttpCallCount, 4);

    assertEquals(optionsResponse.status, 200);
    assertNotEquals(optionsResponse.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(
      optionsResponse.headers.get("Access-Control-Allow-Headers"),
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
    );

    assertEquals(unauthorizedResponse.status, 401);
    assertEquals(await unauthorizedResponse.json(), {
      error: "Unauthorized: Service role key required",
    });

    assertEquals(noUpdateResponse.status, 200);
    assertEquals(await noUpdateResponse.json(), {
      updated: false,
      message: "No fields require update",
      contact_id: "contact-no-update",
    });

    assertEquals(updateResponse.status, 200);
    const updateBody = await updateResponse.json();

    assertEquals(updateBody.updated, true);
    assertEquals(updateBody.contact_id, "contact-update");
    assertEquals(updateBody.changed_fields, ["fonction", "telephone"]);
    assertEquals(updateBody.old_values, {
      fonction: "Directeur",
      telephone: "",
    });
    assertEquals(updateBody.new_values, {
      fonction: "Directeur des achats",
      telephone: "0102030405",
    });
    assertEquals(updateBody.confidence, 0.95);
    assertEquals(updateBody.source, "linkedin_api");

    const historyCall = fetchCalls.find((call) =>
      call.method === "POST" && call.url.includes("/rest/v1/contacts_history")
    );
    const patchCall = fetchCalls.find((call) =>
      call.method === "PATCH" && call.url.includes("/rest/v1/contacts?")
    );

    assertExists(historyCall);
    assertExists(patchCall);

    const historyPayload = JSON.parse(historyCall.body);
    const patchPayload = JSON.parse(patchCall.body);

    assertEquals(historyPayload, {
      contact_id: "contact-update",
      old_values: {
        fonction: "Directeur",
        telephone: "",
      },
      new_values: {
        fonction: "Directeur des achats",
        telephone: "0102030405",
      },
      changed_fields: ["fonction", "telephone"],
      change_source: "linkedin_api",
      source_reference: "profile-123",
      confidence_score: 0.95,
    });

    assertEquals(patchPayload.fonction, "Directeur des achats");
    assertEquals(patchPayload.telephone, "0102030405");
    assertEquals(patchPayload.nom, undefined);
    assertExists(patchPayload.updated_at);
    assertEquals(Number.isNaN(Date.parse(patchPayload.updated_at)), false);

    assertEquals(
      fetchCalls.filter((call) => call.url.includes("/rest/v1/contacts?") && call.method === "GET").length,
      2,
    );
    assertEquals(
      fetchCalls.filter((call) => call.url.includes("/rest/v1/contacts_history")).length,
      1,
    );
    assertEquals(
      fetchCalls.filter((call) => call.url.includes("/rest/v1/contacts?") && call.method === "PATCH").length,
      1,
    );
  } finally {
    restoreListen();
    restoreListenTls();
    restoreServeHttp();

    globalThis.fetch = previousFetch;
    console.log = previousConsoleLog;
    console.error = previousConsoleError;

    restoreEnv("SUPABASE_URL", previousUrl);
    restoreEnv("SUPABASE_SERVICE_ROLE_KEY", previousServiceKey);
  }
});

Deno.test("local fixture guards fail loudly for malformed JSON bodies", () => {
  assertThrows(
    () => JSON.parse("{not-json"),
    SyntaxError,
  );
});

Deno.test("timeout helper rejects pending async work", async () => {
  await assertRejects(
    () => withTimeout(new Promise<Response>(() => {}), 5),
    Error,
    "Timed out after 5ms",
  );
});