import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type EdgeHandler = (req: Request) => Response | Promise<Response>;

let capturedHandler: EdgeHandler | undefined;
let moduleLoaded = false;

const originalServeDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve");

function installServeStub() {
  const serveStub = ((arg1: unknown, arg2?: unknown) => {
    capturedHandler = (typeof arg1 === "function" ? arg1 : arg2) as EdgeHandler;
    return {
      finished: Promise.resolve(),
      shutdown: () => {},
      ref: () => {},
      unref: () => {},
      addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
    };
  }) as typeof Deno.serve;

  Object.defineProperty(Deno, "serve", {
    value: serveStub,
    configurable: true,
    writable: true,
  });
}

function restoreServe() {
  if (originalServeDescriptor) {
    Object.defineProperty(Deno, "serve", originalServeDescriptor);
  }
}

async function loadHandler(): Promise<EdgeHandler> {
  if (!moduleLoaded) {
    installServeStub();
    try {
      await import("./index.ts");
      moduleLoaded = true;
    } finally {
      restoreServe();
    }
  }

  assertExists(capturedHandler);
  return capturedHandler;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function readRequestBody(input: RequestInfo | URL, init?: RequestInit): Promise<string> {
  if (typeof init?.body === "string") return init.body;
  if (init?.body instanceof Uint8Array) return new TextDecoder().decode(init.body);
  if (input instanceof Request) return await input.clone().text();
  return "";
}

function getRequestUrl(input: RequestInfo | URL): URL {
  if (input instanceof Request) return new URL(input.url);
  return new URL(String(input));
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

async function withEdgeEnvAndFetch(
  fetchStub: typeof fetch,
  fn: () => Promise<void>,
): Promise<void> {
  const keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"];
  const previousEnv = new Map<string, string | undefined>();
  for (const key of keys) previousEnv.set(key, Deno.env.get(key));

  const originalFetch = globalThis.fetch;

  Deno.env.set("SUPABASE_URL", "http://supabase.local");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");

  Object.defineProperty(globalThis, "fetch", {
    value: fetchStub,
    configurable: true,
    writable: true,
  });

  try {
    await fn();
  } finally {
    Object.defineProperty(globalThis, "fetch", {
      value: originalFetch,
      configurable: true,
      writable: true,
    });

    for (const [key, value] of previousEnv) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
}

Deno.test("module loads and registers an edge handler without starting a real server", async () => {
  const handler = await loadHandler();
  assertExists(handler);
});

Deno.test("OPTIONS preflight returns CORS headers without requiring environment variables", async () => {
  const handler = await loadHandler();

  const response = await handler(new Request("http://localhost", { method: "OPTIONS" }));

  assertEquals(response.status, 200);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(response.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assertEquals(
    response.headers.get("Access-Control-Allow-Headers"),
    "authorization, x-client-info, apikey, content-type",
  );
});

Deno.test("POST without etablissement_id returns a 400 business error", async () => {
  const handler = await loadHandler();

  let fetchCalled = false;
  const fetchStub = (async () => {
    fetchCalled = true;
    return jsonResponse({});
  }) as typeof fetch;

  await withEdgeEnvAndFetch(fetchStub, async () => {
    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trigger: "manual_button" }),
      }),
    );

    assertEquals(response.status, 400);
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(await response.json(), { error: "etablissement_id requis" });
    assertEquals(fetchCalled, false);
  });
});

