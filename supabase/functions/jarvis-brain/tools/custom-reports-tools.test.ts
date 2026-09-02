import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeListCustomReports,
  executeRunCustomReport,
  executeExportCustomReport,
} from "./custom-reports-tools.ts";

void assertThrows;
void assertRejects;

type MockQueryConfig = {
  data?: unknown[];
  error?: Error | null;
};

function createThenableResult(result: { data: unknown; error: unknown }) {
  return {
    then(
      onFulfilled: (value: typeof result) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      try {
        return Promise.resolve(onFulfilled(result));
      } catch (e) {
        return onRejected ? Promise.resolve(onRejected(e)) : Promise.reject(e);
      }
    },
    catch(onRejected: (reason: unknown) => unknown) {
      return Promise.resolve(result).catch(onRejected);
    },
  };
}

function createSupabaseListMock(config: MockQueryConfig) {
  const state = {
    table: "",
    selected: "",
    orderBy: "",
    orderAscending: true,
    limitValue: 0,
    ilikeColumn: undefined as string | undefined,
    ilikePattern: undefined as string | undefined,
  };

  const builder = {
    from(table: string) {
      state.table = table;
      return this;
    },
    select(selection: string) {
      state.selected = selection;
      return this;
    },
    order(column: string, options?: { ascending?: boolean }) {
      state.orderBy = column;
      state.orderAscending = options?.ascending ?? true;
      return this;
    },
    limit(value: number) {
      state.limitValue = value;
      return this;
    },
    ilike(column: string, pattern: string) {
      state.ilikeColumn = column;
      state.ilikePattern = pattern;
      return this;
    },
    then(
      onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return createThenableResult({
        data: config.data ?? [],
        error: config.error ?? null,
      }).then(onFulfilled, onRejected);
    },
  };

  return { client: builder, state };
}

function createSupabaseRpcMock(config: { data?: unknown; error?: Error | null }) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      return Promise.resolve({
        data: config.data,
        error: config.error ?? null,
      });
    },
  };

  return { client, calls };
}

Deno.test("executeListCustomReports classe les dashboards personnels, partagés et templates", async () => {
  const { client, state } = createSupabaseListMock({
    data: [
      {
        id: "d1",
        nom: "Mon dashboard",
        description: "Perso",
        owner_id: "user-1",
        is_shared: false,
        is_template: false,
        widgets: [{}, {}],
        updated_at: "2024-01-10T10:00:00Z",
      },
      {
        id: "d2",
        nom: "Dashboard partagé",
        description: "Visible à tous",
        owner_id: "user-2",
        is_shared: true,
        is_template: false,
        widgets: [{}],
        updated_at: "2024-01-09T10:00:00Z",
      },
      {
        id: "d3",
        nom: "Template ventes",
        description: "Modèle",
        owner_id: "user-3",
        is_shared: false,
        is_template: true,
        widgets: "not-an-array",
        updated_at: "2024-01-08T10:00:00Z",
      },
      {
        id: "d4",
        nom: "Autre privé",
        description: "Ne doit apparaître nulle part sauf total",
        owner_id: "user-4",
        is_shared: false,
        is_template: false,
        widgets: [],
        updated_at: "2024-01-07T10:00:00Z",
      },
    ],
  });

  const result = await executeListCustomReports(
    { supabase: client as never, userId: "user-1" },
    { search: "dash", limit: 10, include_templates: true },
  );

  assertEquals(state.table, "custom_dashboards");
  assertEquals(state.selected, "id, nom, description, owner_id, is_shared, is_template, icon, color, widgets, created_at, updated_at");
  assertEquals(state.orderBy, "updated_at");
  assertEquals(state.orderAscending, false);
  assertEquals(state.limitValue, 10);
  assertEquals(state.ilikeColumn, "nom");
  assertEquals(state.ilikePattern, "%dash%");

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals(result.data.total, 4);
  assertEquals(result.data.personal, [
    {
      id: "d1",
      nom: "Mon dashboard",
      description: "Perso",
      widgets_count: 2,
      updated_at: "2024-01-10T10:00:00Z",
    },
  ]);
  assertEquals(result.data.shared, [
    {
      id: "d2",
      nom: "Dashboard partagé",
      description: "Visible à tous",
    },
  ]);
  assertEquals(result.data.templates, [
    {
      id: "d3",
      nom: "Template ventes",
      description: "Modèle",
    },
  ]);
  assertEquals(Array.isArray(result.data.available_sources), true);
  assertEquals(result.data.available_sources.includes("mrr_evolution"), true);
});

