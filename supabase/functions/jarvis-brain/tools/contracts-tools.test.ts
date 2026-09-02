import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeAiAssistContract,
  executeGenerateContract,
  executeGetContratAlerts,
  executeManageContratAvenant,
  executeManageContractTemplate,
  executeManageDocument,
  executeRequestSignature,
} from "./contracts-tools.ts";

function dbResult(data: unknown, error: unknown = null) {
  return { data, error };
}

function createSupabaseMock(config: Record<string, any> = {}) {
  const calls: any[] = [];
  const storageCalls: any[] = [];
  const functionCalls: any[] = [];

  function normalize(value: any) {
    if (value instanceof Error) return { data: null, error: value };
    if (value && (Object.hasOwn(value, "data") || Object.hasOwn(value, "error"))) {
      return value;
    }
    return { data: value, error: null };
  }

  function resolveTable(table: string, builder: any) {
    const resolver = config.tables?.[table];

    if (typeof resolver === "function") {
      return normalize(resolver({
        table,
        op: builder._state.op,
        state: builder._state,
        calls,
      }));
    }

    if (resolver && Object.hasOwn(resolver, builder._state.op)) {
      const value = resolver[builder._state.op];
      return normalize(typeof value === "function"
        ? value({
          table,
          op: builder._state.op,
          state: builder._state,
          calls,
        })
        : value);
    }

    return { data: null, error: null };
  }

  function makeBuilder(table: string) {
    let builder: any;
    const state: any = {
      table,
      op: "select",
      payload: undefined,
      filters: [],
      orders: [],
      limits: [],
      selected: [],
    };

    builder = {
      _state: state,

      select(columns = "*") {
        calls.push({ table, method: "select", args: [columns] });
        state.selected.push(columns);
        return builder;
      },

      insert(payload: unknown) {
        calls.push({ table, method: "insert", args: [payload] });
        state.op = "insert";
        state.payload = payload;
        return builder;
      },

      update(payload: unknown) {
        calls.push({ table, method: "update", args: [payload] });
        state.op = "update";
        state.payload = payload;
        return builder;
      },

      delete() {
        calls.push({ table, method: "delete", args: [] });
        state.op = "delete";
        return builder;
      },

      eq(column: string, value: unknown) {
        calls.push({ table, method: "eq", args: [column, value] });
        state.filters.push({ column, value });

        if (typeof config.throwOnEq === "function") {
          const thrown = config.throwOnEq({ table, column, value, state });
          if (thrown) throw thrown === true ? new Error("eq failed") : thrown;
        }

        return builder;
      },

      order(column: string, options: unknown) {
        calls.push({ table, method: "order", args: [column, options] });
        state.orders.push({ column, options });
        return builder;
      },

      limit(count: number) {
        calls.push({ table, method: "limit", args: [count] });
        state.limits.push(count);
        return resolveTable(table, builder);
      },

      single() {
        calls.push({ table, method: "single", args: [] });
        return resolveTable(table, builder);
      },

      then(onFulfilled: any, onRejected: any) {
        return Promise.resolve(resolveTable(table, builder)).then(onFulfilled, onRejected);
      },
    };

    return builder;
  }

  const supabase = {
    from(table: string) {
      calls.push({ table, method: "from", args: [table] });
      return makeBuilder(table);
    },

    functions: {
      invoke(name: string, options: unknown) {
        functionCalls.push({ name, options });
        const invoke = config.functions?.invoke ??
          (() => dbResult({ result: "ok" }));
        return Promise.resolve(normalize(invoke({ name, options })));
      },
    },

    storage: {
      from(bucket: string) {
        storageCalls.push({ method: "from", bucket });

        return {
          list(path: string, options: unknown) {
            storageCalls.push({ method: "list", bucket, path, options });
            const list = config.storage?.list ??
              (() => dbResult([]));
            return Promise.resolve(normalize(list({ bucket, path, options })));
          },

          getPublicUrl(path: string) {
            storageCalls.push({ method: "getPublicUrl", bucket, path });
            const getPublicUrl = config.storage?.getPublicUrl ??
              (() => ({ data: { publicUrl: `https://storage.local/${bucket}/${path}` } }));
            return getPublicUrl({ bucket, path });
          },

          remove(paths: string[]) {
            storageCalls.push({ method: "remove", bucket, paths });
            const remove = config.storage?.remove ??
              (() => dbResult([]));
            return Promise.resolve(normalize(remove({ bucket, paths })));
          },
        };
      },
    },
  };

  return { supabase, calls, storageCalls, functionCalls };
}

