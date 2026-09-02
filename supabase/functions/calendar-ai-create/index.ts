import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAICall, extractUsage, createTimer } from "../_shared/ai-logging.ts";
import { sanitizeForAI, wrapUserContent, detectPromptInjection, logSecurityEvent } from "../_shared/security-utils.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT');
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY');
const FUNCTION_NAME = 'calendar-ai-create';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate Azure configuration
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      console.error('Missing Azure OpenAI configuration');
      return new Response(
        JSON.stringify({ error: 'Configuration IA manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { text, calendars } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Texte requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Sanitize user input before AI processing
    const sanitizedText = sanitizeForAI(text, {
      maxLength: 5000,
      strictMode: false,
      functionName: FUNCTION_NAME,
    });

    // SECURITY: Check for prompt injection
    const detection = detectPromptInjection(sanitizedText);
    if (detection.isDetected && detection.riskLevel !== 'low') {
      logSecurityEvent({
        type: 'injection_attempt',
        functionName: FUNCTION_NAME,
        details: { patterns: detection.patterns },
        riskLevel: detection.riskLevel,
      });
    }

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentWeekNumber = getWeekNumber(now);
    const isCurrentWeekEven = currentWeekNumber % 2 === 0;

    // Build system prompt
    const systemPrompt = `Tu es un assistant de planification d'événements. Tu analyses le texte en français et génères des événements de calendrier.

Date actuelle : ${currentDate}
Numéro de semaine actuel : ${currentWeekNumber} (semaine ${isCurrentWeekEven ? 'paire' : 'impaire'})

Calendriers disponibles :
${calendars?.map((c: { id: string; name: string }) => `- "${c.name}" (id: ${c.id})`).join('\n') || 'Aucun calendrier spécifié'}

RÈGLES CRITIQUES :
1. TITRE : Le titre doit être COURT et PROPRE. JAMAIS d'annotations comme "(semaines paires)", "(récurrent)", etc.
   - BON : "Travail Pauline"
   - MAUVAIS : "Travail Pauline (semaines paires)"

2. UN SEUL ÉVÉNEMENT RÉCURRENT : Pour "tous les X", "1 semaine sur 2", etc., crée UN SEUL événement avec une recurrence_rule. NE CRÉE PAS plusieurs événements séparés.

3. Patterns temporels français :
   - "tous les samedis" → FREQ=WEEKLY;BYDAY=SA
   - "tous les samedis et dimanches" → FREQ=WEEKLY;BYDAY=SA,SU  
   - "1 semaine sur 2" ou "une semaine sur deux" → INTERVAL=2
   - "semaines paires" → commence sur une semaine paire + INTERVAL=2
   - "semaines impaires" → commence sur une semaine impaire + INTERVAL=2

4. Règles RRULE (RFC 5545) :
   - FREQ=WEEKLY;BYDAY=SA,SU → tous les samedis et dimanches
   - FREQ=WEEKLY;BYDAY=SA,SU;INTERVAL=2 → samedis et dimanches 1 semaine sur 2
   - FREQ=MONTHLY;BYMONTHDAY=15 → le 15 de chaque mois

5. Mappage calendrier :
   - Si un nom de calendrier est mentionné (ex: "calendrier famille"), trouve l'ID correspondant
   - Si aucun calendrier n'est mentionné, utilise le premier calendrier disponible

6. Horaires par défaut :
   - Si non précisé pour un travail → 09:00 à 18:00
   - Si "toute la journée" → all_day: true avec start_time et end_time au format YYYY-MM-DDT00:00:00

7. Date de départ (CRITIQUE) :
   - Pour les récurrences avec INTERVAL=2 et BYDAY, utilise simplement la date d'aujourd'hui ou demain comme point de départ
   - Le système frontend calculera automatiquement les bonnes occurrences
   - Par défaut, mets start_time = date du jour au format YYYY-MM-DDT00:00:00 pour les événements all_day

RETOURNE UN JSON VALIDE avec cette structure :`;

    // SECURITY: Wrap user content in XML delimiters for prompt protection
    const userPrompt = `Analyse ce texte et génère les événements de calendrier correspondants :\n\n${wrapUserContent(sanitizedText, 'USER_REQUEST')}`;

    // Call Azure GPT-5
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    let azureResponse: Response;
    try {
      azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
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
          max_completion_tokens: 8000,
          reasoning_effort: 'low',
          verbosity: 'low',
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Retry on rate limit
      if (azureResponse.status === 429) {
        console.log('Rate limited, retrying after 1s...');
        await new Promise(r => setTimeout(r, 1000));
        azureResponse = await fetch(AZURE_OPENAI_ENDPOINT, {
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
            max_completion_tokens: 8000,
            reasoning_effort: 'low',
            verbosity: 'low',
            response_format: { type: 'json_object' },
          }),
        });
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('Azure request timeout');
        return new Response(
          JSON.stringify({ error: 'Délai de réponse dépassé' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      console.error(`Azure API error: ${azureResponse.status}`, errorText);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'analyse IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const azureData = await azureResponse.json();
    const content = azureData.choices?.[0]?.message?.content;
    const usage = extractUsage(azureData);

    if (!content) {
      console.error('No content in Azure response:', azureData);
      return new Response(
        JSON.stringify({ error: 'Réponse IA vide' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse JSON response
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      return new Response(
        JSON.stringify({ error: 'Erreur de format de réponse IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log to ai_processing_log for dashboard
    await logAICall({
      processing_type: 'calendar_ai_create',
      model_used: 'gpt-5',
      ...usage,
      success: true,
      result: { events_count: result.events?.length || 0 },
    });

    // Validate events structure
    if (!result.events || !Array.isArray(result.events)) {
      result.events = [];
    }

    // If no calendar_id set, use first available
    const defaultCalendarId = calendars?.[0]?.id;

    // Check if text mentions even/odd weeks for deterministic correction
    const textLower = text.toLowerCase();
    const mentionsEvenWeeks = textLower.includes('semaine paire') || textLower.includes('semaines paires');
    const mentionsOddWeeks = textLower.includes('semaine impaire') || textLower.includes('semaines impaires');
    const hasExplicitDate = /\d{1,2}[\/\-]\d{1,2}|\d{4}-\d{2}-\d{2}|à partir du|depuis le|le \d{1,2}/i.test(text);

    result.events = result.events.map((event: any) => {
      let processedEvent = {
        ...event,
        calendar_id: event.calendar_id || defaultCalendarId,
      };

      // Deterministic correction for even/odd weeks with BYDAY
      if (!hasExplicitDate && 
          (mentionsEvenWeeks || mentionsOddWeeks) && 
          event.recurrence_rule?.includes('INTERVAL=2') &&
          event.recurrence_rule?.includes('BYDAY=')) {
        
        // Extract BYDAY days
        const byDayMatch = event.recurrence_rule.match(/BYDAY=([A-Z,]+)/);
        if (byDayMatch) {
          const byDays = byDayMatch[1].split(',');
          const dayMap: Record<string, number> = {
            'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6
          };
          const targetDays = byDays.map((d: string) => dayMap[d]).filter((d: number | undefined) => d !== undefined);
          
          if (targetDays.length > 0) {
            // Find the next valid occurrence from today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Search up to 14 days to find the first valid occurrence
            for (let i = 0; i < 14; i++) {
              const checkDate = new Date(today);
              checkDate.setDate(today.getDate() + i);
              
              const dayOfWeek = checkDate.getDay();
              const weekNum = getWeekNumber(checkDate);
              const weekIsEven = weekNum % 2 === 0;
              
              // Check if this day matches our criteria
              const dayMatches = targetDays.includes(dayOfWeek);
              const parityMatches = mentionsEvenWeeks ? weekIsEven : !weekIsEven;
              
              if (dayMatches && parityMatches) {
                // Found the first valid occurrence
                const dateStr = checkDate.toISOString().split('T')[0];
                
                if (event.all_day) {
                  processedEvent.start_time = `${dateStr}T00:00:00`;
                  processedEvent.end_time = `${dateStr}T23:59:59`;
                } else {
                  // Preserve time from original event
                  const originalTime = event.start_time?.split('T')[1] || '09:00:00';
                  const originalEndTime = event.end_time?.split('T')[1] || '18:00:00';
                  processedEvent.start_time = `${dateStr}T${originalTime}`;
                  processedEvent.end_time = `${dateStr}T${originalEndTime}`;
                }
                
                console.log(`Corrected start_time to ${processedEvent.start_time} (first valid ${mentionsEvenWeeks ? 'even' : 'odd'} week occurrence)`);
                break;
              }
            }
          }
        }
      }

      return processedEvent;
    });

    console.log(`Generated ${result.events.length} events from text: "${text.substring(0, 50)}..."`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('calendar-ai-create', error, corsHeaders, 500);
  }
});

// Helper function to get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
