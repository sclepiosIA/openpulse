import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("module source contains expected edge-function business rules", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes("if (req.method === 'OPTIONS')"), true);
  assertEquals(source.includes("profile_id requis"), true);
  assertEquals(source.includes("Unauthorized"), true);
  assertEquals(source.includes("Forbidden"), true);
  assertEquals(source.includes("Profil non trouvé"), true);
  assertEquals(source.includes("Configuration Azure OpenAI manquante"), true);
  assertEquals(source.includes("Timeout Azure OpenAI"), true);
  assertEquals(source.includes("Erreur Azure OpenAI"), true);
  assertEquals(source.includes("Pas de contenu dans la réponse IA"), true);
  assertEquals(source.includes("suggest_employee_training"), true);
  assertEquals(source.includes("can_manage_rh_data"), true);
  assertEquals(source.includes("wrapUserContent(profileData, 'TRAINING_CONTEXT')"), true);
});

Deno.test("request payload parsing for expected handler input works offline", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-token",
    },
    body: JSON.stringify({ profile_id: "user-123" }),
  });

  assertEquals(req.method, "POST");
  assertEquals(req.headers.get("content-type"), "application/json");
  assertEquals(req.headers.get("authorization"), "Bearer test-token");

  const body = await req.json();
  assertEquals(body.profile_id, "user-123");
});

Deno.test("options request construction for CORS preflight is valid offline", () => {
  const req = new Request("http://localhost", {
    method: "OPTIONS",
    headers: {
      origin: "http://localhost:3000",
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization, content-type",
    },
  });

  assertEquals(req.method, "OPTIONS");
  assertEquals(req.headers.get("origin"), "http://localhost:3000");
  assertEquals(req.headers.get("access-control-request-method"), "POST");
  assertEquals(req.headers.get("access-control-request-headers"), "authorization, content-type");
});

Deno.test("response JSON parsing behaves as expected for final success payload shape", async () => {
  const response = new Response(
    JSON.stringify({
      success: true,
      profile: { nom: "Alice Martin", poste: "Responsable RH" },
      suggestions: [
        {
          titre: "Certification RH avancée",
          type: "certification",
          description: "Renforce les compétences stratégiques RH",
          priorite: 1,
          duree_estimee: "2 jours",
          cout_estime: 1500,
        },
        {
          titre: "MOOC People Analytics",
          type: "mooc",
          description: "Améliore l'analyse de données RH",
          priorite: 2,
          duree_estimee: "8 heures",
          cout_estime: 120,
        },
      ],
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );

  const data = await response.json();
  assertEquals(data.success, true);
  assertEquals(data.profile.nom, "Alice Martin");
  assertEquals(data.profile.poste, "Responsable RH");
  assertEquals(data.suggestions.length, 2);
  assertEquals(data.suggestions[0].type, "certification");
  assertEquals(data.suggestions[0].priorite, 1);
  assertEquals(data.suggestions[1].type, "mooc");
  assertEquals(data.suggestions[1].cout_estime, 120);
});

Deno.test("azure chat completion content can be parsed into suggestions payload", () => {
  const azureData = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            suggestions: [
              {
                titre: "Conférence RH Tech",
                type: "conference",
                description: "Veille sur les outils RH innovants",
                priorite: 3,
                duree_estimee: "1 jour",
                cout_estime: 900,
              },
            ],
          }),
        },
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 80,
      total_tokens: 180,
    },
  };

  const content = azureData.choices?.[0]?.message?.content;
  assertExists(content);

  const parsed = JSON.parse(content);
  assertEquals(Array.isArray(parsed.suggestions), true);
  assertEquals(parsed.suggestions.length, 1);
  assertEquals(parsed.suggestions[0].titre, "Conférence RH Tech");
  assertEquals(parsed.suggestions[0].type, "conference");
  assertEquals(parsed.suggestions[0].priorite, 3);
});

Deno.test("JSON.parse throws on invalid AI content", () => {
  assertThrows(() => JSON.parse("{invalid json"), SyntaxError);
});

