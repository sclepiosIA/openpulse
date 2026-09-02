import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { parseICS, extractEmailFromCalendarProperty, type CalendarEvent } from "../_shared/ics-parser.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { 
  parseGoogleCalendarEmail, 
  parseTeamsInvitation,
  isLikelyCalendarInvitation, 
  isTeamsInvitation,
  type GoogleCalendarEvent 
} from "../_shared/google-calendar-parser.ts";
import { sanitizeForAI, wrapUserContent } from "../_shared/security-utils.ts";

const FUNCTION_NAME = 'detect-calendar-invitations';

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-function-secret;

/**
 * Detect video conference provider from URL
 */
function detectVideoProvider(url: string): string | null {
  if (url.includes('meet.google.com')) return 'google_meet';
  if (url.includes('teams.microsoft.com')) return 'teams';
  if (url.includes('zoom.us')) return 'zoom';
  if (url.includes('webex.com')) return 'webex';
  if (url.includes('whereby.com')) return 'whereby';
  return null;
}

/**
 * Extract meeting link from body
 */
function extractMeetingLink(body: string): string | null {
  // Google Meet
  const meetMatch = body.match(/https:\/\/meet\.google\.com\/[a-z-]+/i);
  if (meetMatch) return meetMatch[0];
  
  // Microsoft Teams
  const teamsMatch = body.match(/https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"]+/i);
  if (teamsMatch) return teamsMatch[0];
  
  // Zoom
  const zoomMatch = body.match(/https:\/\/[a-z]+\.zoom\.us\/[^\s<>"]+/i);
  if (zoomMatch) return zoomMatch[0];
  
  // Webex
  const webexMatch = body.match(/https:\/\/[a-z]+\.webex\.com\/[^\s<>"]+/i);
  if (webexMatch) return webexMatch[0];
  
  return null;
}

/**
 * Extract attendees from email body text
 */
function extractAttendeesFromBody(body: string): Array<{email: string; name?: string}> {
  const attendees: Array<{email: string; name?: string}> = [];
  
  // Pattern: email addresses in the body
  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const matches = body.match(emailPattern);
  
  if (matches) {
    const uniqueEmails = [...new Set(matches)].filter(email => 
      !email.includes('noreply') && 
      !email.includes('no-reply') && 
      !email.includes('calendar-notification') &&
      !email.includes('calendar.google.com') &&
      !email.includes('resource.calendar.google.com')
    );
    
    for (const email of uniqueEmails.slice(0, 20)) {
      attendees.push({ email });
    }
  }
  
  return attendees;
}

/**
 * Generate thread summary using GPT-5 Azure
 */
async function generateThreadSummary(
  supabase: any,
  threadId: string,
  subject: string
): Promise<string | null> {
  const AZURE_OPENAI_ENDPOINT = Deno.env.get("AZURE_OPENAI_ENDPOINT");
  const AZURE_OPENAI_API_KEY = Deno.env.get("AZURE_OPENAI_API_KEY");
  
  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
    console.log('[detect-calendar] Azure OpenAI not configured, skipping summary');
    return null;
  }
  
  try {
    // Fetch last 5 messages of the thread
    const { data: messages, error } = await supabase
      .from('email_messages')
      .select('from_address, from_name, body_text, sent_date')
      .eq('thread_id', threadId)
      .order('sent_date', { ascending: false })
      .limit(5);
    
    if (error || !messages || messages.length === 0) {
      return null;
    }
    
    const messagesText = messages.reverse().map((m: any) => 
      `De: ${m.from_name || m.from_address}\n${(m.body_text || '').substring(0, 500)}`
    ).join('\n\n---\n\n');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // Standard 90s timeout
    
    // SECURITY: Sanitize email content before AI processing
    const sanitizedSubject = sanitizeForAI(subject, { maxLength: 500, functionName: FUNCTION_NAME });
    const sanitizedMessages = sanitizeForAI(messagesText, { maxLength: 3000, functionName: FUNCTION_NAME });
    
    const response = await fetch(AZURE_OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "Tu es un assistant qui résume les échanges emails. Génère un résumé court (2-3 phrases max) du contexte des échanges pour une réunion à venir. Réponds uniquement avec le résumé, sans introduction."
          },
          {
            role: "user",
            content: `Sujet: ${sanitizedSubject}\n\nÉchanges:\n${wrapUserContent(sanitizedMessages, 'EMAIL_EXCHANGES')}`
          }
        ],
        max_completion_tokens: 200,
        reasoning_effort: "low",
        verbosity: "low"
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('[detect-calendar] Azure API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
    
  } catch (err) {
    console.error('[detect-calendar] Error generating summary:', err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { message_id } = await req.json();

    if (!message_id) {
      return new Response(
        JSON.stringify({ error: "message_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[detect-calendar] Processing message: ${message_id}`);

    // 1. Fetch message with thread and attachments
    const { data: message, error: fetchError } = await supabase
      .from('email_messages')
      .select(`
        *,
        thread:email_threads!inner(
          id,
          subject,
          etablissement_id,
          user_email_account_id
        )
      `)
      .eq('id', message_id)
      .single();

    if (fetchError || !message) {
      console.error('[detect-calendar] Message not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Message not found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Detect calendar invitations
    const invitations: CalendarEvent[] = [];
    let teamsInvitationWithoutDate = null;

    // 2.1 Check for .ics attachments
    const { data: attachments } = await supabase
      .from('email_attachments')
      .select('id, message_id, filename, mime_type, storage_bucket, storage_path, size_bytes')
      .eq('message_id', message_id);

    if (attachments) {
      for (const att of attachments) {
        if (att.mime_type === 'text/calendar' || att.filename.toLowerCase().endsWith('.ics')) {
          try {
            // Download attachment from storage
            const { data: fileData } = await supabase.storage
              .from(att.storage_bucket)
              .download(att.storage_path);

            if (fileData) {
              const icsContent = await fileData.text();
              const events = parseICS(icsContent);
              invitations.push(...events);
              console.log(`[detect-calendar] Found ${events.length} event(s) in attachment: ${att.filename}`);
            }
          } catch (err) {
            console.error(`[detect-calendar] Error parsing attachment ${att.filename}:`, err);
          }
        }
      }
    }

    // 2.2 Check for inline calendar data in body (ICS format)
    if (message.body_text?.includes('BEGIN:VCALENDAR')) {
      try {
        const events = parseICS(message.body_text);
        invitations.push(...events);
        console.log(`[detect-calendar] Found ${events.length} event(s) in body_text (ICS)`);
      } catch (err) {
        console.error('[detect-calendar] Error parsing body_text ICS:', err);
      }
    }

    if (message.body_html?.includes('BEGIN:VCALENDAR')) {
      try {
        const events = parseICS(message.body_html);
        invitations.push(...events);
        console.log(`[detect-calendar] Found ${events.length} event(s) in body_html (ICS)`);
      } catch (err) {
        console.error('[detect-calendar] Error parsing body_html ICS:', err);
      }
    }

    // 2.3 Parse Google Calendar / Teams invitation emails (text-based)
    if (invitations.length === 0) {
      const subject = message.subject || message.thread?.subject || '';
      const bodyText = message.body_text || '';
      
      // First try Google Calendar format (has date in body)
      if (isLikelyCalendarInvitation(subject, bodyText)) {
        console.log(`[detect-calendar] Detected likely calendar invitation email, parsing...`);
        
        const googleEvent = parseGoogleCalendarEmail(subject, bodyText, message.from_address);
        
        if (googleEvent) {
          console.log(`[detect-calendar] ✅ Parsed Google Calendar event: ${googleEvent.summary}`);
          invitations.push({
            uid: googleEvent.uid,
            summary: googleEvent.summary,
            dtstart: googleEvent.dtstart,
            dtend: googleEvent.dtend,
            location: googleEvent.location,
            description: googleEvent.description,
            organizer: googleEvent.organizer,
            attendees: googleEvent.attendees,
            meetingLink: googleEvent.meetingLink,
          });
        } else {
          console.log(`[detect-calendar] Could not parse calendar event from email text`);
        }
      }
      
      // 2.4 Handle Teams invitations WITHOUT date
      if (invitations.length === 0 && isTeamsInvitation(bodyText)) {
        console.log(`[detect-calendar] Detected Teams invitation without parseable date`);
        
        const teamsInfo = parseTeamsInvitation(subject, bodyText, message.from_address);
        
        if (teamsInfo && !teamsInfo.hasDateInfo) {
          console.log(`[detect-calendar] 📹 Teams meeting detected: ${teamsInfo.summary}`);
          teamsInvitationWithoutDate = teamsInfo;
        }
      }
    }

    // Get "Réunion" category
    const { data: category } = await supabase
      .from('categories_taches')
      .select('id')
      .eq('nom', 'Réunion')
      .single();

    if (!category) {
      console.error('[detect-calendar] Category "Réunion" not found');
      return new Response(
        JSON.stringify({ error: 'Category "Réunion" not found' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Handle Teams invitation without date - create task with meeting link
    if (teamsInvitationWithoutDate && message.thread.etablissement_id) {
      console.log(`[detect-calendar] Creating task for Teams meeting without date...`);
      
      // Check for duplicate (same meeting link)
      const { data: existing } = await supabase
        .from('taches')
        .select('id')
        .eq('etablissement_id', message.thread.etablissement_id)
        .ilike('description', `%${teamsInvitationWithoutDate.meetingLink}%`)
        .limit(1);

      if (!existing || existing.length === 0) {
        // Create task with deadline 7 days from now (placeholder)
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 7);
        
        const descriptionParts = [
          `📹 Réunion Microsoft Teams`,
          ``,
          teamsInvitationWithoutDate.description,
          ``,
          `⚠️ Date de la réunion à vérifier dans l'invitation originale`,
          ``,
          `📧 Email: ${message.thread.subject}`,
          `👤 De: ${teamsInvitationWithoutDate.organizer}`
        ];

        const tache = {
          titre: `Réunion Teams: ${teamsInvitationWithoutDate.summary}`.substring(0, 255),
          description: descriptionParts.join('\n'),
          etablissement_id: message.thread.etablissement_id,
          categorie_id: category.id,
          priorite: 'medium',
          echeance: deadline.toISOString().split('T')[0],
          statut: 'A faire',
          archive: false
        };

        const { data: newTask, error: createError } = await supabase
          .from('taches')
          .insert(tache)
          .select()
          .single();

        if (createError) {
          console.error('[detect-calendar] Error creating Teams task:', createError);
        } else {
          console.log(`[detect-calendar] ✅ Teams task created: ${newTask.titre}`);
          return new Response(
            JSON.stringify({
              success: true,
              invitations: 1,
              created: 1,
              skipped: 0,
              teamsWithoutDate: true,
              details: { created: [newTask], skipped: [] }
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        console.log(`[detect-calendar] Teams meeting task already exists`);
      }
    }

    if (invitations.length === 0 && !teamsInvitationWithoutDate) {
      console.log('[detect-calendar] No calendar invitations found');
      return new Response(
        JSON.stringify({ success: true, invitations: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[detect-calendar] Total invitations found: ${invitations.length}`);

    // 4. Create tasks or suggestions for valid invitations
    const created = [];
    const skipped = [];

    for (const event of invitations) {
      // Validation
      if (!event.summary || !event.dtstart) {
        skipped.push({ event, reason: 'missing_required_fields' });
        continue;
      }

      const eventDate = new Date(event.dtstart);
      if (eventDate < new Date()) {
        skipped.push({ event, reason: 'event_in_past' });
        continue;
      }

      // Extract meeting link from event or body
      const meetingLink = (event as any).meetingLink || 
                          extractMeetingLink(event.description || '') ||
                          extractMeetingLink(message.body_text || '') ||
                          extractMeetingLink(message.body_html || '');

      // Extract attendees
      const attendees = event.attendees?.map(a => typeof a === 'string' ? { email: a } : a) || 
                        extractAttendeesFromBody(message.body_text || '');

      // Generate thread summary (async but don't wait for all)
      let threadSummary: string | null = null;
      if (meetingLink) {
        threadSummary = await generateThreadSummary(
          supabase, 
          message.thread.id, 
          message.thread.subject
        );
      }

      // Check if thread is linked to an establishment
      if (!message.thread.etablissement_id) {
        // Check if a pending suggestion already exists for same event (summary + dtstart)
        const { data: existingSuggestion } = await supabase
          .from('calendar_invitation_suggestions')
          .select('id')
          .eq('event_summary', event.summary)
          .eq('event_dtstart', event.dtstart)
          .eq('status', 'pending_etablissement')
          .limit(1)
          .maybeSingle();

        const suggestionData = {
          email_thread_id: message.thread.id,
          calendar_uid: event.uid,
          event_summary: event.summary,
          event_dtstart: event.dtstart,
          event_dtend: event.dtend,
          event_location: event.location,
          event_description: event.description,
          event_organizer: event.organizer,
          event_meeting_link: meetingLink,
          event_attendees: attendees,
          thread_summary: threadSummary,
          status: 'pending_etablissement'
        };

        let suggestionError;
        if (existingSuggestion) {
          // Update existing suggestion instead of creating a duplicate
          const { error } = await supabase
            .from('calendar_invitation_suggestions')
            .update(suggestionData)
            .eq('id', existingSuggestion.id);
          suggestionError = error;
          if (!error) {
            console.log(`[detect-calendar] 🔄 Updated existing suggestion for: ${event.summary}`);
          }
        } else {
          // Create new suggestion
          const { error } = await supabase
            .from('calendar_invitation_suggestions')
            .insert(suggestionData);
          suggestionError = error;
          if (!error) {
            console.log(`[detect-calendar] 📋 Created enriched suggestion for: ${event.summary}${meetingLink ? ' (with meeting link)' : ''}`);
          }
        }
        
        if (suggestionError) {
          console.error('[detect-calendar] Error creating/updating suggestion:', suggestionError);
        }
        skipped.push({ event, reason: 'no_etablissement' });
        continue;
      }

      // Check for duplicate (same UID)
      const { data: existing } = await supabase
        .from('taches')
        .select('id')
        .eq('etablissement_id', message.thread.etablissement_id)
        .ilike('description', `%UID:${event.uid}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        skipped.push({ event, reason: 'already_exists' });
        continue;
      }

      // Build task description
      const descriptionParts = [];
      
      if (meetingLink) {
        const provider = detectVideoProvider(meetingLink);
        const providerLabel = provider === 'google_meet' ? 'Google Meet' :
                             provider === 'teams' ? 'Microsoft Teams' :
                             provider === 'zoom' ? 'Zoom' : 'Visio';
        descriptionParts.push(`📹 ${providerLabel}: ${meetingLink}`);
      }
      
      if (event.description) {
        descriptionParts.push(event.description.substring(0, 500));
      }
      
      if (event.location && event.location !== meetingLink) {
        descriptionParts.push(`\n📍 Lieu: ${event.location}`);
      }
      
      if (event.organizer) {
        const email = extractEmailFromCalendarProperty(event.organizer);
        descriptionParts.push(`\n👤 Organisateur: ${email || event.organizer}`);
      }
      
      if (attendees && attendees.length > 0) {
        descriptionParts.push(`\n👥 Participants: ${attendees.map(a => a.email).join(', ')}`);
      }
      
      if (event.dtend) {
        const start = new Date(event.dtstart);
        const end = new Date(event.dtend);
        const duration = Math.round((end.getTime() - start.getTime()) / 60000);
        descriptionParts.push(`\n⏱️ Durée: ${duration} minutes`);
      }
      
      descriptionParts.push(`\n\n🔗 UID: ${event.uid}`);
      descriptionParts.push(`\nCréé automatiquement depuis: ${message.thread.subject}`);

      // Create task
      const tache = {
        titre: event.summary.substring(0, 255),
        description: descriptionParts.join(''),
        etablissement_id: message.thread.etablissement_id,
        categorie_id: category.id,
        priorite: 'medium',
        echeance: event.dtstart.split('T')[0], // Format YYYY-MM-DD
        statut: 'A faire',
        archive: false
      };

      const { data: newTask, error: createError } = await supabase
        .from('taches')
        .insert(tache)
        .select()
        .single();

      if (createError) {
        console.error('[detect-calendar] Error creating task:', createError);
        skipped.push({ event, reason: 'creation_failed', error: createError.message });
      } else {
        created.push(newTask);
        console.log(`[detect-calendar] ✅ Task created: ${newTask.titre}`);
        
        // Send push notification for calendar task
        try {
          const { data: accountData } = await supabase
            .from('user_email_accounts')
            .select('profile_id')
            .eq('id', message.thread.user_email_account_id)
            .single();
          
          if (accountData?.profile_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('user_id')
              .eq('id', accountData.profile_id)
              .single();
            
            if (profileData?.user_id) {
              await fetch(
                `${supabaseUrl}/functions/v1/send-push-notification`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                  body: JSON.stringify({
                    user_id: profileData.user_id,
                    title: meetingLink ? '📹 Invitation visio' : '📅 Invitation calendrier',
                    body: `Nouvelle réunion: ${event.summary}`,
                    url: `/etablissements/${message.thread.etablissement_id}`,
                    type: 'calendar',
                    related_id: newTask.id,
                    tag: 'calendar-invitation'
                  }),
                }
              );
              console.log('[detect-calendar] Push notification sent');
            }
          }
        } catch (pushErr) {
          console.error('[detect-calendar] Push notification failed:', pushErr);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        invitations: invitations.length,
        created: created.length,
        skipped: skipped.length,
        details: { created, skipped }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('detect-calendar-invitations', error, corsHeaders, 500);
  }
});
