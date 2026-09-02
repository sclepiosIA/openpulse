import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type EdgeHandler = (req: Request) => Response | Promise<Response>;

let capturedHandler: EdgeHandler | undefined;
let moduleLoadPromise: Promise<void> | undefined;

function getServeHandler(args: unknown[]): EdgeHandler {
  const handler = args.find((arg) => typeof arg === "function");
  if (!handler) {
    throw new Error("Deno.serve handler was not provided");
  }
  return handler as EdgeHandler;
}

async function loadHandler(): Promise<EdgeHandler> {
  if (capturedHandler) {
    return capturedHandler;
  }

  if (!moduleLoadPromise) {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve");

    Object.defineProperty(Deno, "serve", {
      configurable: true,
      writable: true,
      value: (...args: unknown[]) => {
        capturedHandler = getServeHandler(args);
        return {
          addr: { hostname: "127.0.0.1", port: 0, transport: "tcp" },
          finished: Promise.resolve(),
          shutdown: () => Promise.resolve(),
          ref: () => {},
          unref: () => {},
        };
      },
    });

    moduleLoadPromise = import("./index.ts")
      .then(() => {})
      .finally(() => {
        if (originalDescriptor) {
          Object.defineProperty(Deno, "serve", originalDescriptor);
        }
      });
  }

  await moduleLoadPromise;
  assertExists(capturedHandler);
  return capturedHandler;
}

async function withEnv<T>(
  values: Record<string, string>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const key of Object.keys(values)) {
    previous.set(key, Deno.env.get(key));
    Deno.env.set(key, values[key]);
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

async function withFetchStub<T>(
  stub: typeof fetch,
  fn: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stub;

  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function getFetchUrl(input: RequestInfo | URL): string {
  if (input instanceof Request) {
    return input.url;
  }
  return String(input);
}

function getFetchMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) {
    return init.method;
  }
  if (input instanceof Request) {
    return input.method;
  }
  return "GET";
}

async function getFetchBody(input: RequestInfo | URL, init?: RequestInit): Promise<string> {
  if (typeof init?.body === "string") {
    return init.body;
  }
  if (init?.body) {
    return await new Response(init.body as BodyInit).text();
  }
  if (input instanceof Request) {
    return await input.clone().text();
  }
  return "";
}

Deno.test("test harness rejects an invalid Deno.serve registration", () => {
  assertThrows(
    () => getServeHandler([]),
    Error,
    "Deno.serve handler was not provided",
  );
});

Deno.test("module loads and registers the Supabase Edge Function handler", async () => {
  const handler = await loadHandler();

  assertExists(handler);
  assertEquals(typeof handler, "function");
});

Deno.test("OPTIONS request returns the CORS preflight response without calling fetch", async () => {
  const handler = await loadHandler();
  let fetchCalled = false;

  await withFetchStub(
    (() => {
      fetchCalled = true;
      return Promise.resolve(new Response("unexpected fetch", { status: 500 }));
    }) as typeof fetch,
    async () => {
      const response = await handler(
        new Request("http://localhost", { method: "OPTIONS" }),
      );

      assertEquals(response.status, 200);
      assertEquals(await response.text(), "ok");
      assertExists(response.headers.get("Access-Control-Allow-Origin"));
      assertEquals(fetchCalled, false);
    },
  );
});

