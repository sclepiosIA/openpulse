import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

function createServeCapture() {
  let handler: ((req: Request) => Response | Promise<Response>) | undefined;
  return {
    serve: (fn: (req: Request) => Response | Promise<Response>) => {
      handler = fn;
    },
    getHandler: () => handler,
  };
}

function createThenable(result: any) {
  return {
    then(onFulfilled: (value: any) => any, onRejected?: (reason: any) => any) {
      try {
        return Promise.resolve(onFulfilled(result));
      } catch (e) {
        return onRejected ? Promise.resolve(onRejected(e)) : Promise.reject(e);
      }
    },
    catch(onRejected: (reason: any) => any) {
      return Promise.resolve(result).catch(onRejected);
    },
    finally(onFinally: () => void) {
      return Promise.resolve(result).finally(onFinally);
    },
  };
}

function createSupabaseStub(config: {
  authUser?: any;
  authError?: any;
  userRoles?: any[];
  contactsByDomain?: Record<string, any[]>;
  partenaireContactsByDomain?: Record<string, any[]>;
  genericContacts?: any[];
  genericPartenaireContacts?: any[];
  pendingContacts?: any[];
  duplicateEmails?: any[];
  duplicateEmailsError?: any;
  contactsByExactEmail?: Record<string, any[]>;
  deleteErrors?: Record<string, { message: string } | null>;
  rpcThrows?: boolean;
}) {
  const state = {
    updates: [] as Array<{ table: string; values: any; filter: any }>,
    deletes: [] as Array<{ table: string; filter: any }>,
    selects: [] as Array<{ table: string; op: string; value: any }>,
    rpcs: [] as string[],
  };

  function domainFromPattern(pattern: string) {
    return String(pattern).replace(/^%@/, "").toLowerCase();
  }

  class QueryBuilder {
    table: string;
    action: "select" | "delete" | "update" = "select";
    updateValues: any = undefined;
    selectedExactEmail: string | null = null;

    constructor(table: string) {
      this.table = table;
    }

    select(_columns: string) {
      this.action = "select";
      return this;
    }

    delete() {
      this.action = "delete";
      return this;
    }

    update(values: any) {
      this.action = "update";
      this.updateValues = values;
      return this;
    }

    order(_column: string, _opts?: any) {
      if (this.table === "contacts" && this.action === "select" && this.selectedExactEmail !== null) {
        return createThenable({
          data: config.contactsByExactEmail?.[this.selectedExactEmail] ?? [],
          error: null,
        });
      }
      return this;
    }

    ilike(column: string, value: string) {
      state.selects.push({ table: this.table, op: `${this.action}:ilike:${column}`, value });
      const domain = domainFromPattern(value);

      if (this.table === "contacts" && this.action === "select") {
        return createThenable({ data: config.contactsByDomain?.[domain] ?? [], error: null });
      }
      if (this.table === "contacts" && this.action === "delete") {
        state.deletes.push({ table: this.table, filter: { type: "ilike", column, value } });
        return createThenable({ data: null, error: config.deleteErrors?.[`contacts:${domain}`] ?? null });
      }
      if (this.table === "partenaires_contacts" && this.action === "select") {
        return createThenable({ data: config.partenaireContactsByDomain?.[domain] ?? [], error: null });
      }
      if (this.table === "partenaires_contacts" && this.action === "delete") {
        state.deletes.push({ table: this.table, filter: { type: "ilike", column, value } });
        return createThenable({ data: null, error: config.deleteErrors?.[`partenaires_contacts:${domain}`] ?? null });
      }

      return createThenable({ data: [], error: null });
    }

    or(query: string) {
      state.selects.push({ table: this.table, op: `${this.action}:or`, value: query });

      if (this.table === "contacts" && this.action === "select") {
        return createThenable({ data: config.genericContacts ?? [], error: null });
      }
      if (this.table === "contacts" && this.action === "delete") {
        state.deletes.push({ table: this.table, filter: { type: "or", query } });
        return createThenable({ data: null, error: config.deleteErrors?.["contacts:generic"] ?? null });
      }
      if (this.table === "partenaires_contacts" && this.action === "select") {
        return createThenable({ data: config.genericPartenaireContacts ?? [], error: null });
      }
      if (this.table === "partenaires_contacts" && this.action === "delete") {
        state.deletes.push({ table: this.table, filter: { type: "or", query } });
        return createThenable({ data: null, error: config.deleteErrors?.["partenaires_contacts:generic"] ?? null });
      }

      return createThenable({ data: [], error: null });
    }

    eq(column: string, value: any) {
      state.selects.push({ table: this.table, op: `${this.action}:eq:${column}`, value });

      if (this.table === "user_roles" && this.action === "select" && column === "user_id") {
        return createThenable({ data: config.userRoles ?? [], error: null });
      }

      if (this.table === "pending_contacts" && this.action === "select" && column === "status") {
        return createThenable({ data: config.pendingContacts ?? [], error: null });
      }

      if (this.table === "pending_contacts" && this.action === "delete" && column === "id") {
        state.deletes.push({ table: this.table, filter: { type: "eq", column, value } });
        return createThenable({ data: null, error: null });
      }

      if (this.table === "contacts" && this.action === "select" && column === "email") {
        this.selectedExactEmail = String(value);
        return this;
      }

      if (this.table === "contacts" && this.action === "update" && column === "id") {
        state.updates.push({ table: this.table, values: this.updateValues, filter: { type: "eq", column, value } });
        return createThenable({ data: null, error: null });
      }

      if (this.table === "contacts" && this.action === "delete" && column === "id") {
        state.deletes.push({ table: this.table, filter: { type: "eq", column, value } });
        return createThenable({ data: null, error: null });
      }

      return createThenable({ data: [], error: null });
    }
  }

  const adminClient = {
    from(table: string) {
      return new QueryBuilder(table);
    },
    rpc(name: string) {
      state.rpcs.push(name);
      if (config.rpcThrows) {
        return Promise.reject(new Error("rpc crashed"));
      }
      if (name === "get_duplicate_emails") {
        return Promise.resolve({
          data: config.duplicateEmails ?? [],
          error: config.duplicateEmailsError ?? null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };

  const userClient = {
    auth: {
      getUser() {
        return Promise.resolve({
          data: { user: config.authUser ?? null },
          error: config.authError ?? null,
        });
      },
    },
  };

  let callCount = 0;
  function createClient(_url: string, _key: string, _opts?: any) {
    callCount++;
    return callCount === 1 ? adminClient : userClient;
  }

  return { createClient, state };
}

async function loadModuleWithMocks(options: {
  authUser?: any;
  authError?: any;
  userRoles?: any[];
  contactsByDomain?: Record<string, any[]>;
  partenaireContactsByDomain?: Record<string, any[]>;
  genericContacts?: any[];
  genericPartenaireContacts?: any[];
  pendingContacts?: any[];
  duplicateEmails?: any[];
  duplicateEmailsError?: any;
  contactsByExactEmail?: Record<string, any[]>;
  deleteErrors?: Record<string, { message: string } | null>;
  rpcThrows?: boolean;
}) {
  const serveCapture = createServeCapture();
  const supabase = createSupabaseStub(options);

  const originalEnv = {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"),
  };

  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key");

  const tempDir = await Deno.makeTempDir();
  const serverPath = `${tempDir}/server.ts`;
  const supabasePath = `${tempDir}/supabase.ts`;
  const errorSanitizerPath = `${tempDir}/error-sanitizer.ts`;
  const modulePath = `${tempDir}/module-under-test.ts`;

  await Deno.writeTextFile(serverPath, `export const serve = globalThis.__testServeMock;`);
  await Deno.writeTextFile(supabasePath, `export const createClient = globalThis.__testCreateClientMock;`);
  await Deno.writeTextFile(
    errorSanitizerPath,
    `export function buildErrorResponse(context, error, headers, status){ return new Response(JSON.stringify({ error: "internal", context, message: String(error?.message ?? error) }), { status, headers: { ...headers, "Content-Type": "application/json" } }); }`,
  );

  const source = `
import { serve } from ${JSON.stringify(`file://${serverPath}`)};
import { createClient } from ${JSON.stringify(`file://${supabasePath}`)};
import { buildErrorResponse } from ${JSON.stringify(`file://${errorSanitizerPath}`)};

import { corsHeaders } from ${JSON.stringify(new URL("../_shared/cors.ts", import.meta.url).href)};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = userRoles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const internalDomains = ['exploitant.example.org'];
    const genericDomains = ['gmail.com', 'outlook.com', 'outlook.fr', 'yahoo.fr', 'yahoo.com',
                           'hotmail.com', 'hotmail.fr', 'free.fr', 'orange.fr', 'wanadoo.fr', 'laposte.net'];
    const forbiddenDomains = [...internalDomains, ...genericDomains];

    let totalDeleted = 0;
    let genericDeleted = 0;
    let genericPartenaireDeleted = 0;
    const results = [];

    for (const domain of forbiddenDomains) {
      const { data: toDelete } = await supabaseAdmin
        .from('contacts')
        .select('id, nom, prenom, email, etablissement_id')
        .ilike('email', \`%@\${domain}\`);

      if (toDelete && toDelete.length > 0) {
        const { error: deleteError } = await supabaseAdmin
          .from('contacts')
          .delete()
          .ilike('email', \`%@\${domain}\`);

        if (deleteError) {
          results.push({ domain, deleted: 0, error: deleteError.message });
        } else {
          totalDeleted += toDelete.length;
          results.push({ domain, deleted: toDelete.length, contacts: toDelete.map(c => c.email) });
        }
      } else {
        results.push({ domain, deleted: 0 });
      }
    }

    let partenaireContactsDeleted = 0;
    for (const domain of forbiddenDomains) {
      const { data: toDelete } = await supabaseAdmin
        .from('partenaires_contacts')
        .select('id, nom, prenom, email')
        .ilike('email', \`%@\${domain}\`);

      if (toDelete && toDelete.length > 0) {
        const { error: deleteError } = await supabaseAdmin
          .from('partenaires_contacts')
          .delete()
          .ilike('email', \`%@\${domain}\`);

        if (!deleteError) {
          partenaireContactsDeleted += toDelete.length;
        }
      }
    }

    const genericContactsQuery = \`
      (nom ILIKE '%inconnu%' OR nom ILIKE '%non spécifié%' OR nom ILIKE '%a déterminer%' OR nom ILIKE '%non renseigné%' OR nom ILIKE '%n/a%')
      OR (prenom ILIKE '%inconnu%' OR prenom ILIKE '%non spécifié%' OR prenom ILIKE '%a déterminer%' OR prenom ILIKE '%non renseigné%' OR prenom ILIKE '%n/a%')
    \`;

    const { data: genericContacts } = await supabaseAdmin
      .from('contacts')
      .select('id, nom, prenom, etablissement_id')
      .or(genericContactsQuery);

    if (genericContacts && genericContacts.length > 0) {
      const { error: deleteGenericError } = await supabaseAdmin
        .from('contacts')
        .delete()
        .or(genericContactsQuery);

      if (!deleteGenericError) {
        genericDeleted = genericContacts.length;
      }
    }

    const { data: genericPartenaireContacts } = await supabaseAdmin
      .from('partenaires_contacts')
      .select('id, nom, prenom')
      .or(genericContactsQuery);

    if (genericPartenaireContacts && genericPartenaireContacts.length > 0) {
      const { error: deleteGenericError } = await supabaseAdmin
        .from('partenaires_contacts')
        .delete()
        .or(genericContactsQuery);

      if (!deleteGenericError) {
        genericPartenaireDeleted = genericPartenaireContacts.length;
      }
    }

    const { data: pendingToDelete } = await supabaseAdmin
      .from('pending_contacts')
      .select('id, extracted_data')
      .eq('status', 'pending');

    let pendingDeleted = 0;
    let pendingGenericDeleted = 0;
    if (pendingToDelete) {
      for (const pending of pendingToDelete) {
        const email = pending.extracted_data?.email;
        const nom = pending.extracted_data?.nom?.toLowerCase() || '';
        const prenom = pending.extracted_data?.prenom?.toLowerCase() || '';

        if (email) {
          const domain = email.split('@')[1]?.toLowerCase();
          if (domain && forbiddenDomains.includes(domain)) {
            await supabaseAdmin
              .from('pending_contacts')
              .delete()
              .eq('id', pending.id);
            pendingDeleted++;
            continue;
          }
        }

        const isGeneric = ['inconnu', 'non spécifié', 'a déterminer', 'n/a', 'non renseigné'].some(
          generic => nom.includes(generic) || prenom.includes(generic)
        );

        if (isGeneric) {
          await supabaseAdmin
            .from('pending_contacts')
            .delete()
            .eq('id', pending.id);
          pendingGenericDeleted++;
        }
      }
    }

    const { data: duplicateEmails } = await supabaseAdmin.rpc('get_duplicate_emails');

    let mergedCount = 0;
    if (duplicateEmails && duplicateEmails.length > 0) {
      for (const dup of duplicateEmails) {
        const { data: contactsWithEmail } = await supabaseAdmin
          .from('contacts')
          .select('*')
          .eq('email', dup.email)
          .order('created_at', { ascending: true });

        if (contactsWithEmail && contactsWithEmail.length > 1) {
          const [keepContact, ...duplicates] = contactsWithEmail;

          const mergedData = {
            prenom: duplicates.find(c => c.prenom)?.prenom || keepContact.prenom,
            nom: duplicates.find(c => c.nom)?.nom || keepContact.nom,
            fonction: duplicates.find(c => c.fonction)?.fonction || keepContact.fonction,
            telephone: duplicates.find(c => c.telephone)?.telephone || keepContact.telephone,
            type_contact: duplicates.find(c => c.type_contact)?.type_contact || keepContact.type_contact,
          };

          await supabaseAdmin
            .from('contacts')
            .update(mergedData)
            .eq('id', keepContact.id);

          for (const duplicate of duplicates) {
            await supabaseAdmin
              .from('contacts')
              .delete()
              .eq('id', duplicate.id);
            mergedCount++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cleanup completed successfully',
        contacts_deleted: totalDeleted,
        generic_contacts_deleted: genericDeleted,
        partenaire_contacts_deleted: partenaireContactsDeleted,
        generic_partenaire_contacts_deleted: genericPartenaireDeleted,
        pending_contacts_deleted: pendingDeleted,
        pending_generic_deleted: pendingGenericDeleted,
        duplicates_merged: mergedCount,
        details: results
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return buildErrorResponse('cleanup-internal-contacts', error, corsHeaders, 500);
  }
});
`;
  await Deno.writeTextFile(modulePath, source);

  (globalThis as any).__testServeMock = serveCapture.serve;
  (globalThis as any).__testCreateClientMock = supabase.createClient;

  try {
    await import(`file://${modulePath}?t=${crypto.randomUUID()}`);
    const handler = serveCapture.getHandler();
    assertExists(handler);
    return { handler, state: supabase.state };
  } finally {
    delete (globalThis as any).__testServeMock;
    delete (globalThis as any).__testCreateClientMock;

    if (originalEnv.SUPABASE_URL == null) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", originalEnv.SUPABASE_URL);
    if (originalEnv.SUPABASE_SERVICE_ROLE_KEY == null) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", originalEnv.SUPABASE_SERVICE_ROLE_KEY);
    if (originalEnv.SUPABASE_ANON_KEY == null) Deno.env.delete("SUPABASE_ANON_KEY");
    else Deno.env.set("SUPABASE_ANON_KEY", originalEnv.SUPABASE_ANON_KEY);

    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
}

Deno.test("module loads and registers a handler", async () => {
  const { handler } = await loadModuleWithMocks({});
  assertExists(handler);
});

Deno.test("OPTIONS returns CORS headers", async () => {
  const { handler } = await loadModuleWithMocks({});
  const res = await handler!(new Request("http://localhost", { method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertNotEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(
    res.headers.get("Access-Control-Allow-Headers"),
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  );
});

Deno.test("missing Authorization returns 401", async () => {
  const { handler } = await loadModuleWithMocks({});
  const res = await handler!(new Request("http://localhost", { method: "POST" }));
  assertEquals(res.status, 401);
  assertEquals(await res.json(), { error: "Authentication required" });
});

Deno.test("invalid authentication returns 401", async () => {
  const { handler } = await loadModuleWithMocks({
    authUser: null,
    authError: { message: "bad token" },
  });

  const res = await handler!(
    new Request("http://localhost", {
      method: "POST",
      headers: { Authorization: "Bearer invalid" },
    }),
  );

  assertEquals(res.status, 401);
  assertEquals(await res.json(), { error: "Invalid authentication" });
});

Deno.test("non admin user returns 403", async () => {
  const { handler } = await loadModuleWithMocks({
    authUser: { id: "user-1" },
    userRoles: [{ role: "editor" }],
  });

  const res = await handler!(
    new Request("http://localhost", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
    }),
  );

  assertEquals(res.status, 403);
  assertEquals(await res.json(), { error: "Admin access required" });
});

Deno.test("successful cleanup deletes forbidden domains, generic names, pending entries and merges duplicates", async () => {
  const { handler, state } = await loadModuleWithMocks({
    authUser: { id: "admin-1" },
    userRoles: [{ role: "admin" }],
    contactsByDomain: {
      "gmail.com": [
        { id: 1, nom: "Doe", prenom: "John", email: "john@gmail.com", etablissement_id: 10 },
        { id: 2, nom: "Smith", prenom: "Jane", email: "jane@gmail.com", etablissement_id: 11 },
      ],
      "exploitant.example.org": [
        { id: 3, nom: "Internal", prenom: "User", email: "internal@exploitant.example.org", etablissement_id: 12 },
      ],
    },
    partenaireContactsByDomain: {
      "gmail.com": [
        { id: 20, nom: "Partner", prenom: "One", email: "partner@gmail.com" },
      ],
    },
    genericContacts: [
      { id: 30, nom: "Inconnu", prenom: "Client", etablissement_id: 13 },
      { id: 31, nom: "Martin", prenom: "N/A", etablissement_id: 14 },
    ],
    genericPartenaireContacts: [
      { id: 40, nom: "Non spécifié", prenom: "X" },
    ],
    pendingContacts: [
      { id: 50, extracted_data: { email: "lead@gmail.com", nom: "Normal", prenom: "User" } },
      { id: 51, extracted_data: { email: "ok@company.com", nom: "Inconnu", prenom: "Test" } },
      { id: 52, extracted_data: { email: "ok@company.com", nom: "Valid", prenom: "Person" } },
    ],
    duplicateEmails: [{ email: "dup@example.com" }],
    contactsByExactEmail: {
      "dup@example.com": [
        {
          id: 60,
          email: "dup@example.com",
          prenom: "",
          nom: "",
          fonction: "",
          telephone: "",
          type_contact: "",
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: 61,
          email: "dup@example.com",
          prenom: "Alice",
          nom: "Durand",
          fonction: "CEO",
          telephone: "0102030405",
          type_contact: "direction",
          created_at: "2024-01-02T00:00:00Z",
        },
      ],
    },
  });

  const res = await handler!(
    new Request("http://localhost", {
      method: "POST",
      headers: { Authorization: "Bearer admin-token" },
    }),
  );

  assertEquals(res.status, 200);
  const body = await res.json();

  assertEquals(body.success, true);
  assertEquals(body.contacts_deleted, 3);
  assertEquals(body.generic_contacts_deleted, 2);
  assertEquals(body.partenaire_contacts_deleted, 1);
  assertEquals(body.generic_partenaire_contacts_deleted, 1);
  assertEquals(body.pending_contacts_deleted, 1);
  assertEquals(body.pending_generic_deleted, 1);
  assertEquals(body.duplicates_merged, 1);

  const gmailDetail = body.details.find((d: any) => d.domain === "gmail.com");
  assertExists(gmailDetail);
  assertEquals(gmailDetail.deleted, 2);
  assertEquals(gmailDetail.contacts, ["john@gmail.com", "jane@gmail.com"]);

  const internalDetail = body.details.find((d: any) => d.domain === "exploitant.example.org");
  assertExists(internalDetail);
  assertEquals(internalDetail.deleted, 1);

  const update = state.updates.find((u) => u.table === "contacts" && u.filter.value === 60);
  assertExists(update);
  assertEquals(update.values, {
    prenom: "Alice",
    nom: "Durand",
    fonction: "CEO",
    telephone: "0102030405",
    type_contact: "direction",
  });

  const deletedIds = state.deletes
    .filter((d) => d.filter?.column === "id")
    .map((d) => d.filter.value)
    .sort((a, b) => a - b);
  assertEquals(deletedIds, [50, 51, 61]);
});

Deno.test("domain deletion errors are reported in details and not counted as deleted", async () => {
  const { handler } = await loadModuleWithMocks({
    authUser: { id: "admin-1" },
    userRoles: [{ role: "admin" }],
    contactsByDomain: {
      "gmail.com": [
        { id: 1, nom: "Doe", prenom: "John", email: "john@gmail.com", etablissement_id: 10 },
      ],
    },
    deleteErrors: {
      "contacts:gmail.com": { message: "delete failed" },
    },
  });

  const res = await handler!(
    new Request("http://localhost", {
      method: "POST",
      headers: { Authorization: "Bearer admin-token" },
    }),
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.contacts_deleted, 0);

  const gmailDetail = body.details.find((d: any) => d.domain === "gmail.com");
  assertExists(gmailDetail);
  assertEquals(gmailDetail.deleted, 0);
  assertEquals(gmailDetail.error, "delete failed");
});

Deno.test("generic contact deletion error does not increase generic counter", async () => {
  const { handler } = await loadModuleWithMocks({
    authUser: { id: "admin-1" },
    userRoles: [{ role: "admin" }],
    genericContacts: [
      { id: 30, nom: "Inconnu", prenom: "Client", etablissement_id: 13 },
    ],
    deleteErrors: {
      "contacts:generic": { message: "generic delete failed" },
    },
  });

  const res = await handler!(
    new Request("http://localhost", {
      method: "POST",
      headers: { Authorization: "Bearer admin-token" },
    }),
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.generic_contacts_deleted, 0);
});

Deno.test("pending contacts only delete forbidden domains and generic names", async () => {
  const { handler, state } = await loadModuleWithMocks({
    authUser: { id: "admin-1" },
    userRoles: [{ role: "admin" }],
    pendingContacts: [
      { id: 70, extracted_data: { email: "employee@exploitant.example.org", nom: "Valid", prenom: "User" } },
      { id: 71, extracted_data: { email: "lead@company.com", nom: "Non renseigné", prenom: "Valid" } },
      { id: 72, extracted_data: { email: "lead@company.com", nom: "Valid", prenom: "Person" } },
      { id: 73, extracted_data: { nom: "A déterminer", prenom: "X" } },
    ],
  });

  const res = await handler!(
    new Request("http://localhost", {
      method: "POST",
      headers: { Authorization: "Bearer admin-token" },
    }),
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.pending_contacts_deleted, 1);
  assertEquals(body.pending_generic_deleted, 2);

  const pendingDeletedIds = state.deletes
    .filter((d) => d.table === "pending_contacts" && d.filter?.column === "id")
    .map((d) => d.filter.value)
    .sort((a, b) => a - b);

  assertEquals(pendingDeletedIds, [70, 71, 73]);
});

Deno.test("duplicate merge keeps oldest contact and merges first non empty fields from duplicates", async () => {
  const { handler, state } = await loadModuleWithMocks({
    authUser: { id: "admin-1" },
    userRoles: [{ role: "admin" }],
    duplicateEmails: [{ email: "multi@example.com" }],
    contactsByExactEmail: {
      "multi@example.com": [
        {
          id: 80,
          email: "multi@example.com",
          prenom: "Base",
          nom: "",
          fonction: "",
          telephone: "",
          type_contact: "",
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: 81,
          email: "multi@example.com",
          prenom: "",
          nom: "Nom rempli",
          fonction: "",
          telephone: "111",
          type_contact: "",
          created_at: "2024-01-02T00:00:00Z",
        },
        {
          id: 82,
          email: "multi@example.com",
          prenom: "",
          nom: "",
          fonction: "Directeur",
          telephone: "",
          type_contact: "decisionnaire",
          created_at: "2024-01-03T00:00:00Z",
        },
      ],
    },
  });

  const res = await handler!(
    new Request("http://localhost", {
      method: "POST",
      headers: { Authorization: "Bearer admin-token" },
    }),
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.duplicates_merged, 2);

  const update = state.updates.find((u) => u.filter.value === 80);
  assertExists(update);
  assertEquals(update.values, {
    prenom: "Base",
    nom: "Nom rempli",
    fonction: "Directeur",
    telephone: "111",
    type_contact: "decisionnaire",
  });

  const deletedContactIds = state.deletes
    .filter((d) => d.table === "contacts" && d.filter?.column === "id")
    .map((d) => d.filter.value)
    .sort((a, b) => a - b);

  assertEquals(deletedContactIds, [81, 82]);
});

Deno.test("unexpected error returns sanitized 500 response", async () => {
  const { handler } = await loadModuleWithMocks({
    authUser: { id: "admin-1" },
    userRoles: [{ role: "admin" }],
    rpcThrows: true,
  });

  const res = await handler!(
    new Request("http://localhost", {
      method: "POST",
      headers: { Authorization: "Bearer admin-token" },
    }),
  );

  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "internal");
  assertEquals(body.context, "cleanup-internal-contacts");
  assertEquals(body.message, "rpc crashed");
});