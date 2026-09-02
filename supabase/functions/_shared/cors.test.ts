/**
 * OpenPulse — tests du module CORS partage.
 *
 * Ce que ces tests verrouillent :
 *   1. les deux exports historiques existent et gardent leur forme ;
 *   2. aucune origine d'editeur n'est codee en dur dans le module ;
 *   3. '*' n'est JAMAIS emis, meme si un exploitant l'ecrit dans la liste ;
 *   4. une liste explicitement vide refuse le partage au lieu de l'ouvrir ;
 *   5. la constante historique corsHeaders n'est plus un caractere generique.
 *
 * Aucune lecture de fichier : ces tests tournent avec --allow-net --allow-env,
 * les seules permissions accordees par le script test:edge du depot.
 */
import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';

type ModuleCors = {
  getCorsHeaders: (requestOrigin?: string | null) => Record<string, string>;
  listerOriginesAutorisees: () => string[];
  corsHeaders: Record<string, string>;
};

const CLE_PRINCIPALE = 'OPENPULSE_ORIGINES_AUTORISEES';
const CLE_HERITEE = 'CORS_ALLOWED_ORIGINS';

/** Reimporte le module avec une URL unique, pour relire l'environnement. */
async function importerModuleNeuf(): Promise<ModuleCors> {
  return await import(`./cors.ts?test=${crypto.randomUUID()}`) as ModuleCors;
}

/** Execute fn avec un environnement impose, puis restaure l'etat initial. */
async function avecEnv<T>(
  valeurs: Record<string, string | undefined>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const precedent: Record<string, string | undefined> = {};
  for (const cle of Object.keys(valeurs)) {
    precedent[cle] = Deno.env.get(cle);
  }

  try {
    for (const [cle, valeur] of Object.entries(valeurs)) {
      if (valeur === undefined) {
        Deno.env.delete(cle);
      } else {
        Deno.env.set(cle, valeur);
      }
    }

    return await fn();
  } finally {
    for (const [cle, valeur] of Object.entries(precedent)) {
      if (valeur === undefined) {
        Deno.env.delete(cle);
      } else {
        Deno.env.set(cle, valeur);
      }
    }
  }
}

const ENV_VIERGE = { [CLE_PRINCIPALE]: undefined, [CLE_HERITEE]: undefined };

Deno.test('le module expose les trois helpers attendus', async () => {
  await avecEnv(ENV_VIERGE, async () => {
    const mod = await importerModuleNeuf();

    assertExists(mod.getCorsHeaders);
    assertEquals(typeof mod.getCorsHeaders, 'function');
    assertExists(mod.listerOriginesAutorisees);
    assertEquals(typeof mod.listerOriginesAutorisees, 'function');
    assertExists(mod.corsHeaders);
    assertEquals(typeof mod.corsHeaders, 'object');
  });
});

Deno.test('sans variable definie, seules les origines de developpement local sont autorisees', async () => {
  await avecEnv(ENV_VIERGE, async () => {
    const { listerOriginesAutorisees } = await importerModuleNeuf();

    assertEquals(listerOriginesAutorisees(), [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:5173',
    ]);
  });
});

