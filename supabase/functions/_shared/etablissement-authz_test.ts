// Offline test for etablissement-authz.
// Stubs global fetch so @supabase/supabase-js never reaches the network.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;
const originalFetch = globalThis.fetch;

function installFetchStub(handler: FetchHandler) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    return Promise.resolve(handler(url, init));
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const USER = "u-1";
const ETAB = "e-1";

// Import dynamiquement APRÈS le set d'env vars
const { assertEtablissementAccess } = await import("./etablissement-authz.ts");

Deno.test({ name: "assertEtablissementAccess - missing params", sanitizeOps: false, sanitizeResources: false }, async () => {
  const r1 = await assertEtablissementAccess("", ETAB);
  assertEquals(r1.allowed, false);
  assertEquals(r1.reason, "missing_params");

  const r2 = await assertEtablissementAccess(USER, "");
  assertEquals(r2.allowed, false);
  assertEquals(r2.reason, "missing_params");
});

Deno.test({ name: "assertEtablissementAccess - admin bypass", sanitizeOps: false, sanitizeResources: false }, async () => {
  installFetchStub((url) => {
    if (url.includes("/user_roles")) return jsonResponse([{ role: "admin" }]);
    return jsonResponse([], 404);
  });
  try {
    const r = await assertEtablissementAccess(USER, ETAB);
    assertEquals(r.allowed, true);
  } finally {
    restoreFetch();
  }
});

Deno.test({ name: "assertEtablissementAccess - direction bypass", sanitizeOps: false, sanitizeResources: false }, async () => {
  installFetchStub((url) => {
    if (url.includes("/user_roles")) return jsonResponse([{ role: "direction" }]);
    return jsonResponse([], 404);
  });
  try {
    const r = await assertEtablissementAccess(USER, ETAB);
    assertEquals(r.allowed, true);
  } finally {
    restoreFetch();
  }
});

Deno.test({ name: "assertEtablissementAccess - no profile -> denied", sanitizeOps: false, sanitizeResources: false }, async () => {
  installFetchStub((url) => {
    if (url.includes("/user_roles")) return jsonResponse([{ role: "user" }]);
    if (url.includes("/profiles")) return jsonResponse(null);
    return jsonResponse([], 404);
  });
  try {
    const r = await assertEtablissementAccess(USER, ETAB);
    assertEquals(r.allowed, false);
    assertEquals(r.reason, "no_profile");
  } finally {
    restoreFetch();
  }
});

Deno.test({ name: "assertEtablissementAccess - etab not found", sanitizeOps: false, sanitizeResources: false }, async () => {
  installFetchStub((url) => {
    if (url.includes("/user_roles")) return jsonResponse([{ role: "user" }]);
    if (url.includes("/profiles")) return jsonResponse({ id: "p-1" });
    if (url.includes("/etablissements")) return jsonResponse(null);
    return jsonResponse([], 404);
  });
  try {
    const r = await assertEtablissementAccess(USER, ETAB);
    assertEquals(r.allowed, false);
    assertEquals(r.reason, "not_found");
  } finally {
    restoreFetch();
  }
});

Deno.test({ name: "assertEtablissementAccess - assigned commercial allowed", sanitizeOps: false, sanitizeResources: false }, async () => {
  installFetchStub((url) => {
    if (url.includes("/user_roles")) return jsonResponse([{ role: "user" }]);
    if (url.includes("/profiles")) return jsonResponse({ id: "p-1" });
    if (url.includes("/etablissements")) {
      return jsonResponse({
        id: ETAB,
        commercial_id: "p-1",
        csm_id: null,
        chef_projet_id: null,
      });
    }
    return jsonResponse([], 404);
  });
  try {
    const r = await assertEtablissementAccess(USER, ETAB);
    assertEquals(r.allowed, true);
  } finally {
    restoreFetch();
  }
});

Deno.test({ name: "assertEtablissementAccess - assigned csm allowed", sanitizeOps: false, sanitizeResources: false }, async () => {
  installFetchStub((url) => {
    if (url.includes("/user_roles")) return jsonResponse([{ role: "user" }]);
    if (url.includes("/profiles")) return jsonResponse({ id: "p-1" });
    if (url.includes("/etablissements")) {
      return jsonResponse({
        id: ETAB,
        commercial_id: null,
        csm_id: "p-1",
        chef_projet_id: null,
      });
    }
    return jsonResponse([], 404);
  });
  try {
    const r = await assertEtablissementAccess(USER, ETAB);
    assertEquals(r.allowed, true);
  } finally {
    restoreFetch();
  }
});

Deno.test({ name: "assertEtablissementAccess - not assigned -> denied", sanitizeOps: false, sanitizeResources: false }, async () => {
  installFetchStub((url) => {
    if (url.includes("/user_roles")) return jsonResponse([{ role: "user" }]);
    if (url.includes("/profiles")) return jsonResponse({ id: "p-1" });
    if (url.includes("/etablissements")) {
      return jsonResponse({
        id: ETAB,
        commercial_id: "other",
        csm_id: "other",
        chef_projet_id: "other",
      });
    }
    return jsonResponse([], 404);
  });
  try {
    const r = await assertEtablissementAccess(USER, ETAB);
    assertEquals(r.allowed, false);
    assertEquals(r.reason, "not_assigned");
  } finally {
    restoreFetch();
  }
});
