// Types pour le module de prise de RDV publique

export type VideoProvider = 'jitsi' | 'meet' | 'marque' | 'nextcloud' | 'teams' | 'zoom' | 'none';

export interface BookingType {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  color: string;
  category: 'demo' | 'formation' | 'qbr' | 'support' | 'commercial' | 'meeting';
  location_type: 'video' | 'phone' | 'in_person';
  video_provider?: VideoProvider;
  requires_approval: boolean;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_hours: number;
  max_future_days: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingAvailabilitySlot {
  id: string;
  user_id: string;
  booking_type_id: string | null;
  day_of_week: number; // 0-6, 0 = Lundi
  start_time: string; // HH:MM format
  end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookingPage {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  welcome_message: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  theme_color: string;
  default_video_provider?: VideoProvider;
  is_active: boolean;
  require_phone: boolean;
  require_company: boolean;
  custom_questions: CustomQuestion[];
  timezone: string;
  success_redirect_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomQuestion {
  id: string;
  question: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
}

export interface BookingPageType {
  id: string;
  booking_page_id: string;
  booking_type_id: string;
  order_index: number;
  is_visible: boolean;
  created_at: string;
  booking_type?: BookingType;
}

export interface BookingPageHost {
  id: string;
  booking_page_id: string;
  user_id: string;
  is_required: boolean;
  role: 'host' | 'co-host' | 'optional';
  created_at: string;
  profile?: {
    id: string;
    nom: string;
    prenom: string;
    avatar_url?: string | null;
    email?: string;
  };
}

export interface Booking {
  id: string;
  booking_type_id: string;
  booking_page_id: string | null;
  host_user_id: string;
  calendar_event_id: string | null;
  
  // Guest info
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  guest_company: string | null;
  guest_notes: string | null;
  custom_answers: Record<string, string>;
  
  // Appointment details
  start_time: string;
  end_time: string;
  timezone: string;
  location: string | null;
  video_conference_url: string | null;
  
  // Status
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  confirmation_token: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancelled_by: 'host' | 'guest' | null;
  
  // Reminders
  reminder_sent_24h: boolean;
  reminder_sent_1h: boolean;
  
  // CRM
  etablissement_id: string | null;
  tache_id: string | null;
  
  // Metadata
  source: 'booking_page' | 'direct_link' | 'embed';
  referrer: string | null;
  
  created_at: string;
  updated_at: string;
  
  // Relations
  booking_type?: BookingType;
  host?: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    avatar_url?: string;
  };
}

export interface BookingException {
  id: string;
  user_id: string;
  date: string;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_at: string;
}

export interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

export interface CreateBookingInput {
  booking_type_id: string;
  booking_page_id?: string;
  host_user_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
  guest_company?: string;
  guest_notes?: string;
  custom_answers?: Record<string, string>;
  start_time: string;
  end_time: string;
  timezone?: string;
  etablissement_id?: string;
}

export interface BookingFormData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
  customAnswers?: Record<string, string>;
}

export const VIDEO_PROVIDERS: { value: VideoProvider; label: string; icon?: string }[] = [
  { value: 'jitsi', label: 'Jitsi Meet (instantané)' },
  { value: 'meet', label: 'Google Meet' },
  { value: 'marque', label: 'OpenPulse Meet' },
  { value: 'nextcloud', label: 'Nextcloud Talk' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'none', label: 'Aucune visio (lien manuel)' },
];
