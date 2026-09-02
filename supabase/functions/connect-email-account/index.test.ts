import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type EdgeRunResult = {
  status: number;
  headers: Record<string, string | null>;
  body: unknown;
  text: string;
  insert: Record<string, unknown> | null;
  connectCount: number;
  tlsWrites: string[];
  rpcCalls: Array<Record<string, unknown>>;
};

function fileUrlFromPath(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  const absolute = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return new URL(`file://${absolute}`).href;
}

function directoryPathFromImportMeta(url: string): string {
  let path = decodeURIComponent(new URL(".", url).pathname);
  if (Deno.build.os === "windows" && path.startsWith("/")) path = path.slice(1);
  return path;
}

async function removeIfExists(path: string): Promise<void> {
  try {
    await Deno.remove(path);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}

async function runEdgeFunction(
  scenario: Record<string, unknown>,
  request: { method?: string; headers?: Record<string, string>; body?: Record<string, unknown> },
): Promise<EdgeRunResult> {
  const tmpDir = await Deno.makeTempDir();
  const moduleDir = directoryPathFromImportMeta(import.meta.url);
  const runnerPath = `${moduleDir}/.connect_email_account_test_runner_${crypto.randomUUID()}.ts`;

  try {
    const mockServerPath = `${tmpDir}/mock_server.ts`;
    const mockSupabasePath = `${tmpDir}/mock_supabase.ts`;
    const mockSanitizerPath = `${tmpDir}/mock_error_sanitizer.ts`;
    const importMapPath = `${tmpDir}/import_map.json`;

    await Deno.writeTextFile(
      mockServerPath,
      `
export function serve(handler) {
  globalThis.__edgeHandler = handler;
  return { shutdown() {}, finished: Promise.resolve() };
}
`,
    );

    await Deno.writeTextFile(
      mockSanitizerPath,
      `
export function sanitizeErrorForClient(error) {
  if (typeof error === "string") return error;
  if (error && typeof error.message === "string") return error.message;
  return "Une erreur inattendue est survenue";
}

export function safeErrorLog(scope, error) {
  return {
    scope,
    message: error && typeof error.message === "string" ? error.message : String(error),
  };
}
`,
    );

    await Deno.writeTextFile(
      mockSupabasePath,
      `
export function createClient(_url, key, _options) {
  const scenario = globalThis.__scenario ?? {};

  return {
    auth: {
      async getUser() {
        if (scenario.authError) {
          return { data: { user: null }, error: { message: "auth failed" } };
        }

        return {
          data: { user: { id: scenario.userId ?? "user-1", email: "user@example.test" } },
          error: null,
        };
      },
    },

    async rpc(name, args) {
      globalThis.__rpcCalls = [...(globalThis.__rpcCalls ?? []), { name, args: args ?? null, key }];

      if (name === "is_admin") {
        return {
          data: scenario.isAdmin ?? false,
          error: scenario.adminError ? { message: "admin rpc failed" } : null,
        };
      }

      if (name === "encrypt_email_password") {
        if (scenario.encryptError) {
          return { data: null, error: { message: "encrypt failed" } };
        }

        return {
          data: scenario.encryptedPassword ?? "encrypted-password-value",
          error: null,
        };
      }

      return { data: null, error: { message: "unknown rpc " + name } };
    },

    from(table) {
      const state = {
        table,
        filters: [],
        inserted: null,
        selected: null,
      };

      const chain = {
        select(columns) {
          state.selected = columns;
          return chain;
        },

        eq(column, value) {
          state.filters.push([column, value]);
          return chain;
        },

        insert(payload) {
          state.inserted = payload;
          globalThis.__lastInsert = payload;
          return chain;
        },

        async single() {
          if (table === "profiles") {
            const idFilter = state.filters.find(([column]) => column === "id");
            const userFilter = state.filters.find(([column]) => column === "user_id");

            if (idFilter) {
              if (scenario.targetProfileError || idFilter[1] === scenario.missingTargetProfileId) {
                return { data: null, error: { message: "target profile not found" } };
              }

              return { data: { id: idFilter[1] }, error: null };
            }

            if (userFilter) {
              if (scenario.profileError) {
                return { data: null, error: { message: "profile not found" } };
              }

              return { data: { id: scenario.profileId ?? "profile-1" }, error: null };
            }

            return { data: null, error: { message: "unexpected profile query" } };
          }

          if (table === "user_email_accounts") {
            if (scenario.insertError) {
              return { data: null, error: { message: "insert failed" } };
            }

            return {
              data: {
                id: scenario.accountId ?? "account-1",
                email_address: state.inserted.email_address,
                ...state.inserted,
              },
              error: null,
            };
          }

          return { data: null, error: { message: "unknown table " + table } };
        },
      };

      return chain;
    },
  };
}
`,
    );

    const sharedUrl = new URL("../_shared/error-sanitizer.ts", new URL("./index.ts", import.meta.url)).href;

    await Deno.writeTextFile(
      importMapPath,
      JSON.stringify({
        imports: {
          "https://deno.land/std@0.168.0/http/server.ts": fileUrlFromPath(mockServerPath),
          "@supabase/supabase-js": fileUrlFromPath(mockSupabasePath),
          [sharedUrl]: fileUrlFromPath(mockSanitizerPath),
        },
      }),
    );

    await Deno.writeTextFile(
      runnerPath,
      `
const encoder = new TextEncoder();
const scenario = ${JSON.stringify(scenario)};
const requestSpec = ${JSON.stringify(request)};

console.log = () => {};
console.warn = () => {};
console.error = () => {};

globalThis.__scenario = scenario;

Deno.env.set("SUPABASE_URL", "https://supabase.example.test");
Deno.env.set("SUPABASE_ANON_KEY", "anon-test-key");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");

if (scenario.noEncryptionKey) {
  Deno.env.delete("EMAIL_ENCRYPTION_KEY");
} else {
  Deno.env.set("EMAIL_ENCRYPTION_KEY", "test-encryption-key");
}

let connectCount = 0;
const tlsWrites = [];

function replaceDenoApi(name, value) {
  Object.defineProperty(Deno, name, {
    value,
    configurable: true,
    writable: true,
  });
}

replaceDenoApi("resolveDns", async (host, recordType) => {
  const dns = scenario.dns ?? {};
  const hostRecords = dns[String(host).toLowerCase()];

  if (hostRecords) {
    if (recordType === "A") return hostRecords.A ?? [];
    if (recordType === "AAAA") return hostRecords.AAAA ?? [];
  }

  if (recordType === "A") return ["93.184.216.34"];
  if (recordType === "AAAA") return [];
  return [];
});

replaceDenoApi("connect", async (options) => {
  connectCount++;

  if (scenario.failImapConnect) {
    throw new Error("simulated IMAP connection failure");
  }

  globalThis.__lastConnectOptions = options;
  return {
    close() {},
    readable: null,
    writable: null,
  };
});

replaceDenoApi("startTls", async (_conn, options) => {
  let readCount = 0;
  globalThis.__lastTlsOptions = options;

  return {
    async read(buffer) {
      const text = readCount === 0
        ? "* OK IMAP4rev1 Service Ready\\r\\n"
        : (scenario.imapAuthFailure ? "A001 NO Authentication failed\\r\\n" : "A001 OK LOGIN completed\\r\\n");

      readCount++;
      buffer.fill(0);
      buffer.set(encoder.encode(text));
      return text.length;
    },

    async write(bytes) {
      tlsWrites.push(new TextDecoder().decode(bytes));
      return bytes.length;
    },

    close() {},
  };
});

await import("./index.ts");

const handler = globalThis.__edgeHandler;
if (typeof handler !== "function") {
  throw new Error("Edge function handler was not registered through serve()");
}

const headers = new Headers(requestSpec.headers ?? {});
const hasBody = requestSpec.body !== undefined;

if (hasBody && !headers.has("content-type")) {
  headers.set("content-type", "application/json");
}

const response = await handler(new Request("http://localhost/connect-email-account", {
  method: requestSpec.method ?? "POST",
  headers,
  body: hasBody ? JSON.stringify(requestSpec.body) : undefined,
}));

const text = await response.text();
let body = null;

try {
  body = text.length > 0 ? JSON.parse(text) : null;
} catch {
  body = text;
}

await Deno.stdout.write(encoder.encode(JSON.stringify({
  status: response.status,
  headers: {
    accessControlAllowOrigin: response.headers.get("access-control-allow-origin"),
    accessControlAllowMethods: response.headers.get("access-control-allow-methods"),
    contentType: response.headers.get("content-type"),
  },
  body,
  text,
  insert: globalThis.__lastInsert ?? null,
  connectCount,
  tlsWrites,
  rpcCalls: globalThis.__rpcCalls ?? [],
})));
`,
    );

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--quiet",
        "--allow-all",
        "--no-check",
        `--import-map=${importMapPath}`,
        runnerPath,
      ],
      cwd: moduleDir,
      stdout: "piped",
      stderr: "piped",
    });

    const output = await command.output();
    const stdout = new TextDecoder().decode(output.stdout).trim();
    const stderr = new TextDecoder().decode(output.stderr).trim();

    if (output.code !== 0) {
      throw new Error(`Edge runner failed with code ${output.code}: ${stderr}`);
    }

    assertExists(stdout);
    return JSON.parse(stdout) as EdgeRunResult;
  } finally {
    await removeIfExists(runnerPath);
    await Deno.remove(tmpDir, { recursive: true });
  }
}

