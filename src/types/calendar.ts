// Types pour le module Calendrier

export interface Calendar {
  id: string
  owner_id: string
  name: string
  description: string | null
  color: string
  type: 'personal' | 'team' | 'establishment' | 'absences' | 'shared'
  is_default: boolean
  is_visible: boolean
  timezone: string
  created_at: string
  updated_at: string
}

export interface CalendarEvent {
  id: string
  calendar_id: string
  title: string
  description: string | null
  location: string | null
  video_conference_url: string | null
  start_time: string
  end_time: string
  all_day: boolean
  status: 'confirmed' | 'tentative' | 'cancelled'
  visibility: 'public' | 'private' | 'default'
  recurrence_rule: string | null
  recurrence_parent_id: string | null
  recurrence_exception_dates: string[] | null
  etablissement_id: string | null
  tache_id: string | null
  color: string | null
  category_id?: string | null
  display_as_banner?: boolean
  availability?: 'busy' | 'free'
  created_by: string | null
  created_at: string
  updated_at: string
  // Relations jointes
  calendar?: Calendar
  attendees?: EventAttendee[]
  reminders?: EventReminder[]
}

export interface EventAttendee {
  id: string
  event_id: string
  user_id: string | null
  email: string
  display_name: string | null
  role: 'organizer' | 'required' | 'optional'
  status: 'pending' | 'accepted' | 'declined' | 'tentative'
  responded_at: string | null
  created_at: string
}

export interface EventReminder {
  id: string
  event_id: string
  user_id: string
  minutes_before: number
  type: 'notification' | 'email' | 'push'
  is_sent: boolean
  sent_at: string | null
  created_at: string
}

export interface CalendarShare {
  id: string
  calendar_id: string
  shared_with_user_id: string | null
  shared_with_email: string | null
  permission: 'read' | 'write' | 'admin'
  created_by: string | null
  created_at: string
}

// Types pour les mutations
export interface CreateCalendarInput {
  name: string
  description?: string
  color?: string
  type?: Calendar['type']
  is_default?: boolean
  timezone?: string
}

export interface UpdateCalendarInput {
  name?: string
  description?: string | null
  color?: string
  is_visible?: boolean
  timezone?: string
}

export interface CreateEventInput {
  calendar_id: string
  title: string
  description?: string
  location?: string
  video_conference_url?: string
  start_time: string
  end_time: string
  all_day?: boolean
  status?: CalendarEvent['status']
  visibility?: CalendarEvent['visibility']
  recurrence_rule?: string
  etablissement_id?: string
  tache_id?: string
  color?: string
  category_id?: string | null
  display_as_banner?: boolean
  availability?: 'busy' | 'free'
}

export interface UpdateEventInput {
  title?: string
  description?: string | null
  location?: string | null
  video_conference_url?: string | null
  start_time?: string
  end_time?: string
  all_day?: boolean
  status?: CalendarEvent['status']
  visibility?: CalendarEvent['visibility']
  recurrence_rule?: string | null
  color?: string | null
  category_id?: string | null
  display_as_banner?: boolean
  availability?: 'busy' | 'free'
}

export const AVAILABILITY_LABELS: Record<'busy' | 'free', string> = {
  busy: 'Occupé',
  free: 'Disponible pour des réunions',
}

export interface CreateAttendeeInput {
  event_id: string
  user_id?: string
  email: string
  display_name?: string
  role?: EventAttendee['role']
}

export interface UpdateAttendeeInput {
  status?: EventAttendee['status']
  role?: EventAttendee['role']
}

// Type pour les invités sélectionnés dans le formulaire
export interface SelectedAttendee {
  email: string
  displayName: string
  userId?: string
  role: 'required' | 'optional'
}

export interface CreateReminderInput {
  event_id: string
  minutes_before: number
  type?: EventReminder['type']
}

export interface CreateShareInput {
  calendar_id: string
  shared_with_user_id?: string
  shared_with_email?: string
  permission?: CalendarShare['permission']
}

// Constantes utiles
export const REMINDER_OPTIONS = [
  { value: 0, label: "Au moment de l'événement" },
  { value: 5, label: '5 minutes avant' },
  { value: 15, label: '15 minutes avant' },
  { value: 30, label: '30 minutes avant' },
  { value: 60, label: '1 heure avant' },
  { value: 120, label: '2 heures avant' },
  { value: 1440, label: '1 jour avant' },
  { value: 10080, label: '1 semaine avant' },
]

export const CALENDAR_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
]

export const EVENT_STATUS_LABELS: Record<CalendarEvent['status'], string> = {
  confirmed: 'Confirmé',
  tentative: 'Provisoire',
  cancelled: 'Annulé',
}