Deno.test('une origine declaree est renvoyee telle quelle', async () => {
  await avecEnv(
    { [CLE_PRINCIPALE]: 'https://gestion.example.org,https://preprod.example.org', [CLE_HERITEE]: undefined },
    async () => {
      const { getCorsHeaders } = await importerModuleNeuf();
      const entetes = getCorsHeaders('https://preprod.example.org');

      assertEquals(entetes['Access-Control-Allow-Origin'], 'https://preprod.example.org');
      assertEquals(
        entetes['Access-Control-Allow-Headers'],
        'authorization, x-client-info, apikey, content-type, x-internal-secret',
      );
      assertEquals(entetes['Access-Control-Allow-Methods'], 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      assertEquals(entetes['Access-Control-Max-Age'], '86400');
      assertEquals(entetes['Vary'], 'Origin');
    },
  );
});

Deno.test('une origine inconnue retombe sur la premiere autorisee, jamais sur elle-meme ni sur *', async () => {
  await avecEnv(
    { [CLE_PRINCIPALE]: 'https://gestion.example.org,https://preprod.example.org', [CLE_HERITEE]: undefined },
    async () => {
      const { getCorsHeaders } = await importerModuleNeuf();
      const entetes = getCorsHeaders('https://attaquant.example.com');

      assertEquals(entetes['Access-Control-Allow-Origin'], 'https://gestion.example.org');
      assertEquals(entetes['Access-Control-Allow-Origin'] === '*', false);
      assertEquals(entetes['Access-Control-Allow-Origin'] === 'https://attaquant.example.com', false);
    },
  );
});

Deno.test('origine absente, nulle ou vide : premiere origine autorisee', async () => {
  await avecEnv(
    { [CLE_PRINCIPALE]: 'https://gestion.example.org', [CLE_HERITEE]: undefined },
    async () => {
      const { getCorsHeaders } = await importerModuleNeuf();

      assertEquals(getCorsHeaders()['Access-Control-Allow-Origin'], 'https://gestion.example.org');
      assertEquals(getCorsHeaders(null)['Access-Control-Allow-Origin'], 'https://gestion.example.org');
      assertEquals(getCorsHeaders(undefined)['Access-Control-Allow-Origin'], 'https://gestion.example.org');
      assertEquals(getCorsHeaders('')['Access-Control-Allow-Origin'], 'https://gestion.example.org');
      assertEquals(getCorsHeaders('   ')['Access-Control-Allow-Origin'], 'https://gestion.example.org');
    },
  );
});

Deno.test('la liste est nettoyee : espaces coupes, entrees vides ignorees', async () => {
  await avecEnv(
    {
      [CLE_PRINCIPALE]: ' https://un.example.org , , https://deux.example.org,https://trois.example.org ',
      [CLE_HERITEE]: undefined,
    },
    async () => {
      const { listerOriginesAutorisees, getCorsHeaders } = await importerModuleNeuf();

      assertEquals(listerOriginesAutorisees(), [
        'https://un.example.org',
        'https://deux.example.org',
        'https://trois.example.org',
      ]);
      assertEquals(
        getCorsHeaders('https://deux.example.org')['Access-Control-Allow-Origin'],
        'https://deux.example.org',
      );
    },
  );
});

Deno.test("le nom herite CORS_ALLOWED_ORIGINS reste lu quand le nom OpenPulse est absent", async () => {
  await avecEnv(
    { [CLE_PRINCIPALE]: undefined, [CLE_HERITEE]: 'https://herite.example.org' },
    async () => {
      const { listerOriginesAutorisees } = await importerModuleNeuf();

      assertEquals(listerOriginesAutorisees(), ['https://herite.example.org']);
    },
  );
});

Deno.test('le nom OpenPulse a la priorite sur le nom herite', async () => {
  await avecEnv(
    { [CLE_PRINCIPALE]: 'https://principale.example.org', [CLE_HERITEE]: 'https://herite.example.org' },
    async () => {
      const { getCorsHeaders, listerOriginesAutorisees } = await importerModuleNeuf();

      assertEquals(listerOriginesAutorisees(), ['https://principale.example.org']);
      assertEquals(
        getCorsHeaders('https://herite.example.org')['Access-Control-Allow-Origin'],
        'https://principale.example.org',
      );
    },
  );
});

Deno.test("un caractere generique place dans la liste est ignore, pas propage", async () => {
  await avecEnv(
    { [CLE_PRINCIPALE]: '*,https://gestion.example.org', [CLE_HERITEE]: undefined },
    async () => {
      const { listerOriginesAutorisees, getCorsHeaders } = await importerModuleNeuf();

      assertEquals(listerOriginesAutorisees(), ['https://gestion.example.org']);
      assertEquals(getCorsHeaders('*')['Access-Control-Allow-Origin'], 'https://gestion.example.org');
      assertEquals(
        getCorsHeaders('https://attaquant.example.com')['Access-Control-Allow-Origin'] === '*',
        false,
      );
    },
  );
});

Deno.test('une liste explicitement vide refuse le partage au lieu de l ouvrir', async () => {
  await avecEnv({ [CLE_PRINCIPALE]: '', [CLE_HERITEE]: undefined }, async () => {
    const { listerOriginesAutorisees, getCorsHeaders } = await importerModuleNeuf();

    assertEquals(listerOriginesAutorisees(), []);
    assertEquals(getCorsHeaders('https://gestion.example.org')['Access-Control-Allow-Origin'], 'null');
    assertEquals(getCorsHeaders(null)['Access-Control-Allow-Origin'], 'null');
  });
});

Deno.test("la constante historique corsHeaders n'est plus un caractere generique", async () => {
  await avecEnv(
    { [CLE_PRINCIPALE]: 'https://gestion.example.org,https://preprod.example.org', [CLE_HERITEE]: undefined },
    async () => {
      const { corsHeaders } = await importerModuleNeuf();

      assertEquals(corsHeaders['Access-Control-Allow-Origin'], 'https://gestion.example.org');
      assertEquals(corsHeaders['Access-Control-Allow-Origin'] === '*', false);
      // Les deux cles historiques restent presentes : les appelants qui etalent
      // cette constante continuent de produire des reponses valides.
      assertExists(corsHeaders['Access-Control-Allow-Origin']);
      assertEquals(
        corsHeaders['Access-Control-Allow-Headers'],
        'authorization, x-client-info, apikey, content-type, x-internal-secret',
      );
    },
  );
});
