import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

// Document type keywords mapping
const DOCUMENT_TYPE_KEYWORDS: Record<string, string[]> = {
  'Conformité': [
    'dpo', 'rgpd', 'gdpr', 'données personnelles', 'privacy',
    'conformité', 'sécurité', 'audit sécurité', 'dpia', 'pia'
  ],
  'Contractuel': [
    'contrat', 'contract', 'signature', 'signé', 'accord commercial',
    'avenant', 'conditions générales', 'cgv', 'cgu', 'bon de commande'
  ],
  'Commercial': [
    'devis', 'proposition commerciale', 'offre', 'tarif',
    'pricing', 'quote', 'commercial proposal'
  ],
  'Déploiement': [
    'planning déploiement', 'plan de déploiement', 'installation',
    'migration', 'déploiement technique', 'rollout'
  ],
  'Formation': [
    'formation', 'training', 'support de formation', 'manuel utilisateur',
    'guide', 'tutoriel', 'documentation formation'
  ],
  'Documentation': [
    'documentation', 'manuel', 'guide technique', 'spécifications',
    'specs', 'cahier des charges', 'technical documentation'
  ],
  'Go-Live': [
    'go-live', 'mise en production', 'prod', 'lancement',
    'démarrage', 'mep', 'recette'
  ]
};

