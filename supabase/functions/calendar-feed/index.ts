import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { createClient } from "@supabase/supabase-js";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')

    console.log(`[calendar-feed] Token reçu: ${token?.substring(0, 8)}...`)

    if (!token) {
      return new Response('Token manquant', { status: 400 })
    }

    // Rate-limit per IP+token (anti-abuse — calendars are polled every few minutes by clients)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = checkRateLimit(`calendar-feed:${ip}:${token.substring(0, 16)}`, { limit: 30, windowSec: 60 });
    if (!rl.allowed) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: { ...corsHeaders, 'Retry-After': String(rl.retryAfterSec ?? 60) },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Vérifier et récupérer le token (sans jointure obligatoire)
    const { data: tokenData, error: tokenError } = await supabase
      .from('calendar_feed_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single()

    if (tokenError || !tokenData) {
      console.error('[calendar-feed] Token invalide:', tokenError)
      return new Response('Token invalide', { status: 401 })
    }

    console.log(`[calendar-feed] Token trouvé: type=${tokenData.type}, id=${tokenData.id}`)

    // Vérifier l'expiration
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      console.log('[calendar-feed] Token expiré')
      return new Response('Token expiré', { status: 401 })
    }

    // Récupérer le profil utilisateur si token user
    let userProfile = null
    if (tokenData.type === 'user' && tokenData.target_user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nom, prenom, email')
        .eq('id', tokenData.target_user_id)
        .single()
      userProfile = profile
      console.log(`[calendar-feed] Profil utilisateur: ${profile?.prenom} ${profile?.nom}`)
    }

    // Mettre à jour les stats d'accès
    await supabase
      .from('calendar_feed_tokens')
      .update({ 
        last_accessed_at: new Date().toISOString(),
        access_count: tokenData.access_count + 1
      })
      .eq('id', tokenData.id)

    // Construire la requête des tâches selon le type
    let tachesQuery = supabase
      .from('taches')
      .select(`
        id, titre, description, statut, priorite, echeance, created_at, updated_at,
        etablissements(nom),
        categories_taches(nom, couleur),
        profiles!responsable_id(nom, prenom, email)
      `)
      .eq('archive', false)

    // Filtrer selon le type de token
    if (tokenData.type === 'user') {
      tachesQuery = tachesQuery.eq('responsable_id', tokenData.target_user_id)
    }
    
    // Filtrer par établissement si spécifié
    if (tokenData.etablissement_id) {
      tachesQuery = tachesQuery.eq('etablissement_id', tokenData.etablissement_id)
    }

    const { data: taches, error: tachesError } = await tachesQuery

    if (tachesError) {
      console.error('[calendar-feed] Erreur tâches:', tachesError)
      throw tachesError
    }

    // Récupérer les événements calendrier
    let calendarEvents: any[] = []
    const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 jours passés
    const dateTo = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 an futur

    if (tokenData.type === 'user' && tokenData.target_user_id) {
      // Pour un token user: récupérer les calendriers dont il est propriétaire
      const { data: userCalendars } = await supabase
        .from('calendars')
        .select('id')
        .eq('owner_id', tokenData.target_user_id)

      const calendarIds = (userCalendars || []).map(c => c.id)
      console.log(`[calendar-feed] Calendriers de l'utilisateur: ${calendarIds.length}`)

      if (calendarIds.length > 0) {
        const { data: events, error: eventsError } = await supabase
          .from('calendar_events')
          .select(`
            id, title, description, start_time, end_time, location, status,
            video_conference_url, created_at, updated_at, all_day,
            calendars(name),
            event_attendees(email, display_name, status)
          `)
          .in('calendar_id', calendarIds)
          .gte('start_time', dateFrom)
          .lte('start_time', dateTo)

        if (eventsError) {
          console.error('[calendar-feed] Erreur événements:', eventsError)
        } else {
          calendarEvents = events || []
        }
      }

      // Aussi inclure les événements créés directement par l'utilisateur (autres calendriers)
      if (calendarEvents.length === 0) {
        const { data: createdEvents, error: createdError } = await supabase
          .from('calendar_events')
          .select(`
            id, title, description, start_time, end_time, location, status,
            video_conference_url, created_at, updated_at, all_day,
            calendars(name),
            event_attendees(email, display_name, status)
          `)
          .eq('created_by', tokenData.target_user_id)
          .gte('start_time', dateFrom)
          .lte('start_time', dateTo)

        if (!createdError && createdEvents) {
          calendarEvents = createdEvents
        }
      }
    } else if (tokenData.type === 'global') {
      // Pour un token global: récupérer TOUS les événements
      const { data: events, error: eventsError } = await supabase
        .from('calendar_events')
        .select(`
          id, title, description, start_time, end_time, location, status,
          video_conference_url, created_at, updated_at, all_day,
          calendars(name),
            event_attendees(email, display_name, status)
          `)
          .gte('start_time', dateFrom)
          .lte('start_time', dateTo)
          .limit(1000)

      if (eventsError) {
        console.error('[calendar-feed] Erreur événements global:', eventsError)
      } else {
        calendarEvents = events || []
      }
    }

    console.log(`[calendar-feed] Nombre de tâches trouvées: ${taches?.length || 0}`)
    console.log(`[calendar-feed] Nombre d'événements trouvés: ${calendarEvents.length}`)

    // Générer le fichier ICS
    const ics = generateICS(taches || [], calendarEvents, tokenData, userProfile)
    
    console.log(`[calendar-feed] ICS généré: ${ics.length} caractères`)

    return new Response(ics, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="marque-${tokenData.type}.ics"`,
        'Cache-Control': 'no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function generateICS(taches: any[], events: any[], tokenData: any, userProfile: any): string {
  const calendarName = tokenData.type === 'global' 
    ? 'Tâches & Événements Marque - Équipe'
    : `Marque - ${userProfile?.prenom || 'Personnel'}`

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Marque//Calendar Feed//FR',
    `X-WR-CALNAME:${calendarName}`,
    'X-WR-TIMEZONE:Europe/Paris',
    'METHOD:PUBLISH',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    'CALSCALE:GREGORIAN',
  ]

  // Add tasks as VEVENT
  taches.forEach(tache => {
    const dtstart = tache.echeance 
      ? formatICSDate(tache.echeance)
      : formatICSDate(tache.created_at || new Date())

    const status = tache.statut === 'Terminé' ? 'COMPLETED' : 'NEEDS-ACTION'
    const priority = tache.priorite === 'high' ? '1' : tache.priorite === 'medium' ? '5' : '9'

    const description = [
      tache.description || '',
      '',
      `Établissement: ${tache.etablissements?.nom || 'N/A'}`,
      `Catégorie: ${tache.categories_taches?.nom || 'N/A'}`,
      `Statut: ${tache.statut}`,
      `Responsable: ${tache.profiles?.prenom || ''} ${tache.profiles?.nom || ''}`,
    ].join('\\n')

    ics.push(
      'BEGIN:VEVENT',
      `UID:task-${tache.id}@marque.app`,
      `DTSTAMP:${formatICSDateTime(tache.created_at)}`,
      `DTSTART;VALUE=DATE:${dtstart}`,
      `SUMMARY:[Tâche] ${escapeICS(tache.titre)}`,
      `DESCRIPTION:${escapeICS(description)}`,
      `STATUS:${status}`,
      `PRIORITY:${priority}`,
      `CATEGORIES:${escapeICS(tache.categories_taches?.nom || 'Tâche')}`,
      `LAST-MODIFIED:${formatICSDateTime(tache.updated_at)}`,
    )

    if (tache.profiles?.email) {
      ics.push(`ORGANIZER;CN=${escapeICS(tache.profiles.prenom + ' ' + tache.profiles.nom)}:mailto:${tache.profiles.email}`)
    }

    ics.push('END:VEVENT')
  })

  // Add calendar events as VEVENT
  events.forEach(event => {
    const description = event.description ? escapeICS(event.description) : ''
    
    ics.push(
      'BEGIN:VEVENT',
      `UID:event-${event.id}@marque.app`,
      `DTSTAMP:${formatICSDateTime(event.created_at)}`,
      `DTSTART:${formatICSDateTime(event.start_time)}`,
      `DTEND:${formatICSDateTime(event.end_time)}`,
      `SUMMARY:${escapeICS(event.title)}`,
    )

    if (description) {
      ics.push(`DESCRIPTION:${description}`)
    }

    if (event.location) {
      ics.push(`LOCATION:${escapeICS(event.location)}`)
    }

    if (event.video_conference_url) {
      ics.push(`URL:${event.video_conference_url}`)
      ics.push(`X-GOOGLE-CONFERENCE:${event.video_conference_url}`)
    }

    // Add attendees
    if (event.event_attendees && event.event_attendees.length > 0) {
      event.event_attendees.forEach((attendee: any) => {
        const cn = attendee.display_name ? `CN=${escapeICS(attendee.display_name)};` : ''
        const partstat = attendee.status === 'accepted' ? 'ACCEPTED' : 
                        attendee.status === 'declined' ? 'DECLINED' : 'NEEDS-ACTION'
        ics.push(`ATTENDEE;${cn}PARTSTAT=${partstat}:mailto:${attendee.email}`)
      })
    }

    ics.push(
      `STATUS:${event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
      `LAST-MODIFIED:${formatICSDateTime(event.updated_at)}`,
      'END:VEVENT'
    )
  })

  ics.push('END:VCALENDAR')
  return ics.join('\r\n')
}

function formatICSDate(date: string | Date): string {
  const d = new Date(date)
  return d.toISOString().split('T')[0].replace(/-/g, '')
}

function formatICSDateTime(date: string | Date): string {
  const d = new Date(date)
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}