Deno.test("executeListCustomReports limite à 100 et peut exclure les templates", async () => {
  const { client, state } = createSupabaseListMock({
    data: [
      {
        id: "t1",
        nom: "Template RH",
        description: "Template",
        owner_id: "user-9",
        is_shared: false,
        is_template: true,
        widgets: [],
        updated_at: "2024-01-01T00:00:00Z",
      },
    ],
  });

  const result = await executeListCustomReports(
    { supabase: client as never, userId: "user-1" },
    { limit: 1000, include_templates: false },
  );

  assertEquals(state.limitValue, 100);
  assertEquals(result.success, true);
  assertEquals(result.data.templates, []);
});

Deno.test("executeListCustomReports ne filtre pas par ilike si search est absent", async () => {
  const { client, state } = createSupabaseListMock({
    data: [],
  });

  const result = await executeListCustomReports(
    { supabase: client as never, userId: "user-1" },
    { limit: 5 },
  );

  assertEquals(result.success, true);
  assertEquals(state.ilikeColumn, undefined);
  assertEquals(state.ilikePattern, undefined);
});

Deno.test("executeListCustomReports retourne success false si Supabase renvoie une erreur", async () => {
  const { client } = createSupabaseListMock({
    error: new Error("db exploded"),
  });

  const result = await executeListCustomReports(
    { supabase: client as never, userId: "user-1" },
    {},
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "db exploded");
  assertExists(result.execution_time_ms);
});

Deno.test("executeRunCustomReport appelle la RPC get_report_data avec la source et les filtres", async () => {
  const { client, calls } = createSupabaseRpcMock({
    data: [{ month: "2024-01", total: 1200 }],
  });

  const result = await executeRunCustomReport(
    { supabase: client as never, userId: "user-1" },
    {
      source: "factures_par_mois",
      filters: { year: 2024, status: "paid" },
    },
  );

  assertEquals(calls.length, 1);
  assertEquals(calls[0], {
    fn: "get_report_data",
    args: {
      source_key: "factures_par_mois",
      params: { year: 2024, status: "paid" },
    },
  });

  assertEquals(result.success, true);
  assertEquals(result.data, {
    source: "factures_par_mois",
    filters: { year: 2024, status: "paid" },
    result: [{ month: "2024-01", total: 1200 }],
  });
});

Deno.test("executeRunCustomReport utilise un objet vide si filters est absent", async () => {
  const { client, calls } = createSupabaseRpcMock({
    data: { ok: true },
  });

  const result = await executeRunCustomReport(
    { supabase: client as never, userId: "user-1" },
    {
      source: "mrr_evolution",
    },
  );

  assertEquals(calls.length, 1);
  assertEquals(calls[0], {
    fn: "get_report_data",
    args: {
      source_key: "mrr_evolution",
      params: {},
    },
  });
  assertEquals(result.success, true);
  assertEquals(result.data, {
    source: "mrr_evolution",
    filters: {},
    result: { ok: true },
  });
});