Deno.test("POST returns count 0 when no eligible établissement is found", async () => {
  const handler = await loadHandler();
  const fetchCalls: Array<{ url: string; method: string }> = [];

  await withEnv(
    {
      SUPABASE_URL: "http://localhost",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
    async () => {
      await withFetchStub(
        (async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = getFetchUrl(input);
          const method = getFetchMethod(input, init);
          fetchCalls.push({ url, method });

          if (method === "GET" && url.includes("/rest/v1/etablissements")) {
            return new Response(JSON.stringify([]), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ message: "unexpected request" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }) as typeof fetch,
        async () => {
          const response = await handler(
            new Request("http://localhost", { method: "POST" }),
          );

          assertEquals(response.status, 200);
          assertEquals(response.headers.get("Content-Type"), "application/json");

          const body = await response.json();
          assertEquals(body, {
            message: "Aucun établissement avec date de premier paiement",
            count: 0,
          });

          assertEquals(fetchCalls.length, 1);
          assertEquals(fetchCalls[0].method, "GET");
          assertEquals(fetchCalls[0].url.includes("/rest/v1/etablissements"), true);

          const decodedUrl = decodeURIComponent(fetchCalls[0].url);
          assertEquals(
            decodedUrl.includes("statut=in.(Production,Go-Live,Contractuel)"),
            true,
          );
          assertEquals(
            decodedUrl.includes("date_premier_paiement=not.is.null"),
            true,
          );
        },
      );
    },
  );
});

Deno.test("POST generates quarterly recurring revenues from pallier pricing and an initial payment offline", async () => {
  const handler = await loadHandler();

  const insertedRows: Array<Record<string, unknown>> = [];
  const fetchCalls: Array<{ url: string; method: string }> = [];

  const etablissement = {
    id: "etab-1",
    nom: "Clinique Test",
    statut: "Production",
    type_offre: "Au succès",
    modele_detaille: null,
    periodicite_paiement: "trimestriel",
    date_premier_paiement: "2025-01-15",
    date_signature: "2024-12-10",
    date_go_live: null,
    tarifs_palliers: {
      Pallier_2: 12000,
    },
    pallier_vise: "Pallier 2",
    modele_statique_succes: null,
    nombre_passages_urgences_annuel: null,
    paiement_initial: 1500,
  };

  await withEnv(
    {
      SUPABASE_URL: "http://localhost",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
    async () => {
      await withFetchStub(
        (async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = getFetchUrl(input);
          const method = getFetchMethod(input, init);
          fetchCalls.push({ url, method });

          if (method === "GET" && url.includes("/rest/v1/etablissements")) {
            return new Response(JSON.stringify([etablissement]), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }

          if (method === "GET" && url.includes("/rest/v1/tresorerie_revenus")) {
            return new Response(JSON.stringify(null), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }

          if (method === "POST" && url.includes("/rest/v1/tresorerie_revenus")) {
            const rawBody = await getFetchBody(input, init);
            const parsed = JSON.parse(rawBody);
            const rows = Array.isArray(parsed) ? parsed : [parsed];
            insertedRows.push(...rows);

            return new Response(JSON.stringify(null), {
              status: 201,
              headers: { "content-type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ message: "unexpected request", url, method }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }) as typeof fetch,
        async () => {
          const response = await handler(
            new Request("http://localhost", { method: "POST" }),
          );

          assertEquals(response.status, 200);

          const body = await response.json();
          assertEquals(body.message, "Revenus générés avec succès");
          assertEquals(body.created, 4);
          assertEquals(body.errors, 0);
          assertEquals(body.details.created.length, 4);
          assertEquals(body.details.errors, []);

          const recurringRows = insertedRows.filter((row) =>
            row.type_revenu === "abonnement_mensuel"
          );
          const initialRows = insertedRows.filter((row) =>
            row.type_revenu === "paiement_initial"
          );

          assertEquals(insertedRows.length, 5);
          assertEquals(recurringRows.length, 4);
          assertEquals(initialRows.length, 1);

          assertEquals(
            recurringRows.map((row) => row.mois),
            ["2025-01-01", "2025-04-01", "2025-07-01", "2025-10-01"],
          );
          assertEquals(
            recurringRows.map((row) => row.montant_prevu),
            [3000, 3000, 3000, 3000],
          );
          assertEquals(
            recurringRows.every((row) => row.etablissement_id === "etab-1"),
            true,
          );
          assertEquals(
            recurringRows.every((row) => row.source_modele === "succes"),
            true,
          );
          assertEquals(
            recurringRows.every((row) => row.source_periodicite === "trimestriel"),
            true,
          );
          assertEquals(
            recurringRows.every((row) => row.source_pallier === "Pallier 2"),
            true,
          );
          assertEquals(
            recurringRows.every((row) => row.notes === "Revenu succes - Clinique Test"),
            true,
          );

          assertEquals(initialRows[0].etablissement_id, "etab-1");
          assertEquals(initialRows[0].mois, "2024-12-01");
          assertEquals(initialRows[0].montant_prevu, 1500);
          assertEquals(initialRows[0].source_modele, "ponctuel");
          assertEquals(initialRows[0].notes, "Paiement initial - Clinique Test");

          const tresorerieGetCount = fetchCalls.filter((call) =>
            call.method === "GET" && call.url.includes("/rest/v1/tresorerie_revenus")
          ).length;
          const tresoreriePostCount = fetchCalls.filter((call) =>
            call.method === "POST" && call.url.includes("/rest/v1/tresorerie_revenus")
          ).length;

          assertEquals(tresorerieGetCount, 5);
          assertEquals(tresoreriePostCount, 5);
        },
      );
    },
  );
});

Deno.test("POST returns a sanitized 500 response when the Supabase fetch layer rejects", async () => {
  const handler = await loadHandler();

  await withEnv(
    {
      SUPABASE_URL: "http://localhost",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
    async () => {
      await withFetchStub(
        (() => Promise.reject(new Error("simulated offline database failure"))) as typeof fetch,
        async () => {
          await assertRejects(
            async () => {
              throw new Error("control rejection for assertRejects import");
            },
            Error,
            "control rejection",
          );

          const response = await handler(
            new Request("http://localhost", { method: "POST" }),
          );

          assertEquals(response.status, 500);
          assertExists(response.headers.get("Access-Control-Allow-Origin"));

          const text = await response.text();
          assertEquals(text.length > 0, true);
        },
      );
    },
  );
});