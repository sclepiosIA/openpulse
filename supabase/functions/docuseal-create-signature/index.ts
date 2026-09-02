import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const DOCUSEAL_API_URL = (Deno.env.get('SIGNATURE_URL_BASE') ?? '');

interface Signer {
  email: string;
  name: string;
  role?: string;
}

interface CreateSignatureRequest {
  contratId: string;
  signers: Signer[];
  documentPath?: string;
  expireInDays?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DOCUSEAL_API_KEY = Deno.env.get('DOCUSEAL_API_KEY');
    if (!DOCUSEAL_API_KEY) {
      throw new Error('DOCUSEAL_API_KEY non configurée');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header manquant');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      throw new Error('Utilisateur non authentifié');
    }

    const { contratId, signers, documentPath, expireInDays = 30 }: CreateSignatureRequest = await req.json();

    if (!contratId || !signers || signers.length === 0) {
      throw new Error('contratId et signers sont requis');
    }

    // Récupérer le contrat
    const { data: contrat, error: contratError } = await supabase
      .from('contrats')
      .select('*')
      .eq('id', contratId)
      .single();

    if (contratError || !contrat) {
      throw new Error(`Contrat non trouvé: ${contratError?.message}`);
    }

    // Déterminer le chemin du document
    const pdfPath = documentPath || contrat.document_path;
    if (!pdfPath) {
      throw new Error('Aucun document associé au contrat');
    }

    // Télécharger le PDF depuis Supabase Storage
    const { data: pdfData, error: downloadError } = await supabase
      .storage
      .from('contrats')
      .download(pdfPath);

    if (downloadError || !pdfData) {
      throw new Error(`Erreur téléchargement PDF: ${downloadError?.message}`);
    }

    // Convertir en base64
    const arrayBuffer = await pdfData.arrayBuffer();
    const base64Pdf = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Calculer la date d'expiration
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + expireInDays);
    const expireAtFormatted = expireAt.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

    // Préparer les submitters pour DocuSeal
    const submitters = signers.map((signer, index) => ({
      role: signer.role || `Signataire ${index + 1}`,
      email: signer.email,
      name: signer.name,
    }));

    // Créer la submission DocuSeal
    const docusealResponse = await fetch(`${DOCUSEAL_API_URL}/submissions/pdf`, {
      method: 'POST',
      headers: {
        'X-Auth-Token': DOCUSEAL_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Contrat ${contrat.numero || contratId}`,
        documents: [{
          name: `contrat_${contrat.numero || contratId}.pdf`,
          file: base64Pdf,
        }],
        submitters,
        send_email: true,
        expire_at: expireAtFormatted,
        message: {
          subject: `Signature requise: Contrat ${contrat.numero || ''}`,
          body: `Vous êtes invité(e) à signer le contrat "${contrat.titre || contrat.numero}". Veuillez cliquer sur le lien ci-dessous pour accéder au document et le signer électroniquement.`,
        },
      }),
    });

    if (!docusealResponse.ok) {
      const errorText = await docusealResponse.text();
      console.error('Erreur DocuSeal:', errorText);
      throw new Error(`Erreur DocuSeal: ${docusealResponse.status} - ${errorText}`);
    }

    const submissionData = await docusealResponse.json();
    console.log('DocuSeal submission créée:', submissionData);

    // Extraire l'ID de la submission (DocuSeal retourne un tableau de submitters)
    const submissionId = submissionData[0]?.submission_id || submissionData.id;
    
    // Extraire les URLs d'embed pour chaque signataire
    const embedUrls = submissionData.map((s: any) => ({
      email: s.email,
      embedSrc: s.embed_src,
      slug: s.slug,
    }));

    // Mettre à jour le contrat avec les infos de signature
    const { error: updateError } = await supabase
      .from('contrats')
      .update({
        signature_provider: 'docuseal',
        signature_request_id: String(submissionId),
        signature_status: 'pending',
        signature_requested_at: new Date().toISOString(),
        signature_requested_by: user.id,
        signature_expires_at: expireAt.toISOString(),
        signature_metadata: {
          submitters: submissionData,
          embed_urls: embedUrls,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', contratId);

    if (updateError) {
      console.error('Erreur mise à jour contrat:', updateError);
      // Ne pas échouer si la mise à jour échoue, la signature a été créée
    }

    // Logger l'action
    await supabase.from('contrat_historique').insert({
      contrat_id: contratId,
      action: 'signature_requested',
      description: `Demande de signature envoyée à ${signers.map(s => s.email).join(', ')}`,
      performed_by: user.id,
      metadata: {
        provider: 'docuseal',
        submission_id: submissionId,
        signers: signers,
      },
    }).catch(err => console.error('Erreur log historique:', err));

    return new Response(JSON.stringify({
      success: true,
      submission_id: submissionId,
      embed_urls: embedUrls,
      expires_at: expireAt.toISOString(),
      message: 'Demande de signature créée avec succès',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    return buildErrorResponse('docuseal-create-signature', error, corsHeaders, 400);
  }
});
