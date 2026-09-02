import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type CalendarEvent = {
  uid: string;
  summary: string;
  dtstart: string;
  dtend?: string;
  location?: string;
  description?: string;
};

type SupabaseMockState = {
  existingEvents: Array<{ id: string; title: string; start_time: string }>;
  insertedRows: Array<Record<string, unknown>>;
  updates: Array<{
    table: string;
    payload: Record<string, unknown>;
    column: string;
    value: unknown;
  }>;
  createClientCalls: Array<{ url: string; key: string }>;
  insertError?: { message: string } | null;
};

type TestableModule = {
  parseICSDate: (value: string) => string;
  decodeICSValue: (value: string) => string;
  parseICS: (content: string) => CalendarEvent[];
  servedHandler: (req: Request) => Response | Promise<Response>;
};

function toFileUrl(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  const absolute = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `file://${absolute.split("/").map((part, index) => index === 0 ? "" : encodeURIComponent(part)).join("/")}`;
}

function getSupabaseState(): SupabaseMockState {
  return (globalThis as unknown as { __supabaseMockState: SupabaseMockState }).__supabaseMockState;
}

function setSupabaseState(state: SupabaseMockState): void {
  (globalThis as unknown as { __supabaseMockState: SupabaseMockState }).__supabaseMockState = state;
}

function defaultSupabaseState(): SupabaseMockState {
  return {
    existingEvents: [],
    insertedRows: [],
    updates: [],
    createClientCalls: [],
    insertError: null,
  };
}

async function writeOfflineStubs(tempDir: string): Promise<void> {
  await Deno.writeTextFile(
    `${tempDir}/server_stub.ts`,
    `
export let servedHandler;
export function serve(handler) {
  servedHandler = handler;
}
`,
  );

  await Deno.writeTextFile(
    `${tempDir}/supabase_stub.ts`,
    `
function state() {
  globalThis.__supabaseMockState ??= {
    existingEvents: [],
    insertedRows: [],
    updates: [],
    createClientCalls: [],
    insertError: null,
  };
  return globalThis.__supabaseMockState;
}

export function createClient(url, key) {
  state().createClientCalls.push({ url, key });

  return {
    from(table) {
      return {
        select(_columns) {
          return this;
        },
        eq(column, value) {
          if (table === "calendar_events") {
            return Promise.resolve({ data: state().existingEvents, error: null });
          }

          return Promise.resolve({ data: null, error: null });
        },
        update(payload) {
          return {
            eq(column, value) {
              state().updates.push({ table, payload, column, value });
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
        insert(rows) {
          return {
            select(_columns) {
              const inserted = Array.isArray(rows) ? rows : [];
              state().insertedRows.push(...inserted);

              if (state().insertError) {
                return Promise.resolve({ data: null, error: state().insertError });
              }

              return Promise.resolve({
                data: inserted.map((_, index) => ({ id: "inserted-" + String(index + 1) })),
                error: null,
              });
            },
          };
        },
      };
    },
  };
}
`,
  );

  await Deno.writeTextFile(
    `${tempDir}/error_sanitizer_stub.ts`,
    `
export function buildErrorResponse(functionName, error, headers = {}, status = 500) {
  return new Response(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      functionName,
    }),
    {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    },
  );
}
`,
  );
}