Deno.test("executeRunCustomReport rejette une source absente", async () => {
  const { client } = createSupabaseRpcMock({ data: [] });

  const result = await executeRunCustomReport(
    { supabase: client as never, userId: "user-1" },
    { source: "" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "source requise");
});

Deno.test("executeRunCustomReport rejette une source non whitelistée", async () => {
  const { client } = createSupabaseRpcMock({ data: [] });

  const result = await executeRunCustomReport(
    { supabase: client as never, userId: "user-1" },
    { source: "source_inconnue", filters: { x: 1 } },
  );

  assertEquals(result.success, false);
  assertEquals(
    result.error,
    "Source non autorisée. Sources valides: etablissements_pipeline, etablissements_par_statut, factures_par_mois, factures_impayees, devis_par_statut, tresorerie_revenus_par_categorie, tresorerie_depenses_par_categorie, taches_par_statut, support_tickets_par_statut, rh_masse_salariale, formations_sessions, csm_health_distribution, churn_risk_distribution, sales_forecast_pipeline, activity_volume, mrr_evolution",
  );
});

Deno.test("executeRunCustomReport retourne success false si la RPC renvoie une erreur", async () => {
  const { client } = createSupabaseRpcMock({
    error: new Error("rpc failure"),
  });

  const result = await executeRunCustomReport(
    { supabase: client as never, userId: "user-1" },
    { source: "mrr_evolution" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "rpc failure");
});

Deno.test("executeExportCustomReport appelle l'edge function avec le bon payload et formate la réponse", async () => {
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const originalFetch = globalThis.fetch;

  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

  try {
    const imported = await import(`./custom-reports-tools.ts?export-success=${Date.now()}`);

    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            url: "https://signed.example/report.pdf",
            expires_at: "2026-01-01T00:00:00Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    }) as typeof fetch;

    const result = await imported.executeExportCustomReport(
      { supabase: {} as never, userId: "user-42" },
      {
        dashboard_id: "dash-123",
        filters: { month: "2024-05" },
        format: "pdf",
      },
    );

    assertEquals(capturedUrl, "https://example.supabase.co/functions/v1/report-export");
    assertExists(capturedInit);
    assertEquals(capturedInit?.method, "POST");
    assertEquals((capturedInit?.headers as Record<string, string>)["Content-Type"], "application/json");
    assertEquals((capturedInit?.headers as Record<string, string>)["Authorization"], "Bearer service-role-key");

    const body = JSON.parse(String(capturedInit?.body));
    assertEquals(body.dashboard_id, "dash-123");
    assertEquals(body.source, undefined);
    assertEquals(body.filters, { month: "2024-05" });
    assertEquals(body.format, "pdf");
    assertEquals(body.user_id, "user-42");

    assertEquals(result.success, true);
    assertEquals(result.data, {
      message: "Rapport exporté en PDF",
      url: "https://signed.example/report.pdf",
      expires_at: "2026-01-01T00:00:00Z",
      format: "pdf",
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", previousUrl);
    if (previousKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousKey);
  }
});

Deno.test("executeExportCustomReport utilise signed_url si url est absente et format par défaut pdf", async () => {
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const originalFetch = globalThis.fetch;

  Deno.env.set("SUPABASE_URL", "https://offline.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "key-2");

  try {
    const imported = await import(`./custom-reports-tools.ts?export-signed-url=${Date.now()}`);

    let capturedBody: Record<string, unknown> | undefined;

    globalThis.fetch = ((_: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body));
      return Promise.resolve(
        new Response(
          JSON.stringify({
            signed_url: "https://signed.example/report.csv",
            expires_at: "2026-02-01T00:00:00Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    }) as typeof fetch;

    const result = await imported.executeExportCustomReport(
      { supabase: {} as never, userId: "user-9" },
      {
        source: "mrr_evolution",
      },
    );

    assertExists(capturedBody);
    assertEquals(capturedBody?.dashboard_id, undefined);
    assertEquals(capturedBody?.source, "mrr_evolution");
    assertEquals(capturedBody?.filters, {});
    assertEquals(capturedBody?.format, "pdf");
    assertEquals(capturedBody?.user_id, "user-9");

    assertEquals(result.success, true);
    assertEquals(result.data.url, "https://signed.example/report.csv");
    assertEquals(result.data.format, "pdf");
    assertEquals(result.data.message, "Rapport exporté en PDF");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", previousUrl);
    if (previousKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousKey);
  }
});

Deno.test("executeExportCustomReport rejette un format invalide", async () => {
  const result = await executeExportCustomReport(
    { supabase: {} as never, userId: "user-1" },
    {
      source: "mrr_evolution",
      format: "docx" as "pdf",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "Format invalide (pdf/xlsx/csv)");
});

Deno.test("executeExportCustomReport exige dashboard_id ou source", async () => {
  const result = await executeExportCustomReport(
    { supabase: {} as never, userId: "user-1" },
    {},
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "dashboard_id ou source requis");
});

Deno.test("executeExportCustomReport retourne l'erreur métier renvoyée par l'edge function", async () => {
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const originalFetch = globalThis.fetch;

  Deno.env.set("SUPABASE_URL", "https://edge.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "key-3");

  try {
    const imported = await import(`./custom-reports-tools.ts?export-error=${Date.now()}`);

    globalThis.fetch = (() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({ error: "export impossible" }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    }) as typeof fetch;

    const result = await imported.executeExportCustomReport(
      { supabase: {} as never, userId: "user-1" },
      {
        source: "factures_par_mois",
        format: "xlsx",
      },
    );

    assertEquals(result.success, false);
    assertEquals(result.error, "export impossible");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", previousUrl);
    if (previousKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousKey);
  }
});

Deno.test("executeExportCustomReport gère une réponse non JSON en erreur HTTP", async () => {
  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const originalFetch = globalThis.fetch;

  Deno.env.set("SUPABASE_URL", "https://edge.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "key-4");

  try {
    const imported = await import(`./custom-reports-tools.ts?export-http-error=${Date.now()}`);

    globalThis.fetch = (() => {
      return Promise.resolve(
        new Response("not-json", {
          status: 502,
          headers: { "content-type": "text/plain" },
        }),
      );
    }) as typeof fetch;

    const result = await imported.executeExportCustomReport(
      { supabase: {} as never, userId: "user-1" },
      {
        source: "activity_volume",
        format: "csv",
      },
    );

    assertEquals(result.success, false);
    assertEquals(result.error, "HTTP 502");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", previousUrl);
    if (previousKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousKey);
  }
});