Deno.test("module loads and exports contract tool functions", () => {
  assertExists(executeGenerateContract);
  assertExists(executeAiAssistContract);
  assertExists(executeRequestSignature);
  assertExists(executeManageContractTemplate);
  assertExists(executeManageContratAvenant);
  assertExists(executeGetContratAlerts);
  assertExists(executeManageDocument);
});

Deno.test("executeGenerateContract creates a draft contract with merged establishment variables", async () => {
  const insertedContracts: any[] = [];

  const { supabase } = createSupabaseMock({
    tables: {
      contrat_modeles: ({ op }: any) => {
        assertEquals(op, "select");
        return dbResult({
          id: "tpl-1",
          nom: "Convention de partenariat",
          contenu: "Bonjour {{etablissement_nom}}",
        });
      },
      etablissements: () =>
        dbResult({
          id: "etab-1",
          nom: "Clinique Test",
          siret: "12345678900011",
          adresse: "1 rue du Test",
          email: "contact@example.test",
          telephone: "0102030405",
        }),
      contrats: ({ op, state }: any) => {
        assertEquals(op, "insert");
        insertedContracts.push(state.payload);
        return dbResult({
          id: "contract-1",
          nom: state.payload.nom,
        });
      },
    },
  });

  const result = await executeGenerateContract(
    { supabase, userId: "user-42" } as any,
    {
      template_id: "tpl-1",
      etablissement_id: "etab-1",
      variables: {
        montant_ht: 1200,
        duree_mois: 12,
      },
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Contrat généré: Convention de partenariat - Clinique Test");
  assertEquals(result.data.contract_id, "contract-1");
  assertEquals(result.data.etablissement, "Clinique Test");
  assertExists(result.execution_time_ms);

  assertEquals(insertedContracts.length, 1);
  assertEquals(insertedContracts[0].modele_id, "tpl-1");
  assertEquals(insertedContracts[0].etablissement_id, "etab-1");
  assertEquals(insertedContracts[0].nom, "Convention de partenariat - Clinique Test");
  assertEquals(insertedContracts[0].contenu, "Bonjour {{etablissement_nom}}");
  assertEquals(insertedContracts[0].statut, "brouillon");
  assertEquals(insertedContracts[0].created_by, "user-42");
  assertEquals(insertedContracts[0].variables.montant_ht, 1200);
  assertEquals(insertedContracts[0].variables.duree_mois, 12);
  assertEquals(insertedContracts[0].variables.etablissement_nom, "Clinique Test");
  assertEquals(insertedContracts[0].variables.etablissement_siret, "12345678900011");
  assertEquals(insertedContracts[0].variables.etablissement_adresse, "1 rue du Test");
  assertExists(insertedContracts[0].variables.date_generation);
});

Deno.test("executeGenerateContract returns a failure result when template lookup fails", async () => {
  const { supabase } = createSupabaseMock({
    tables: {
      contrat_modeles: () => dbResult(null, new Error("template not found")),
    },
  });

  const result = await executeGenerateContract(
    { supabase, userId: "user-42" } as any,
    {
      template_id: "missing-template",
      etablissement_id: "etab-1",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "template not found");
  assertExists(result.execution_time_ms);
});

Deno.test("executeAiAssistContract invokes the Supabase edge function with action, content and context", async () => {
  const { supabase, functionCalls } = createSupabaseMock({
    functions: {
      invoke: ({ name, options }: any) => {
        assertEquals(name, "contract-ai-assist");
        assertEquals(options, {
          body: {
            action: "adapt",
            content: "Texte initial",
            context: "Adapter pour un établissement de santé",
          },
        });

        return dbResult({
          result: "Texte adapté",
          suggestions: ["Ajouter une clause de résiliation"],
        });
      },
    },
  });

  const result = await executeAiAssistContract(
    { supabase, userId: "user-42" } as any,
    {
      action: "adapt",
      content: "Texte initial",
      context: "Adapter pour un établissement de santé",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.action, "adapt");
  assertEquals(result.data.result, "Texte adapté");
  assertEquals(result.data.suggestions, ["Ajouter une clause de résiliation"]);
  assertEquals(functionCalls.length, 1);
});

Deno.test("executeAiAssistContract falls back to returned content when result is absent", async () => {
  const { supabase } = createSupabaseMock({
    functions: {
      invoke: () =>
        dbResult({
          content: "Résumé du contrat",
        }),
    },
  });

  const result = await executeAiAssistContract(
    { supabase, userId: "user-42" } as any,
    {
      action: "summarize",
      content: "Contrat long",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.action, "summarize");
  assertEquals(result.data.result, "Résumé du contrat");
});

Deno.test("executeAiAssistContract returns a failure result when invoke returns an error", async () => {
  const { supabase } = createSupabaseMock({
    functions: {
      invoke: () => dbResult(null, new Error("AI unavailable")),
    },
  });

  const result = await executeAiAssistContract(
    { supabase, userId: "user-42" } as any,
    {
      action: "check",
      content: "Clause à vérifier",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "AI unavailable");
});

Deno.test("executeRequestSignature updates contract status and returns signer emails", async () => {
  const { supabase, calls } = createSupabaseMock({
    tables: {
      contrats: () => dbResult({ id: "doc-1" }),
    },
  });

  const result = await executeRequestSignature(
    { supabase, userId: "user-42" } as any,
    {
      document_id: "doc-1",
      signataires: [
        { email: "alice@example.test", name: "Alice" },
        { email: "bob@example.test", name: "Bob" },
      ],
    },
  );

  const updateCall = calls.find((call) => call.table === "contrats" && call.method === "update");
  const filterCall = calls.find((call) => call.table === "contrats" && call.method === "eq");

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Demande de signature envoyée à 2 personne(s)");
  assertEquals(result.data.document_id, "doc-1");
  assertEquals(result.data.signataires, ["alice@example.test", "bob@example.test"]);
  assertEquals(updateCall.args[0].statut, "en_signature");
  assertExists(updateCall.args[0].signature_requested_at);
  assertEquals(filterCall.args, ["id", "doc-1"]);
});

Deno.test("executeRequestSignature returns a failure result when status update throws", async () => {
  const { supabase } = createSupabaseMock({
    throwOnEq: ({ table }: any) => table === "contrats" ? new Error("update denied") : false,
  });

  const result = await executeRequestSignature(
    { supabase, userId: "user-42" } as any,
    {
      document_id: "doc-err",
      signataires: [{ email: "alice@example.test", name: "Alice" }],
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "update denied");
});

Deno.test("executeManageContractTemplate lists templates ordered by newest first", async () => {
  const templates = [
    { id: "tpl-2", nom: "Nouveau modèle" },
    { id: "tpl-1", nom: "Ancien modèle" },
  ];

  const { supabase, calls } = createSupabaseMock({
    tables: {
      contrat_modeles: ({ op }: any) => {
        assertEquals(op, "select");
        return dbResult(templates);
      },
    },
  });

  const result = await executeManageContractTemplate(
    { supabase, userId: "user-42" } as any,
    { action: "list" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.templates, templates);
  assertEquals(result.data.count, 2);
  assertEquals(
    calls.find((call) => call.table === "contrat_modeles" && call.method === "order").args,
    ["created_at", { ascending: false }],
  );
});

Deno.test("executeManageContractTemplate creates template with current user as creator", async () => {
  let insertedPayload: any;

  const { supabase } = createSupabaseMock({
    tables: {
      contrat_modeles: ({ op, state }: any) => {
        assertEquals(op, "insert");
        insertedPayload = state.payload;
        return dbResult({
          id: "tpl-created",
          ...state.payload,
        });
      },
    },
  });

  const result = await executeManageContractTemplate(
    { supabase, userId: "creator-1" } as any,
    {
      action: "create",
      data: {
        nom: "Contrat cadre",
        contenu: "Contenu modèle",
      },
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Modèle créé");
  assertEquals(result.data.template.id, "tpl-created");
  assertEquals(insertedPayload, {
    nom: "Contrat cadre",
    contenu: "Contenu modèle",
    created_by: "creator-1",
  });
});

Deno.test("executeManageContractTemplate updates an existing template", async () => {
  const { supabase, calls } = createSupabaseMock({
    tables: {
      contrat_modeles: ({ op, state }: any) => {
        assertEquals(op, "update");
        return dbResult({
          id: "tpl-1",
          ...state.payload,
        });
      },
    },
  });

  const result = await executeManageContractTemplate(
    { supabase, userId: "user-42" } as any,
    {
      action: "update",
      template_id: "tpl-1",
      data: {
        nom: "Modèle modifié",
      },
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Modèle mis à jour");
  assertEquals(result.data.template, { id: "tpl-1", nom: "Modèle modifié" });
  assertEquals(
    calls.find((call) => call.table === "contrat_modeles" && call.method === "eq").args,
    ["id", "tpl-1"],
  );
});

Deno.test("executeManageContractTemplate rejects update without template_id", async () => {
  const { supabase } = createSupabaseMock();

  const result = await executeManageContractTemplate(
    { supabase, userId: "user-42" } as any,
    {
      action: "update",
      data: {
        nom: "Sans identifiant",
      },
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "template_id required");
});

Deno.test("executeManageContractTemplate deletes an existing template", async () => {
  const { supabase, calls } = createSupabaseMock({
    tables: {
      contrat_modeles: ({ op }: any) => {
        assertEquals(op, "delete");
        return dbResult(null);
      },
    },
  });

  const result = await executeManageContractTemplate(
    { supabase, userId: "user-42" } as any,
    {
      action: "delete",
      template_id: "tpl-delete",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Modèle supprimé");
  assertEquals(
    calls.find((call) => call.table === "contrat_modeles" && call.method === "eq").args,
    ["id", "tpl-delete"],
  );
});

Deno.test("executeManageContratAvenant lists avenants for a contract", async () => {
  const avenants = [
    { id: "av-2", contrat_id: "contract-1", objet: "Prix" },
    { id: "av-1", contrat_id: "contract-1", objet: "Durée" },
  ];

  const { supabase, calls } = createSupabaseMock({
    tables: {
      contrat_avenants: ({ op }: any) => {
        assertEquals(op, "select");
        return dbResult(avenants);
      },
    },
  });

  const result = await executeManageContratAvenant(
    { supabase, userId: "user-42" } as any,
    {
      action: "list",
      contrat_id: "contract-1",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.avenants, avenants);
  assertEquals(result.data.count, 2);
  assertEquals(
    calls.find((call) => call.table === "contrat_avenants" && call.method === "eq").args,
    ["contrat_id", "contract-1"],
  );
});

Deno.test("executeManageContratAvenant creates an avenant with created_by", async () => {
  let insertedPayload: any;

  const { supabase } = createSupabaseMock({
    tables: {
      contrat_avenants: ({ op, state }: any) => {
        assertEquals(op, "insert");
        insertedPayload = state.payload;
        return dbResult({
          id: "av-created",
          ...state.payload,
        });
      },
    },
  });

  const result = await executeManageContratAvenant(
    { supabase, userId: "user-99" } as any,
    {
      action: "create",
      contrat_id: "contract-1",
      data: {
        objet: "Modification tarifaire",
        montant: 250,
      },
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Avenant créé");
  assertEquals(result.data.avenant.id, "av-created");
  assertEquals(insertedPayload, {
    contrat_id: "contract-1",
    objet: "Modification tarifaire",
    montant: 250,
    created_by: "user-99",
  });
});

Deno.test("executeManageContratAvenant returns failure when listing without contrat_id", async () => {
  const { supabase } = createSupabaseMock();

  const result = await executeManageContratAvenant(
    { supabase, userId: "user-42" } as any,
    { action: "list" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "contrat_id required");
});

Deno.test("executeManageContratAvenant returns placeholder success for unknown action", async () => {
  const { supabase } = createSupabaseMock();

  const result = await executeManageContratAvenant(
    { supabase, userId: "user-42" } as any,
    { action: "archive", avenant_id: "av-1" },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Action archive not implemented");
});

Deno.test("executeGetContratAlerts applies contract and status filters then limits results", async () => {
  const alerts = [
    { id: "alert-1", contrat_id: "contract-1", status: "open" },
    { id: "alert-2", contrat_id: "contract-1", status: "open" },
  ];

  const { supabase, calls } = createSupabaseMock({
    tables: {
      contrat_alertes: ({ op }: any) => {
        assertEquals(op, "select");
        return dbResult(alerts);
      },
    },
  });

  const result = await executeGetContratAlerts(
    { supabase, userId: "user-42" } as any,
    {
      contrat_id: "contract-1",
      status: "open",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.alerts, alerts);
  assertEquals(result.data.count, 2);
  assertEquals(
    calls.filter((call) => call.table === "contrat_alertes" && call.method === "eq").map((call) => call.args),
    [
      ["contrat_id", "contract-1"],
      ["status", "open"],
    ],
  );
  assertEquals(
    calls.find((call) => call.table === "contrat_alertes" && call.method === "order").args,
    ["created_at", { ascending: false }],
  );
  assertEquals(
    calls.find((call) => call.table === "contrat_alertes" && call.method === "limit").args,
    [50],
  );
});

Deno.test("executeGetContratAlerts returns failure when alert query returns an error", async () => {
  const { supabase } = createSupabaseMock({
    tables: {
      contrat_alertes: () => dbResult(null, new Error("alerts query failed")),
    },
  });

  const result = await executeGetContratAlerts(
    { supabase, userId: "user-42" } as any,
    {},
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "alerts query failed");
});

Deno.test("executeManageDocument lists files from provided bucket and path", async () => {
  const files = [
    { name: "contrat-a.pdf" },
    { name: "contrat-b.pdf" },
  ];

  const { supabase, storageCalls } = createSupabaseMock({
    storage: {
      list: ({ bucket, path, options }: any) => {
        assertEquals(bucket, "contracts");
        assertEquals(path, "2024/");
        assertEquals(options, { limit: 100 });
        return dbResult(files);
      },
    },
  });

  const result = await executeManageDocument(
    { supabase, userId: "user-42" } as any,
    {
      action: "list",
      bucket: "contracts",
      path: "2024/",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.files, files);
  assertEquals(result.data.count, 2);
  assertEquals(result.data.path, "2024/");
  assertEquals(storageCalls[0], { method: "from", bucket: "contracts" });
});

Deno.test("executeManageDocument gets a public URL for a document path", async () => {
  const { supabase } = createSupabaseMock({
    storage: {
      getPublicUrl: ({ bucket, path }: any) => {
        assertEquals(bucket, "documents");
        assertEquals(path, "contrats/contract-1.pdf");
        return {
          data: {
            publicUrl: "https://storage.example.test/documents/contrats/contract-1.pdf",
          },
        };
      },
    },
  });

  const result = await executeManageDocument(
    { supabase, userId: "user-42" } as any,
    {
      action: "get_url",
      path: "contrats/contract-1.pdf",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.url, "https://storage.example.test/documents/contrats/contract-1.pdf");
  assertEquals(result.data.path, "contrats/contract-1.pdf");
});

Deno.test("executeManageDocument deletes a document path", async () => {
  const { supabase, storageCalls } = createSupabaseMock({
    storage: {
      remove: ({ bucket, paths }: any) => {
        assertEquals(bucket, "documents");
        assertEquals(paths, ["contrats/obsolete.pdf"]);
        return dbResult([]);
      },
    },
  });

  const result = await executeManageDocument(
    { supabase, userId: "user-42" } as any,
    {
      action: "delete",
      path: "contrats/obsolete.pdf",
    },
  );

  assertEquals(result.success, true);
  assertEquals(result.data.message, "Document supprimé");
  assertEquals(result.data.path, "contrats/obsolete.pdf");
  assertEquals(
    storageCalls.find((call) => call.method === "remove"),
    { method: "remove", bucket: "documents", paths: ["contrats/obsolete.pdf"] },
  );
});

Deno.test("executeManageDocument returns failure when get_url is missing path", async () => {
  const { supabase } = createSupabaseMock();

  const result = await executeManageDocument(
    { supabase, userId: "user-42" } as any,
    {
      action: "get_url",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "path required");
});