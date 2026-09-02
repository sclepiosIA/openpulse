import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const sourceUrl = new URL("./index.ts", import.meta.url);

async function readSource(): Promise<string> {
  return await Deno.readTextFile(sourceUrl);
}

function extractNumberConst(source: string, name: string): number {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)\\s*;`));
  if (!match) {
    throw new Error(`Constante ${name} introuvable`);
  }
  return Number(match[1]);
}

function extractQuotedArray(source: string, prefixRegex: RegExp): string[] {
  const match = source.match(prefixRegex);
  if (!match) {
    throw new Error("Tableau attendu introuvable");
  }

  return match[1]
    .split(",")
    .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

Deno.test("CreateUserSchema valide les champs métier obligatoires", async () => {
  const source = await readSource();

  assertExists(source.match(/const\s+CreateUserSchema\s*=\s*z\.object\(/));
  assertExists(source.match(/email:\s*z\.string\(\)\.email\("Email invalide"\)/));
  assertExists(source.match(/prenom:\s*z\.string\(\)\.min\(1,\s*"Prénom requis"\)/));
  assertExists(source.match(/nom:\s*z\.string\(\)\.min\(1,\s*"Nom requis"\)/));
  assertExists(source.match(/password:\s*z\.string\(\)\.min\(8,\s*"Le mot de passe doit contenir au moins 8 caractères"\)/));
  assertExists(source.match(/\.default\('user'\)/));
});

Deno.test("CreateUserSchema limite les rôles aux valeurs autorisées", async () => {
  const source = await readSource();

  const roles = extractQuotedArray(source, /role:\s*z\.enum\(\s*\[([^\]]+)\]/);
  assertEquals(roles, [
    "admin",
    "direction",
    "copil",
    "commercial",
    "chef_projet",
    "csm",
    "rh",
    "user",
  ]);

  assertExists(source.match(/errorMap:\s*\(\)\s*=>\s*\(\{\s*message:\s*"Rôle invalide"\s*\}\)/));
});

Deno.test("le rate limiting autorise 5 tentatives par minute et renvoie une erreur 429", async () => {
  const source = await readSource();

  assertEquals(extractNumberConst(source, "RATE_LIMIT_MAX"), 5);
  assertEquals(extractNumberConst(source, "RATE_LIMIT_WINDOW"), 60000);

  assertExists(source.match(/rateLimitMap\s*=\s*new\s+Map<string,\s*\{\s*count:\s*number;\s*resetAt:\s*number\s*\}>/));
  assertExists(source.match(/if\s*\(\s*userLimit\.count\s*>=\s*RATE_LIMIT_MAX\s*\)\s*\{\s*return\s+false;\s*\}/));
  assertExists(source.match(/status:\s*429/));
  assertExists(source.match(/Trop de tentatives\. Veuillez réessayer dans 1 minute\./));
});

Deno.test("les réponses CORS et OPTIONS sont configurées pour une Edge Function", async () => {
  const source = await readSource();

  assertExists(source.match(/import \{ corsHeaders \} from '\.\.\/_shared\/cors\.ts'/));
  const { corsHeaders } = await import("../_shared/cors.ts");
  assertEquals(corsHeaders["Access-Control-Allow-Headers"], "authorization, x-client-info, apikey, content-type, x-internal-secret");
  assertEquals(corsHeaders["Access-Control-Allow-Origin"] === "*", false);
  assertExists(source.match(/if\s*\(\s*req\.method\s*===\s*'OPTIONS'\s*\)/));
  assertExists(source.match(/return\s+new\s+Response\(null,\s*\{\s*headers:\s*corsHeaders\s*\}\)/));
});

Deno.test("l'authentification et le contrôle admin strict 2FA sont obligatoires", async () => {
  const source = await readSource();

  assertExists(source.match(/req\.headers\.get\('Authorization'\)/));
  assertExists(source.match(/error:\s*'Authentification requise'/));
  assertExists(source.match(/status:\s*401/));
  assertExists(source.match(/supabaseClient\.auth\.getUser\(\)/));
  assertExists(source.match(/rpc\(\s*'has_admin_role_strict',\s*\{\s*_user_id:\s*user\.id\s*\}\s*\)/));
  assertExists(source.match(/Accès refusé : privilèges admin avec 2FA requis/));
  assertExists(source.match(/Vous devez être administrateur avec 2FA activé pour créer des utilisateurs/));
  assertExists(source.match(/status:\s*403/));
});

Deno.test("les erreurs de validation retournent un statut 400 avec les détails Zod", async () => {
  const source = await readSource();

  assertExists(source.match(/const\s+body\s*=\s*await\s+req\.json\(\)/));
  assertExists(source.match(/CreateUserSchema\.safeParse\(body\)/));
  assertExists(source.match(/if\s*\(\s*!validationResult\.success\s*\)/));
  assertExists(source.match(/error:\s*'Données invalides'/));
  assertExists(source.match(/details:\s*validationResult\.error\.errors/));
  assertExists(source.match(/status:\s*400/));
});

Deno.test("les cas de doublons et désynchronisation auth/profil renvoient des réponses métier explicites", async () => {
  const source = await readSource();

  assertExists(source.match(/listUsers\(\)/));
  assertExists(source.match(/u\.email\?\.toLowerCase\(\)\s*===\s*email\.toLowerCase\(\)/));
  assertExists(source.match(/from\('profiles'\)\s*\.\s*select\('id, actif, user_id, email, prenom, nom'\)\s*\.\s*eq\('email',\s*email\)/));
  assertExists(source.match(/Plusieurs profils existent pour cet email/));
  assertExists(source.match(/Profil inactif existant/));
  assertExists(source.match(/Utilisateur synchronisé avec succès/));
  assertExists(source.match(/Conflit de profil détecté/));
});

Deno.test("la création d'utilisateur confirme l'email, force le changement de mot de passe et assigne le rôle", async () => {
  const source = await readSource();

  assertExists(source.match(/createUser\(\s*\{\s*email,\s*password,\s*email_confirm:\s*true/));
  assertExists(source.match(/user_metadata:\s*\{\s*prenom,\s*nom,\s*role\s*\}/));
  assertExists(source.match(/must_change_password:\s*true/));
  assertExists(source.match(/if\s*\(\s*role\s*!==\s*'user'\s*\)/));
  assertExists(source.match(/from\('user_roles'\)\s*\.\s*upsert\(/));
  assertExists(source.match(/onConflict:\s*'user_id,role'/));
  assertExists(source.match(/Utilisateur créé avec succès/));
});

Deno.test("les erreurs Supabase email déjà utilisé sont normalisées en réponse métier", async () => {
  const source = await readSource();

  assertExists(source.match(/already registered/));
  assertExists(source.match(/email exists/));
  assertExists(source.match(/errorCode\s*===\s*'email_exists'/));
  assertExists(source.match(/errorStatus\s*===\s*422/));
  assertExists(source.match(/error:\s*'Cet email est déjà utilisé'/));
  assertExists(source.match(/details:\s*'Un compte existe déjà avec cette adresse email\.'/));
});

Deno.test("les helpers de test détectent les constructions source manquantes", async () => {
  const source = await readSource();

  assertThrows(
    () => extractNumberConst(source, "CONSTANTE_INEXISTANTE"),
    Error,
    "CONSTANTE_INEXISTANTE",
  );

  assertThrows(
    () => extractQuotedArray(source, /schema_inexistant\(\[([^\]]+)\]/),
    Error,
    "Tableau attendu introuvable",
  );

  await assertRejects(
    async () => {
      await Deno.readTextFile(new URL("./index.ts.inexistant", import.meta.url));
    },
    Deno.errors.NotFound,
  );
});

Deno.test("module import smoke test disponible sans ouvrir de vrai listener", async () => {
  if (Deno.env.get("RUN_EDGE_IMPORT_TEST") !== "1") {
    assertEquals(Deno.env.get("RUN_EDGE_IMPORT_TEST"), undefined);
    return;
  }

  const previousUrl = Deno.env.get("SUPABASE_URL");
  const previousKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const originalFetch = globalThis.fetch;
  const originalListenDescriptor = Object.getOwnPropertyDescriptor(Deno, "listen");
  const listenCalls: unknown[] = [];

  try {
    Deno.env.set("SUPABASE_URL", "http://localhost");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )) as typeof fetch;

    const fakeListener = {
      addr: { transport: "tcp", hostname: "127.0.0.1", port: 8000 },
      rid: -1,
      close() {},
      ref() {},
      unref() {},
      accept() {
        return new Promise(() => {});
      },
      [Symbol.asyncIterator]() {
        return {
          next() {
            return new Promise(() => {});
          },
        };
      },
    };

    Object.defineProperty(Deno, "listen", {
      configurable: true,
      writable: true,
      value: (options: unknown) => {
        listenCalls.push(options);
        return fakeListener;
      },
    });

    const module = await import("./index.ts");
    assertExists(module);
    assertEquals(listenCalls.length, 1);
  } finally {
    if (previousUrl === undefined) {
      Deno.env.delete("SUPABASE_URL");
    } else {
      Deno.env.set("SUPABASE_URL", previousUrl);
    }

    if (previousKey === undefined) {
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousKey);
    }

    globalThis.fetch = originalFetch;

    if (originalListenDescriptor) {
      Object.defineProperty(Deno, "listen", originalListenDescriptor);
    }
  }
});