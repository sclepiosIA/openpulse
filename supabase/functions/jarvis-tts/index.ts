// Jarvis TTS — synthèse vocale des agents Jarvis.
// Utilise un déploiement Azure OpenAI "speech" (gpt-4o-mini-tts / tts-1) lorsqu'il
// est configuré via AZURE_TTS_ENDPOINT + AZURE_TTS_API_KEY.
// Si aucun déploiement n'est configuré, la fonction répond explicitement
// { audioUrl: null, fallback: "web-speech" } : le client bascule alors sur la
// synthèse vocale native du navigateur (aucun 404, aucun échec silencieux).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getCorsHeaders } from '../_shared/cors.ts'
import { sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TTS_ENDPOINT = Deno.env.get('AZURE_TTS_ENDPOINT')
const TTS_API_KEY = Deno.env.get('AZURE_TTS_API_KEY')

// Voix par agent (noms de voix OpenAI standard)
const ALLOWED_VOICES = new Set(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'])

function json(body: unknown, corsHeaders: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // --- Auth applicative (JWT utilisateur obligatoire) ---
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Non authentifié' }, corsHeaders, 401)
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: userData, error: userErr } = await admin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (userErr || !userData?.user) {
      return json({ error: 'Non authentifié' }, corsHeaders, 401)
    }

    // --- Validation des entrées ---
    const body = await req.json().catch(() => ({}))
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    const voiceRaw = typeof body?.voice === 'string' ? body.voice : 'alloy'
    const voice = ALLOWED_VOICES.has(voiceRaw) ? voiceRaw : 'alloy'

    if (!text) {
      return json({ error: "Le champ 'text' est requis" }, corsHeaders, 400)
    }
    if (text.length > 4000) {
      return json({ error: 'Texte trop long (max 4000 caractères)' }, corsHeaders, 400)
    }

    // --- Pas de moteur TTS configuré : repli explicite côté client ---
    if (!TTS_ENDPOINT || !TTS_API_KEY) {
      return json({
        audioUrl: null,
        fallback: 'web-speech',
        reason: 'tts_not_configured',
      }, corsHeaders)
    }

    // --- Appel Azure (timeout 90s + retry 429) ---
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000)

    try {
      const doCall = () =>
        fetch(TTS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': TTS_API_KEY,
          },
          body: JSON.stringify({
            input: text,
            voice,
            response_format: 'mp3',
          }),
          signal: controller.signal,
        })

      let response = await doCall()
      if (response.status === 429) {
        await new Promise((r) => setTimeout(r, 1000))
        response = await doCall()
      }
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errText = await response.text()
        console.error('[jarvis-tts] Azure error', response.status, errText)
        return json({
          audioUrl: null,
          fallback: 'web-speech',
          reason: `tts_error_${response.status}`,
        }, corsHeaders)
      }

      // Stockage de l'audio et retour d'une URL signée courte durée
      const audio = new Uint8Array(await response.arrayBuffer())
      const path = `${userData.user.id}/${crypto.randomUUID()}.mp3`

      const { error: upErr } = await admin.storage
        .from('jarvis-tts')
        .upload(path, audio, { contentType: 'audio/mpeg', upsert: false })

      if (upErr) {
        console.error('[jarvis-tts] upload error', upErr.message)
        return json({
          audioUrl: null,
          fallback: 'web-speech',
          reason: 'storage_error',
        }, corsHeaders)
      }

      const { data: signed, error: signErr } = await admin.storage
        .from('jarvis-tts')
        .createSignedUrl(path, 3600)

      if (signErr || !signed?.signedUrl) {
        return json({
          audioUrl: null,
          fallback: 'web-speech',
          reason: 'signed_url_error',
        }, corsHeaders)
      }

      return json({ audioUrl: signed.signedUrl, voice }, corsHeaders)
    } catch (e) {
      clearTimeout(timeoutId)
      if ((e as Error).name === 'AbortError') {
        return json({
          audioUrl: null,
          fallback: 'web-speech',
          reason: 'tts_timeout',
        }, corsHeaders)
      }
      throw e
    }
  } catch (error) {
    console.error('[jarvis-tts] error:', error)
    return json({ error: sanitizeErrorForClient(error) }, corsHeaders, 500)
  }
})
