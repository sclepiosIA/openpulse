import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const CORS_ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type, x-internal-secret";

function replaceDenoProperty(name: string, value: unknown): () => void {
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

async function runEdgeFunctionRequest(request: Request): Promise<{
  response: Response;
  moduleUnderTest: unknown;
  listenOptions: unknown[];
}> {
  let responseResolve!: (response: Response) => void;
  let responseReject!: (error: unknown) => void;

  const responsePromise = new Promise<Response>((resolve, reject) => {
    responseResolve = resolve;
    responseReject = reject;
  });

  const listenOptions: unknown[] = [];

  const fakeConn = {
    rid: 1,
    localAddr: { transport: "tcp", hostname: "127.0.0.1", port: 8000 },
    remoteAddr: { transport: "tcp", hostname: "127.0.0.1", port: 54321 },
    readable: new ReadableStream(),
    writable: new WritableStream(),
    read: async () => null,
    write: async (p: Uint8Array) => p.byteLength,
    close: () => {},
    closeWrite: async () => {},
  };

  let accepted = false;
  const fakeListener = {
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 8000 },
    close: () => {},
    accept: async () => {
      if (!accepted) {
        accepted = true;
        return fakeConn;
      }
      return await new Promise(() => {});
    },
    [Symbol.asyncIterator]() {
      let yielded = false;
      return {
        next: async () => {
          if (yielded) {
            return { done: true, value: undefined };
          }
          yielded = true;
          return { done: false, value: fakeConn };
        },
      };
    },
  };

  let nextRequestCalled = false;
  const fakeHttpConn = {
    nextRequest: async () => {
      if (nextRequestCalled) {
        return null;
      }

      nextRequestCalled = true;
      return {
        request,
        respondWith: (responseOrPromise: Response | Promise<Response>) => {
          const responseResolution = Promise.resolve(responseOrPromise);
          responseResolution.then(responseResolve, responseReject);
          return responseResolution.then(() => undefined);
        },
      };
    },
    close: () => {},
  };

  const restoreListen = replaceDenoProperty("listen", (options: unknown) => {
    listenOptions.push(options);
    return fakeListener;
  });

  const restoreServeHttp = replaceDenoProperty("serveHttp", () => fakeHttpConn);

  let timeoutId: number | undefined;

  try {
    const moduleUnderTest = await import(`./index.ts?test=${crypto.randomUUID()}`);

    const timeoutPromise = new Promise<Response>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Timed out waiting for the edge function response"));
      }, 2_000);
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);

    return {
      response,
      moduleUnderTest,
      listenOptions,
    };
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    restoreServeHttp();
    restoreListen();
  }
}

Deno.test("OPTIONS request returns CORS preflight response without authentication", async () => {
  const { response, moduleUnderTest, listenOptions } = await runEdgeFunctionRequest(
    new Request("http://localhost/backfill-contacts-from-ai-data", {
      method: "OPTIONS",
    }),
  );

  assertExists(moduleUnderTest);
  assertEquals(listenOptions.length, 1);
  assertEquals(response.status, 200);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(response.headers.get("Access-Control-Allow-Headers"), CORS_ALLOW_HEADERS);
  assertEquals(response.headers.get("Content-Type"), null);
  assertEquals(await response.text(), "");
});

Deno.test("GET request without Authorization returns 401 authentication error", async () => {
  const { response, moduleUnderTest, listenOptions } = await runEdgeFunctionRequest(
    new Request("http://localhost/backfill-contacts-from-ai-data", {
      method: "GET",
    }),
  );

  assertExists(moduleUnderTest);
  assertEquals(listenOptions.length, 1);
  assertEquals(response.status, 401);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(response.headers.get("Access-Control-Allow-Headers"), CORS_ALLOW_HEADERS);
  assertEquals(response.headers.get("Content-Type"), "application/json");

  const body = await response.json();
  assertEquals(body, { error: "Authentication required" });
});

Deno.test("POST request without Authorization returns 401 and ignores request body", async () => {
  const { response } = await runEdgeFunctionRequest(
    new Request("http://localhost/backfill-contacts-from-ai-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        thread_id: "thread-test",
        etablissement_id: "etablissement-test",
      }),
    }),
  );

  assertEquals(response.status, 401);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');

  const body = await response.json();
  assertEquals(body.error, "Authentication required");
});