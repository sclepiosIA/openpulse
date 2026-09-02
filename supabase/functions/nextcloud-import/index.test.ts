// CHARGER LE MODULE SANS OUVRIR DE PORT.
//
// `import "./index.ts"` execute `serve(...)`, qui ouvre reellement un serveur
// sur le port 8000 par defaut. Sur une machine ou ce port est pris -- une
// instance en cours d'execution, par exemple -- le banc entier tombe sur
// « AddrInUse », sans rapport avec le code qu'il pretend verifier.
//
// On lit la source, on neutralise l'appel a `serve`, et on charge le resultat
// depuis une URL `data:`. C'est ce que font les quatre-vingts autres bancs.
async function chargerSansServeur(chemin = "./index.ts") {
  const base = new URL(chemin, import.meta.url);
  const source = await Deno.readTextFile(base);
  const neutralise = source
    .replace(
      /import\s*\{\s*serve\s*\}\s*from\s*["'][^"']*http\/server\.ts["'];?/,
      "const serve = (_h: unknown) => Promise.resolve();",
    )
    // Un module `data:` n'a pas de repertoire d'origine : ses specificateurs
    // relatifs ne resolvent contre rien, et Deno refuse le chargement. On les
    // ancre sur l'emplacement reel du module avant de le lui donner.
    .replace(
      /(\bfrom\s*|\bimport\s*\(\s*)(["'])(\.\.?\/[^"']*)\2/g,
      (_tout, avant, guillemet, cible) =>
        `${avant}${guillemet}${new URL(cible, base).href}${guillemet}`,
    );
  return await import(
    `data:application/typescript;charset=utf-8,${encodeURIComponent(neutralise)}#${crypto.randomUUID()}`
  );
}

import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type PureHelpers = {
  normalizeBaseUrl: (url: string | undefined) => string;
  normalizeBaseFolder: (folder: string | undefined) => string;
  buildWebDAVUrl: (userId: string, path?: string) => string;
  getAuthHeader: () => string;
  getWebDAVPrefix: (userId: string) => string;
  parseWebDAVResponse: (xml: string, basePath: string, userId: string) => Array<{
    name: string;
    path: string;
    size: number;
    modified: string;
    isDirectory: boolean;
    mimeType: string;
  }>;
};

function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}`);
  if (start === -1) {
    throw new Error(`Function ${name} not found`);
  }

  const openBrace = source.indexOf("{", start);
  if (openBrace === -1) {
    throw new Error(`Function ${name} has no body`);
  }

  let depth = 0;
  for (let i = openBrace; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") depth--;

    if (depth === 0) {
      return source.slice(start, i + 1);
    }
  }

  throw new Error(`Function ${name} body is incomplete`);
}

async function withPureHelpers<T>(fn: (helpers: PureHelpers) => T | Promise<T>): Promise<T> {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  const helperSource = `
interface NextcloudFile {
  name: string;
  path: string;
  size: number;
  modified: string;
  isDirectory: boolean;
  mimeType: string;
}

const NEXTCLOUD_URL = "https://nextcloud.example.test";
const NEXTCLOUD_USERNAME = "test-user";
const NEXTCLOUD_APP_PASSWORD = "test-password";
const NEXTCLOUD_BASE_FOLDER = normalizeBaseFolder("/Shared Documents/");

${extractFunction(source, "normalizeBaseUrl")}
${extractFunction(source, "normalizeBaseFolder")}
${extractFunction(source, "buildWebDAVUrl")}
${extractFunction(source, "getAuthHeader")}
${extractFunction(source, "getWebDAVPrefix")}
${extractFunction(source, "parseWebDAVResponse")}

export {
  normalizeBaseUrl,
  normalizeBaseFolder,
  buildWebDAVUrl,
  getAuthHeader,
  getWebDAVPrefix,
  parseWebDAVResponse,
};
`;

  // Le module d'aides pures est charge depuis une URL `data:` : le banc n'ecrit
  // rien sur le disque, et tourne donc sans droit d'ecriture.
  const moduleUrl =
    `data:application/typescript;charset=utf-8,${encodeURIComponent(helperSource)}#v=${crypto.randomUUID()}`;

  const helpers = await import(moduleUrl) as PureHelpers;
  return await fn(helpers);
}

Deno.test("normalizeBaseUrl trims whitespace and removes all trailing slashes", async () => {
  await withPureHelpers(({ normalizeBaseUrl }) => {
    assertEquals(normalizeBaseUrl(undefined), "");
    assertEquals(normalizeBaseUrl(""), "");
    assertEquals(normalizeBaseUrl("   https://cloud.example.com///   "), "https://cloud.example.com");
    assertEquals(normalizeBaseUrl("https://cloud.example.com/base/path/"), "https://cloud.example.com/base/path");
  });
});

Deno.test("normalizeBaseFolder returns a canonical absolute folder path", async () => {
  await withPureHelpers(({ normalizeBaseFolder }) => {
    assertEquals(normalizeBaseFolder(undefined), "/");
    assertEquals(normalizeBaseFolder(""), "/");
    assertEquals(normalizeBaseFolder("   "), "/");
    assertEquals(normalizeBaseFolder("/"), "/");
    assertEquals(normalizeBaseFolder("Shared Documents"), "/Shared Documents");
    assertEquals(normalizeBaseFolder("/Shared Documents/"), "/Shared Documents");
    assertEquals(normalizeBaseFolder("  /Team/Docs/  "), "/Team/Docs");
  });
});

Deno.test("buildWebDAVUrl combines base URL, encoded user id, configured base folder and normalized path", async () => {
  await withPureHelpers(({ buildWebDAVUrl, getWebDAVPrefix }) => {
    assertEquals(
      buildWebDAVUrl("john.doe@example.com", "Projects/Q1/"),
      "https://nextcloud.example.test/remote.php/dav/files/john.doe%40example.com/Shared Documents/Projects/Q1",
    );

    assertEquals(
      buildWebDAVUrl("Jean Dupont", "/"),
      "https://nextcloud.example.test/remote.php/dav/files/Jean%20Dupont/Shared Documents/",
    );

    assertEquals(
      buildWebDAVUrl("Jean Dupont", ""),
      "https://nextcloud.example.test/remote.php/dav/files/Jean%20Dupont/Shared Documents",
    );

    assertEquals(
      buildWebDAVUrl("Jean Dupont"),
      "https://nextcloud.example.test/remote.php/dav/files/Jean%20Dupont/Shared Documents",
    );

    assertEquals(
      getWebDAVPrefix("john.doe@example.com"),
      "/remote.php/dav/files/john.doe%40example.com/Shared Documents",
    );
  });
});

Deno.test("getAuthHeader builds a Basic authorization header from configured credentials", async () => {
  await withPureHelpers(({ getAuthHeader }) => {
    assertEquals(getAuthHeader(), `Basic ${btoa("test-user:test-password")}`);
  });
});

Deno.test("parseWebDAVResponse parses folders and files while skipping the current folder entry", async () => {
  await withPureHelpers(({ parseWebDAVResponse }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/remote.php/dav/files/alice/Shared%20Documents/</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname>Shared Documents</d:displayname>
        <d:resourcetype><d:collection/></d:resourcetype>
      </d:prop>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/alice/Shared%20Documents/Projects/</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname>Projects</d:displayname>
        <d:getlastmodified>Tue, 02 Jan 2024 10:00:00 GMT</d:getlastmodified>
        <d:resourcetype><d:collection/></d:resourcetype>
      </d:prop>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/alice/Shared%20Documents/Report%20Q1.pdf</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname>Report Q1.pdf</d:displayname>
        <d:getcontentlength>12345</d:getcontentlength>
        <d:getlastmodified>Wed, 03 Jan 2024 11:30:00 GMT</d:getlastmodified>
        <d:getcontenttype>application/pdf</d:getcontenttype>
        <d:resourcetype/>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>`;

    assertEquals(parseWebDAVResponse(xml, "/", "alice"), [
      {
        name: "Projects",
        path: "/Projects",
        size: 0,
        modified: "Tue, 02 Jan 2024 10:00:00 GMT",
        isDirectory: true,
        mimeType: "inode/directory",
      },
      {
        name: "Report Q1.pdf",
        path: "/Report Q1.pdf",
        size: 12345,
        modified: "Wed, 03 Jan 2024 11:30:00 GMT",
        isDirectory: false,
        mimeType: "application/pdf",
      },
    ]);
  });
});

Deno.test("parseWebDAVResponse falls back to filename, zero size and octet-stream when optional WebDAV properties are missing", async () => {
  await withPureHelpers(({ parseWebDAVResponse }) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/remote.php/dav/files/alice/Shared%20Documents/Projects/</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname>Projects</d:displayname>
        <d:resourcetype><d:collection/></d:resourcetype>
      </d:prop>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/alice/Shared%20Documents/Projects/Nested%20File.bin</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype/>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>`;

    assertEquals(parseWebDAVResponse(xml, "/Projects", "alice"), [
      {
        name: "Nested File.bin",
        path: "/Projects/Nested File.bin",
        size: 0,
        modified: "",
        isDirectory: false,
        mimeType: "application/octet-stream",
      },
    ]);
  });
});

Deno.test("test harness detects when an expected pure helper is absent from index.ts", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertThrows(
    () => extractFunction(source, "definitelyMissingHelper"),
    Error,
    "Function definitelyMissingHelper not found",
  );
});