export const ATTENDEE_STATUS_LABELS: Record<EventAttendee['status'], string> = {
  pending: 'En attente',
  accepted: 'Accepté',
  declined: 'Refusé',
  tentative: 'Peut-être',
}

export const ATTENDEE_ROLE_LABELS: Record<EventAttendee['role'], string> = {
  organizer: 'Organisateur',
  required: 'Requis',
  optional: 'Optionnel',
}

// Types pour les providers de visioconférence
export type VideoProvider =
  | 'none'
  | 'marque'
  | 'meet'
  | 'teams'
  | 'zoom'
  | 'jitsi'
  | 'nextcloud'
  | 'custom'

export interface VideoProviderConfig {
  id: VideoProvider
  name: string
  icon: 'VideoOff' | 'Video' | 'Users' | 'MessageSquare' | 'Link' | 'Heart'
  color: string
  generateLink: (roomId: string) => string
  requiresOAuth: boolean
  oauthProvider?: 'google' | 'microsoft' | 'zoom'
  description?: string
  isInstant: boolean
}

/**
 * Create VIDEO_PROVIDERS with configurable infrastructure URLs.
 * Call this with URLs from useInfraUrls() at the component level.
 */
export const createVideoProviders = (infraUrls?: {
  jitsi_url?: string
  nextcloud_url?: string
}): VideoProviderConfig[] => {
  const jitsiBase = infraUrls?.jitsi_url || ''
  const nextcloudBase = infraUrls?.nextcloud_url || ''

  return [
    {
      id: 'none',
      name: 'Aucune',
      icon: 'VideoOff',
      color: '#6B7280',
      generateLink: () => '',
      requiresOAuth: false,
      isInstant: false,
    },
    {
      id: 'marque',
      name: 'OpenPulse Meet',
      icon: 'Heart',
      color: '#10B981',
      generateLink: (roomCode) => `/visio/${roomCode}`,
      requiresOAuth: false,
      isInstant: true,
      description: 'Visio interne sécurisée',
    },
    {
      id: 'jitsi',
      name: 'Jitsi Meet',
      icon: 'Video',
      color: '#17A3DB',
      generateLink: (roomId) => (jitsiBase ? `${jitsiBase}/${roomId}` : ''),
      requiresOAuth: false,
      isInstant: true,
      description: 'Lien instantané, sans inscription',
    },
    {
      id: 'meet',
      name: 'Google Meet',
      icon: 'Video',
      color: '#00897B',
      generateLink: () => '', // Généré via OAuth
      requiresOAuth: true,
      oauthProvider: 'google',
      isInstant: false,
      description: 'Connexion Google requise',
    },
    {
      id: 'teams',
      name: 'Microsoft Teams',
      icon: 'Users',
      color: '#6264A7',
      generateLink: () => '', // Généré via OAuth
      requiresOAuth: true,
      oauthProvider: 'microsoft',
      isInstant: false,
      description: 'Connexion Microsoft 365 requise',
    },
    {
      id: 'zoom',
      name: 'Zoom',
      icon: 'Video',
      color: '#2D8CFF',
      generateLink: () => '', // Généré via OAuth
      requiresOAuth: true,
      oauthProvider: 'zoom',
      isInstant: false,
      description: 'Connexion Zoom requise',
    },
    {
      id: 'nextcloud',
      name: 'Nextcloud Talk',
      icon: 'MessageSquare',
      color: '#0082C9',
      generateLink: (roomId) => (nextcloudBase ? `${nextcloudBase}/call/${roomId}` : ''),
      requiresOAuth: false,
      isInstant: false,
      description: 'Configuration requise',
    },
    {
      id: 'custom',
      name: 'Lien personnalisé',
      icon: 'Link',
      color: '#9CA3AF',
      generateLink: (url) => url,
      requiresOAuth: false,
      isInstant: false,
    },
  ]
}

/** Default VIDEO_PROVIDERS using fallback URLs (for backward compatibility) */
export const VIDEO_PROVIDERS: VideoProviderConfig[] = createVideoProviders()

// Détecter le provider depuis une URL existante
export const detectProviderFromUrl = (url: string): VideoProvider => {
  if (!url) return 'none'
  if (url.includes('/visio/')) return 'marque'
  if (url.includes('meet.google.com')) return 'meet'
  if (url.includes('teams.microsoft.com')) return 'teams'
  if (url.includes('zoom.us')) return 'zoom'
  if (url.includes('meet.jit.si') || url.includes('jitsi'))
    return 'jitsi'
  if (url.includes('nextcloud') || url.includes('/call/')) return 'nextcloud'
  return 'custom'
}

// Générer un ID de salle unique
export const generateRoomId = (eventTitle: string): string => {
  const slug = eventTitle
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 15)
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  return slug ? `${slug}-${randomSuffix}` : randomSuffix
}
