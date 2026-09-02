import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type ServedHandler = (req: Request) => Response | Promise<Response>;

let capturedHandler: ServedHandler | undefined;

const originalServeDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve");
const serveStub = (arg1: unknown, arg2?: unknown) => {
  capturedHandler = (typeof arg1 === "function" ? arg1 : arg2) as ServedHandler;
  return {
    finished: Promise.resolve(),
    shutdown() {},
    ref() {},
    unref() {},
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
  };
};

const envKeys = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "EMAIL_ENCRYPTION_KEY",
];

const savedEnv = new Map<string, string | undefined>();
for (const key of envKeys) savedEnv.set(key, Deno.env.get(key));

Object.defineProperty(Deno, "serve", {
  value: serveStub,
  configurable: true,
  writable: true,
});

try {
  Deno.env.set("SUPABASE_URL", "http://supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");
  Deno.env.set("EMAIL_ENCRYPTION_KEY", "test-encryption-key");
  await import("./index.ts");
} finally {
  for (const [key, value] of savedEnv) {
    if (value === undefined) Deno.env.delete(key);
    else Deno.env.set(key, value);
  }

  if (originalServeDescriptor) {
    Object.defineProperty(Deno, "serve", originalServeDescriptor);
  }
}

type FetchCall = {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
};

type Scenario = {
  user?: { id: string } | null;
  canPublish?: boolean;
  comment?: {
    id: string;
    brand_id: string;
    platform: string;
    external_id: string;
    post_id: string;
  } | null;
  connection?: { id: string } | null;
  encryptedToken?: string | null;
  decryptedToken?: string | null;
  graphStatus?: number;
  graphBody?: unknown;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function defaultScenario(overrides: Scenario = {}): Required<Scenario> {
  return {
    user: { id: "user-1" },
    canPublish: true,
    comment: {
      id: "comment-1",
      brand_id: "brand-1",
      platform: "facebook",
      external_id: "external-comment-1",
      post_id: "post-1",
    },
    connection: { id: "connection-1" },
    encryptedToken: "encrypted-token",
    decryptedToken: "decrypted-token-value",
    graphStatus: 200,
    graphBody: { id: "graph-result-1", success: true },
    ...overrides,
  };
}

async function readBody(init?: RequestInit): Promise<unknown> {
  const raw = init?.body;
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  if (raw instanceof Uint8Array) {
    const text = new TextDecoder().decode(raw);
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return raw;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of headers.entries()) out[key] = value;
  return out;
}

function authUserPayload(user: { id: string }) {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: `${user.id}@example.test`,
    app_metadata: {},
    user_metadata: {},
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
  };
}

function createFetchStub(scenarioOverrides: Scenario = {}) {
  const scenario = defaultScenario(scenarioOverrides);
  const calls: FetchCall[] = [];

  const fetchStub = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : undefined;
    const url = String(request?.url ?? input);
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const headers = new Headers(request?.headers);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    const body = await readBody(init ?? (request ? { body: request.body as never } : undefined));

    calls.push({ url, method, body, headers: headersToRecord(headers) });

    const parsed = new URL(url);

    if (parsed.origin === "http://supabase.test" && parsed.pathname === "/auth/v1/user") {
      if (scenario.user === null) {
        return jsonResponse({ message: "Invalid token" }, 401);
      }
      return jsonResponse(authUserPayload(scenario.user));
    }

    if (
      parsed.origin === "http://supabase.test" &&
      parsed.pathname === "/rest/v1/rpc/is_social_publisher"
    ) {
      return jsonResponse(scenario.canPublish);
    }

    if (
      parsed.origin === "http://supabase.test" &&
      parsed.pathname === "/rest/v1/social_comments" &&
      method === "GET"
    ) {
      return jsonResponse(scenario.comment);
    }

    if (
      parsed.origin === "http://supabase.test" &&
      parsed.pathname === "/rest/v1/social_connections" &&
      method === "GET"
    ) {
      return jsonResponse(scenario.connection);
    }

    if (
      parsed.origin === "http://supabase.test" &&
      parsed.pathname === "/rest/v1/social_connection_secrets" &&
      method === "GET"
    ) {
      return jsonResponse(
        scenario.encryptedToken ? { access_token_enc: scenario.encryptedToken } : null,
      );
    }

    if (
      parsed.origin === "http://supabase.test" &&
      parsed.pathname === "/rest/v1/rpc/decrypt_social_secret"
    ) {
      return jsonResponse(scenario.decryptedToken);
    }

    if (
      parsed.origin === "http://supabase.test" &&
      parsed.pathname === "/rest/v1/social_comments" &&
      method === "PATCH"
    ) {
      return new Response(null, { status: 204 });
    }

    if (parsed.origin === "https://graph.facebook.com") {
      return jsonResponse(scenario.graphBody, scenario.graphStatus);
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  };

  return { fetchStub, calls };
}

