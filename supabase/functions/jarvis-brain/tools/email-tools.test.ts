import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executeSendEmail } from "./email-tools.ts";

type QueryResult = { data?: unknown; error?: unknown };

function createSupabaseStub(options: {
  personalAccount?: QueryResult;
  sharedAccount?: QueryResult;
  profile?: QueryResult;
}) {
  const calls: Array<{
    table: string;
    filters: Array<{ type: string; column?: string; value?: unknown; columns?: string }>;
  }> = [];

  return {
    calls,
    client: {
      from(table: string) {
        const state = {
          table,
          filters: [] as Array<{ type: string; column?: string; value?: unknown; columns?: string }>,
        };

        const builder = {
          select(columns: string) {
            state.filters.push({ type: "select", columns });
            return builder;
          },
          eq(column: string, value: unknown) {
            state.filters.push({ type: "eq", column, value });
            return builder;
          },
          limit(value: number) {
            state.filters.push({ type: "limit", value });
            return builder;
          },
          async maybeSingle() {
            calls.push({ table: state.table, filters: [...state.filters] });
            if (state.table === "user_email_accounts") {
              const hasProfileFilter = state.filters.some((f) => f.type === "eq" && f.column === "profile_id");
              if (hasProfileFilter) {
                return {
                  data: options.personalAccount?.data ?? null,
                  error: options.personalAccount?.error ?? null,
                };
              }
              return {
                data: options.sharedAccount?.data ?? null,
                error: options.sharedAccount?.error ?? null,
              };
            }
            return { data: null, error: null };
          },
          async single() {
            calls.push({ table: state.table, filters: [...state.filters] });
            if (state.table === "profiles") {
              return {
                data: options.profile?.data ?? null,
                error: options.profile?.error ?? null,
              };
            }
            return { data: null, error: null };
          },
        };

        return builder;
      },
    },
  };
}

function setEnv(vars: Record<string, string | undefined>) {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(vars)) {
    previous.set(key, Deno.env.get(key));
    const value = vars[key];
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  };
}

