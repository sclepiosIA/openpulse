import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type CapturedHandler = (request: Request) => Response | Promise<Response>;

const indexUrl = new URL("./index.ts", import.meta.url);

let originalModuleLoadPromise: Promise<void> | undefined;
let originalCapturedHandler: CapturedHandler | undefined;

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
      delete (Deno as unknown as Record<string, unknown>)[name];
    }
  };
}

async function loadOriginalModuleSafely(): Promise<CapturedHandler | undefined> {
  if (originalModuleLoadPromise) {
    await originalModuleLoadPromise;
    return originalCapturedHandler;
  }

  originalModuleLoadPromise = (async () => {
    const fakeHttpServer = {
      finished: Promise.resolve(),
      shutdown: () => Promise.resolve(),
      ref: () => {},
      unref: () => {},
      addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
    };

    const fakeServe = ((arg1: unknown, arg2?: unknown) => {
      if (typeof arg1 === "function") {
        originalCapturedHandler = arg1 as CapturedHandler;
      } else if (typeof arg2 === "function") {
        originalCapturedHandler = arg2 as CapturedHandler;
      } else if (
        arg1 &&
        typeof arg1 === "object" &&
        typeof (arg1 as { handler?: unknown }).handler === "function"
      ) {
        originalCapturedHandler = (arg1 as { handler: CapturedHandler }).handler;
      }

      return fakeHttpServer;
    }) as typeof Deno.serve;

    const fakeListener = {
      addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
      rid: -1,
      close: () => {},
      accept: async () => {
        await new Promise(() => {});
        throw new Error("fake listener closed");
      },
      [Symbol.asyncIterator]() {
        return {
          next: async () => ({ done: true, value: undefined }),
        };
      },
    };

    const restoreServe = replaceDenoProperty("serve", fakeServe);
    const restoreListen = replaceDenoProperty("listen", () => fakeListener);

    try {
      await import(`./index.ts?original-module-load=${crypto.randomUUID()}`);
    } finally {
      restoreListen();
      restoreServe();
    }
  })();

  await originalModuleLoadPromise;
  return originalCapturedHandler;
}

type Inserts = Record<"rd_projets" | "rd_epics" | "rd_user_stories", unknown[]>;

interface SupabaseMockOptions {
  projectId?: string;
  errors?: Partial<Record<keyof Inserts, unknown>>;
}

function createSupabaseMock(options: SupabaseMockOptions = {}) {
  const inserts: Inserts = {
    rd_projets: [],
    rd_epics: [],
    rd_user_stories: [],
  };

  const createClientCalls: unknown[][] = [];

  function createInsertResult(table: keyof Inserts, payload: unknown) {
    inserts[table].push(payload);

    const result = {
      select() {
        return result;
      },
      single() {
        const configuredError = options.errors?.[table];

        if (configuredError) {
          return Promise.resolve({ data: null, error: configuredError });
        }

        if (table === "rd_projets") {
          return Promise.resolve({
            data: {
              id: options.projectId ?? "project-1",
              ...(payload && typeof payload === "object" ? payload : {}),
            },
            error: null,
          });
        }

        if (table === "rd_epics") {
          return Promise.resolve({
            data: {
              id: `epic-${inserts.rd_epics.length}`,
              ...(payload && typeof payload === "object" ? payload : {}),
            },
            error: null,
          });
        }

        return Promise.resolve({ data: null, error: null });
      },
      then(resolve: (value: { data: null; error: unknown }) => unknown, reject?: (reason: unknown) => unknown) {
        const configuredError = options.errors?.[table] ?? null;
        return Promise.resolve({ data: null, error: configuredError }).then(resolve, reject);
      },
    };

    return result;
  }

  const createClient = (...args: unknown[]) => {
    createClientCalls.push(args);

    return {
      from(table: keyof Inserts) {
        return {
          insert(payload: unknown) {
            return createInsertResult(table, payload);
          },
        };
      },
    };
  };

  return { createClient, createClientCalls, inserts };
}