const validEmailPayload = {
  email_address: "agent@example.test",
  password: "correct horse battery staple",
  imap_host: "imap.example.test",
  imap_port: 993,
  smtp_host: "smtp.example.test",
  smtp_port: 465,
};

Deno.test("OPTIONS request returns CORS preflight headers without authentication", async () => {
  const result = await runEdgeFunction({}, { method: "OPTIONS" });

  assertEquals(result.status, 200);
  assertEquals(result.text, "");
  assertNotEquals(result.headers.accessControlAllowOrigin, "*");
  assertEquals(result.headers.accessControlAllowMethods, "POST, OPTIONS");
  assertEquals(result.connectCount, 0);
});

Deno.test("POST request without authenticated user returns Unauthorized", async () => {
  const result = await runEdgeFunction(
    { authError: true },
    {
      method: "POST",
      headers: { authorization: "Bearer invalid-token" },
      body: validEmailPayload,
    },
  );

  assertEquals(result.status, 401);
  assertEquals(result.body, { error: "Unauthorized" });
  assertNotEquals(result.headers.accessControlAllowOrigin, "*");
  assertEquals(result.connectCount, 0);
  assertEquals(result.insert, null);
});

Deno.test("non-admin cannot configure another user's email account", async () => {
  const result = await runEdgeFunction(
    { isAdmin: false, userId: "regular-user" },
    {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: {
        ...validEmailPayload,
        target_profile_id: "profile-owned-by-someone-else",
      },
    },
  );

  assertEquals(result.status, 403);
  assertEquals(result.body, {
    error: "Seuls les administrateurs peuvent configurer les comptes email d'autres utilisateurs",
  });
  assertEquals(result.connectCount, 0);
  assertEquals(result.insert, null);
  assertEquals(result.rpcCalls[0]?.name, "is_admin");
});