Deno.test("executeSendEmail envoie avec compte personnel et signature décodée + HTML stylé", async () => {
  const restoreEnv = setEnv({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  });

  const originalFetch = globalThis.fetch;

  try {
    const supabase = createSupabaseStub({
      personalAccount: {
        data: { id: "acc-1", email_address: "perso@example.com" },
      },
      profile: {
        data: {
          email_signature: "<pre><code>&amp;lt;strong&amp;gt;Signature&amp;lt;/strong&amp;gt;</code></pre>",
          prenom: "Jean",
          nom: "Dupont",
        },
      },
    });

    let fetchUrl = "";
    let fetchOptions: RequestInit | undefined;
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      fetchUrl = String(input);
      fetchOptions = init;
      return new Response(JSON.stringify({ message_id: "msg-123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await executeSendEmail(
      {
        userId: "user-1",
        supabase: supabase.client,
      } as any,
      {
        to: "dest@example.com",
        subject: "Sujet test",
        body: "<h2>Bonjour</h2><p>Contenu</p>",
        thread_id: "thread-1",
        cc: ["cc1@example.com", "cc2@example.com"],
      },
    );

    assertEquals(result.success, true);
    assertExists(result.data);
    assertEquals((result.data as any).message, "Email envoyé avec succès");
    assertEquals((result.data as any).to, "dest@example.com");
    assertEquals((result.data as any).subject, "Sujet test");
    assertEquals((result.data as any).from, "perso@example.com");
    assertEquals((result.data as any).message_id, "msg-123");

    assertEquals(fetchUrl, "https://example.supabase.co/functions/v1/send-email");
    assertExists(fetchOptions);
    assertEquals(fetchOptions?.method, "POST");
    assertEquals((fetchOptions?.headers as Record<string, string>)["Authorization"], "Bearer service-role-key");

    const body = JSON.parse(String(fetchOptions?.body));
    assertEquals(body.to, "dest@example.com");
    assertEquals(body.subject, "Sujet test");
    assertEquals(body.thread_id, "thread-1");
    assertEquals(body.cc, ["cc1@example.com", "cc2@example.com"]);
    assertEquals(body.user_id, "user-1");
    assertEquals(body.account_id, "acc-1");
    assertEquals(typeof body.html_body, "string");
    assertEquals(body.html_body.includes("<!DOCTYPE html>"), true);
    assertEquals(body.html_body.includes('<h2 style="color:#1a1a2e;font-size:20px;font-weight:700;margin:24px 0 12px 0" '), true);
    assertEquals(body.html_body.includes('<p style="margin:0 0 12px 0;line-height:1.6;color:#333" '), true);
    assertEquals(body.html_body.includes("<strong>Signature</strong>"), true);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

Deno.test("executeSendEmail utilise un compte partagé si aucun compte personnel", async () => {
  const restoreEnv = setEnv({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  });

  const originalFetch = globalThis.fetch;

  try {
    const supabase = createSupabaseStub({
      personalAccount: { data: null },
      sharedAccount: {
        data: { id: "shared-1", email_address: "shared@example.com" },
      },
      profile: {
        data: { prenom: "Marie", nom: "Curie" },
      },
    });

    let sentPayload: any;
    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
      sentPayload = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ message_id: "msg-shared" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await executeSendEmail(
      {
        userId: "user-2",
        supabase: supabase.client,
      } as any,
      {
        to: "team@example.com",
        body: "Bonjour\nLigne 2",
      },
    );

    assertEquals(result.success, true);
    assertEquals((result.data as any).message, "Email envoyé avec succès (compte partagé)");
    assertEquals((result.data as any).from, "shared@example.com");
    assertEquals((result.data as any).message_id, "msg-shared");
    assertEquals(sentPayload.subject, "Message de Jarvis");
    assertEquals(sentPayload.account_id, "shared-1");
    assertEquals(sentPayload.html_body.includes("Bonjour<br>Ligne 2"), true);
    assertEquals(sentPayload.html_body.includes("--<br>Marie Curie"), true);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

Deno.test("executeSendEmail retourne une erreur claire si aucun compte email n'est configuré", async () => {
  const restoreEnv = setEnv({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  });

  const originalFetch = globalThis.fetch;

  try {
    const supabase = createSupabaseStub({
      personalAccount: { data: null },
      sharedAccount: { data: null },
      profile: { data: null },
    });

    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ message_id: "should-not-happen" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await executeSendEmail(
      {
        userId: "user-3",
        supabase: supabase.client,
      } as any,
      {
        to: "nobody@example.com",
        body: "Test",
      },
    );

    assertEquals(result.success, false);
    assertEquals(
      result.error,
      "❌ **Aucun compte email configuré**\n\nVeuillez configurer un compte email dans **Paramètres > Comptes Email**.",
    );
    assertEquals(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

Deno.test("executeSendEmail échoue si les variables d'environnement Supabase sont manquantes", async () => {
  const restoreEnv = setEnv({
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
  });

  const originalFetch = globalThis.fetch;

  try {
    const supabase = createSupabaseStub({
      personalAccount: {
        data: { id: "acc-2", email_address: "perso2@example.com" },
      },
      profile: {
        data: { prenom: "Alice", nom: "Martin" },
      },
    });

    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ message_id: "x" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await executeSendEmail(
      {
        userId: "user-4",
        supabase: supabase.client,
      } as any,
      {
        to: "dest@example.com",
        body: "Bonjour",
      },
    );

    assertEquals(result.success, false);
    assertEquals(
      result.error,
      "❌ **Échec de l'envoi**\n\nMissing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
    assertEquals(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

Deno.test("executeSendEmail retourne une erreur métier si la fonction send-email répond avec error", async () => {
  const restoreEnv = setEnv({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  });

  const originalFetch = globalThis.fetch;

  try {
    const supabase = createSupabaseStub({
      personalAccount: {
        data: { id: "acc-3", email_address: "sender@example.com" },
      },
      profile: {
        data: {},
      },
    });

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: "SMTP indisponible" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const result = await executeSendEmail(
      {
        userId: "user-5",
        supabase: supabase.client,
      } as any,
      {
        to: "dest@example.com",
        body: "Bonjour",
      },
    );

    assertEquals(result.success, false);
    assertEquals(result.error, "❌ **Échec de l'envoi**\n\nSMTP indisponible");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

Deno.test("executeSendEmail retourne une erreur HTTP si la réponse fetch n'est pas ok", async () => {
  const restoreEnv = setEnv({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  });

  const originalFetch = globalThis.fetch;

  try {
    const supabase = createSupabaseStub({
      personalAccount: {
        data: { id: "acc-4", email_address: "sender@example.com" },
      },
      profile: {
        data: {},
      },
    });

    globalThis.fetch = async () =>
      new Response(JSON.stringify({}), {
        status: 503,
        headers: { "content-type": "application/json" },
      });

    const result = await executeSendEmail(
      {
        userId: "user-6",
        supabase: supabase.client,
      } as any,
      {
        to: "dest@example.com",
        body: "Bonjour",
      },
    );

    assertEquals(result.success, false);
    assertEquals(result.error, "❌ **Échec de l'envoi**\n\nHTTP 503");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

Deno.test("executeSendEmail échappe le texte non HTML et ajoute le nom si pas de signature", async () => {
  const restoreEnv = setEnv({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  });

  const originalFetch = globalThis.fetch;

  try {
    const supabase = createSupabaseStub({
      personalAccount: {
        data: { id: "acc-5", email_address: "sender@example.com" },
      },
      profile: {
        data: { prenom: "Luc", nom: "Bernard" },
      },
    });

    let payload: any;
    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
      payload = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ message_id: "msg-escape" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await executeSendEmail(
      {
        userId: "user-7",
        supabase: supabase.client,
      } as any,
      {
        to: "dest@example.com",
        body: "Texte & <script>alert(1)</script>\nDeuxième ligne",
      },
    );

    assertEquals(result.success, true);
    assertEquals(payload.html_body.includes("Texte &amp; &lt;script&gt;alert(1)&lt;/script&gt;<br>Deuxième ligne"), true);
    assertEquals(payload.html_body.includes("--<br>Luc Bernard"), true);
    assertEquals(payload.html_body.includes("<script>alert(1)</script>"), false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});