Deno.test("single enrichment searches by cleaned SIREN, patches empty fields, and logs success", async () => {
  const handler = await loadHandler();

  const calls: Array<{ url: string; method: string; body: string }> = [];
  const patches: Record<string, unknown>[] = [];
  const logs: Record<string, unknown>[] = [];
  const searchQueries: string[] = [];

  const etablissement = {
    id: "etab-1",
    nom: "Societe Demo",
    siren_client: "552 100 554",
    email: null,
    email_domains: null,
    adresse: null,
    code_postal: null,
    ville: null,
    directeur_general_nom: null,
    enrichment_data: { previous_marker: "kept" },
  };

  const publicResult = {
    siren: "552100554",
    nom_complet: "SOCIETE DEMO",
    nature_juridique: "5710",
    activite_principale: "62.01Z",
    libelle_activite_principale: "Programmation informatique",
    tranche_effectif_salarie: "12",
    date_creation: "1955-01-01",
    siege: {
      siret: "55210055400013",
      adresse: "1 RUE DE LA PAIX",
      code_postal: "75002",
      libelle_commune: "PARIS",
    },
    dirigeants: [
      { nom: "DURAND", prenoms: "Alice Marie", qualite: "Présidente" },
      { nom: "MARTIN", prenom: "Bob", qualite: "Directeur général" },
    ],
  };

  const fetchStub = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = getRequestUrl(input);
    const method = getRequestMethod(input, init);
    const body = await readRequestBody(input, init);
    calls.push({ url: url.toString(), method, body });

    if (url.hostname === "recherche-entreprises.api.gouv.fr") {
      searchQueries.push(url.searchParams.get("q") ?? "");
      assertEquals(url.searchParams.get("per_page"), "1");
      return jsonResponse({ results: [publicResult] });
    }

    if (url.hostname === "supabase.local" && url.pathname === "/rest/v1/etablissements") {
      if (method === "GET") {
        assertEquals(url.searchParams.get("id"), "eq.etab-1");
        return jsonResponse(etablissement);
      }

      if (method === "PATCH") {
        patches.push(JSON.parse(body));
        assertEquals(url.searchParams.get("id"), "eq.etab-1");
        return new Response(null, { status: 204 });
      }
    }

    if (
      url.hostname === "supabase.local" &&
      url.pathname === "/rest/v1/prospect_enrichment_log" &&
      method === "POST"
    ) {
      logs.push(JSON.parse(body));
      return jsonResponse({}, 201);
    }

    return jsonResponse({ message: `unexpected ${method} ${url.toString()}` }, 500);
  }) as typeof fetch;

  await withEdgeEnvAndFetch(fetchStub, async () => {
    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          etablissement_id: "etab-1",
          trigger: "manual_button",
        }),
      }),
    );

    const payload = await response.json();

    assertEquals(response.status, 200);
    assertEquals(payload, {
      ok: true,
      fields_updated: [
        "adresse",
        "code_postal",
        "ville",
        "directeur_general_nom",
        "directeur_general_prenom",
      ],
    });

    assertEquals(searchQueries, ["552100554"]);
    assertEquals(patches.length, 1);

    const patch = patches[0];
    assertEquals(patch.siren_client, undefined);
    assertEquals(patch.adresse, "1 RUE DE LA PAIX");
    assertEquals(patch.code_postal, "75002");
    assertEquals(patch.ville, "PARIS");
    assertEquals(patch.directeur_general_nom, "DURAND");
    assertEquals(patch.directeur_general_prenom, "Alice Marie");
    assertEquals(patch.enrichment_source, "recherche_entreprises_gouv");
    assertEquals(patch.enrichment_status, "enriched");
    assertExists(patch.enrichment_at);

    const enrichmentData = patch.enrichment_data as Record<string, unknown>;
    assertEquals(enrichmentData.previous_marker, "kept");
    assertEquals(enrichmentData.source, "recherche_entreprises_gouv");
    assertEquals(enrichmentData.siren, "552100554");
    assertEquals(enrichmentData.siret, "55210055400013");
    assertEquals(enrichmentData.denomination, "SOCIETE DEMO");
    assertEquals(enrichmentData.code_naf, "62.01Z");
    assertEquals(enrichmentData.libelle_naf, "Programmation informatique");
    assertExists(enrichmentData.enriched_at);

    assertEquals(logs.length, 1);
    assertEquals(logs[0].etablissement_id, "etab-1");
    assertEquals(logs[0].source, "recherche_entreprises_gouv");
    assertEquals(logs[0].trigger, "manual_button");
    assertEquals(logs[0].success, true);
    assertEquals(logs[0].fields_updated, [
      "adresse",
      "code_postal",
      "ville",
      "directeur_general_nom",
      "directeur_general_prenom",
    ]);
    assertExists(logs[0].duration_ms);

    assertEquals(calls.some((call) => call.url.includes("api.pappers.fr")), false);
  });
});