Deno.test("admin target profile missing returns 404 before IMAP connection", async () => {
  const result = await runEdgeFunction(
    { isAdmin: true, missingTargetProfileId: "missing-profile" },
    {
      method: "POST",
      headers: { authorization: "Bearer admin-token" },
      body: {
        ...validEmailPayload,
        target_profile_id: "missing-profile",
      },
    },
  );

  assertEquals(result.status, 404);
  assertEquals(result.body, { error: "Profil utilisateur cible introuvable" });
  assertEquals(result.connectCount, 0);
  assertEquals(result.insert, null);
});

Deno.test("current user without profile returns Profile not found before IMAP connection", async () => {
  const result = await runEdgeFunction(
    { profileError: true },
    {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: validEmailPayload,
    },
  );

  assertEquals(result.status, 404);
  assertEquals(result.body, { error: "Profile not found" });
  assertEquals(result.connectCount, 0);
  assertEquals(result.insert, null);
});

Deno.test("SSRF protection blocks localhost IMAP target before opening a socket", async () => {
  const result = await runEdgeFunction(
    { profileId: "profile-ssrf" },
    {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: {
        ...validEmailPayload,
        imap_host: "localhost",
        imap_port: 993,
      },
    },
  );

  assertEquals(result.status, 400);
  assertEquals(result.body, {
    error: "Serveur ou port IMAP non autorisé. Les serveurs sur réseau privé sont refusés par défaut : l'exploitant peut les autoriser avec EMAIL_AUTORISER_RESEAU_PRIVE=true.",
  });
  assertEquals(result.connectCount, 0);
  assertEquals(result.insert, null);
});

Deno.test("SSRF protection blocks disallowed IMAP ports", async () => {
  const result = await runEdgeFunction(
    { profileId: "profile-bad-port" },
    {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: {
        ...validEmailPayload,
        imap_host: "imap.example.test",
        imap_port: 22,
      },
    },
  );

  assertEquals(result.status, 400);
  assertEquals(result.body, {
    error: "Serveur ou port IMAP non autorisé. Les serveurs sur réseau privé sont refusés par défaut : l'exploitant peut les autoriser avec EMAIL_AUTORISER_RESEAU_PRIVE=true.",
  });
  assertEquals(result.connectCount, 0);
  assertEquals(result.insert, null);
});

Deno.test("SSRF protection blocks public hostname resolving to private IP", async () => {
  const result = await runEdgeFunction(
    {
      profileId: "profile-private-dns",
      dns: {
        "imap.example.test": { A: ["192.168.1.10"], AAAA: [] },
      },
    },
    {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: validEmailPayload,
    },
  );

  assertEquals(result.status, 400);
  assertEquals(result.body, {
    error: "Serveur ou port IMAP non autorisé. Les serveurs sur réseau privé sont refusés par défaut : l'exploitant peut les autoriser avec EMAIL_AUTORISER_RESEAU_PRIVE=true.",
  });
  assertEquals(result.connectCount, 0);
  assertEquals(result.insert, null);
});

