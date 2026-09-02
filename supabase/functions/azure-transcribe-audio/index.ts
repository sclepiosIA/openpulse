import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
import { validateServiceOrUser } from "../_shared/auth-helpers.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
// Note: Audio transcription uses binary audio data, not text prompts
// Security sanitization not applicable to raw audio bytes

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await validateServiceOrUser(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const body = await req.json();
    const { audio, sessionId, speakerName, language = 'fr' } = body;
    const userId = auth.isServiceCall ? body.userId : auth.userId;

    if (!audio) {
      throw new Error('Audio data is required');
    }

    const AZURE_TRANSCRIBE_ENDPOINT = Deno.env.get('AZURE_TRANSCRIBE_ENDPOINT');
    const AZURE_TRANSCRIBE_API_KEY = Deno.env.get('AZURE_TRANSCRIBE_API_KEY') 
      || Deno.env.get('AZURE_OPENAI_API_KEY');

    if (!AZURE_TRANSCRIBE_ENDPOINT) {
      console.error('AZURE_TRANSCRIBE_ENDPOINT not configured. Add this secret in Supabase.');
      return new Response(JSON.stringify({
        success: false,
        error: 'Azure transcription not configured. Please add AZURE_TRANSCRIBE_ENDPOINT secret.',
        configured: false,
      }), {
        status: 200, // Non-blocking - return 200 with error flag
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!AZURE_TRANSCRIBE_API_KEY) {
      console.error('AZURE_TRANSCRIBE_API_KEY not configured');
      return new Response(JSON.stringify({
        success: false,
        error: 'Azure API key not configured.',
        configured: false,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing transcription for session ${sessionId}, user ${userId}`);

    // Decode base64 audio to binary
    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log(`Audio size: ${bytes.length} bytes`);
    
    // Check minimum size (at least 1KB of audio data)
    if (bytes.length < 1000) {
      console.log('Audio chunk too small, skipping');
      return new Response(JSON.stringify({
        success: false,
        error: 'Audio chunk too small',
        skipped: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Validate WebM format (EBML magic bytes: 1A 45 DF A3)
    const isValidWebM = bytes.length > 4 && 
      bytes[0] === 0x1A && 
      bytes[1] === 0x45 && 
      bytes[2] === 0xDF && 
      bytes[3] === 0xA3;
    
    // Also check for MP4 format (starts with ftyp)
    const isValidMP4 = bytes.length > 8 && 
      bytes[4] === 0x66 && 
      bytes[5] === 0x74 && 
      bytes[6] === 0x79 && 
      bytes[7] === 0x70;
    
    // Check for EBML Cluster (continuation data from MediaRecorder chunks)
    // Clusters start with 0x1F 0x43 0xB6 0x75 or 0x43 0xC3 0x81 (Cluster element)
    const isEBMLCluster = bytes.length > 4 && (
      (bytes[0] === 0x1F && bytes[1] === 0x43 && bytes[2] === 0xB6 && bytes[3] === 0x75) ||
      (bytes[0] === 0x43 && bytes[1] === 0xC3 && bytes[2] === 0x81) ||
      // SimpleBlock element 0xA3 or 0x23 (common in chunks)
      (bytes[0] === 0xA3) ||
      (bytes[0] === 0x23)
    );
    
    const firstBytes = Array.from(bytes.slice(0, 12)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`First 12 bytes: ${firstBytes}`);
    console.log(`Format detected: WebM=${isValidWebM}, MP4=${isValidMP4}, EBMLCluster=${isEBMLCluster}`);
    
    // Accept any of these formats - Azure Whisper is quite flexible
    // If it's not a recognized format, we'll still try to send it
    const isRecognizedFormat = isValidWebM || isValidMP4 || isEBMLCluster;
    
    if (!isRecognizedFormat) {
      console.warn('Unrecognized audio format, attempting transcription anyway');
    }
    
    // Determine content type and extension
    const contentType = isValidWebM ? 'audio/webm' : 'audio/mp4';
    const extension = isValidWebM ? 'webm' : 'm4a';
    
    // Create blob for multipart form data
    const audioBlob = new Blob([bytes], { type: contentType });
    console.log(`Created blob: ${audioBlob.size} bytes, type: ${contentType}`);

    // Prepare multipart form data for Azure GPT-4o Transcribe
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${extension}`);
    formData.append('model', 'gpt-4o-transcribe-diarize');
    formData.append('response_format', 'json'); // 'json' is compatible with gpt-4o-transcribe-diarize (not 'verbose_json')
    formData.append('language', language);
    formData.append('chunking_strategy', 'auto'); // Required for diarization models

    // Call Azure OpenAI transcription endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    console.log(`Calling Azure transcription endpoint...`);
    
    let azureResponse: Response;
    try {
      azureResponse = await fetch(AZURE_TRANSCRIBE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AZURE_TRANSCRIBE_API_KEY}`,
        },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Azure transcription request timeout (60s)');
      }
      throw fetchError;
    }

    // Handle rate limiting with retry
    if (azureResponse.status === 429) {
      console.log('Rate limited, waiting 1s and retrying...');
      await new Promise(r => setTimeout(r, 1000));
      
      azureResponse = await fetch(AZURE_TRANSCRIBE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AZURE_TRANSCRIBE_API_KEY}`,
        },
        body: formData,
      });
    }

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error(`Azure transcription error: ${azureResponse.status}`, errorText);
      // Return 200 with error flag instead of throwing 500
      return new Response(JSON.stringify({
        success: false,
        error: `Azure transcription failed: ${azureResponse.status}`,
        azureStatus: azureResponse.status,
        details: errorText,
      }), {
        status: 200, // Non-blocking for UI
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await azureResponse.json();
    console.log(`Transcription result: ${result.text?.substring(0, 100)}...`);

    // Extract segments - support both 'segments' and 'utterances' (diarization format)
    let segments: any[] = [];
    
    if (result.segments && result.segments.length > 0) {
      segments = result.segments.map((seg: any) => ({
        speaker: seg.speaker || speakerName,
        text: seg.text,
        start: seg.start,
        end: seg.end,
        confidence: seg.confidence,
      }));
    } else if (result.utterances && result.utterances.length > 0) {
      // Handle diarization format with utterances
      segments = result.utterances.map((utt: any) => ({
        speaker: utt.speaker || speakerName,
        text: utt.text,
        start: utt.start,
        end: utt.end,
        confidence: utt.confidence ?? 1.0,
      }));
    }

    // If no segments but we have text, create a single segment
    if (segments.length === 0 && result.text) {
      segments.push({
        speaker: speakerName,
        text: result.text,
        start: 0,
        end: result.duration || 5,
        confidence: 1.0,
      });
    }

    // Save segments to database if sessionId provided
    if (sessionId && segments.length > 0) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const segmentsToInsert = segments.map((seg: any) => ({
        session_id: sessionId,
        user_id: userId,
        speaker_name: speakerName,
        speaker_id: seg.speaker,
        text: seg.text,
        start_time_ms: Math.round(seg.start * 1000),
        end_time_ms: Math.round(seg.end * 1000),
        is_partial: false,
        confidence: seg.confidence,
      }));

      const { error: insertError } = await supabase
        .from('visio_transcription_segments')
        .insert(segmentsToInsert);

      if (insertError) {
        console.error('Error saving segments:', insertError);
        // Don't throw, still return the transcription result
      } else {
        console.log(`Saved ${segmentsToInsert.length} segments to database`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      text: result.text,
      segments,
      duration: result.duration,
      language: result.language || language,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Transcription error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: sanitizeErrorForClient(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
