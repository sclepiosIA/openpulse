import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";

import { origineAutorisee } from '../_shared/cors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const auth = await validateServiceOrUser(req);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let sessionId: string | null = null;

  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      throw new Error('Content-Type must be multipart/form-data');
    }

    const formData = await req.formData();
    const audioFile = formData.get('file') as File | null;
    const title = formData.get('title') as string || 'Note de réunion';
    const language = formData.get('language') as string || 'fr';
    const userId = formData.get('userId') as string;
    const etablissementId = formData.get('etablissementId') as string | null;
    const partenaireId = formData.get('partenaireId') as string | null;
    const groupeId = formData.get('groupeId') as string | null;

    if (!audioFile) throw new Error('Fichier audio requis');
    if (!userId) throw new Error('userId requis');

    // Validate file size (50MB max)
    if (audioFile.size > 50 * 1024 * 1024) {
      throw new Error('Le fichier ne doit pas dépasser 50 Mo');
    }

    console.log(`[meeting-notes] Processing: "${title}", file: ${audioFile.name} (${(audioFile.size / 1024 / 1024).toFixed(1)} MB), lang: ${language}`);

    // ===== STEP 1: Create session =====
    const { data: session, error: sessionError } = await supabase
      .from('visio_transcription_sessions')
      .insert({
        title,
        created_by: userId,
        status: 'processing',
        language,
        started_at: new Date().toISOString(),
        etablissement_id: etablissementId || null,
        partenaire_id: partenaireId || null,
        groupe_id: groupeId || null,
        decisions: [],
        next_steps: [],
      })
      .select('id')
      .single();

    if (sessionError) throw new Error(`Erreur création session: ${sessionError.message}`);
    sessionId = session.id;
    console.log(`[meeting-notes] Session created: ${sessionId}`);

    // ===== STEP 2: Transcribe via Azure =====
    const AZURE_TRANSCRIBE_ENDPOINT = Deno.env.get('AZURE_TRANSCRIBE_ENDPOINT');
    const AZURE_TRANSCRIBE_API_KEY = Deno.env.get('AZURE_TRANSCRIBE_API_KEY') || Deno.env.get('AZURE_OPENAI_API_KEY');

    if (!AZURE_TRANSCRIBE_ENDPOINT || !AZURE_TRANSCRIBE_API_KEY) {
      throw new Error('Azure transcription non configurée');
    }

    const transcribeForm = new FormData();
    transcribeForm.append('file', audioFile, audioFile.name);
    transcribeForm.append('model', 'gpt-4o-transcribe-diarize');
    transcribeForm.append('response_format', 'json');
    transcribeForm.append('language', language);
    transcribeForm.append('chunking_strategy', 'auto');

    const transcribeController = new AbortController();
    const transcribeTimeout = setTimeout(() => transcribeController.abort(), 120000); // 2 min for large files

    let transcribeResponse: Response;
    try {
      transcribeResponse = await fetch(AZURE_TRANSCRIBE_ENDPOINT, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${AZURE_TRANSCRIBE_API_KEY}` },
        body: transcribeForm,
        signal: transcribeController.signal,
      });
      clearTimeout(transcribeTimeout);
    } catch (e: unknown) {
      clearTimeout(transcribeTimeout);
      if (e.name === 'AbortError') throw new Error('Transcription timeout (120s)');
      throw e;
    }

    // Retry on 429
    if (transcribeResponse.status === 429) {
      console.log('[meeting-notes] Rate limited, retrying in 2s...');
      await new Promise(r => setTimeout(r, 2000));
      transcribeResponse = await fetch(AZURE_TRANSCRIBE_ENDPOINT, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${AZURE_TRANSCRIBE_API_KEY}` },
        body: transcribeForm,
      });
    }

    if (!transcribeResponse.ok) {
      const errText = await transcribeResponse.text();
      console.error(`[meeting-notes] Transcription error ${transcribeResponse.status}:`, errText);
      throw new Error(`Transcription échouée (${transcribeResponse.status})`);
    }

    const transcribeResult = await transcribeResponse.json();
    console.log(`[meeting-notes] Transcription done: ${transcribeResult.text?.length || 0} chars`);

    // Extract segments
    let segments: Array<{ speaker: string; text: string; start: number; end: number; confidence: number }> = [];

    if (transcribeResult.segments?.length > 0) {
      segments = transcribeResult.segments.map((seg: any) => ({
        speaker: seg.speaker || 'Intervenant',
        text: seg.text,
        start: seg.start || 0,
        end: seg.end || 0,
        confidence: seg.confidence ?? 1.0,
      }));
    } else if (transcribeResult.utterances?.length > 0) {
      segments = transcribeResult.utterances.map((utt: any) => ({
        speaker: utt.speaker || 'Intervenant',
        text: utt.text,
        start: utt.start || 0,
        end: utt.end || 0,
        confidence: utt.confidence ?? 1.0,
      }));
    } else if (transcribeResult.text) {
      segments = [{ speaker: 'Intervenant', text: transcribeResult.text, start: 0, end: transcribeResult.duration || 0, confidence: 1.0 }];
    }

    // Save segments
    if (segments.length > 0) {
      const { error: segError } = await supabase
        .from('visio_transcription_segments')
        .insert(segments.map(seg => ({
          session_id: sessionId,
          user_id: userId,
          speaker_name: seg.speaker,
          speaker_id: seg.speaker,
          text: seg.text,
          start_time_ms: Math.round(seg.start * 1000),
          end_time_ms: Math.round(seg.end * 1000),
          is_partial: false,
          confidence: seg.confidence,
        })));

      if (segError) console.error('[meeting-notes] Error saving segments:', segError);
      else console.log(`[meeting-notes] Saved ${segments.length} segments`);
    }

    // Build full transcript
    const formatTime = (ms: number) => {
      const s = Math.floor(ms / 1000);
      return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    };

    const fullTranscript = segments
      .map(seg => `[${formatTime(seg.start * 1000)}] ${seg.speaker}: ${seg.text}`)
      .join('\n');

    // ===== STEP 3: AI Summary =====
    const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
    const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');

    let summary = 'Résumé IA non disponible.';
    let decisions: any[] = [];
    let nextSteps: any[] = [];

    if (AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_API_KEY && fullTranscript.length > 10) {
      const systemPrompt = `Tu es un assistant qui analyse les transcriptions de réunions professionnelles.
À partir de la transcription fournie, génère une analyse structurée en JSON avec les champs suivants :
- summary: résumé en 3-5 points clés (max 300 mots, en français)
- decisions: liste des décisions prises, format [{decision: string, owner?: string}]
- nextSteps: liste des prochaines étapes/actions, format [{task: string, assignee?: string, deadline?: string, priority?: "haute"|"moyenne"|"basse"}]

Sois concis et factuel. Concentre-toi sur les éléments actionnables.
Réponds UNIQUEMENT en JSON valide.`;

      const userPrompt = `Transcription de la réunion "${title}" :\n\n${fullTranscript}\n\nAnalyse cette réunion.`;

      const gptController = new AbortController();
      const gptTimeout = setTimeout(() => gptController.abort(), 90000);

      try {
        let gptResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': AZURE_OPENAI_API_KEY },
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
          signal: gptController.signal,
        });
        clearTimeout(gptTimeout);

        if (gptResponse.status === 429) {
          await new Promise(r => setTimeout(r, 2000));
          gptResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': AZURE_OPENAI_API_KEY },
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
          });
        }

        if (gptResponse.ok) {
          const gptData = await gptResponse.json();
          const content = gptData.choices?.[0]?.message?.content;
          if (content) {
            try {
              const analysis = JSON.parse(content);
              summary = analysis.summary || summary;
              decisions = analysis.decisions || [];
              nextSteps = analysis.nextSteps || [];
            } catch { summary = content; }
          }
        } else {
          const errText = await gptResponse.text();
          console.error(`[meeting-notes] GPT error ${gptResponse.status}:`, errText);
        }
      } catch (e: any) {
        clearTimeout(gptTimeout);
        console.error('[meeting-notes] GPT call failed:', e.message);
      }
    }

    // Calculate duration from audio
    const durationSec = transcribeResult.duration || (segments.length > 0 ? Math.max(...segments.map(s => s.end)) : 0);
    const endedAt = new Date(Date.now()).toISOString();

    // ===== STEP 4: Update session =====
    const { error: updateError } = await supabase
      .from('visio_transcription_sessions')
      .update({
        status: 'archived',
        ended_at: endedAt,
        full_transcript: fullTranscript,
        summary,
        decisions,
        next_steps: nextSteps,
      })
      .eq('id', sessionId);

    if (updateError) throw new Error(`Erreur mise à jour session: ${updateError.message}`);

    console.log(`[meeting-notes] Session ${sessionId} processed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        durationSec,
        summary,
        decisions,
        nextSteps,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[meeting-notes-process] Fatal error:', error);
    if (sessionId) {
      try {
        await supabase
          .from('visio_transcription_sessions')
          .update({ status: 'error', error_message: error.message })
          .eq('id', sessionId);
      } catch { /* swallow */ }
    }
    return buildErrorResponse('meeting-notes-process', error, corsHeaders, 500);
  }
});