Deno.test("une demande sans serveur est refusée, sans ouvrir de socket", async () => {
  // Cette requête réussissait auparavant : la fonction complétait les serveurs
  // manquants avec un gabarit (« smtp.example.org ») qui ne résout pas. Le
  // compte était donc créé, inutilisable, et l'échec n'apparaissait qu'à la
  // première synchronisation. Nommer son serveur est désormais obligatoire.
  const result = await runEdgeFunction(
    {
      profileId: "profile-current-user",
      encryptedPassword: "encrypted-password-from-rpc",
      accountId: "email-account-123",
    },
    {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: {
        email_address: "agent@example.test",
        password: "plain-password",
      },
    },
  );

  assertEquals(result.status, 400);
  assertEquals(result.body, {
    error: "Serveurs IMAP et SMTP requis. Renseignez ceux de votre fournisseur.",
  });
  assertEquals(result.connectCount, 0);
  assertEquals(result.insert, null);
});

Deno.test("successful connection stores encrypted credentials with the servers provided", async () => {
  const result = await runEdgeFunction(
    {
      profileId: "profile-current-user",
      encryptedPassword: "encrypted-password-from-rpc",
      accountId: "email-account-123",
    },
    {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: {
        email_address: "agent@example.test",
        password: "plain-password",
        imap_host: "imap.example.test",
        imap_port: 993,
        smtp_host: "smtp.example.test",
        smtp_port: 465,
      },
    },
  );

  assertEquals(result.status, 200);
  assertEquals(result.body, {
    success: true,
    account: {
      id: "email-account-123",
      email_address: "agent@example.test",
    },
  });

  assertEquals(result.connectCount, 1);
  assertEquals(result.tlsWrites, ['A001 LOGIN "agent@example.test" "plain-password"\r\n']);

  // Ce qui est enregistré est ce que l'utilisateur a saisi, sans substitution.
  assertEquals(result.insert, {
    profile_id: "profile-current-user",
    email_address: "agent@example.test",
    encrypted_password: "encrypted-password-from-rpc",
    imap_host: "imap.example.test",
    imap_port: 993,
    imap_use_ssl: true,
    smtp_host: "smtp.example.test",
    smtp_port: 465,
    smtp_use_ssl: true,
  });

  assertEquals(result.rpcCalls.some((call) => call.name === "encrypt_email_password"), true);
});

Deno.test("admin can configure a target profile email account", async () => {
  const result = await runEdgeFunction(
    {
      isAdmin: true,
      encryptedPassword: "encrypted-for-target",
      accountId: "target-account-1",
    },
    {
      method: "POST",
      headers: { authorization: "Bearer admin-token" },
      body: {
        ...validEmailPayload,
        target_profile_id: "target-profile-42",
      },
    },
  );

  assertEquals(result.status, 200);
  assertEquals(result.body, {
    success: true,
    account: {
      id: "target-account-1",
      email_address: "agent@example.test",
    },
  });
  assertEquals(result.insert?.profile_id, "target-profile-42");
  assertEquals(result.insert?.encrypted_password, "encrypted-for-target");
  assertEquals(result.insert?.imap_host, "imap.example.test");
  assertEquals(result.insert?.smtp_host, "smtp.example.test");
});

Deno.test("IMAP authentication failure returns a validation error and does not insert account", async () => {
  const result = await runEdgeFunction(
    {
      profileId: "profile-imap-fail",
      imapAuthFailure: true,
    },
    {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: validEmailPayload,
    },
  );

  assertEquals(result.status, 400);
  assertEquals(result.body, {
    error: "Échec de connexion IMAP. Vérifiez vos identifiants et paramètres serveur.",
  });
  assertEquals(result.connectCount, 1);
  assertEquals(result.insert, null);
});

Deno.test("missing EMAIL_ENCRYPTION_KEY returns server configuration error after IMAP validation", async () => {
  const result = await runEdgeFunction(
    {
      profileId: "profile-no-key",
      noEncryptionKey: true,
    },
    {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: validEmailPayload,
    },
  );

  assertEquals(result.status, 500);
  assertEquals(result.body, {
    error: "Configuration serveur manquante (EMAIL_ENCRYPTION_KEY)",
  });
  assertEquals(result.connectCount, 1);
  assertEquals(result.insert, null);
});

Deno.test("encryption RPC failure returns an encryption error and does not insert account", async () => {
  const result = await runEdgeFunction(
    {
      profileId: "profile-encrypt-fail",
      encryptError: true,
    },
    {
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: validEmailPayload,
    },
  );

  assertEquals(result.status, 500);
  assertEquals(result.body, { error: "Échec du chiffrement du mot de passe" });
  assertEquals(result.connectCount, 1);
  assertEquals(result.insert, null);
});