async function withSupabaseEnv<T>(fn: () => Promise<T>): Promise<T> {
  const keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const previous = new Map<string, string | undefined>();

  for (const key of keys) {
    previous.set(key, Deno.env.get(key));
  }

  Deno.env.set("SUPABASE_URL", "http://supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

  try {
    return await fn();
  } finally {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

async function withInstrumentedHandler<T>(
  fn: (handler: CapturedHandler) => Promise<T>,
  supabaseMock = createSupabaseMock(),
): Promise<T> {
  const source = await Deno.readTextFile(indexUrl);

  const instrumentedSource = source
    .replace(
      'import { serve } from "https://deno.land/std@0.190.0/http/server.ts";',
      `const serve = (handler: (request: Request) => Response | Promise<Response>) => {
        (globalThis as unknown as { __capturedServeHandler?: typeof handler }).__capturedServeHandler = handler;
        return {
          finished: Promise.resolve(),
          shutdown: () => Promise.resolve(),
          ref: () => {},
          unref: () => {},
          addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
        };
      };`,
    )
    .replace(
      'import { createClient } from "@supabase/supabase-js";',
      `const createClient = (...args: unknown[]) =>
        (globalThis as unknown as { __mockCreateClient: (...args: unknown[]) => unknown }).__mockCreateClient(...args);`,
    )
    .replace(
      'import { buildErrorResponse } from "../_shared/error-sanitizer.ts";',
      `const buildErrorResponse = (context: string, error: unknown, headers: HeadersInit, status: number) => {
        const message = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({ error: "sanitized", context, message }), {
          status,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      };`,
    )
    // L'import relatif ajoute par la consolidation CORS ne se resout pas
    // depuis une URL `data:` : on le remplace par sa valeur.
    .replace(
      `import { corsHeaders } from '../_shared/cors.ts'`,
      `const corsHeaders = { 'Access-Control-Allow-Origin': 'http://localhost:8080', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret' };`,
    );

  // Le module instrumente est charge depuis une URL `data:` : le banc n'ecrit
  // rien sur le disque, et tourne donc sans droit d'ecriture.
  const moduleUrl =
    `data:application/typescript;charset=utf-8,${encodeURIComponent(instrumentedSource)}#instrumented=${crypto.randomUUID()}`;

  const globals = globalThis as unknown as {
    __capturedServeHandler?: CapturedHandler;
    __mockCreateClient?: (...args: unknown[]) => unknown;
  };

  const previousHandler = globals.__capturedServeHandler;
  const previousCreateClient = globals.__mockCreateClient;

  globals.__capturedServeHandler = undefined;
  globals.__mockCreateClient = supabaseMock.createClient;

  try {
    await import(moduleUrl);
    assertExists(globals.__capturedServeHandler);
    return await fn(globals.__capturedServeHandler);
  } finally {
    if (previousHandler === undefined) {
      delete globals.__capturedServeHandler;
    } else {
      globals.__capturedServeHandler = previousHandler;
    }

    if (previousCreateClient === undefined) {
      delete globals.__mockCreateClient;
    } else {
      globals.__mockCreateClient = previousCreateClient;
    }
  }
}

Deno.test("module loads safely and source file is resolved relative to the test file", async () => {
  const source = await Deno.readTextFile(indexUrl);
  assertEquals(source.includes('import { serve } from "https://deno.land/std@0.190.0/http/server.ts";'), true);
  assertEquals(source.includes('import { createClient } from "@supabase/supabase-js";'), true);
  assertEquals(source.includes("serve(async (req) =>"), true);

  const maybeHandler = await loadOriginalModuleSafely();
  if (maybeHandler) {
    assertEquals(typeof maybeHandler, "function");
  }
});

Deno.test("source declares expected Deck status and priority mappings", async () => {
  const source = await Deno.readTextFile(indexUrl);

  assertEquals(source.includes('"en cours": "in_progress"'), true);
  assertEquals(source.includes('"terminé": "done"'), true);
  assertEquals(source.includes('"to do": "todo"'), true);
  assertEquals(source.includes('"urgent": "critical"'), true);
  assertEquals(source.includes('"bug": "high"'), true);
  assertEquals(source.includes('"plus tard": "low"'), true);
  assertEquals(source.includes("if (card.archived) continue;"), true);
});

Deno.test("OPTIONS request returns CORS headers", async () => {
  await withInstrumentedHandler(async (handler) => {
    const response = await handler(new Request("http://localhost", { method: "OPTIONS" }));

    assertEquals(response.status, 200);
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
    assertEquals(
      response.headers.get("Access-Control-Allow-Headers"),
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
    );
    assertEquals(await response.text(), "");
  });
});

Deno.test("POST rejects missing Deck JSON data with 400 without inserting rows", async () => {
  const supabaseMock = createSupabaseMock();

  await withSupabaseEnv(async () => {
    await withInstrumentedHandler(async (handler) => {
      const response = await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deckData: { boards: [] } }),
        }),
      );

      assertEquals(response.status, 400);
      assertEquals(response.headers.get("Content-Type"), "application/json");
      assertEquals(await response.json(), { error: "Invalid Deck JSON data" });
      assertEquals(supabaseMock.createClientCalls, [["http://supabase.test", "test-service-role-key"]]);
      assertEquals(supabaseMock.inserts.rd_projets.length, 0);
      assertEquals(supabaseMock.inserts.rd_epics.length, 0);
      assertEquals(supabaseMock.inserts.rd_user_stories.length, 0);
    }, supabaseMock);
  });
});