Deno.test("enrichment does not overwrite existing establishment fields", async () => {
  const handler = await loadHandler();

  const patches: Record<string, unknown>[] = [];

  const etablissement = {
    id: "etab-existing",
    nom: "Entreprise Existante",
    siren_client: "123456789",
    email: "contact@example.test",
    email_domains: ["example.test"],
    adresse: "10 AVENUE EXISTANTE",
    code_postal: "69001",
    ville: "LYON",
    directeur_general_nom: "EXISTANT",
    enrichment_data: { stable: true },
  };

  const publicResult = {
    siren: "123456789",
    nom_raison_sociale: "ENTREPRISE EXISTANTE",
    nature_juridique: "5499",
    activite_principale: "70.22Z",
    libelle_activite_principale: "Conseil pour les affaires",
    tranche_effectif_salarie: "03",
    date_creation: "2010-05-12",
    siege: {
      siret: "12345678900011",
      adresse: "99 RUE NOUVELLE",
      code_postal: "75008",
      libelle_commune: "PARIS",
    },
    dirigeants: [{ nom: "NOUVEAU", prenom: "Nina", qualite: "Gérante" }],
  };

  const fetchStub = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = getRequestUrl(input);
    const method = getRequestMethod(input, init);
    const body = await readRequestBody(input, init);

    if (url.hostname === "recherche-entreprises.api.gouv.fr") {
      return jsonResponse({ results: [publicResult] });
    }

    if (url.hostname === "supabase.local" && url.pathname === "/rest/v1/etablissements") {
      if (method === "GET") return jsonResponse(etablissement);
      if (method === "PATCH") {
        patches.push(JSON.parse(body));
        return new Response(null, { status: 204 });
      }
    }

    if (url.hostname === "supabase.local" && url.pathname === "/rest/v1/prospect_enrichment_log") {
      return jsonResponse({}, 201);
    }

    return jsonResponse({ message: `unexpected ${method} ${url.toString()}` }, 500);
  }) as typeof fetch;

  await withEdgeEnvAndFetch(fetchStub, async () => {
    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ etablissement_id: "etab-existing" }),
      }),
    );

    const payload = await response.json();

    assertEquals(response.status, 200);
    assertEquals(payload.ok, true);
    assertEquals(payload.fields_updated, []);
    assertEquals(patches.length, 1);

    const patch = patches[0];
    assertEquals("siren_client" in patch, false);
    assertEquals("adresse" in patch, false);
    assertEquals("code_postal" in patch, false);
    assertEquals("ville" in patch, false);
    assertEquals("directeur_general_nom" in patch, false);
    assertEquals("directeur_general_prenom" in patch, false);
    assertEquals(patch.enrichment_status, "enriched");
    assertEquals(patch.enrichment_source, "recherche_entreprises_gouv");

    const enrichmentData = patch.enrichment_data as Record<string, unknown>;
    assertEquals(enrichmentData.stable, true);
    assertEquals(enrichmentData.adresse, "99 RUE NOUVELLE");
    assertEquals(enrichmentData.ville, "PARIS");
  });
});

Deno.test("when no public result is found it marks enrichment as failed and writes a failure log", async () => {
  const handler = await loadHandler();

  const patches: Record<string, unknown>[] = [];
  const logs: Record<string, unknown>[] = [];
  const searchQueries: string[] = [];

  const etablissement = {
    id: "etab-missing",
    nom: "Entreprise Introuvable",
    siren_client: null,
    email: null,
    email_domains: null,
    adresse: null,
    code_postal: null,
    ville: null,
    directeur_general_nom: null,
    enrichment_data: null,
  };

  const fetchStub = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = getRequestUrl(input);
    const method = getRequestMethod(input, init);
    const body = await readRequestBody(input, init);

    if (url.hostname === "recherche-entreprises.api.gouv.fr") {
      searchQueries.push(url.searchParams.get("q") ?? "");
      return jsonResponse({ results: [] });
    }

    if (url.hostname === "supabase.local" && url.pathname === "/rest/v1/etablissements") {
      if (method === "GET") return jsonResponse(etablissement);
      if (method === "PATCH") {
        patches.push(JSON.parse(body));
        assertEquals(url.searchParams.get("id"), "eq.etab-missing");
        return new Response(null, { status: 204 });
      }
    }

    if (
      url.hostname === "supabase.local" &&
      url.pathname === "/rest/v1/prospect_enrichment_log" &&
      method === "POST"
    ) {
      logs.push(JSON.parse(body));
      return jsonResponse({}, 201);
    }

    return jsonResponse({ message: `unexpected ${method} ${url.toString()}` }, 500);
  }) as typeof fetch;

  await withEdgeEnvAndFetch(fetchStub, async () => {
    const response = await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          etablissement_id: "etab-missing",
          trigger: "auto_create",
        }),
      }),
    );

    const payload = await response.json();

    assertEquals(response.status, 422);
    assertEquals(payload, {
      ok: false,
      fields_updated: [],
      error: "Aucun résultat",
    });

    assertEquals(searchQueries, ["Entreprise Introuvable"]);
    assertEquals(patches.length, 1);
    assertEquals(patches[0].enrichment_status, "failed");
    assertExists(patches[0].enrichment_at);

    assertEquals(logs.length, 1);
    assertEquals(logs[0].etablissement_id, "etab-missing");
    assertEquals(logs[0].source, "recherche_entreprises_gouv");
    assertEquals(logs[0].trigger, "auto_create");
    assertEquals(logs[0].success, false);
    assertEquals(logs[0].error_message, "Aucun résultat trouvé");
    assertEquals(logs[0].triggered_by, null);
    assertExists(logs[0].duration_ms);
  });
});