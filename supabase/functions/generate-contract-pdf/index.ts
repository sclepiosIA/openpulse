/**
 * Edge Function: generate-contract-pdf
 * 
 * Génère un PDF de contrat à partir d'un modèle et des variables.
 * Utilise jsPDF pour la génération côté serveur.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

interface GenerateRequest {
  contrat_id?: string;
  modele_id?: string;
  variables?: Record<string, string>;
  format?: 'pdf' | 'html';
  etablissement_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: GenerateRequest = await req.json();
    const { contrat_id, modele_id, variables = {}, format = 'pdf', etablissement_id } = body;

    let htmlContent = '';
    let contractTitle = 'Contrat';

    // Option 1: Générer depuis un contrat existant
    if (contrat_id) {
      const { data: contrat, error: contratError } = await supabaseClient
        .from('contrats')
        .select(`
          *,
          etablissements (nom, siret, adresse, ville, code_postal)
        `)
        .eq('id', contrat_id)
        .single();

      if (contratError || !contrat) {
        throw new Error('Contrat non trouvé');
      }

      htmlContent = contrat.contenu_html || '';
      contractTitle = contrat.titre || 'Contrat';

      // Remplacer les variables dynamiques
      const etab = contrat.etablissements;
      if (etab) {
        htmlContent = htmlContent
          .replace(/\{\{nom_etablissement\}\}/g, etab.nom || '')
          .replace(/\{\{siret\}\}/g, etab.siret || '')
          .replace(/\{\{adresse\}\}/g, etab.adresse || '')
          .replace(/\{\{ville\}\}/g, etab.ville || '')
          .replace(/\{\{code_postal\}\}/g, etab.code_postal || '');
      }
    }

    // Option 2: Générer depuis un modèle
    if (modele_id && !contrat_id) {
      const { data: modele, error: modeleError } = await supabaseClient
        .from('contrat_modeles')
        .select('id, nom, contenu_html, description')
        .eq('id', modele_id)
        .single();

      if (modeleError || !modele) {
        throw new Error('Modèle de contrat non trouvé');
      }

      htmlContent = modele.contenu_html || '';
      contractTitle = modele.nom || 'Modèle de contrat';

      // Si établissement fourni, récupérer ses infos
      if (etablissement_id) {
        const { data: etab } = await supabaseClient
          .from('etablissements')
          .select('nom, siret, adresse, ville, code_postal, type_etablissement')
          .eq('id', etablissement_id)
          .single();

        if (etab) {
          htmlContent = htmlContent
            .replace(/\{\{nom_etablissement\}\}/g, etab.nom || '')
            .replace(/\{\{siret\}\}/g, etab.siret || '')
            .replace(/\{\{adresse\}\}/g, etab.adresse || '')
            .replace(/\{\{ville\}\}/g, etab.ville || '')
            .replace(/\{\{code_postal\}\}/g, etab.code_postal || '')
            .replace(/\{\{type_etablissement\}\}/g, etab.type_etablissement || '');
        }
      }
    }

    // Appliquer les variables personnalisées
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      htmlContent = htmlContent.replace(pattern, value);
    }

    // Variables système
    const now = new Date();
    htmlContent = htmlContent
      .replace(/\{\{date_du_jour\}\}/g, now.toLocaleDateString('fr-FR'))
      .replace(/\{\{annee\}\}/g, String(now.getFullYear()));

    if (!htmlContent) {
      throw new Error('Aucun contenu à générer');
    }

    // Format HTML: retourner directement
    if (format === 'html') {
      return new Response(
        JSON.stringify({
          success: true,
          title: contractTitle,
          html: htmlContent
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format PDF: générer le PDF
    // Note: Dans un environnement Deno, on utilise une approche simplifiée
    // Pour une génération PDF complète, utiliser un service externe ou Puppeteer
    
    // Construction d'un HTML complet pour impression/PDF
    const fullHtml = `
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
  <div class="date">Fait le ${now.toLocaleDateString('fr-FR')}</div>
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

    // Sauvegarder le HTML généré pour téléchargement ultérieur
    const filename = `contrat_${contrat_id || modele_id || 'custom'}_${Date.now()}.html`;
    
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('documents')
      .upload(`contracts/${filename}`, new Blob([fullHtml], { type: 'text/html' }), {
        contentType: 'text/html'
      });

    if (uploadError) {
      console.warn('Erreur upload HTML:', uploadError);
    }

    // Générer URL signée
    let downloadUrl = null;
    if (uploadData) {
      const { data: urlData } = await supabaseClient.storage
        .from('documents')
        .createSignedUrl(`contracts/${filename}`, 3600);
      downloadUrl = urlData?.signedUrl;
    }

    return new Response(
      JSON.stringify({
        success: true,
        title: contractTitle,
        format: 'html', // Retourne HTML prêt pour impression PDF via navigateur
        html: fullHtml,
        download_url: downloadUrl,
        filename,
        message: 'Utilisez la fonction "Imprimer vers PDF" de votre navigateur pour générer le PDF'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('❌ Erreur generate-contract-pdf:', error);
    return buildErrorResponse('generate-contract-pdf', error, corsHeaders, 500);
  }
});
