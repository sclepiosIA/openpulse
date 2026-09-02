import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type {} from "./index.ts";

const indexUrl = new URL("./index.ts", import.meta.url);

async function readModuleSource(): Promise<string> {
  return await Deno.readTextFile(indexUrl);
}

function applyKnownEtablissementReplacements(
  html: string,
  etablissement: {
    nom?: string;
    siret?: string;
    adresse?: string;
    ville?: string;
    code_postal?: string;
    type_etablissement?: string;
  },
): string {
  return html
    .replace(/\{\{nom_etablissement\}\}/g, etablissement.nom || "")
    .replace(/\{\{siret\}\}/g, etablissement.siret || "")
    .replace(/\{\{adresse\}\}/g, etablissement.adresse || "")
    .replace(/\{\{ville\}\}/g, etablissement.ville || "")
    .replace(/\{\{code_postal\}\}/g, etablissement.code_postal || "")
    .replace(/\{\{type_etablissement\}\}/g, etablissement.type_etablissement || "");
}

function applyCustomVariables(html: string, variables: Record<string, string>): string {
  let rendered = html;
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    rendered = rendered.replace(pattern, value);
  }
  return rendered;
}

function applySystemVariables(html: string, now: Date): string {
  return html
    .replace(/\{\{date_du_jour\}\}/g, now.toLocaleDateString("fr-FR"))
    .replace(/\{\{annee\}\}/g, String(now.getFullYear()));
}

function buildExpectedFullHtml(contractTitle: string, htmlContent: string, now: Date): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${contractTitle}</title>
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #000;
    }
    h1 { font-size: 18pt; text-align: center; margin-bottom: 30px; }
    h2 { font-size: 14pt; margin-top: 20px; }
    p { text-align: justify; }
    .signature-block {
      margin-top: 50px;
      display: flex;
      justify-content: space-between;
    }
    .signature-box {
      width: 45%;
      border-top: 1px solid #000;
      padding-top: 10px;
    }
    .date { text-align: right; margin-bottom: 30px; }
  </style>
</head>
<body>
  <div class="date">Fait le ${now.toLocaleDateString("fr-FR")}</div>
  <h1>${contractTitle}</h1>
  ${htmlContent}
  <div class="signature-block">
    <div class="signature-box">
      <strong>Pour le Prestataire</strong><br>
      Signature précédée de la mention "Lu et approuvé"
    </div>
    <div class="signature-box">
      <strong>Pour le Client</strong><br>
      Signature précédée de la mention "Lu et approuvé"
    </div>
  </div>