async function withTestableModule(fn: (mod: TestableModule) => void | Promise<void>): Promise<void> {
  const tempDir = await Deno.makeTempDir({ prefix: "sync_calendar_subscription_test_" });

  try {
    await writeOfflineStubs(tempDir);

    const sourceUrl = new URL("./index.ts", import.meta.url);
    let source = await Deno.readTextFile(sourceUrl);

    source = source
      .replace(
        `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";`,
        `import { serve } from "./server_stub.ts";`,
      )
      .replace(
        `import { createClient } from "@supabase/supabase-js";`,
        `import { createClient } from "./supabase_stub.ts";`,
      )
      .replace(
        `import { buildErrorResponse } from "../_shared/error-sanitizer.ts";`,
        `import { buildErrorResponse } from "./error_sanitizer_stub.ts";`,
      )
      // L'import relatif ajoute par la consolidation CORS ne se resout pas
      // depuis le repertoire temporaire : on le pointe vers le vrai module.
      .replace(
        `import { corsHeaders } from '../_shared/cors.ts'`,
        `import { corsHeaders } from ` + JSON.stringify(new URL("../_shared/cors.ts", import.meta.url).href),
      );

    source += `\nexport { parseICSDate, decodeICSValue, parseICS };\nexport { servedHandler } from "./server_stub.ts";\n`;

    const modulePath = `${tempDir}/index_testable.ts`;
    await Deno.writeTextFile(modulePath, source);

    const mod = await import(`${toFileUrl(modulePath)}?cache=${crypto.randomUUID()}`) as TestableModule;
    await fn(mod);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}

async function withEnv<T>(values: Record<string, string>, fn: () => Promise<T> | T): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(values)) {
    previous.set(key, Deno.env.get(key));
    Deno.env.set(key, value);
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

Deno.test("module loads offline with dependency stubs", async () => {
  await withTestableModule((mod) => {
    assertExists(mod.parseICSDate);
    assertExists(mod.decodeICSValue);
    assertExists(mod.parseICS);
    assertExists(mod.servedHandler);
  });
});

Deno.test("parseICSDate formats UTC date-time values", async () => {
  await withTestableModule((mod) => {
    assertEquals(mod.parseICSDate("20240510T093045Z"), "2024-05-10T09:30:45Z");
  });
});

Deno.test("parseICSDate formats local date-time values without adding timezone", async () => {
  await withTestableModule((mod) => {
    assertEquals(mod.parseICSDate("20250115T153000"), "2025-01-15T15:30:00");
  });
});

Deno.test("parseICSDate formats all-day date values at midnight", async () => {
  await withTestableModule((mod) => {
    assertEquals(mod.parseICSDate("20241224"), "2024-12-24T00:00:00");
  });
});

Deno.test("parseICSDate returns unparseable values unchanged", async () => {
  await withTestableModule((mod) => {
    assertEquals(mod.parseICSDate("invalid-date"), "invalid-date");
  });
});

Deno.test("parseICSDate throws TypeError for non-string input", async () => {
  await withTestableModule((mod) => {
    assertThrows(
      () => mod.parseICSDate(undefined as unknown as string),
      TypeError,
    );
  });
});

Deno.test("parseICS rejects asynchronously when content is not a string", async () => {
  await withTestableModule(async (mod) => {
    await assertRejects(
      async () => {
        await Promise.resolve();
        mod.parseICS(undefined as unknown as string);
      },
      TypeError,
    );
  });
});

Deno.test("decodeICSValue decodes escaped newlines, commas, semicolons and backslashes", async () => {
  await withTestableModule((mod) => {
    assertEquals(
      mod.decodeICSValue("Première ligne\\nDeuxième ligne\\, suite\\; fin\\\\archive"),
      "Première ligne\nDeuxième ligne, suite; fin\\archive",
    );
  });
});

Deno.test("parseICS parses complete VEVENT fields with parameters and escaped values", async () => {
  await withTestableModule((mod) => {
    const events = mod.parseICS([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:event-123",
      "SUMMARY:Consultation\\, suivi",
      "DTSTART;TZID=Europe/Paris:20250115T093000",
      "DTEND;TZID=Europe/Paris:20250115T100000",
      "LOCATION:Cabinet\\; Salle 2",
      "DESCRIPTION:Première ligne\\nDeuxième ligne",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n"));

    assertEquals(events.length, 1);
    assertEquals(events[0], {
      uid: "event-123",
      summary: "Consultation, suivi",
      dtstart: "2025-01-15T09:30:00",
      dtend: "2025-01-15T10:00:00",
      location: "Cabinet; Salle 2",
      description: "Première ligne\nDeuxième ligne",
    });
  });
});

Deno.test("parseICS handles folded line continuations", async () => {
  await withTestableModule((mod) => {
    const events = mod.parseICS([
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:folded-1",
      "SUMMARY:Rendez-vous long avec ",
      " médecin spécialiste",
      "DTSTART:20250203T140000Z",
      "DESCRIPTION:Texte initial ",
      "\tcontinué sur une autre ligne",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n"));

    assertEquals(events.length, 1);
    assertEquals(events[0].summary, "Rendez-vous long avec médecin spécialiste");
    assertEquals(events[0].dtstart, "2025-02-03T14:00:00Z");
    assertEquals(events[0].description, "Texte initial continué sur une autre ligne");
  });
});

Deno.test("parseICS ignores events without required summary or start date", async () => {
  await withTestableModule((mod) => {
    const events = mod.parseICS([
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:no-summary",
      "DTSTART:20250101T090000Z",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:no-start",
      "SUMMARY:Sans date de début",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:valid-event",
      "SUMMARY:Événement valide",
      "DTSTART:20250102T090000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n"));

    assertEquals(events.length, 1);
    assertEquals(events[0].uid, "valid-event");
    assertEquals(events[0].summary, "Événement valide");
    assertEquals(events[0].dtstart, "2025-01-02T09:00:00Z");
  });
});

Deno.test("parseICS generates a uid when a valid event has no UID", async () => {
  await withTestableModule((mod) => {
    const events = mod.parseICS([
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "SUMMARY:Événement sans identifiant",
      "DTSTART:20250102T090000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n"));

    assertEquals(events.length, 1);
    assertExists(events[0].uid);
    assertEquals(events[0].summary, "Événement sans identifiant");
    assertEquals(events[0].dtstart, "2025-01-02T09:00:00Z");
  });
});

Deno.test("handler returns CORS headers for OPTIONS preflight without external calls", async () => {
  await withTestableModule(async (mod) => {
    const response = await mod.servedHandler(new Request("http://localhost", { method: "OPTIONS" }));

    assertEquals(response.status, 200);
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(
      response.headers.get("Access-Control-Allow-Headers"),
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
    );
  });
});

Deno.test("handler returns 400 when subscriptionUrl is missing", async () => {
  await withTestableModule(async (mod) => {
    setSupabaseState(defaultSupabaseState());

    await withEnv(
      {
        SUPABASE_URL: "http://supabase.local.test",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-test",
      },
      async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (() => {
          throw new Error("fetch should not be called for invalid request payload");
        }) as typeof fetch;

        try {
          const response = await mod.servedHandler(
            new Request("http://localhost", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ calendarId: "calendar-1" }),
            }),
          );

          const body = await response.json();

          assertEquals(response.status, 400);
          assertEquals(body, { error: "Missing subscriptionUrl or calendarId" });
          assertEquals(getSupabaseState().createClientCalls.length, 1);
        } finally {
          globalThis.fetch = originalFetch;
        }
      },
    );
  });
});

Deno.test("handler imports only new relevant ICS events and updates subscription status", async () => {
  await withTestableModule(async (mod) => {
    const year = new Date().getUTCFullYear() + 1;
    const duplicateStart = `${year}-01-05T09:00:00Z`;
    const dateOnlyStart = `${year}-01-06T00:00:00`;

    setSupabaseState({
      ...defaultSupabaseState(),
      existingEvents: [
        { id: "existing-1", title: "Déjà importé", start_time: duplicateStart },
      ],
    });

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:old-event",
      "SUMMARY:Ancien événement ignoré",
      `${"DTSTART"}:${year - 2}0105T090000Z`,
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:duplicate-event",
      "SUMMARY:Déjà importé",
      `${"DTSTART"}:${year}0105T090000Z`,
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:new-all-day",
      "SUMMARY:Nouveau rendez-vous\\, important",
      `${"DTSTART"}:${year}0106`,
      "LOCATION:Cabinet\\; Salle 3",
      "DESCRIPTION:Première ligne\\nDeuxième ligne",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");

    await withEnv(
      {
        SUPABASE_URL: "http://supabase.local.test",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-test",
      },
      async () => {
        const originalFetch = globalThis.fetch;
        const fetchCalls: Array<{ input: string | URL | Request; init?: RequestInit }> = [];

        globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
          fetchCalls.push({ input, init });
          return Promise.resolve(
            new Response(icsContent, {
              status: 200,
              headers: { "Content-Type": "text/calendar" },
            }),
          );
        }) as typeof fetch;

        try {
          const response = await mod.servedHandler(
            new Request("http://localhost", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subscriptionId: "subscription-1",
                subscriptionUrl: "https://calendar.example.test/feed.ics",
                calendarId: "calendar-1",
              }),
            }),
          );

          const body = await response.json();
          const state = getSupabaseState();

          assertEquals(response.status, 200);
          assertEquals(body, {
            success: true,
            imported: 1,
            total: 2,
            skipped: 1,
          });

          assertEquals(fetchCalls.length, 1);
          assertEquals(fetchCalls[0].input, "https://calendar.example.test/feed.ics");
          assertEquals(
            (fetchCalls[0].init?.headers as Record<string, string>)["User-Agent"],
            "Marque-IA/1.0 Calendar-Sync",
          );

          assertEquals(state.createClientCalls, [
            {
              url: "http://supabase.local.test",
              key: "service-role-key-for-test",
            },
          ]);

          assertEquals(state.insertedRows.length, 1);
          assertEquals(state.insertedRows[0].calendar_id, "calendar-1");
          assertEquals(state.insertedRows[0].title, "Nouveau rendez-vous, important");
          assertEquals(state.insertedRows[0].start_time, dateOnlyStart);
          assertEquals(state.insertedRows[0].end_time, dateOnlyStart);
          assertEquals(state.insertedRows[0].location, "Cabinet; Salle 3");
          assertEquals(state.insertedRows[0].description, "Première ligne\nDeuxième ligne");
          assertEquals(state.insertedRows[0].status, "confirmed");
          assertEquals(state.insertedRows[0].visibility, "default");
          assertEquals(state.insertedRows[0].all_day, true);

          assertEquals(state.updates.length, 1);
          assertEquals(state.updates[0].table, "calendar_subscriptions");
          assertEquals(state.updates[0].column, "id");
          assertEquals(state.updates[0].value, "subscription-1");
          assertEquals(state.updates[0].payload.last_sync_status, "success: 1 imported");
          assertExists(state.updates[0].payload.last_sync_at);
        } finally {
          globalThis.fetch = originalFetch;
        }
      },
    );
  });
});