import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sanitizeForAI, wrapUserContent, logSecurityEvent } from "../_shared/security-utils.ts";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authentication: accepter JWT utilisateur OU service role key
    const authHeader = req.headers.get("Authorization");
    const apiKey = req.headers.get("apikey");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    let isServiceRole = false;
    
    // Vérifier si c'est un appel service-to-service
    if (authHeader?.includes(serviceRoleKey) || apiKey === serviceRoleKey) {
      console.log("🔑 Service role authentication detected");
      isServiceRole = true;
    } else if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Si ce n'est pas service role, vérifier JWT utilisateur
    if (!isServiceRole) {
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid authentication" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("🔑 User JWT authentication validated");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    const { thread_id, force_reprocess = false } = await req.json();
    
    console.log(`📧 Processing thread ${thread_id}, force_reprocess: ${force_reprocess}`);

    const { data: thread } = await supabaseAdmin
      .from("email_threads")
      .select("*, messages:email_messages(*), partenaires(*)")
      .eq("id", thread_id)
      .single();

    if (!thread) {
      return new Response(JSON.stringify({ error: "Thread not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 🛡️ GARDE ANTI-RETRAITEMENT: Skip si déjà traité et pas de nouveau message
    if (!force_reprocess && thread.ai_last_processed_at) {
      const lastProcessed = new Date(thread.ai_last_processed_at);
      const lastMessage = new Date(thread.last_message_date);
      if (lastMessage <= lastProcessed) {
        console.log(`⏭️ Skipping thread ${thread_id}: no new messages since last processing (${thread.ai_last_processed_at})`);
        return new Response(JSON.stringify({ 
          skipped: true, 
          reason: 'no new messages since last processing' 
        }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      console.log(`🔄 Re-processing thread ${thread_id}: new messages detected (last_message: ${thread.last_message_date}, last_processed: ${thread.ai_last_processed_at})`);
    }

    const truncate = (s: string | null, n: number) => {
      const str = (s ?? '').toString();
      return str.length > n ? str.slice(0, n) + '…' : str;
    };

    // GPT-5.4: contexte avec troncature intelligente pour limiter les tokens
    const allMessages = thread.messages
      .sort((a, b) => new Date(a.sent_date).getTime() - new Date(b.sent_date).getTime());
    
    // 🎯 TRONCATURE INTELLIGENTE: si > 10 messages, garder 3 premiers + 7 derniers
    let selectedMessages = allMessages;
    if (allMessages.length > 10) {
      const first3 = allMessages.slice(0, 3);
      const last7 = allMessages.slice(-7);
      selectedMessages = [...first3, ...last7];
      console.log(`✂️ Truncated messages: ${allMessages.length} → ${selectedMessages.length} (3 first + 7 last)`);
    }

    // 🔒 SECURITY: Sanitize email content before AI processing
    // 🎯 Plafond de contexte: max 15000 caractères total
    const MAX_CONTEXT_CHARS = 15000;
    let totalChars = 0;
    const messagesContext = selectedMessages
      .map((msg, idx) => {
        const sanitizedSubject = sanitizeForAI(msg.subject || '', {
          maxLength: 300,
          strictMode: false,
          functionName: 'process-email-with-ai'
        });
        // Adapter la longueur max du corps en fonction du budget restant
        const remainingBudget = Math.max(500, MAX_CONTEXT_CHARS - totalChars);
        const bodyMaxLen = Math.min(2500, remainingBudget);
        const sanitizedBody = sanitizeForAI(msg.body_text || '', {
          maxLength: bodyMaxLen,
          strictMode: false,
          functionName: 'process-email-with-ai'
        });
        const block = `
Message ${idx + 1} (${msg.from_name || msg.from_address}):
Sujet: ${truncate(sanitizedSubject, 300)}
Corps: ${truncate(sanitizedBody, bodyMaxLen)}
---`;
        totalChars += block.length;
        return block;
      }).join('\n');
    
    console.log(`📊 Context size: ${totalChars} chars, ${selectedMessages.length}/${allMessages.length} messages`);

    // 🔒 SECURITY: Wrap entire context with XML delimiters
    const wrappedMessagesContext = wrapUserContent(messagesContext, 'EMAIL_THREAD_CONTENT');

    console.log('📊 Context stats (GPT-5 minimal reasoning):', {
      total_messages: thread.messages.length,
      sent_messages: allMessages.length,
      context_length: messagesContext.length,
      context_chars: messagesContext.length
    });

    // Détecter si c'est un thread partenaire
    const isPartenaireThread = !!thread.partenaire_id;
    
    const systemPrompt = isPartenaireThread 
      ? `Tu es un assistant IA pour un CRM de gestion de partenaires.
Analyse cet échange d'emails avec un partenaire et extrais les informations structurées en JSON.

Réponds UNIQUEMENT avec un JSON valide contenant:
{
  "summary": "Résumé concis de l'échange en 2-3 phrases",
  "detailed_summary": "Résumé détaillé structuré couvrant l'ensemble du thread. Format: Chronologie des échanges, puis 'Points clés :' avec liste à puces des éléments importants, puis 'Questions ouvertes :' avec liste à puces des sujets en attente. 500-800 caractères pour les threads longs, peut être plus court si le thread est simple.",
  "sentiment": "positive|neutral|negative",
  "priority": "low|medium|high",
  "category": "Commercial|Contractuel|Support|Relation",
  "auto_tags": ["tag1", "tag2", "tag3"],  // 🆕 PHASE 2: 3-5 tags pertinents (ex: "urgent", "contrat", "rdv", "problème", "renouvellement", "formation")
  "confidence_score": 0.0-1.0,
  
  "completed_tasks": [
    {
      "task_title": "Titre exact de la tâche complétée",
      "task_category": "Commercial|Contractuel|Support|Technique|Relation",
      "confidence": 0.0-1.0,
      "evidence": "Citation exacte du mail prouvant la complétion",
      "completed_date": "YYYY-MM-DD"
    }
  ],
  "new_tasks_needed": [
    {
      "title": "Titre de la nouvelle tâche",
      "direction": "outgoing|incoming",
      "category": "Commercial|Contractuel|Support|Technique|Relation",
      "priority": "low|medium|high",
      "deadline_days": number (délai en jours à partir d'aujourd'hui),
      "description": "Description détaillée",
      "confidence": 0.0-1.0
    }
  ]
}

⚠️ PHASE 2 : DIRECTION DES ACTIONS (NOUVEAU)

Pour chaque action dans "new_tasks_needed", détermine la DIRECTION :

- "outgoing" : Action que NOUS faisons ou demandons AU PARTENAIRE
  Exemples : 
  * "Pouvez-vous nous envoyer le contrat ?"
  * "Merci de vérifier les droits"
  * "Nous avons besoin du document X"
  
- "incoming" : Action que LE PARTENAIRE doit faire ou nous propose
  Exemples : 
  * "Nous vous envoyons le document demain"
  * "Je vais vérifier de mon côté"
  * "On vous propose un RDV"

⚠️ RÈGLE CRITIQUE :
- Si direction = "outgoing" (on demande au partenaire) :
  → C'est une action qu'ON FAIT (la demande elle-même)
  → NE PAS créer de tâche "pour qu'ils le fassent"
  → Cette action sera traitée différemment (marquage de tâche existante ou création de suivi)
  
- Si direction = "incoming" (ils vont faire) :
  → Créer une tâche de SUIVI pour vérifier qu'ils le font
  → Format : "Suivre : [Action attendue du partenaire]"
  → Délai : 3-5 jours selon urgence

EXEMPLES :
❌ MAUVAIS :
Email : "Pouvez-vous nous envoyer le contrat signé ?"
→ new_tasks_needed: [{ title: "Envoyer le contrat signé", direction: "outgoing" }]

✅ BON :
Email : "Pouvez-vous nous envoyer le contrat signé ?"
→ completed_tasks: [{ task_title: "Demander le contrat signé" }] (si cette tâche existe)
→ new_tasks_needed: [{ title: "Suivre : Réception contrat signé", direction: "incoming", deadline_days: 5 }]

Pour les tâches partenaires :
- Catégories possibles : Commercial (opportunités, négociations), Contractuel (renouvellement, avenants), 
  Support (assistance technique), Technique (configuration, intégration), Relation (rendez-vous, suivi)
- Détecte les actions nécessaires : RDV à planifier, contrats à renouveler, problèmes à résoudre, suivis à faire
- Confidence >= 0.7 pour completed_tasks, >= 0.6 pour new_tasks_needed`
      : `Tu es un assistant IA pour un CRM de gestion d'établissements de santé.
Analyse cet échange d'emails et extrais les informations structurées en JSON.

⚠️ IMPORTANT - RÈGLE D'EXCLUSION DES CONTACTS :
- NE PAS extraire les contacts avec email @exploitant.example.org (domaine interne)
- NE PAS extraire les contacts avec email @gmail.com, @outlook.com, @yahoo.fr, @hotmail.com, @free.fr, @orange.fr (domaines génériques)
- UNIQUEMENT extraire les contacts appartenant aux établissements/partenaires externes avec domaine professionnel

Réponds UNIQUEMENT avec un JSON valide contenant:
{
  "summary": "Résumé concis de l'échange en 2-3 phrases",
  "detailed_summary": "Résumé détaillé structuré couvrant l'ensemble du thread. Format: Chronologie des échanges, puis 'Points clés :' avec liste à puces des éléments importants, puis 'Questions ouvertes :' avec liste à puces des sujets en attente. 500-800 caractères pour les threads longs, peut être plus court si le thread est simple.",
  "category": "Commercial|Support|Technique|Administratif",  // 🆕 PHASE 2: Catégoriser TOUS les emails
  "auto_tags": ["tag1", "tag2", "tag3"],  // 🆕 PHASE 2: 3-5 tags pertinents (ex: "urgent", "contrat", "rdv", "problème", "configuration", "formation", "go-live", "bug")
  "establishment": {
    "nom": "string",
    "ville": "string", 
    "type": "string (ex: CHU, Clinique, EHPAD)",
    "dpi": "string (nom du DPI actuel si mentionné)"
  },
  "contacts": [
    {
      "nom": "string",
      "prenom": "string",
      "fonction": "string (ex: Directeur, Médecin urgentiste, DIM, DSI, Chef de service, Infirmier coordonnateur)",
      "email": "string",  // ⚠️ Vérifier que ce n'est PAS un domaine interne (@exploitant.example.org) ou générique (@gmail, @outlook, etc.)
      "telephone": "string",
      "type_contact": "cliniciens|administration|informatique|dim|secretariat|autre",  
                // ⚠️ IMPORTANT : Toujours fournir un type_contact basé sur la fonction:
                // - Médecin, urgentiste, chef de service, infirmier → cliniciens
                // - Directeur, DAF, DRH, administratif → administration  
                // - DSI, informaticien, technicien IT → informatique
                // - DIM, codeur, archiviste médical → dim
                // - Secrétaire, assistant(e) → secretariat
                // - Si incertain → autre
      "confidence": 0.0-1.0  // GUIDE DE SCORING:
                       // 0.95-1.0 = Email professionnel + nom/prénom/fonction clairs dans la signature
                       // 0.85-0.94 = Nom/prénom clairs + email valide mais fonction floue
                       // 0.70-0.84 = Nom/prénom mentionnés mais incertitude (ex: email manquant)
                       // 0.60-0.69 = Informations partielles nécessitant validation
                       // < 0.60 = Trop d'incertitude, ne pas extraire
    }
  ],
  "needs": ["besoin 1", "besoin 2"],
  "dates": {
    "rdv_prevu": "YYYY-MM-DD ou null",
    "deadline": "YYYY-MM-DD ou null"
  },
  "sentiment": "positive|neutral|negative",
  "priority": "low|medium|high",
  "new_tasks_needed": [
    {
      "title": "Titre de la nouvelle tâche",
      "direction": "outgoing|incoming",
      "category": "Commercial|Formation|Configuration|Technique|Support|Suivi",
      "priority": "low|medium|high",
      "deadline_days": number,
      "description": "Description détaillée",
      "confidence": 0.0-1.0
    }
  ]
}

⚠️ PHASE 2 : DIRECTION DES ACTIONS (NOUVEAU)

Pour chaque action dans "new_tasks_needed", détermine la DIRECTION :

- "outgoing" : Action que NOUS faisons ou demandons À L'ÉTABLISSEMENT
  Exemples : 
  * "Pouvez-vous nous envoyer le contrat ?"
  * "Merci de valider la configuration"
  * "Nous avons besoin des signatures"
  
- "incoming" : Action que L'ÉTABLISSEMENT doit faire ou nous propose
  Exemples : 
  * "Nous vous envoyons les documents demain"
  * "Je vais vérifier avec l'équipe IT"
  * "On vous propose un rendez-vous"

⚠️ RÈGLE CRITIQUE :
- Si direction = "outgoing" (on demande à l'établissement) :
  → C'est une action qu'ON FAIT (la demande elle-même)
  → NE PAS créer de tâche "pour qu'ils le fassent"
  → Cette action sera traitée différemment (marquage de tâche existante ou création de suivi)
  
- Si direction = "incoming" (ils vont faire) :
  → Créer une tâche de SUIVI pour vérifier qu'ils le font
  → Format : "Suivre : [Action attendue de l'établissement]"
  → Délai : 3-5 jours selon urgence

EXEMPLES :
❌ MAUVAIS :
Email : "Pouvez-vous nous envoyer le contrat signé ?"
→ new_tasks_needed: [{ title: "Envoyer le contrat signé", direction: "outgoing" }]

✅ BON :
Email : "Pouvez-vous nous envoyer le contrat signé ?"
→ completed_tasks: [{ task_title: "Demander le contrat signé" }] (si cette tâche existe)
→ new_tasks_needed: [{ title: "Suivre : Réception contrat signé", direction: "incoming", deadline_days: 5 }]

Pour les tâches établissements :
  "category": "Commercial|Support|Technique|Administratif",
  "confidence_score": 0.0-1.0,  // Score de confiance GLOBAL de la classification (0.85 = 85% confiant). Minimum 0.3 pour tout thread analysé avec succès.
  "recommended_action": "create_new_etablissement|link_existing|no_action",
  
  "completed_tasks": [
    {
      "task_title": "Titre exact de la tâche complétée",
      "task_category": "Commercial|Contractuel|Conformité|Déploiement|Formation|Go-Live|Suivi Production",
      "confidence": 0.0-1.0,
      "evidence": "Citation exacte du mail prouvant la complétion",
      "completed_date": "YYYY-MM-DD"
    }
  ],
  "new_tasks_needed": [
    {
      "title": "Titre de la nouvelle tâche",
      "category": "Commercial|Contractuel|Conformité|Déploiement|Formation|Go-Live|Suivi Production",
      "priority": "low|medium|high",
      "deadline_days": number (délai en jours à partir d'aujourd'hui),
      "description": "Description détaillée",
      "confidence": 0.0-1.0
    }
  ]
}

Instructions détaillées:
- Pour contacts: 
  ⚠️ RÈGLE STRICTE : NE PAS extraire de contact si son NOM et PRÉNOM ne sont PAS clairement identifiés dans l'email.
  
  NE PAS extraire :
  - Mentions génériques sans nom (ex: "le DAF", "la secrétaire", "le directeur", "l'assistante")
  - Noms incomplets (ex: "Dr Martin" sans prénom, "M. Dupont" sans prénom)
  - Contacts avec "Inconnu", "Non spécifié", "A déterminer" comme nom/prénom
  - Domaines internes (@exploitant.example.org)
  - Domaines génériques (gmail, outlook, yahoo, hotmail, free, orange, laposte)
  
  UNIQUEMENT extraire si :
  - Nom ET prénom sont explicitement mentionnés (ex: "Jean Dupont", "Marie Martin", "Dr Sophie Leclerc")
  - Email professionnel valide (pas @exploitant.example.org ni domaines génériques)
  - Domaine d'email correspond à un établissement de santé
  
  ⚠️ IMPORTANT type_contact : Toujours fournir un type_contact (au minimum "autre" si incertain).
  Déduire depuis la fonction (ex: Médecin urgentiste → cliniciens, DIM → dim, DSI → informatique).
  Utiliser uniquement les valeurs: cliniciens, administration, informatique, dim, secretariat, autre.

  ⚠️ SCORING DE CONFIANCE - IMPORTANT :
  - 0.95-1.0 : Email professionnel + nom complet + fonction précise (ex: signature complète)
  - 0.85-0.94 : Nom/prénom + email valide + fonction claire
  - 0.70-0.84 : Nom/prénom identifiés + email OU fonction (pas les deux)
  - 0.60-0.69 : Informations partielles (nom uniquement, fonction floue)
  - < 0.60 : NE PAS extraire (trop d'incertitude)

  IMPORTANT : Varier réellement les scores selon la qualité de l'extraction. 
  Ne pas mettre systématiquement 0.7 !

  Seuils de traitement :
  - Confiance ≥ 0.85 → Contact créé automatiquement
  - 0.65 ≤ Confiance < 0.85 → Validation manuelle requise
  - Confiance < 0.65 → Contact rejeté (ne pas inclure)
  
  Si le nom/prénom n'est pas identifiable, NE PAS ajouter ce contact dans le tableau.
- Pour completed_tasks: Détecte TOUTES les mentions de tâches accomplies (contrat signé, document envoyé, réunion effectuée, formation terminée, installation faite, problème résolu, etc.)
- Pour new_tasks_needed: Identifie les actions à faire mentionnées ou implicites (RDV à planifier, documents à envoyer, suivis nécessaires, relances, formations à organiser, etc.)
- Confidence >= 0.7 pour completed_tasks, >= 0.6 pour new_tasks_needed
- Si aucune tâche ou contact détecté, retourner des tableaux vides []`;

    const startTime = Date.now();
    
    // Timeout + retry wrapper for Azure call
    const doAzureCall = async () => {
      const controller = new AbortController();
      // GPT-5 minimal reasoning peut prendre 45-90s selon la charge Azure
      const timeoutId = setTimeout(() => controller.abort('timeout'), 90000);
      try {
        const res = await fetch(
          Deno.env.get("AZURE_OPENAI_ENDPOINT")!,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "api-key": Deno.env.get("AZURE_OPENAI_API_KEY")!,
            },
            body: JSON.stringify({
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Voici l'échange d'emails:\n\n${wrappedMessagesContext}` },
              ],
              // GPT-5 minimal reasoning: très peu de reasoning_tokens (~50-100)
              // + output_tokens (~1500-2000) = max 3000 tokens total
              max_completion_tokens: 3000,
              response_format: { type: "json_object" },
              reasoning_effort: "low",
              verbosity: "low",
            }),
            signal: controller.signal,
          }
        );
        return res;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    let azureResponse: Response;
    try {
      console.log('🚀 Starting Azure GPT-5 call...');
      azureResponse = await doAzureCall();
      console.log(`✅ Azure response received in ${Date.now() - startTime}ms`);
      if (azureResponse.status === 429) {
        console.warn('Azure rate limited, backing off 1s and retrying once...');
        await new Promise(r => setTimeout(r, 1000));
        azureResponse = await doAzureCall();
      }
    } catch (e) {
      console.error('Azure call failed:', e);
      throw new Error(e === 'timeout' ? 'Azure request timeout (90s) - GPT-5 endpoint trop lent' : 'Azure request failed');
    }

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error("Azure OpenAI error:", azureResponse.status, errorText);
      throw new Error(`Azure OpenAI API error: ${azureResponse.status}`);
    }

    const azureData = await azureResponse.json();
    const processingDuration = Date.now() - startTime;
    
    console.log('Azure response structure:', JSON.stringify({
      has_choices: !!azureData?.choices,
      choices_length: azureData?.choices?.length,
      first_choice_keys: azureData?.choices?.[0] ? Object.keys(azureData.choices[0]) : null,
      message_type: typeof azureData?.choices?.[0]?.message,
      content_type: typeof azureData?.choices?.[0]?.message?.content,
      finish_reason: azureData?.choices?.[0]?.finish_reason,
      has_usage: !!azureData?.usage
    }));

    // Extract content from various possible response formats
    let contentRaw: any;
    const firstChoice = azureData?.choices?.[0];
    
    if (firstChoice?.message?.content) {
      contentRaw = firstChoice.message.content;
    } else if (firstChoice?.text) {
      contentRaw = firstChoice.text;
    } else if (firstChoice?.message?.function_call?.arguments) {
      contentRaw = firstChoice.message.function_call.arguments;
    } else if (Array.isArray(firstChoice?.message?.tool_calls) && firstChoice.message.tool_calls.length > 0) {
      const fn = firstChoice.message.tool_calls.find((t: any) => t?.function?.arguments)?.function;
      if (fn?.arguments) contentRaw = fn.arguments;
    }
    
    // Handle array content format (some Azure deployments return this)
    if (Array.isArray(contentRaw)) {
      contentRaw = contentRaw.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('');
    }

    let contentStr = typeof contentRaw === 'string' ? contentRaw.trim() : '';

    // Second-chance retry WITHOUT response_format if empty
    if (!contentStr) {
      console.warn('Empty content from first call. finish_reason=', firstChoice?.finish_reason, ' - retrying without response_format');
      const retryRes = await fetch(Deno.env.get("AZURE_OPENAI_ENDPOINT")!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': Deno.env.get('AZURE_OPENAI_API_KEY')! },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt + '\nImportant: Réponds uniquement en JSON valide.' },
            { role: 'user', content: `Voici l'échange d'emails:\n\n${messagesContext}` }
          ],
          max_completion_tokens: 3000,
          reasoning_effort: "low",
          verbosity: "low"
        })
      });
      if (!retryRes.ok) {
        const t = await retryRes.text();
        console.error('Retry Azure error:', retryRes.status, t);
        throw new Error(`Azure retry failed: ${retryRes.status}`);
      }
      const retryData = await retryRes.json();
      const rc = retryData?.choices?.[0];
      contentStr = (rc?.message?.content || rc?.text || '')?.toString().trim();
      if (Array.isArray(rc?.message?.content)) {
        contentStr = rc.message.content.map((p: any) => p?.text ?? '').join('').trim();
      }
      if (!contentStr) {
        console.error('❌ Azure retry still empty. Full response:', JSON.stringify(retryData, null, 2));
        throw new Error('No content in Azure response - check logs for full response');
      }
    }

    
    console.log('✅ Content extracted, length:', contentStr.length);

    // Normalize JSON string (strip code fences etc.)
    if (contentStr.startsWith('```')) {
      contentStr = contentStr.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    }

    let aiResult: any;
    try {
      aiResult = JSON.parse(contentStr);
    } catch (e) {
      const fbStart = contentStr.indexOf('{');
      const fbEnd = contentStr.lastIndexOf('}');
      if (fbStart !== -1 && fbEnd !== -1 && fbEnd > fbStart) {
        const candidate = contentStr.slice(fbStart, fbEnd + 1);
        try {
          aiResult = JSON.parse(candidate);
        } catch (e2) {
          console.error('❌ Failed to parse AI JSON (fallback) candidate=', candidate);
          throw new Error('Invalid JSON returned by Azure model');
        }
      } else {
        console.error('❌ Failed to parse AI JSON. Raw content=', contentStr);
        throw new Error('Invalid JSON returned by Azure model');
      }
    }

    const usage = azureData.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    // 🆕 Filter out internal domains, generic domains, and generic names (server-side safety net)
    const forbiddenDomains = ['exploitant.example.org', 'gmail.com', 'outlook.com', 'outlook.fr', 
                              'yahoo.fr', 'yahoo.com', 'hotmail.com', 'hotmail.fr',
                              'free.fr', 'orange.fr', 'wanadoo.fr', 'laposte.net'];
    
    const genericNames = ['inconnu', 'non spécifié', 'a déterminer', 'non renseigné', 
                          'n/a', 'nc', 'non communiqué', 'à définir', 'non identifié'];

    if (aiResult.contacts && Array.isArray(aiResult.contacts)) {
      const originalCount = aiResult.contacts.length;
      aiResult.contacts = aiResult.contacts.filter((contact: any) => {
        // Vérifier domaine email
        if (contact.email) {
          const domain = contact.email.split('@')[1]?.toLowerCase();
          if (domain && forbiddenDomains.includes(domain)) {
            console.log(`🚫 Contact filtered out: ${contact.email} (forbidden domain: ${domain})`);
            return false;
          }
        }
        
        // Vérifier nom/prénom valides
        const nom = contact.nom?.toLowerCase().trim() || '';
        const prenom = contact.prenom?.toLowerCase().trim() || '';
        
        if (genericNames.includes(nom) || genericNames.includes(prenom)) {
          console.log(`🚫 Contact filtered out: ${contact.prenom} ${contact.nom} (generic name)`);
          return false;
        }
        
        // Rejeter si nom vide ou trop court
        if (!nom || nom.length < 2) {
          console.log(`🚫 Contact filtered out: empty or too short name`);
          return false;
        }
        
        // Rejeter si prenom vide (sauf si confiance très élevée)
        if ((!prenom || prenom.length < 2) && (contact.confidence || 0) < 0.85) {
          console.log(`🚫 Contact filtered out: ${contact.nom} (no first name and confidence < 0.85)`);
          return false;
        }
        
        return true;
      });
      
      if (originalCount !== aiResult.contacts.length) {
        console.log(`✅ Filtered ${originalCount - aiResult.contacts.length} invalid contacts. ${aiResult.contacts.length} valid contacts remaining.`);
      }
    }

    // 🆕 PHASE 2 : Traitement par direction des actions
    console.log('🔍 Phase 2: Analyzing action directions...');

    // Séparer les tâches selon leur direction
    const tasksToProcess = {
      outgoing: [],  // Actions qu'on fait → chercher tâches à clôturer
      incoming: [],  // Actions qu'ils font → créer tâches de suivi
      neutral: []    // Pas de direction spécifiée → traitement normal
    };

    for (const task of aiResult.new_tasks_needed || []) {
      const direction = task.direction || 'neutral';
      tasksToProcess[direction].push(task);
    }

    console.log(`📊 Direction analysis:`, {
      outgoing: tasksToProcess.outgoing.length,
      incoming: tasksToProcess.incoming.length,
      neutral: tasksToProcess.neutral.length
    });

    // Traiter les actions "outgoing" : log pour traitement ultérieur dans generate-ai-suggestions
    for (const outgoingTask of tasksToProcess.outgoing) {
      console.log(`⚠️ Outgoing action detected: "${outgoingTask.title}"`);
      console.log(`  → This should be handled as: mark existing "Demander ${outgoingTask.title}" as done`);
      console.log(`  → Or create follow-up: "Suivre : ${outgoingTask.title}"`);
    }

    // Transformer les actions "incoming" en tâches de suivi
    for (const incomingTask of tasksToProcess.incoming) {
      console.log(`📥 Incoming action detected: "${incomingTask.title}"`);
      
      // Transformer en tâche de suivi si ce n'est pas déjà un suivi
      if (!incomingTask.title.toLowerCase().startsWith('suivre')) {
        incomingTask.title = `Suivre : ${incomingTask.title}`;
      }
      incomingTask.category = incomingTask.category || 'Suivi';
      incomingTask.deadline_days = incomingTask.deadline_days || 5; // Délai par défaut 5 jours
      
      console.log(`  → Transformed to follow-up task: "${incomingTask.title}"`);
    }

    // Reconstruire new_tasks_needed avec les tâches transformées
    aiResult.new_tasks_needed = [
      ...tasksToProcess.incoming,  // Tâches de suivi transformées
      ...tasksToProcess.neutral    // Tâches normales
      // On exclut les outgoing car elles seront traitées dans generate-ai-suggestions
    ];

    // Ajouter les outgoing dans un champ spécial pour traitement ultérieur
    aiResult.outgoing_actions = tasksToProcess.outgoing;

    console.log(`✅ Tasks after direction processing: ${aiResult.new_tasks_needed.length} to create, ${aiResult.outgoing_actions.length} to handle as completed`);

    // 🆕 PHASE 2: Sauvegarder la catégorie ET les tags automatiques pour TOUS les threads
    await supabaseAdmin.from("email_threads").update({
      ai_summary: aiResult.summary,
      ai_detailed_summary: aiResult.detailed_summary || null,
      ai_extracted_data: {
        ...aiResult,
        outgoing_actions: aiResult.outgoing_actions || [],  // Sauvegarder pour traitement ultérieur
        processed_at: new Date().toISOString()
      },
      ai_confidence_score: Math.max(0.1, Math.min(1.0, parseFloat(aiResult.confidence_score) || 0.5)),
      ai_last_processed_at: new Date().toISOString(),
      category: aiResult.category || 'Autre',  // ✅ Toujours sauvegarder la catégorie
      tags: aiResult.auto_tags || [],  // ✅ PHASE 2: Sauvegarder les tags automatiques
      priority: aiResult.priority || 'medium',
      needs_manual_review: (aiResult.confidence_score || 0) < 0.7,
    }).eq("id", thread_id);

    await supabaseAdmin.from("ai_processing_log").insert({
      email_thread_id: thread_id,
      processing_type: "extraction",
      model_used: "gpt-5.4",
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      result: aiResult,
      confidence_score: Math.max(0.1, Math.min(1.0, parseFloat(aiResult.confidence_score) || 0.5)),
      success: true,
      processing_duration_ms: processingDuration,
    });

    if (aiResult.recommended_action === "create_new_etablissement") {
      // ========== REFONTE AVEC VALIDATION STRICTE (PHASE 3) ==========
      
      // 1. Extraire domaines
      const threadDomains = new Set<string>();
      for (const message of thread.messages || []) {
        if (message.from_address && typeof message.from_address === 'string') {
          const domain = message.from_address.split('@')[1]?.toLowerCase();
          if (domain) threadDomains.add(domain);
        }
      }
      
      // 2. Valider TOUS les domaines avec critères stricts
      let hasValidDomain = false;
      const genericDomains = ['gmail.com', 'outlook.com', 'yahoo.fr', 'hotmail.com', 
                              'free.fr', 'orange.fr', 'wanadoo.fr', 'laposte.net'];
      const healthKeywords = ['chu-', 'ch-', 'ght-', 'clinique', 'hopital', 'hospital', 
                              'ehpad', 'espic', 'polyclinique', 'sante', 'medical'];
      
      for (const domain of threadDomains) {
        // Rejeter domaines génériques
        if (genericDomains.includes(domain)) {
          console.log(`❌ Domain ${domain} rejected: generic`);
          continue;
        }
        
        // Rejeter domaines internes
        if (domain.includes('exploitant.example.org')) {
          console.log(`❌ Domain ${domain} rejected: internal`);
          continue;
        }
        
        // Vérifier si déjà mappé
        const { data: mapping } = await supabaseAdmin
          .from('email_domain_mappings')
          .select('domain, niveau_mapping, is_excluded, etablissement_id, groupe_id, partenaire_id')
          .eq('domain', domain)
          .maybeSingle();
        
        if (mapping) {
          if (mapping.is_excluded) {
            console.log(`❌ Domain ${domain} rejected: excluded`);
            continue;
          }
          if (['partenaire', 'equipe', 'groupe'].includes(mapping.niveau_mapping)) {
            console.log(`❌ Domain ${domain} rejected: ${mapping.niveau_mapping}`);
            continue;
          }
          if (mapping.etablissement_id) {
            console.log(`❌ Domain ${domain} rejected: already mapped to etablissement`);
            continue;
          }
        }
        
        // Vérifier si établissement existe avec ce domaine
        const { data: existingEtab } = await supabaseAdmin
          .from('etablissements')
          .select('id')
          .contains('email_domains', [domain])
          .maybeSingle();
        
        if (existingEtab) {
          console.log(`❌ Domain ${domain} rejected: etablissement exists`);
          continue;
        }
        
        // Vérifier mots-clés santé
        const hasHealthKeyword = healthKeywords.some(kw => domain.includes(kw));
        if (!hasHealthKeyword) {
          console.log(`❌ Domain ${domain} rejected: no health keywords`);
          continue;
        }
        
        console.log(`✅ Domain ${domain} valid for AI suggestion`);
        hasValidDomain = true;
        break;
      }
      
      if (!hasValidDomain) {
        console.log('Aucun domaine valide détecté, skip suggestion');
      } else {
        // 3. Valider les données IA
        if (!aiResult.establishment?.nom || !aiResult.establishment?.ville) {
          console.log('Données IA incomplètes (nom/ville manquants), skip');
        } else if (aiResult.establishment.nom === aiResult.establishment.ville) {
          console.log('Données IA invalides (nom = ville), skip');
        } else if ((aiResult.confidence_score || 0) < 0.7) {
          console.log(`Confidence IA trop faible (${aiResult.confidence_score}), skip`);
        } else {
          // 4. Vérifier suggestions existantes
          const { data: existingSuggestions } = await supabaseAdmin
            .from('email_to_etablissement_suggestions')
            .select('id')
            .eq('email_thread_id', thread_id)
            .in('status', ['pending', 'accepted']);
          
          if (!existingSuggestions || existingSuggestions.length === 0) {
            await supabaseAdmin.from("email_to_etablissement_suggestions").insert({
              email_thread_id: thread_id,
              suggestion_type: "create_new",
              extracted_data: aiResult.establishment,
              match_confidence: aiResult.confidence_score,
              match_reason: `IA recommande: ${aiResult.establishment.nom} à ${aiResult.establishment.ville}`,
              status: "pending"
            });
            console.log('✅ Created AI suggestion with validation');
          } else {
            console.log('Suggestion already exists, skip');
          }
        }
      }
    }

    // DÉCLENCHEURS AUTOMATIQUES
    
    // 1. Générer les suggestions IA si un établissement est associé
    if (thread.etablissement_id) {
      console.log(`Triggering AI suggestions for etablissement ${thread.etablissement_id}...`);
      
      try {
        const { error: suggestionsError } = await supabaseAdmin.functions.invoke(
          'generate-ai-suggestions',
          {
            body: { 
              thread_id, 
              etablissement_id: thread.etablissement_id 
            }
          }
        );
        
        if (suggestionsError) {
          console.error('Error generating AI suggestions:', suggestionsError);
        } else {
          console.log('AI suggestions generated successfully');
        }
      } catch (err) {
        console.error('Failed to invoke generate-ai-suggestions:', err);
      }
    }

    // 2. Créer les nouvelles tâches détectées
    if (aiResult.new_tasks_needed && aiResult.new_tasks_needed.length > 0 && thread.etablissement_id) {
      console.log(`Creating ${aiResult.new_tasks_needed.length} new tasks...`);
      
      try {
        const { error: createError } = await supabaseAdmin.functions.invoke(
          'create-tasks-from-email',
          {
            body: {
              thread_id,
              etablissement_id: thread.etablissement_id,
              new_tasks_needed: aiResult.new_tasks_needed.filter(t => t.confidence >= 0.6)
            }
          }
        );
        
        if (createError) {
          console.error('Error creating tasks:', createError);
        } else {
          console.log('Tasks created successfully');
        }
      } catch (err) {
        console.error('Failed to invoke create-tasks-from-email:', err);
      }
    }

    // 3. Marquer les tâches comme terminées (établissements)
    if (aiResult.completed_tasks && aiResult.completed_tasks.length > 0 && thread.etablissement_id) {
      console.log(`Updating ${aiResult.completed_tasks.length} completed tasks for etablissement...`);
      
      try {
        const { error: updateError } = await supabaseAdmin.functions.invoke(
          'update-tasks-from-email',
          {
            body: {
              thread_id,
              etablissement_id: thread.etablissement_id,
              completed_tasks: aiResult.completed_tasks.filter(t => t.confidence >= 0.7)
            }
          }
        );
        
        if (updateError) {
          console.error('Error updating tasks:', updateError);
        } else {
          console.log('Tasks updated successfully');
        }
      } catch (err) {
        console.error('Failed to invoke update-tasks-from-email:', err);
      }
    }
    
    // 3b. Créer les nouvelles tâches détectées (partenaires)
    if (aiResult.new_tasks_needed && aiResult.new_tasks_needed.length > 0 && thread.partenaire_id) {
      console.log(`Creating ${aiResult.new_tasks_needed.length} new tasks for partenaire...`);
      
      try {
        const { error: createError } = await supabaseAdmin.functions.invoke(
          'create-tasks-from-email',
          {
            body: {
              thread_id,
              partenaire_id: thread.partenaire_id,
              new_tasks_needed: aiResult.new_tasks_needed.filter(t => t.confidence >= 0.6)
            }
          }
        );
        
        if (createError) {
          console.error('Error creating partenaire tasks:', createError);
        } else {
          console.log('Partenaire tasks created successfully');
        }
      } catch (err) {
        console.error('Failed to invoke create-tasks-from-email for partenaire:', err);
      }
    }
    
    // 3c. Marquer les tâches partenaires comme terminées
    if (aiResult.completed_tasks && aiResult.completed_tasks.length > 0 && thread.partenaire_id) {
      console.log(`Updating ${aiResult.completed_tasks.length} completed tasks for partenaire...`);
      
      try {
        const { error: updateError } = await supabaseAdmin.functions.invoke(
          'update-tasks-from-email',
          {
            body: {
              thread_id,
              partenaire_id: thread.partenaire_id,
              completed_tasks: aiResult.completed_tasks.filter(t => t.confidence >= 0.7)
            }
          }
        );
        
        if (updateError) {
          console.error('Error updating partenaire tasks:', updateError);
        } else {
          console.log('Partenaire tasks updated successfully');
        }
      } catch (err) {
        console.error('Failed to invoke update-tasks-from-email for partenaire:', err);
      }
    }

    // 4. Créer les contacts détectés automatiquement pour ETABLISSEMENTS
    if (aiResult.contacts && aiResult.contacts.length > 0 && thread.etablissement_id) {
      const highConfidenceContacts = aiResult.contacts.filter(c => (c.confidence || 0) >= 0.7);
      
      if (highConfidenceContacts.length > 0) {
        console.log(`Auto-creating ${highConfidenceContacts.length} contacts for etablissement...`);
        
        try {
          const { data: createdContacts, error: contactsError } = await supabaseAdmin.functions.invoke(
            'auto-create-contacts-from-email',
            {
              body: {
                thread_id,
                etablissement_id: thread.etablissement_id,
                contacts: highConfidenceContacts
              }
            }
          );
          
          if (contactsError) {
            console.error('Error auto-creating contacts:', contactsError);
          } else {
            console.log(`Created ${createdContacts?.created_count || 0} new contacts for etablissement`);
          }
        } catch (err) {
          console.error('Failed to invoke auto-create-contacts-from-email:', err);
        }
      }
    }

    // 5. Créer les contacts détectés automatiquement pour PARTENAIRES
    if (aiResult.contacts && aiResult.contacts.length > 0 && thread.partenaire_id) {
      const highConfidenceContacts = aiResult.contacts.filter(c => (c.confidence || 0) >= 0.7);
      
      if (highConfidenceContacts.length > 0) {
        console.log(`Auto-creating ${highConfidenceContacts.length} contacts for partenaire...`);
        
        try {
          const { data: createdContacts, error: contactsError } = await supabaseAdmin.functions.invoke(
            'auto-create-contacts-from-partenaire',
            {
              body: {
                thread_id,
                partenaire_id: thread.partenaire_id,
                contacts: highConfidenceContacts
              }
            }
          );
          
          if (contactsError) {
            console.error('Error auto-creating partenaire contacts:', contactsError);
          } else {
            console.log(`Created ${createdContacts?.created_count || 0} new contacts for partenaire`);
          }
        } catch (err) {
          console.error('Failed to invoke auto-create-contacts-from-partenaire:', err);
        }
      }
    }

    // 6. Créer les contacts détectés automatiquement pour GROUPES
    if (aiResult.contacts && aiResult.contacts.length > 0 && thread.groupe_id) {
      const highConfidenceContacts = aiResult.contacts.filter(c => (c.confidence || 0) >= 0.7);
      
      if (highConfidenceContacts.length > 0) {
        console.log(`Auto-creating ${highConfidenceContacts.length} contacts for groupe...`);
        
        try {
          const { data: createdContacts, error: contactsError } = await supabaseAdmin.functions.invoke(
            'auto-create-contacts-from-email',
            {
              body: {
                thread_id,
                groupe_id: thread.groupe_id,
                contacts: highConfidenceContacts
              }
            }
          );
          
          if (contactsError) {
            console.error('Error auto-creating groupe contacts:', contactsError);
          } else {
            console.log(`Created ${createdContacts?.created_count || 0} new contacts for groupe`);
          }
        } catch (err) {
          console.error('Failed to invoke auto-create-contacts-from-email for groupe:', err);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true, 
      ai_result: aiResult,
      tokens_used: usage.total_tokens,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in process-email-with-ai:", error);
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});