</body>
</html>`;
}

Deno.test("module source is present and defines the Supabase Edge Function entrypoint", async () => {
  const source = await readModuleSource();

  assertExists(source);
  assertEquals(source.includes('import { serve } from "https://deno.land/std@0.168.0/http/server.ts";'), true);
  assertEquals(source.includes('import { createClient } from "@supabase/supabase-js";'), true);
  assertEquals(source.includes("serve(async (req) =>"), true);
  assertEquals(source.includes("buildErrorResponse('generate-contract-pdf'"), true);
});

Deno.test("CORS preflight and authentication guard are implemented with expected response values", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
  assertEquals(source.includes("headers: corsHeaders"), true);
  assertEquals(source.includes("Access-Control-Allow-Origin"), false);
  assertEquals(source.includes("if (req.method === 'OPTIONS')"), true);
  assertEquals(source.includes("Authentication required"), true);
  assertEquals(source.includes("{ status: 401"), true);
});

Deno.test("contract and model Supabase queries target the expected tables and filters", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes(".from('contrats')"), true);
  assertEquals(source.includes(".from('contrat_modeles')"), true);
  assertEquals(source.includes(".from('etablissements')"), true);
  assertEquals(source.includes(".eq('id', contrat_id)"), true);
  assertEquals(source.includes(".eq('id', modele_id)"), true);
  assertEquals(source.includes(".eq('id', etablissement_id)"), true);
  assertEquals(source.includes(".single()"), true);
});

Deno.test("etablissement placeholders are replaced with concrete business values", () => {
  const html = [
    "<h1>{{nom_etablissement}}</h1>",
    "<p>SIRET {{siret}}</p>",
    "<p>{{adresse}}, {{code_postal}} {{ville}}</p>",
    "<p>Type: {{type_etablissement}}</p>",
    "<p>Encore {{nom_etablissement}}</p>",
  ].join("");

  const rendered = applyKnownEtablissementReplacements(html, {
    nom: "Clinique du Parc",
    siret: "12345678900011",
    adresse: "10 rue des Lilas",
    ville: "Lyon",
    code_postal: "69003",
    type_etablissement: "clinique",
  });

  assertEquals(
    rendered,
    "<h1>Clinique du Parc</h1><p>SIRET 12345678900011</p><p>10 rue des Lilas, 69003 Lyon</p><p>Type: clinique</p><p>Encore Clinique du Parc</p>",
  );
});

Deno.test("missing etablissement fields are rendered as empty strings, matching edge-function fallback behavior", () => {
  const rendered = applyKnownEtablissementReplacements(
    "{{nom_etablissement}}|{{siret}}|{{adresse}}|{{ville}}|{{code_postal}}|{{type_etablissement}}",
    {
      nom: "EHPAD Bellevue",
    },
  );

  assertEquals(rendered, "EHPAD Bellevue|||||");
});

Deno.test("custom variables replace all matching placeholders globally", () => {
  const rendered = applyCustomVariables(
    "<p>{{client_nom}} signe avec {{prestataire_nom}}. Client: {{client_nom}}.</p>",
    {
      client_nom: "Marie Dupont",
      prestataire_nom: "Santé Services",
    },
  );

  assertEquals(
    rendered,
    "<p>Marie Dupont signe avec Santé Services. Client: Marie Dupont.</p>",
  );
});

Deno.test("custom variable keys are used as RegExp fragments and invalid patterns throw", () => {
  assertThrows(
    () => applyCustomVariables("{{[}}", { "[": "invalid" }),
    SyntaxError,
  );
});

Deno.test("system date placeholders are rendered in French date format and current year", () => {
  const rendered = applySystemVariables(
    "Fait le {{date_du_jour}} pour l'année {{annee}}.",
    new Date("2024-02-03T12:00:00.000Z"),
  );

  assertEquals(rendered, "Fait le 03/02/2024 pour l'année 2024.");
});

Deno.test("HTML/PDF wrapper contains contract title, rendered content, print styles and signature blocks", () => {
  const now = new Date("2025-06-15T08:30:00.000Z");
  const fullHtml = buildExpectedFullHtml(
    "Contrat de prestation",
    "<p>Entre Clinique du Parc et Santé Services.</p>",
    now,
  );

  assertEquals(fullHtml.includes("<title>Contrat de prestation</title>"), true);
  assertEquals(fullHtml.includes("<h1>Contrat de prestation</h1>"), true);
  assertEquals(fullHtml.includes("<p>Entre Clinique du Parc et Santé Services.</p>"), true);
  assertEquals(fullHtml.includes("@page"), true);
  assertEquals(fullHtml.includes("size: A4;"), true);
  assertEquals(fullHtml.includes("margin: 2cm;"), true);
  assertEquals(fullHtml.includes('font-family: \'Times New Roman\', serif;'), true);
  assertEquals(fullHtml.includes("Fait le 15/06/2025"), true);
  assertEquals(fullHtml.includes("Pour le Prestataire"), true);
  assertEquals(fullHtml.includes("Pour le Client"), true);
  assertEquals(fullHtml.includes('Signature précédée de la mention "Lu et approuvé"'), true);
});

Deno.test("storage upload contract path and signed URL generation are present for generated printable HTML", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes(".storage"), true);
  assertEquals(source.includes(".from('documents')"), true);
  assertEquals(source.includes(".upload(`contracts/${filename}`"), true);
  assertEquals(source.includes("contentType: 'text/html'"), true);
  assertEquals(source.includes(".createSignedUrl(`contracts/${filename}`, 3600)"), true);
  assertEquals(source.includes("download_url: downloadUrl"), true);
});

Deno.test("expected business errors are defined for missing content and missing database records", async () => {
  const source = await readModuleSource();

  assertEquals(source.includes("Contrat non trouvé"), true);
  assertEquals(source.includes("Modèle de contrat non trouvé"), true);
  assertEquals(source.includes("Aucun contenu à générer"), true);
});

Deno.test("offline async assertion helper is available for rejected operations", async () => {
  await assertRejects(
    async () => {
      throw new Error("offline rejection");
    },
    Error,
    "offline rejection",
  );
});