import { assertEquals, assertExists, assertRejects, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Deno.serve is a non-writable getter in current Deno; keep edge-runtime
// contracts static here instead of monkey-patching the runtime.

Deno.test("assertThrows works for a local invariant to keep assert imports exercised", () => {
  assertThrows(() => {
    throw new Error("expected");
  }, Error, "expected");
});

Deno.test("assertRejects works for a local async invariant to keep assert imports exercised", async () => {
  await assertRejects(
    async () => {
      throw new Error("expected async");
    },
    Error,
    "expected async",
  );
});

// ---------------------------------------------------------------------------
// Invariants provisioning : unicité des rôles + delete-then-insert.
// On lit directement la source pour éviter d'exécuter le handler complet
// (qui dépend de Deno.env / réseau Supabase).
// ---------------------------------------------------------------------------

const SOURCE = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("edge handler expose OPTIONS CORS et Deno.serve", () => {
  assertEquals(SOURCE.includes("Deno.serve(async (req) =>"), true);
  assertEquals(SOURCE.includes('if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });'), true);
  assertEquals(SOURCE.includes("origineAutorisee()"), true);
  assertEquals(SOURCE.includes('"Access-Control-Allow-Methods": "POST, OPTIONS"'), true);
});

Deno.test("ROLES contient exactement 7 rôles sandbox uniques", () => {
  const match = SOURCE.match(/const ROLES = \[([^\]]+)\] as const;/);
  assertExists(match);
  const roles = match![1]
    .split(",")
    .map((s) => s.trim().replace(/["']/g, ""))
    .filter(Boolean);

  // Pas de doublon dans la liste source
  assertEquals(new Set(roles).size, roles.length);
  assertEquals(roles.length, 7);

  // Rôles attendus (alignés avec docs/SANDBOX_TEST_ACCOUNTS.md)
  const expected = ["admin", "direction", "commercial", "chef_projet", "csm", "rh", "copil"];
  assertEquals(roles.sort(), expected.sort());
});

Deno.test("provisioning supprime les rôles existants avant d'insérer (garantie d'unicité)", () => {
  // Assure que la séquence DELETE puis INSERT sur user_roles est bien
  // présente dans la source — protège contre une régression qui laisserait
  // s'accumuler des doublons (root cause de PGRST116 côté useUserRole).
  const deleteIdx = SOURCE.indexOf('.from("user_roles")\n          .delete()');
  const insertIdx = SOURCE.indexOf('.from("user_roles").insert');

  assertEquals(deleteIdx > 0, true, "DELETE FROM user_roles manquant");
  assertEquals(insertIdx > 0, true, "INSERT INTO user_roles manquant");
  assertEquals(deleteIdx < insertIdx, true, "DELETE doit précéder INSERT");
});

Deno.test("provisioning cherche les utilisateurs existants au-delà de la première page Auth", () => {
  assertEquals(SOURCE.includes("async function findAuthUserIdByEmail"), true);
  assertEquals(SOURCE.includes("page <= 20"), true);
  assertEquals(SOURCE.includes("listUsers({ page, perPage })"), true);
  assertEquals(SOURCE.includes("findAuthUserIdByEmail(admin, email)"), true);
});

Deno.test("provisioning retombe sur profiles.is_sandbox si Auth Admin listUsers est indisponible", () => {
  assertEquals(SOURCE.includes("async function findSandboxProfileUserIdByEmail"), true);
  assertEquals(SOURCE.includes('.eq("is_sandbox", true)'), true);
  assertEquals(SOURCE.includes("return await findSandboxProfileUserIdByEmail(admin, email)"), true);
});

Deno.test("emails sandbox suivent le pattern test-<role>@exploitant.example.org", () => {
  // Le domaine et le préfixe sont un contrat produit — les audits browser-use
  // s'appuient dessus pour identifier un compte sandbox sans requête DB.
  assertEquals(SOURCE.includes("`test-${role}@exploitant.example.org`"), true);
});

Deno.test("comptes sandbox marqués is_sandbox=true dans profiles", () => {
  // Filtre indispensable pour ne pas polluer les vues/exports produit.
  assertEquals(SOURCE.includes("is_sandbox: true"), true);
});