function detectDocumentType(filename: string, subject: string, bodyText: string): {
  type: string | null;
  confidence: number;
  matchedKeywords: string[];
} {
  const searchText = `${filename} ${subject} ${bodyText}`.toLowerCase();
  const scores: Record<string, { score: number; keywords: string[] }> = {};

  for (const [category, keywords] of Object.entries(DOCUMENT_TYPE_KEYWORDS)) {
    let score = 0;
    const matched: string[] = [];

    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        // Higher weight for filename matches (more reliable)
        if (filename.toLowerCase().includes(keyword.toLowerCase())) {
          score += 3;
        } else if (subject.toLowerCase().includes(keyword.toLowerCase())) {
          score += 2;
        } else {
          score += 1;
        }
        matched.push(keyword);
      }
    }

    if (score > 0) {
      scores[category] = { score, keywords: matched };
    }
  }

  if (Object.keys(scores).length === 0) {
    return { type: null, confidence: 0, matchedKeywords: [] };
  }

  // Find category with highest score
  const entries = Object.entries(scores);
  const best = entries.reduce((max, [cat, data]) =>
    data.score > max.data.score ? { category: cat, data } : max,
    { category: entries[0][0], data: entries[0][1] }
  );

  // Normalize confidence (0.0 - 1.0)
  const confidence = Math.min(best.data.score / 10, 1.0);

  return {
    type: best.category,
    confidence,
    matchedKeywords: best.data.keywords
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { attachment_id, etablissement_id, force_task_id } = await req.json();

    if (!attachment_id || !etablissement_id) {
      return new Response(
        JSON.stringify({ error: "attachment_id and etablissement_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing attachment ${attachment_id} for etablissement ${etablissement_id}`);

    // 1. Fetch attachment and email context
    const { data: attachment, error: attachError } = await supabase
      .from('email_attachments')
      .select(`
        id, message_id, filename, mime_type, size_bytes, storage_bucket, storage_path, downloaded, imap_part_id,
        message:email_messages!inner(
          subject,
          body_text,
          thread:email_threads!inner(
            id,
            subject,
            ai_summary
          )
        )
      `)
      .eq('id', attachment_id)
      .single();

    if (attachError || !attachment) {
      throw new Error("Attachment not found");
    }

    const message = (attachment as any).message;
    const thread = message.thread;

    // 2. Detect document type
    const detection = detectDocumentType(
      attachment.filename,
      message.subject || thread.subject,
      message.body_text || thread.ai_summary || ''
    );

    if (!detection.type || detection.confidence < 0.3) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: "Could not detect document type with sufficient confidence",
          detection
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Detected type: ${detection.type} (confidence: ${detection.confidence})`);

    // 3. Find corresponding task category
    const { data: category } = await supabase
      .from('categories_taches')
      .select('id, nom')
      .ilike('nom', `%${detection.type}%`)
      .maybeSingle();

    if (!category) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: `No task category found for type: ${detection.type}`,
          detection
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Find or use forced task
    let existingTask;
    if (force_task_id) {
      const { data } = await supabase
        .from('taches')
        .select('id, titre')
        .eq('id', force_task_id)
        .single();
      existingTask = data;
    } else {
      const { data } = await supabase
        .from('taches')
        .select('id, titre')
        .eq('etablissement_id', etablissement_id)
        .eq('categorie_id', category.id)
        .neq('statut', 'Terminé')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      existingTask = data;
    }

    if (!existingTask) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: `No active task found for category: ${category.nom}`,
          detection,
          category
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found task: ${existingTask.titre}`);

    // 5. Check if document already linked
    const { data: existingDoc } = await supabase
      .from('taches_documents')
      .select('id')
      .eq('source_reference', attachment_id)
      .maybeSingle();

    if (existingDoc) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: "Document already linked",
          existing_document_id: existingDoc.id
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Download attachment if not already done
    if (!attachment.downloaded || !attachment.storage_path) {
      console.log('Downloading attachment...');
      const { error: downloadError } = await supabase.functions.invoke('download-attachment', {
        body: { attachment_id }
      });
      if (downloadError) throw downloadError;

      // Re-fetch to get storage_path
      const { data: updatedAttachment } = await supabase
        .from('email_attachments')
        .select('storage_path')
        .eq('id', attachment_id)
        .single();

      if (!updatedAttachment?.storage_path) {
        throw new Error("Failed to download attachment");
      }
      attachment.storage_path = updatedAttachment.storage_path;
    }

    // 7. Copy to taches-documents bucket
    console.log('Copying file to taches-documents bucket...');
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('email-attachments')
      .download(attachment.storage_path);

    if (downloadErr) throw downloadErr;

    // 8. Get next version number
    const { data: versionData, error: versionError } = await supabase
      .rpc('get_next_document_version', {
        p_tache_id: existingTask.id,
        p_document_type: detection.type
      });

    if (versionError) {
      console.error('Error getting version:', versionError);
    }

    const nextVersion = versionData || 1;
    console.log(`Next version: ${nextVersion}`);

    // 9. Mark old versions as not latest
    if (nextVersion > 1) {
      await supabase
        .from('taches_documents')
        .update({ is_latest_version: false })
        .eq('tache_id', existingTask.id)
        .eq('document_type', detection.type)
        .eq('is_latest_version', true);
    }

    // 10. Upload to taches-documents
    const destPath = `${existingTask.id}/v${nextVersion}_${attachment.filename}`;
    const { error: uploadErr } = await supabase.storage
      .from('taches-documents')
      .upload(destPath, fileData, {
        contentType: attachment.mime_type,
        upsert: false
      });

    if (uploadErr) throw uploadErr;

    // 11. Create database record
    const { data: newDoc, error: insertErr } = await supabase
      .from('taches_documents')
      .insert({
        tache_id: existingTask.id,
        nom_fichier: attachment.filename,
        chemin_fichier: destPath,
        type_mime: attachment.mime_type,
        taille_fichier: attachment.size_bytes,
        version_number: nextVersion,
        is_latest_version: true,
        document_type: detection.type,
        source_type: 'email',
        source_reference: attachment_id,
        auto_detected: true,
        detection_confidence: detection.confidence,
        metadata: {
          email_subject: message.subject,
          email_thread_id: thread.id,
          matched_keywords: detection.matchedKeywords,
          detection_date: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    console.log(`✅ Successfully linked attachment to task with version ${nextVersion}`);

    return new Response(
      JSON.stringify({
        success: true,
        document: newDoc,
        task: existingTask,
        detection,
        version: nextVersion
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in auto-link-attachment-to-task:", error);
    return new Response(
      JSON.stringify({ error: sanitizeErrorForClient(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
