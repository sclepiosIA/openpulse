import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type NextcloudFile = {
  name: string;
  path: string;
  size: number;
  modified: string;
  isDirectory: boolean;
  mimeType: string;
  etag?: string;
};

type TestableModule = {
  normalizeBaseUrl: (url: string | undefined) => string;
  normalizeBaseFolder: (folder: string | undefined) => string;
  buildWebDAVUrl: (userId: string, path?: string) => string;
  getAuthHeader: () => string;
  getWebDAVPrefix: (userId: string) => string;
  parseWebDAVResponse: (xml: string, basePath: string, userId: string) => NextcloudFile[];
  resolveNextcloudUserId: () => Promise<string>;
};

const DEFAULT_ENV: Record<string, string> = {
  NEXTCLOUD_URL: "https://cloud.example.test///",
  NEXTCLOUD_USERNAME: "alice",
  NEXTCLOUD_APP_PASSWORD: "app-password",
  NEXTCLOUD_BASE_FOLDER: "/Documents/",
  SUPABASE_URL: "https://supabase.example.test",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
};

async function withEnv<T>(
  values: Record<string, string | undefined>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(values)) {
    previous.set(key, Deno.env.get(key));
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
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

function toFileUrl(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `file://${withLeadingSlash}`;
}

function makeTestableSource(source: string): string {
  const transformed = source
    // L'import relatif de ../_shared/cors.ts ne se resout pas depuis le fichier
    // temporaire ou ce banc charge le module : on l'ancre en URL absolue, afin de
    // charger le VRAI module partage plutot qu'un simulacre.
    .replace(
      "'../_shared/cors.ts'",
      JSON.stringify(new URL("../_shared/cors.ts", import.meta.url).href),
    )
    .replace(
      /import\s+\{\s*serve\s*\}\s+from\s+["'][^"']*\/http\/server\.ts["'];?/g,
      "const serve = (_handler: unknown) => undefined;",
    )
    .replace(
      /import\s+\{\s*createClient\s*\}\s+from\s+["'][^"']*supabase-js["'];?/g,
      `const createClient = (..._args: unknown[]) => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
              order: () => Promise.resolve({ data: [], error: null }),
            }),
            order: () => Promise.resolve({ data: [], error: null }),
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
          delete: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      });`,
    )
    .replace(
      /import\s+\{\s*buildErrorResponse\s*\}\s+from\s+["'][^"']*error-sanitizer\.ts["'];?/g,
      "const buildErrorResponse = (message: string, status = 500) => new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });",
    );

  return `${transformed}

export {
  normalizeBaseUrl,
  normalizeBaseFolder,
  buildWebDAVUrl,
  getAuthHeader,
  getWebDAVPrefix,
  parseWebDAVResponse,
  resolveNextcloudUserId,
};
`;
}

async function importTestableModule(
  envOverrides: Record<string, string | undefined> = {},
): Promise<TestableModule> {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const transformedSource = makeTestableSource(source);
  const tempFile = await Deno.makeTempFile({
    prefix: "nextcloud_files_testable_",
    suffix: ".ts",
  });

  await Deno.writeTextFile(tempFile, transformedSource);

  try {
    return await withEnv({ ...DEFAULT_ENV, ...envOverrides }, async () => {
      const mod = await import(`${toFileUrl(tempFile)}?v=${crypto.randomUUID()}`);
      return mod as TestableModule;
    });
  } finally {
    await Deno.remove(tempFile).catch(() => undefined);
  }
}

Deno.test("normalizes Nextcloud base URL and base folder", async () => {
  const mod = await importTestableModule();

  assertEquals(mod.normalizeBaseUrl(undefined), "");
  assertEquals(mod.normalizeBaseUrl("   https://cloud.example.com///   "), "https://cloud.example.com");
  assertEquals(mod.normalizeBaseUrl("https://cloud.example.com/path/"), "https://cloud.example.com/path");

  assertEquals(mod.normalizeBaseFolder(undefined), "/");
  assertEquals(mod.normalizeBaseFolder(""), "/");
  assertEquals(mod.normalizeBaseFolder("   "), "/");
  assertEquals(mod.normalizeBaseFolder("documents/"), "/documents");
  assertEquals(mod.normalizeBaseFolder("/documents/sub/"), "/documents/sub");
  assertEquals(mod.normalizeBaseFolder("/"), "/");
});

Deno.test("builds WebDAV URLs with normalized configuration and encoded user id", async () => {
  const mod = await importTestableModule({
    NEXTCLOUD_URL: " https://cloud.example.test/// ",
    NEXTCLOUD_BASE_FOLDER: "Cabinet/Archives/",
  });

  assertEquals(
    mod.buildWebDAVUrl("john.doe+demo", "factures/2024/"),
    "https://cloud.example.test/remote.php/dav/files/john.doe%2Bdemo/Cabinet/Archives/factures/2024",
  );

  assertEquals(
    mod.buildWebDAVUrl("john.doe+demo", "/factures/2024"),
    "https://cloud.example.test/remote.php/dav/files/john.doe%2Bdemo/Cabinet/Archives/factures/2024",
  );

  assertEquals(
    mod.getWebDAVPrefix("john.doe+demo"),
    "/remote.php/dav/files/john.doe%2Bdemo/Cabinet/Archives",
  );
});

Deno.test("builds WebDAV URLs correctly when base folder is root", async () => {
  const mod = await importTestableModule({
    NEXTCLOUD_BASE_FOLDER: "/",
  });

  assertEquals(
    mod.buildWebDAVUrl("demo", "/"),
    "https://cloud.example.test/remote.php/dav/files/demo/",
  );

  assertEquals(
    mod.buildWebDAVUrl("demo", "reports"),
    "https://cloud.example.test/remote.php/dav/files/demo/reports",
  );

  assertEquals(mod.getWebDAVPrefix("demo"), "/remote.php/dav/files/demo");
});

Deno.test("rejects path traversal attempts when building WebDAV URLs", async () => {
  const mod = await importTestableModule();

  assertThrows(
    () => mod.buildWebDAVUrl("demo", "../secret.txt"),
    Error,
    "Invalid path: traversal sequences are not allowed",
  );

  assertThrows(
    () => mod.buildWebDAVUrl("demo", "/safe/%2e%2e/secret.txt"),
    Error,
    "Invalid path: traversal sequences are not allowed",
  );

  assertThrows(
    () => mod.buildWebDAVUrl("demo", "/safe/..hidden/file.txt"),
    Error,
    "Invalid path: traversal sequences are not allowed",
  );
});

Deno.test("builds Basic authentication header from configured credentials", async () => {
  const mod = await importTestableModule({
    NEXTCLOUD_USERNAME: "user@example.test",
    NEXTCLOUD_APP_PASSWORD: "app-password-123",
  });

  assertEquals(
    mod.getAuthHeader(),
    `Basic ${btoa("user@example.test:app-password-123")}`,
  );
});

Deno.test("parses WebDAV PROPFIND XML into files and directories", async () => {
  const mod = await importTestableModule({
    NEXTCLOUD_BASE_FOLDER: "/Cabinet",
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/remote.php/dav/files/demo/Cabinet/reports/</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname>reports</d:displayname>
        <d:resourcetype><d:collection/></d:resourcetype>
      </d:prop>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/demo/Cabinet/reports/budget.xlsx</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname>Budget 2024.xlsx</d:displayname>
        <d:getcontentlength>1536</d:getcontentlength>
        <d:getlastmodified>Mon, 01 Jan 2024 10:00:00 GMT</d:getlastmodified>
        <d:getcontenttype>application/vnd.openxmlformats-officedocument.spreadsheetml.sheet</d:getcontenttype>
        <d:resourcetype/>
        <d:getetag>"abc123"</d:getetag>
      </d:prop>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/demo/Cabinet/reports/contracts/</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname>Contracts</d:displayname>
        <d:getlastmodified>Tue, 02 Jan 2024 11:00:00 GMT</d:getlastmodified>
        <d:resourcetype><d:collection /></d:resourcetype>
        <d:getetag>folder-etag</d:getetag>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>`;

  const files = mod.parseWebDAVResponse(xml, "/reports", "demo");

  assertExists(files);
  assertEquals(files, [
    {
      name: "Budget 2024.xlsx",
      path: "/reports/budget.xlsx",
      size: 1536,
      modified: "Mon, 01 Jan 2024 10:00:00 GMT",
      isDirectory: false,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      etag: "abc123",
    },
    {
      name: "Contracts",
      path: "/reports/contracts",
      size: 0,
      modified: "Tue, 02 Jan 2024 11:00:00 GMT",
      isDirectory: true,
      mimeType: "inode/directory",
      etag: "folder-etag",
    },
  ]);
});

Deno.test("parses decoded href paths and falls back to filename when display name is absent", async () => {
  const mod = await importTestableModule({
    NEXTCLOUD_BASE_FOLDER: "/Cabinet",
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/remote.php/dav/files/demo/Cabinet/reports/space%20file.txt</d:href>
    <d:propstat>
      <d:prop>
        <d:getcontentlength>4</d:getcontentlength>
        <d:getlastmodified>Wed, 03 Jan 2024 12:00:00 GMT</d:getlastmodified>
        <d:getcontenttype>text/plain</d:getcontenttype>
        <d:resourcetype/>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>`;

  assertEquals(mod.parseWebDAVResponse(xml, "/reports", "demo"), [
    {
      name: "space file.txt",
      path: "/reports/space file.txt",
      size: 4,
      modified: "Wed, 03 Jan 2024 12:00:00 GMT",
      isDirectory: false,
      mimeType: "text/plain",
      etag: undefined,
    },
  ]);
});

Deno.test("resolveNextcloudUserId rejects when username is not configured", async () => {
  const mod = await importTestableModule({
    NEXTCLOUD_USERNAME: undefined,
  });

  await assertRejects(
    () => mod.resolveNextcloudUserId(),
    Error,
    "NEXTCLOUD_USERNAME non configuré",
  );
});

Deno.test("resolveNextcloudUserId auto-detects user id and caches it", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async (input, init) => {
    calls++;
    assertEquals(String(input), "https://cloud.example.test/ocs/v2.php/cloud/user?format=json");
    assertEquals(init?.method, "GET");

    const headers = new Headers(init?.headers);
    assertEquals(headers.get("OCS-APIRequest"), "true");
    assertEquals(headers.get("Authorization"), `Basic ${btoa("alice:app-password")}`);

    return new Response(JSON.stringify({ ocs: { data: { id: "real-user-id" } } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const mod = await importTestableModule();

    assertEquals(await mod.resolveNextcloudUserId(), "real-user-id");
    assertEquals(await mod.resolveNextcloudUserId(), "real-user-id");
    assertEquals(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("resolveNextcloudUserId falls back to configured username when OCS response has no id", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ ocs: { data: {} } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const mod = await importTestableModule({
      NEXTCLOUD_USERNAME: "fallback-user",
    });

    assertEquals(await mod.resolveNextcloudUserId(), "fallback-user");
    assertEquals(await mod.resolveNextcloudUserId(), "fallback-user");
    assertEquals(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});