Deno.test("le chargement du module ne declenche aucun appel reseau", async () => {
  const previousFetch = globalThis.fetch;
  const keys = [
    "NEXTCLOUD_URL",
    "NEXTCLOUD_USERNAME",
    "NEXTCLOUD_APP_PASSWORD",
    "NEXTCLOUD_BASE_FOLDER",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const previousEnv = new Map(keys.map((key) => [key, Deno.env.get(key)]));

  let appelsReseau = 0;
  globalThis.fetch = () => {
    appelsReseau += 1;
    return Promise.resolve(
      new Response(JSON.stringify({ ocs: { data: { id: "alice" } } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  };

  try {
    Deno.env.set("NEXTCLOUD_URL", "https://nextcloud.example.test");
    Deno.env.set("NEXTCLOUD_USERNAME", "test-user");
    Deno.env.set("NEXTCLOUD_APP_PASSWORD", "test-password");
    Deno.env.set("NEXTCLOUD_BASE_FOLDER", "/Shared Documents");
    Deno.env.set("SUPABASE_URL", "https://supabase.example.test");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

    // L'epreuve exigeait auparavant un rejet -- le module etant casse, elle
    // ne prouvait rien. Elle verifie desormais ce qu'elle annonce : le
    // chargement n'appelle pas le reseau.
    const charge = await chargerSansServeur();
    assertExists(charge);
    assertEquals(appelsReseau, 0);
  } finally {
    globalThis.fetch = previousFetch;

    for (const key of keys) {
      const value = previousEnv.get(key);
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
});