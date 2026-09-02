import 'https://deno.land/x/xhr@0.1.0/mod.ts'
import { logAICall, createTimer } from '../_shared/ai-logging.ts'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

// Note: Audio transcription uses binary audio data, not text prompts
// Security sanitization not applicable to raw audio bytes

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

// Process base64 in chunks to prevent memory issues with large audio files
function processBase64Chunks(base64String: string, chunkSize = 32768): Uint8Array {
  const chunks: Uint8Array[] = []
  let position = 0

  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize)
    const binaryChunk = atob(chunk)
    const bytes = new Uint8Array(binaryChunk.length)

    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i)
    }

    chunks.push(bytes)
    position += chunkSize
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result
}

export async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { audio, language = 'fr' } = await req.json()

    if (!audio) {
      throw new Error('Aucune donnée audio fournie')
    }

    console.log('[transcribe-audio] Processing audio, language:', language)
    console.log('[transcribe-audio] Audio base64 length:', audio.length)

    // Get OpenAI API key (we'll use OpenAI Whisper as it's more widely available)
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

    if (!OPENAI_API_KEY) {
      // Fallback to Azure if configured
      const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT')
      const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY')

      if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
        throw new Error('Aucune clé API de transcription configurée')
      }

      // Use Azure Whisper (requires separate Whisper deployment)
      console.log('[transcribe-audio] Using Azure OpenAI')

      // For Azure, we'd need a Whisper deployment - for now, return an error
      throw new Error('Azure Whisper non configuré. Veuillez ajouter OPENAI_API_KEY.')
    }

    // Process audio in chunks to prevent memory issues
    const binaryAudio = processBase64Chunks(audio)
    console.log('[transcribe-audio] Binary audio size:', binaryAudio.length, 'bytes')

    // Prepare form data for Whisper API
    const formData = new FormData()

    // Detect audio type from base64 header or default to webm
    const blob = new Blob([binaryAudio], { type: 'audio/webm' })
    formData.append('file', blob, 'audio.webm')
    formData.append('model', 'whisper-1')
    formData.append('language', language)
    formData.append('response_format', 'json')

    // Send to OpenAI Whisper API with a timeout that is always cleared.
    console.log('[transcribe-audio] Calling OpenAI Whisper API')
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30_000)
    const timer = createTimer()
    let response: Response
    try {
      response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[transcribe-audio] OpenAI API error:', response.status, errorText)
      throw new Error(`Erreur API OpenAI: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('[transcribe-audio] Transcription successful, text length:', result.text?.length)

    // Log to ai_processing_log for dashboard
    await logAICall({
      processing_type: 'audio_transcription',
      model_used: 'whisper-1',
      processing_duration_ms: timer.stop(),
      success: true,
      result: { text_length: result.text?.length || 0, language },
    })

    return new Response(
      JSON.stringify({
        success: true,
        text: result.text,
        language: language,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: unknown) {
    return buildErrorResponse('transcribe-audio', error, corsHeaders, 500)
  }
}

if (import.meta.main) Deno.serve(handler)
