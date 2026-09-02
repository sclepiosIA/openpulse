// Ce banc interroge une instance DEPLOYEE : il n'exerce pas le code, il
// verifie qu'un service repond. Sans instance configuree, il ne peut rien
// dire.
//
// Le chargement dotenv d'origine comparait le fichier d'environnement au
// modele et levait des l'import : les 160 variables du modele n'etant jamais
// toutes posees, le fichier tombait avant meme d'enregistrer une epreuve --
// dix-sept bancs muets, comptes comme des echecs.
//
// On charge sans valider, et on SAUTE les epreuves quand l'adresse de
// l'instance manque. Un saut explicite se lit ; un echec sans cause, non.
//
// La reference est captee AVANT la declaration du drapeau : la substitution
// qui remplace `Deno.test(` par `test(` porte sur tout ce qui suit ce
// drapeau, et se mordrait la queue autrement.
const __enregistrerEpreuve = Deno.test;
import { load as chargerEnv } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
await chargerEnv({ export: true, examplePath: null }).catch(() => {});

const INSTANCE_JOIGNABLE = Boolean(Deno.env.get("VITE_SUPABASE_URL"));
const test: typeof Deno.test = INSTANCE_JOIGNABLE
  ? __enregistrerEpreuve
  : ((nom: unknown) =>
      __enregistrerEpreuve({
        name: typeof nom === "string" ? nom : String((nom as { name?: string })?.name),
        ignore: true,
        fn: () => {},
      })) as typeof Deno.test;
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

test("sync-emails - CORS preflight works", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-emails`, {
    method: "OPTIONS",
  });
  await res.text();
  assertEquals(res.status, 200);
});

test("sync-emails - returns 401 without auth", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  // Should be 401 (no auth) or 400 (missing params)
  assertEquals(res.status === 401 || res.status === 400, true);
});

test("sync-emails - returns error without account_id", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  // Should be 400 or 401 (anon key may not have access)
  assertEquals(res.status >= 400, true);
});