Deno.test("POST imports Deck board into project, epics and user stories", async () => {
  const supabaseMock = createSupabaseMock({ projectId: "project-1" });

  await withSupabaseEnv(async () => {
    await withInstrumentedHandler(async (handler) => {
      const deckData = {
        boards: [
          {
            id: 10,
            title: "Roadmap RD",
            color: "336699",
            labels: [
              { id: 1, title: "Frontend", color: "ff0000", boardId: 10 },
              { id: 2, title: "Terminé", color: "00ff00", boardId: 10 },
              { id: 3, title: "Plus tard", color: "cccccc", boardId: 10 },
            ],
            stacks: {
              doing: {
                id: 100,
                title: "En cours",
                cards: [
                  {
                    id: 1000,
                    title: "Créer le tableau de bord",
                    description: "Afficher les indicateurs principaux",
                    stackId: 100,
                    labels: [
                      { id: 1, title: "Frontend", color: "ff0000", boardId: 10 },
                      { id: 99, title: "Urgent", color: "ff9900", boardId: 10 },
                    ],
                    assignedUsers: [],
                    order: 3,
                    archived: false,
                  },
                  {
                    id: 1001,
                    title: "Ancienne carte ignorée",
                    description: "Ne doit pas être importée",
                    stackId: 100,
                    labels: [],
                    assignedUsers: [],
                    order: 4,
                    archived: true,
                  },
                ],
              },
              done: {
                id: 101,
                title: "Terminé",
                cards: [
                  {
                    id: 1002,
                    title: "Corriger la synchronisation",
                    description: "",
                    stackId: 101,
                    labels: [{ id: 98, title: "Bug", color: "aa0000", boardId: 10 }],
                    assignedUsers: [],
                    order: 7,
                    archived: false,
                  },
                ],
              },
            },
          },
        ],
      };

      const response = await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deckData }),
        }),
      );

      assertEquals(response.status, 200);
      assertEquals(await response.json(), {
        success: true,
        message: "Import terminé",
        results: [
          {
            board: "Roadmap RD",
            projectId: "project-1",
            epicsCreated: 1,
            storiesCreated: 2,
          },
        ],
      });

      assertEquals(supabaseMock.inserts.rd_projets, [
        {
          nom: "Roadmap RD",
          description: "Importé depuis Nextcloud Deck",
          couleur: "#336699",
          statut: "actif",
        },
      ]);

      assertEquals(supabaseMock.inserts.rd_epics, [
        {
          projet_id: "project-1",
          titre: "Frontend",
          couleur: "#ff0000",
          priorite: "medium",
        },
      ]);

      assertEquals(supabaseMock.inserts.rd_user_stories, [
        {
          projet_id: "project-1",
          epic_id: "epic-1",
          titre: "Créer le tableau de bord",
          description: "Afficher les indicateurs principaux",
          statut: "in_progress",
          priorite: "critical",
          ordre: 3,
        },
        {
          projet_id: "project-1",
          epic_id: null,
          titre: "Corriger la synchronisation",
          description: null,
          statut: "done",
          priorite: "high",
          ordre: 7,
        },
      ]);
    }, supabaseMock);
  });
});

