import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'
import { requireInternalSecret } from '../_shared/internal-secret.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

// Helper to escape HTML special characters
function escapeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const denied = requireInternalSecret(req, corsHeaders)
    if (denied) return denied

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT')
    const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY')

    const { sessionId } = await req.json()

    if (!sessionId) {
      throw new Error('sessionId is required')
    }

    console.log(`Processing summary for session: ${sessionId}`)

    // Get session with segments
    const { data: session, error: sessionError } = await supabase
      .from('visio_transcription_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      throw new Error('Session not found')
    }

    // Get all segments ordered by time
    const { data: segments, error: segmentsError } = await supabase
      .from('visio_transcription_segments')
      .select('*')
      .eq('session_id', sessionId)
      .order('start_time_ms', { ascending: true })

    if (segmentsError) throw segmentsError

    if (!segments || segments.length === 0) {
      console.log('No segments found, marking as archived without summary')
      await supabase
        .from('visio_transcription_sessions')
        .update({
          status: 'archived',
          summary: 'Aucune transcription disponible.',
        })
        .eq('id', sessionId)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'No segments to process',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Build full transcript with speaker names and timestamps
    const formatTime = (ms: number) => {
      const seconds = Math.floor(ms / 1000)
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    const fullTranscript = segments
      .map((seg) => `[${formatTime(seg.start_time_ms || 0)}] ${seg.speaker_name}: ${seg.text}`)
      .join('\n')

    console.log(`Built transcript with ${segments.length} segments, ${fullTranscript.length} chars`)

    // If no GPT-5 configured, just save the transcript
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      console.log('GPT-5 not configured, saving transcript only')
      await supabase
        .from('visio_transcription_sessions')
        .update({
          status: 'archived',
          full_transcript: fullTranscript,
          summary: 'Résumé IA non disponible (GPT-5 non configuré).',
        })
        .eq('id', sessionId)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Transcript saved without AI summary',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Call GPT-5 for summary
    const systemPrompt = `Tu es un assistant qui analyse les transcriptions de réunions professionnelles.
À partir de la transcription fournie, génère une analyse structurée en JSON avec les champs suivants :
- summary: résumé en 3-5 points clés (max 300 mots, en français)
- decisions: liste des décisions prises, format [{decision: string, owner?: string}]
- nextSteps: liste des prochaines étapes/actions, format [{task: string, assignee?: string, deadline?: string, priority?: "haute"|"moyenne"|"basse"}]
- keyTopics: liste des sujets principaux abordés (max 5)
- participants: liste des participants détectés avec leur rôle si mentionné [{name: string, role?: string}]

Sois concis et factuel. Concentre-toi sur les éléments actionnables.
Réponds UNIQUEMENT en JSON valide, sans markdown ni texte autour.`

    const userPrompt = `Voici la transcription de la réunion "${session.title}" :

${fullTranscript}

Analyse cette réunion et génère le JSON demandé.`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000)

    let gptResponse: Response
    try {
      gptResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_completion_tokens: 2000,
          reasoning_effort: 'medium',
          verbosity: 'medium',
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('GPT-5 request timeout (90s)')
      }
      throw error
    }

    // Retry on rate limit
    if (gptResponse.status === 429) {
      console.log('Rate limited, waiting 2s and retrying...')
      await new Promise((r) => setTimeout(r, 2000))
      gptResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_completion_tokens: 2000,
          reasoning_effort: 'medium',
          verbosity: 'medium',
          response_format: { type: 'json_object' },
        }),
      })
    }

    if (!gptResponse.ok) {
      const errorText = await gptResponse.text()
      console.error(`GPT-5 error: ${gptResponse.status}`, errorText)
      throw new Error(`GPT-5 analysis failed: ${gptResponse.status}`)
    }

    const gptData = await gptResponse.json()
    const content = gptData.choices?.[0]?.message?.content

    if (!content || typeof content !== 'string') {
      console.error('GPT-5 returned empty or invalid content:', JSON.stringify(gptData, null, 2))

      // Fallback: save transcript without AI summary
      await supabase
        .from('visio_transcription_sessions')
        .update({
          status: 'archived',
          full_transcript: fullTranscript,
          summary: 'Résumé IA non disponible (erreur de traitement). Voir transcription complète.',
        })
        .eq('id', sessionId)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Transcript saved without AI summary (GPT-5 error)',
          transcriptOnly: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('GPT-5 response received, parsing...')

    let analysis
    try {
      analysis = JSON.parse(content)
    } catch (e) {
      console.error('Failed to parse GPT response:', content)
      analysis = {
        summary: content,
        decisions: [],
        nextSteps: [],
        keyTopics: [],
        participants: [],
      }
    }

    // Update session with results
    const { error: updateError } = await supabase
      .from('visio_transcription_sessions')
      .update({
        status: 'archived',
        full_transcript: fullTranscript,
        summary: analysis.summary || 'Résumé non disponible.',
        decisions: analysis.decisions || [],
        next_steps: analysis.nextSteps || [],
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Error updating session:', updateError)
      throw updateError
    }

    console.log(`Session ${sessionId} processed successfully`)

    // ====== STORAGE: Create Markdown document for file manager ======
    // Declare storagePath at broader scope for final response
    let storagePath = ''

    // Wrap in try-catch so document creation failures don't block session archival
    try {
      const sessionDate = new Date(session.ended_at || session.started_at).toLocaleDateString(
        'fr-FR',
        {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }
      )

      const participantsList =
        (analysis.participants || [])
          .map((p: any) => `- ${p.name}${p.role ? ` (${p.role})` : ''}`)
          .join('\n') || '- Non détectés'

      const decisionsList =
        (analysis.decisions || [])
          .map((d: any, i: number) => `${i + 1}. ${d.decision}${d.owner ? ` → *${d.owner}*` : ''}`)
          .join('\n') || '- Aucune décision enregistrée'

      const nextStepsList =
        (analysis.nextSteps || [])
          .map((s: any, i: number) => {
            let line = `${i + 1}. ${s.task}`
            if (s.assignee) line += ` → *${s.assignee}*`
            if (s.deadline) line += ` (${s.deadline})`
            if (s.priority) line += ` [${s.priority}]`
            return line
          })
          .join('\n') || '- Aucune prochaine étape'

      const keyTopicsList =
        (analysis.keyTopics || []).map((t: string) => `- ${t}`).join('\n') || '- Non détectés'

      // Calculate duration
      const durationMinutes =
        session.started_at && session.ended_at
          ? Math.round(
              (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) /
                60000
            )
          : null

      // Generate branded HTML document
      const documentContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compte-rendu - ${session.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      background: #f8fafc;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      box-shadow: none;
    }
    .header {
      background: #211A17;
      color: white;
      padding: 2rem;
      position: relative;
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: #CC5B19;
    }
    .logo-section {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .logo-icon {
      width: 48px;
      height: 48px;
      background: rgba(255,255,255,0.15);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    .logo-text h1 {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .logo-text p {
      font-size: 0.875rem;
      opacity: 0.8;
    }
    .meeting-title {
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
    }
    .meeting-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      font-size: 0.9rem;
      opacity: 0.9;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .content {
      padding: 2rem;
    }
    .section {
      margin-bottom: 2rem;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e2e8f0;
    }
    .section-icon {
      width: 32px;
      height: 32px;
      background: #0099AD;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 16px;
    }
    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #0c4a6e;
    }
    .summary-box {
      background: #FAF7F4;
      border-left: 4px solid #0ea5e9;
      padding: 1.25rem;
      border-radius: 0 8px 8px 0;
      font-size: 1rem;
    }
    .participant-list, .topic-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .participant-tag, .topic-tag {
      background: #f1f5f9;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-size: 0.9rem;
      border: 1px solid #e2e8f0;
    }
    .participant-tag { background: #dbeafe; border-color: #93c5fd; color: #1e40af; }
    .topic-tag { background: #fef3c7; border-color: #fcd34d; color: #92400e; }
    .decision-list, .nextstep-list {
      list-style: none;
    }
    .decision-item, .nextstep-item {
      padding: 1rem;
      margin-bottom: 0.75rem;
      border-radius: 8px;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .decision-item {
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
    }
    .nextstep-item {
      background: #fefce8;
      border-left: 4px solid #eab308;
    }
    .item-number {
      width: 24px;
      height: 24px;
      background: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.8rem;
      flex-shrink: 0;
    }
    .decision-item .item-number { color: #22c55e; border: 2px solid #22c55e; }
    .nextstep-item .item-number { color: #eab308; border: 2px solid #eab308; }
    .item-content {
      flex: 1;
    }
    .item-text {
      font-weight: 500;
      margin-bottom: 0.25rem;
    }
    .item-meta {
      font-size: 0.8rem;
      color: #64748b;
    }
    .transcript-section {
      background: #1e293b;
      border-radius: 8px;
      overflow: hidden;
    }
    .transcript-header {
      background: #0f172a;
      padding: 0.75rem 1rem;
      color: #94a3b8;
      font-size: 0.85rem;
      display: flex;
      justify-content: space-between;
    }
    .transcript-content {
      padding: 1rem;
      color: #e2e8f0;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.8rem;
      line-height: 1.8;
      white-space: pre-wrap;
      max-height: 400px;
      overflow-y: auto;
    }
    .footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 1.5rem 2rem;
      text-align: center;
      color: #64748b;
      font-size: 0.85rem;
    }
    .footer-logo {
      font-weight: 600;
      color: #0c4a6e;
    }
    .empty-state {
      color: #94a3b8;
      font-style: italic;
      padding: 1rem;
      text-align: center;
      background: #f8fafc;
      border-radius: 8px;
    }
    @media print {
      body { background: white; }
      .container { box-shadow: none; }
      .transcript-content { max-height: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-section">
        <div class="logo-icon">⚕️</div>
        <div class="logo-text">
          <h1>OpenPulse</h1>
          <p>Solutions Médicales Intelligentes</p>
        </div>
      </div>
      <div class="meeting-title">${escapeHtml(session.title)}</div>
      <div class="meeting-meta">
        <div class="meta-item">📅 ${sessionDate}</div>
        ${durationMinutes ? `<div class="meta-item">⏱️ ${durationMinutes} min</div>` : ''}
        <div class="meta-item">🌐 ${session.language === 'en' ? 'English' : 'Français'}</div>
      </div>
    </div>

    <div class="content">
      <div class="section">
        <div class="section-header">
          <div class="section-icon">📋</div>
          <div class="section-title">Résumé</div>
        </div>
        <div class="summary-box">
          ${escapeHtml(analysis.summary || 'Aucun résumé disponible.')}
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <div class="section-icon">👥</div>
          <div class="section-title">Participants</div>
        </div>
        <div class="participant-list">
          ${
            (analysis.participants || []).length > 0
              ? (analysis.participants || [])
                  .map(
                    (p: any) =>
                      `<span class="participant-tag">${escapeHtml(p.name)}${p.role ? ` (${escapeHtml(p.role)})` : ''}</span>`
                  )
                  .join('')
              : '<div class="empty-state">Aucun participant détecté</div>'
          }
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <div class="section-icon">🎯</div>
          <div class="section-title">Sujets abordés</div>
        </div>
        <div class="topic-list">
          ${
            (analysis.keyTopics || []).length > 0
              ? (analysis.keyTopics || [])
                  .map((t: string) => `<span class="topic-tag">${escapeHtml(t)}</span>`)
                  .join('')
              : '<div class="empty-state">Aucun sujet détecté</div>'
          }
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <div class="section-icon">✅</div>
          <div class="section-title">Décisions prises</div>
        </div>
        ${
          (analysis.decisions || []).length > 0
            ? `<div class="decision-list">
              ${(analysis.decisions || [])
                .map(
                  (d: any, i: number) => `
                <div class="decision-item">
                  <div class="item-number">${i + 1}</div>
                  <div class="item-content">
                    <div class="item-text">${escapeHtml(d.decision)}</div>
                    ${d.owner ? `<div class="item-meta">Responsable : ${escapeHtml(d.owner)}</div>` : ''}
                  </div>
                </div>
              `
                )
                .join('')}
            </div>`
            : '<div class="empty-state">Aucune décision enregistrée</div>'
        }
      </div>

      <div class="section">
        <div class="section-header">
          <div class="section-icon">⏭️</div>
          <div class="section-title">Prochaines étapes</div>
        </div>
        ${
          (analysis.nextSteps || []).length > 0
            ? `<div class="nextstep-list">
              ${(analysis.nextSteps || [])
                .map(
                  (s: any, i: number) => `
                <div class="nextstep-item">
                  <div class="item-number">${i + 1}</div>
                  <div class="item-content">
                    <div class="item-text">${escapeHtml(s.task)}</div>
                    <div class="item-meta">
                      ${[
                        s.assignee ? `Assigné à : ${escapeHtml(s.assignee)}` : '',
                        s.deadline ? `Échéance : ${escapeHtml(s.deadline)}` : '',
                        s.priority ? `Priorité : ${escapeHtml(s.priority)}` : '',
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </div>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>`
            : '<div class="empty-state">Aucune prochaine étape identifiée</div>'
        }
      </div>

      <div class="section">
        <div class="section-header">
          <div class="section-icon">📜</div>
          <div class="section-title">Transcription complète</div>
        </div>
        <div class="transcript-section">
          <div class="transcript-header">
            <span>${segments.length} segment(s)</span>
            <span>${fullTranscript.length} caractères</span>
          </div>
          <div class="transcript-content">${escapeHtml(fullTranscript)}</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Document généré automatiquement par <span class="footer-logo">OpenPulse</span></p>
      <p>© ${new Date().getFullYear()} OpenPulse - Tous droits réservés</p>
    </div>
  </div>
</body>
</html>`

      // Generate clean filename
      const cleanTitle = session.title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50)
      const dateStr = new Date().toISOString().split('T')[0]
      const fileName = `compte-rendu-${cleanTitle}-${dateStr}-${sessionId.slice(0, 8)}.html`
      const storagePath = `transcriptions/${fileName}`

      // Encode content as UTF-8 properly
      const encoder = new TextEncoder()
      const utf8Content = encoder.encode(documentContent)

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, utf8Content, {
          contentType: 'text/html; charset=utf-8',
          upsert: true,
        })

      if (uploadError) {
        console.error('Error uploading document to storage:', uploadError)
        // Non-blocking: continue even if storage fails
      } else {
        console.log(`Document uploaded to storage: ${storagePath}`)

        // Create document entry in database
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .insert({
            name: `Compte-rendu - ${session.title}`,
            file_size_bytes: utf8Content.length,
            mime_type: 'text/html',
            storage_path: storagePath,
            storage_bucket: 'documents',
            source_type: 'transcription',
            source_id: sessionId,
            created_by: session.created_by,
            tags: ['transcription', 'compte-rendu', 'visio'],
            description:
              analysis.summary?.substring(0, 500) || 'Compte-rendu de réunion généré par IA',
          })
          .select('id')
          .single()

        if (docError) {
          console.error('Error creating document entry:', docError)
        } else if (docData) {
          console.log(`Document entry created: ${docData.id}`)

          // Create document relations
          const relations: any[] = []

          // Link to etablissement if present
          if (session.etablissement_id) {
            relations.push({
              document_id: docData.id,
              related_etablissement_id: session.etablissement_id,
              relation_type: 'transcription',
              created_by: session.created_by,
            })
          }

          // Link to partenaire if present
          if (session.partenaire_id) {
            relations.push({
              document_id: docData.id,
              related_partenaire_id: session.partenaire_id,
              relation_type: 'transcription',
              created_by: session.created_by,
            })
          }

          // Link to groupe if present
          if (session.groupe_id) {
            relations.push({
              document_id: docData.id,
              related_groupe_id: session.groupe_id,
              relation_type: 'transcription',
              created_by: session.created_by,
            })
          }

          if (relations.length > 0) {
            const { error: relError } = await supabase.from('document_relations').insert(relations)

            if (relError) {
              console.error('Error creating document relations:', relError)
            } else {
              console.log(`Created ${relations.length} document relation(s)`)
            }
          }

          // ====== POST MESSAGE TO PULSE CONVERSATION ======
          if (session.conversation_id) {
            try {
              console.log(
                `Posting transcription summary to conversation: ${session.conversation_id}`
              )

              // Get document public URL
              const { data: urlData } = await supabase.storage
                .from('documents')
                .getPublicUrl(storagePath)

              const documentUrl = urlData?.publicUrl || ''

              // Build message content
              const summaryPreview = (analysis.summary || 'Résumé non disponible.').substring(
                0,
                300
              )
              const messageContent = `📝 **Compte-rendu de réunion disponible**

**${session.title}**

${summaryPreview}${analysis.summary && analysis.summary.length > 300 ? '...' : ''}

${analysis.decisions && analysis.decisions.length > 0 ? `✅ **${analysis.decisions.length} décision(s)** enregistrée(s)` : ''}
${analysis.nextSteps && analysis.nextSteps.length > 0 ? `⏭️ **${analysis.nextSteps.length} prochaine(s) étape(s)** identifiée(s)` : ''}

[📄 Voir le compte-rendu complet](/documents?source=transcription&id=${docData.id})`

              // Insert system message into conversation
              const { error: messageError } = await supabase.from('pulse_messages').insert({
                conversation_id: session.conversation_id,
                user_id: session.created_by,
                content: messageContent,
                message_type: 'system',
                metadata: {
                  type: 'transcription_summary',
                  session_id: sessionId,
                  document_id: docData.id,
                  document_url: documentUrl,
                },
              })

              if (messageError) {
                console.error('Error posting message to conversation:', messageError)
              } else {
                console.log('Transcription summary posted to conversation')
              }
            } catch (msgErr) {
              console.error('Error posting to conversation:', msgErr)
            }
          }
        }
      }
    } catch (docErr) {
      // Non-critical: session is already archived, document creation failed but that's okay
      console.error('Non-critical error creating document:', docErr)
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: analysis.summary,
        decisions: analysis.decisions,
        nextSteps: analysis.nextSteps,
        keyTopics: analysis.keyTopics,
        participants: analysis.participants,
        documentPath: storagePath || null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('Summary processing error:', error)

    // Try to mark session as archived even on error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const { sessionId } = await req.json().catch(() => ({}))

      if (sessionId) {
        await supabase
          .from('visio_transcription_sessions')
          .update({
            status: 'archived',
            summary: `Erreur lors du traitement: ${error.message}`,
          })
          .eq('id', sessionId)
      }
    } catch (e) {
      console.error('Failed to update session on error:', e)
    }

    return buildErrorResponse('process-transcription-summary', error, corsHeaders, 500)
  }
})