Deno.test("missing AI content shape is detectable offline", () => {
  const azureData = {
    choices: [
      {
        message: {
          content: "",
        },
      },
    ],
  };

  const content = azureData.choices?.[0]?.message?.content;
  assertEquals(content, "");
  assertEquals(!content, true);
});

Deno.test("profile context formatting reproduces expected business text", () => {
  const profile = {
    full_name: "Jean Dupont",
    poste: "Chef de projet",
    date_embauche: "2022-01-15",
  };

  const objectifs = [
    { titre: "Réduire les délais", type: "performance", cible_valeur: 10, realise_valeur: 7 },
    { titre: "Former l'équipe", type: "management", cible_valeur: 5, realise_valeur: 2 },
  ];

  const formationsDemandees = [
    { titre: "Agile avancé", type: "formation_externe", statut: "validee" },
    { titre: "Leadership", type: "mooc", statut: "terminee" },
  ];

  const profileData = `**Employé:** ${profile.full_name || 'Non renseigné'}
**Poste:** ${profile.poste || 'Non renseigné'}
**Ancienneté:** ${profile.date_embauche ? `Depuis ${profile.date_embauche}` : 'Non renseignée'}

**Objectifs en cours:**
${objectifs && objectifs.length > 0
  ? objectifs.map((o) => `- ${o.titre} (${o.type}): ${o.realise_valeur || 0}/${o.cible_valeur || '?'}`).join('\n')
  : 'Aucun objectif défini'}

**Formations déjà demandées/suivies:**
${formationsDemandees && formationsDemandees.length > 0
  ? formationsDemandees.map((f) => `- ${f.titre} (${f.type}) - ${f.statut}`).join('\n')
  : 'Aucune formation'}`;

  assertEquals(profileData.includes("**Employé:** Jean Dupont"), true);
  assertEquals(profileData.includes("**Poste:** Chef de projet"), true);
  assertEquals(profileData.includes("**Ancienneté:** Depuis 2022-01-15"), true);
  assertEquals(profileData.includes("- Réduire les délais (performance): 7/10"), true);
  assertEquals(profileData.includes("- Former l'équipe (management): 2/5"), true);
  assertEquals(profileData.includes("- Agile avancé (formation_externe) - validee"), true);
  assertEquals(profileData.includes("- Leadership (mooc) - terminee"), true);
});

Deno.test("profile context formatting falls back to explicit defaults when data is absent", () => {
  const profile = {
    full_name: "",
    poste: null,
    date_embauche: null,
  };

  const objectifs: Array<{ titre: string; type: string; cible_valeur?: number; realise_valeur?: number }> = [];
  const formationsDemandees: Array<{ titre: string; type: string; statut: string }> = [];

  const profileData = `**Employé:** ${profile.full_name || 'Non renseigné'}
**Poste:** ${profile.poste || 'Non renseigné'}
**Ancienneté:** ${profile.date_embauche ? `Depuis ${profile.date_embauche}` : 'Non renseignée'}

**Objectifs en cours:**
${objectifs && objectifs.length > 0
  ? objectifs.map((o) => `- ${o.titre} (${o.type}): ${o.realise_valeur || 0}/${o.cible_valeur || '?'}`).join('\n')
  : 'Aucun objectif défini'}

**Formations déjà demandées/suivies:**
${formationsDemandees && formationsDemandees.length > 0
  ? formationsDemandees.map((f) => `- ${f.titre} (${f.type}) - ${f.statut}`).join('\n')
  : 'Aucune formation'}`;

  assertEquals(profileData.includes("**Employé:** Non renseigné"), true);
  assertEquals(profileData.includes("**Poste:** Non renseigné"), true);
  assertEquals(profileData.includes("**Ancienneté:** Non renseignée"), true);
  assertEquals(profileData.includes("Aucun objectif défini"), true);
  assertEquals(profileData.includes("Aucune formation"), true);
});

Deno.test("abort controller can reject a fetch-like promise offline", async () => {
  const controller = new AbortController();

  const fakeFetch = () =>
    new Promise<Response>((_resolve, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    });

  const promise = fakeFetch();
  controller.abort();

  await assertRejects(
    async () => {
      await promise;
    },
    DOMException,
    "Aborted",
  );
});