Deno.test("POST uses provided project id instead of creating a project", async () => {
  const supabaseMock = createSupabaseMock();

  await withSupabaseEnv(async () => {
    await withInstrumentedHandler(async (handler) => {
      const response = await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projetId: "existing-project-id",
            deckData: {
              boards: [
                {
                  id: 20,
                  title: "Maintenance",
                  color: "123456",
                  labels: [],
                  stacks: {
                    todo: {
                      id: 200,
                      title: "To Do",
                      cards: [
                        {
                          id: 2000,
                          title: "Planifier la migration",
                          description: "Préparer les étapes",
                          stackId: 200,
                          labels: [{ id: 201, title: "Plus tard", color: "999999", boardId: 20 }],
                          assignedUsers: [],
                          order: 1,
                          archived: false,
                        },
                      ],
                    },
                  },
                },
              ],
            },
          }),
        }),
      );

      assertEquals(response.status, 200);
      assertEquals(await response.json(), {
        success: true,
        message: "Import terminé",
        results: [
          {
            board: "Maintenance",
            projectId: "existing-project-id",
            epicsCreated: 0,
            storiesCreated: 1,
          },
        ],
      });

      assertEquals(supabaseMock.inserts.rd_projets.length, 0);
      assertEquals(supabaseMock.inserts.rd_epics.length, 0);
      assertEquals(supabaseMock.inserts.rd_user_stories, [
        {
          projet_id: "existing-project-id",
          epic_id: null,
          titre: "Planifier la migration",
          description: "Préparer les étapes",
          statut: "todo",
          priorite: "low",
          ordre: 1,
        },
      ]);
    }, supabaseMock);
  });
});

Deno.test("POST returns sanitized 500 response when project creation fails", async () => {
  const supabaseMock = createSupabaseMock({
    errors: {
      rd_projets: new Error("database insert refused"),
    },
  });

  await withSupabaseEnv(async () => {
    await withInstrumentedHandler(async (handler) => {
      const response = await handler(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deckData: {
              boards: [
                {
                  id: 30,
                  title: "Projet en erreur",
                  color: "abcdef",
                  labels: [],
                  stacks: {},
                },
              ],
            },
          }),
        }),
      );

      assertEquals(response.status, 500);
      assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
      assertEquals(await response.json(), {
        error: "sanitized",
        context: "import-deck-json",
        message: "database insert refused",
      });
      assertEquals(supabaseMock.inserts.rd_projets.length, 1);
      assertEquals(supabaseMock.inserts.rd_epics.length, 0);
      assertEquals(supabaseMock.inserts.rd_user_stories.length, 0);
    }, supabaseMock);
  });
});

Deno.test("assert helpers are available for synchronous and asynchronous failures", async () => {
  assertThrows(
    () => {
      JSON.parse("{");
    },
    SyntaxError,
  );

  await assertRejects(
    async () => {
      await Promise.reject(new TypeError("offline rejection"));
    },
    TypeError,
    "offline rejection",
  );
});