async function withFetchStub<T>(
  scenario: Scenario,
  fn: (calls: FetchCall[]) => Promise<T> | T,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const { fetchStub, calls } = createFetchStub(scenario);
  globalThis.fetch = fetchStub as typeof fetch;
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function invoke(
  body: unknown,
  options: { method?: string; authorization?: string; rawBody?: string } = {},
): Promise<Response> {
  assertExists(capturedHandler);
  const headers = new Headers();
  if (options.authorization !== undefined) {
    headers.set("Authorization", options.authorization);
  } else {
    headers.set("Authorization", "Bearer valid-jwt");
  }

  const init: RequestInit = {
    method: options.method ?? "POST",
    headers,
  };

  if (options.rawBody !== undefined) {
    init.body = options.rawBody;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    headers.set("content-type", "application/json");
  }

  return await capturedHandler(new Request("http://localhost", init));
}

function callsByPath(calls: FetchCall[], path: string): FetchCall[] {
  return calls.filter((call) => {
    try {
      return new URL(call.url).pathname === path;
    } catch {
      return false;
    }
  });
}

function graphCalls(calls: FetchCall[]): FetchCall[] {
  return calls.filter((call) => {
    try {
      return new URL(call.url).origin === "https://graph.facebook.com";
    } catch {
      return false;
    }
  });
}

Deno.test("module loads and registers the Edge Function handler", () => {
  assertExists(capturedHandler);
  assertEquals(typeof capturedHandler, "function");
});

Deno.test("OPTIONS request returns ok without external calls", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (() => {
    fetchCalled = true;
    return Promise.resolve(jsonResponse({ unexpected: true }));
  }) as typeof fetch;

  try {
    assertExists(capturedHandler);
    const response = await capturedHandler(new Request("http://localhost", { method: "OPTIONS" }));
    assertEquals(response.status, 200);
    assertEquals(await response.text(), "ok");
    assertEquals(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("POST without Bearer authorization returns 401 and does not call Supabase", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (() => {
    fetchCalled = true;
    return Promise.resolve(jsonResponse({ unexpected: true }));
  }) as typeof fetch;

  try {
    const response = await invoke({ comment_id: "comment-1", action: "handle" }, {
      authorization: "",
    });
    assertEquals(response.status, 401);
    assertEquals(await response.json(), { error: "Unauthorized" });
    assertEquals(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("invalid authenticated user returns 401", async () => {
  await withFetchStub({ user: null }, async (calls) => {
    const response = await invoke({ comment_id: "comment-1", action: "handle" });

    assertEquals(response.status, 401);
    assertEquals(await response.json(), { error: "Unauthorized" });
    assertEquals(callsByPath(calls, "/auth/v1/user").length, 1);
    assertEquals(callsByPath(calls, "/rest/v1/rpc/is_social_publisher").length, 0);
  });
});

Deno.test("non publisher user returns 403 before reading comment", async () => {
  await withFetchStub({ canPublish: false }, async (calls) => {
    const response = await invoke({ comment_id: "comment-1", action: "handle" });

    assertEquals(response.status, 403);
    assertEquals(await response.json(), { error: "Forbidden" });
    assertEquals(callsByPath(calls, "/rest/v1/rpc/is_social_publisher").length, 1);
    assertEquals(callsByPath(calls, "/rest/v1/social_comments").length, 0);
  });
});

Deno.test("missing comment_id or action returns validation error", async () => {
  await withFetchStub({}, async (calls) => {
    const response = await invoke({ comment_id: "comment-1" });

    assertEquals(response.status, 400);
    assertEquals(await response.json(), { error: "comment_id et action requis" });
    assertEquals(callsByPath(calls, "/auth/v1/user").length, 1);
    assertEquals(callsByPath(calls, "/rest/v1/rpc/is_social_publisher").length, 1);
    assertEquals(callsByPath(calls, "/rest/v1/social_comments").length, 0);
  });
});

Deno.test("invalid JSON body is treated as empty body and returns validation error", async () => {
  await withFetchStub({}, async () => {
    const response = await invoke(undefined, { rawBody: "{invalid-json" });

    assertEquals(response.status, 400);
    assertEquals(await response.json(), { error: "comment_id et action requis" });
  });
});

Deno.test("unknown comment returns 404", async () => {
  await withFetchStub({ comment: null }, async (calls) => {
    const response = await invoke({ comment_id: "missing-comment", action: "handle" });

    assertEquals(response.status, 404);
    assertEquals(await response.json(), { error: "Commentaire introuvable" });
    assertEquals(callsByPath(calls, "/rest/v1/social_comments").length, 1);
    assertEquals(callsByPath(calls, "/rest/v1/social_connections").length, 0);
  });
});

Deno.test("handle action marks the comment as handled without Graph API call", async () => {
  await withFetchStub({}, async (calls) => {
    const response = await invoke({ comment_id: "comment-1", action: "handle" });

    assertEquals(response.status, 200);
    assertEquals(await response.json(), { ok: true });
    assertEquals(graphCalls(calls).length, 0);
    assertEquals(callsByPath(calls, "/rest/v1/rpc/decrypt_social_secret").length, 0);

    const updates = callsByPath(calls, "/rest/v1/social_comments").filter((call) =>
      call.method === "PATCH"
    );
    assertEquals(updates.length, 1);
    assertEquals((updates[0].body as Record<string, unknown>).is_handled, true);
    assertEquals((updates[0].body as Record<string, unknown>).handled_by, "user-1");
    assertExists((updates[0].body as Record<string, unknown>).handled_at);
  });
});

Deno.test("unhandle action clears handled metadata", async () => {
  await withFetchStub({}, async (calls) => {
    const response = await invoke({ comment_id: "comment-1", action: "unhandle" });

    assertEquals(response.status, 200);
    assertEquals(await response.json(), { ok: true });

    const updates = callsByPath(calls, "/rest/v1/social_comments").filter((call) =>
      call.method === "PATCH"
    );
    assertEquals(updates.length, 1);
    assertEquals(updates[0].body, {
      is_handled: false,
      handled_by: null,
      handled_at: null,
    });
  });
});

Deno.test("reply action rejects empty message before decrypting token", async () => {
  await withFetchStub({}, async (calls) => {
    const response = await invoke({
      comment_id: "comment-1",
      action: "reply",
      message: "   ",
    });

    assertEquals(response.status, 400);
    assertEquals(await response.json(), { error: "message vide" });
    assertEquals(callsByPath(calls, "/rest/v1/social_connections").length, 1);
    assertEquals(callsByPath(calls, "/rest/v1/social_connection_secrets").length, 0);
    assertEquals(callsByPath(calls, "/rest/v1/rpc/decrypt_social_secret").length, 0);
    assertEquals(graphCalls(calls).length, 0);
  });
});

Deno.test("reply action posts to Graph API and then marks comment as handled", async () => {
  await withFetchStub({}, async (calls) => {
    const response = await invoke({
      comment_id: "comment-1",
      action: "reply",
      message: "Merci pour votre commentaire",
    });

    assertEquals(response.status, 200);
    assertEquals(await response.json(), { ok: true });

    const decryptCalls = callsByPath(calls, "/rest/v1/rpc/decrypt_social_secret");
    assertEquals(decryptCalls.length, 1);
    assertEquals(decryptCalls[0].body, {
      ciphertext: "encrypted-token",
      encryption_key: "test-encryption-key",
    });

    const graph = graphCalls(calls);
    assertEquals(graph.length, 1);
    assertEquals(graph[0].method, "POST");
    assertEquals(
      graph[0].url,
      "https://graph.facebook.com/v21.0/external-comment-1/comments",
    );
    assertEquals(graph[0].body, {
      message: "Merci pour votre commentaire",
      access_token: "decrypted-token-value",
    });

    const updates = callsByPath(calls, "/rest/v1/social_comments").filter((call) =>
      call.method === "PATCH"
    );
    assertEquals(updates.length, 1);
    assertEquals((updates[0].body as Record<string, unknown>).is_handled, true);
    assertEquals((updates[0].body as Record<string, unknown>).handled_by, "user-1");
  });
});

Deno.test("instagram reply uses the same Graph comments endpoint and handles the comment", async () => {
  await withFetchStub({
    comment: {
      id: "comment-ig-1",
      brand_id: "brand-1",
      platform: "instagram",
      external_id: "ig-comment-1",
      post_id: "ig-post-1",
    },
  }, async (calls) => {
    const response = await invoke({
      comment_id: "comment-ig-1",
      action: "reply",
      message: "Réponse Instagram",
    });

    assertEquals(response.status, 200);
    assertEquals(await response.json(), { ok: true });

    const graph = graphCalls(calls);
    assertEquals(graph.length, 1);
    assertEquals(graph[0].url, "https://graph.facebook.com/v21.0/ig-comment-1/comments");
    assertEquals(graph[0].body, {
      message: "Réponse Instagram",
      access_token: "decrypted-token-value",
    });
  });
});

Deno.test("hide action hides a facebook comment and marks it as handled", async () => {
  await withFetchStub({}, async (calls) => {
    const response = await invoke({ comment_id: "comment-1", action: "hide" });

    assertEquals(response.status, 200);
    assertEquals(await response.json(), { ok: true });

    const graph = graphCalls(calls);
    assertEquals(graph.length, 1);
    assertEquals(graph[0].method, "POST");
    assertEquals(
      graph[0].url,
      "https://graph.facebook.com/v21.0/external-comment-1?is_hidden=true&access_token=decrypted-token-value",
    );

    const updates = callsByPath(calls, "/rest/v1/social_comments").filter((call) =>
      call.method === "PATCH"
    );
    assertEquals(updates.length, 2);
    assertEquals(updates[0].body, { is_hidden: true });
    assertEquals((updates[1].body as Record<string, unknown>).is_handled, true);
    assertEquals((updates[1].body as Record<string, unknown>).handled_by, "user-1");
  });
});