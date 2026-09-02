import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

import { debug } from '@/lib/debug';

import type {
  BookingType,
  BookingPage,
  BookingAvailabilitySlot,
  Booking,
  BookingException,
  CreateBookingInput,
  TimeSlot,
} from '@/types/booking';
import { format } from 'date-fns';

import type { Database as _DB } from '@/integrations/supabase/types';
type BookingPageInsert = _DB['public']['Tables']['booking_pages']['Insert'];
type BookingPageUpdate = _DB['public']['Tables']['booking_pages']['Update'];
type BookingTypeInsert = _DB['public']['Tables']['booking_types']['Insert'];
type BookingTypeUpdate = _DB['public']['Tables']['booking_types']['Update'];
type BookingSlotInsert = _DB['public']['Tables']['booking_availability_slots']['Insert'];
type BookingExceptionInsert = _DB['public']['Tables']['booking_exceptions']['Insert'];
type BookingPageTypeInsert = _DB['public']['Tables']['booking_page_types']['Insert'];
type BookingPageTypeUpdate = _DB['public']['Tables']['booking_page_types']['Update'];
type BookingPageHostInsert = _DB['public']['Tables']['booking_page_hosts']['Insert'];
type BookingPageHostUpdate = _DB['public']['Tables']['booking_page_hosts']['Update'];

// =====================================================
// BOOKING TYPES
// =====================================================

export function useBookingTypes(activeOnly = true) {
  return useQuery({
    queryKey: ['booking-types', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('booking_types')
        .select('id, name, description, duration_minutes, category, color, location_type, video_provider, is_active, requires_approval, min_notice_hours, max_future_days, buffer_before_minutes, buffer_after_minutes, created_by, created_at, updated_at')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as BookingType[];
    }
  });
}

export function useCreateBookingType() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  /** Type pour création d'un type de booking */
  interface BookingTypeInsert {
    name: string;
    duration_minutes?: number;
    category?: string;
    description?: string | null;
    color?: string | null;
    location_type?: string | null;
    video_provider?: string | null;
    buffer_before_minutes?: number | null;
    buffer_after_minutes?: number | null;
    min_notice_hours?: number | null;
    max_future_days?: number | null;
    requires_approval?: boolean | null;
    is_active?: boolean | null;
    created_by?: string | null;
  }

  return useMutation({
    mutationFn: async (input: Partial<BookingType>) => {
      const insertData: BookingTypeInsert = {
        name: input.name || 'Nouveau RDV',
        duration_minutes: input.duration_minutes,
        category: input.category,
        description: input.description,
        color: input.color,
        location_type: input.location_type,
        video_provider: input.video_provider,
        buffer_before_minutes: input.buffer_before_minutes,
        buffer_after_minutes: input.buffer_after_minutes,
        min_notice_hours: input.min_notice_hours,
        max_future_days: input.max_future_days,
        requires_approval: input.requires_approval,
        is_active: input.is_active,
        created_by: user?.id,
      };

      const { data, error } = await supabase
        .from('booking_types')
        .insert(insertData)
        .select('id, name, description, duration_minutes, category, color, location_type, video_provider, is_active, requires_approval, min_notice_hours, max_future_days, buffer_before_minutes, buffer_after_minutes, created_by, created_at, updated_at')
        .single(); // safe: guaranteed-row

      if (error) throw error;
      return data as BookingType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-types'] });
      toast.success('Type de RDV créé');
    },
    onError: (error) => {
      toast.error('Erreur lors de la création');
      debug.error('Error creating booking:', error);
    }
  });
}

export function useUpdateBookingType() {
  const queryClient = useQueryClient();

  /** Type pour mise à jour d'un type de booking */
  type BookingTypeUpdate = Partial<Omit<BookingType, 'id' | 'created_at' | 'updated_at' | 'created_by'>>;

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BookingType> & { id: string }) => {
      const updateData: BookingTypeUpdate = {
        name: updates.name,
        duration_minutes: updates.duration_minutes,
        category: updates.category,
        description: updates.description,
        color: updates.color,
        location_type: updates.location_type,
        video_provider: updates.video_provider,
        buffer_before_minutes: updates.buffer_before_minutes,
        buffer_after_minutes: updates.buffer_after_minutes,
        min_notice_hours: updates.min_notice_hours,
        max_future_days: updates.max_future_days,
        requires_approval: updates.requires_approval,
        is_active: updates.is_active,
      };
      
      // Supprimer les clés undefined
      const cleanedData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== undefined)
      );

      const { data, error } = await supabase
        .from('booking_types')
        .update(cleanedData as never)
        .eq('id', id)
        .select('id, name, description, duration_minutes, category, color, location_type, video_provider, is_active, requires_approval, min_notice_hours, max_future_days, buffer_before_minutes, buffer_after_minutes, created_by, created_at, updated_at')
        .single(); // safe: guaranteed-row

      if (error) throw error;
      return data as BookingType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-types'] });
      toast.success('Type de RDV mis à jour');
    }
  });
}

// =====================================================
// BOOKING PAGES
// =====================================================

export function useBookingPages() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['booking-pages', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('booking_pages')
        .select('id, title, slug, description, user_id, is_active, theme_color, logo_url, cover_image_url, welcome_message, timezone, default_video_provider, require_phone, require_company, custom_questions, success_redirect_url, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(page => ({
        ...page,
        custom_questions: Array.isArray(page.custom_questions) ? page.custom_questions : []
      })) as unknown as BookingPage[];
    },
    enabled: !!user?.id
  });
}

export function useBookingPageBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['booking-page', slug],
    queryFn: async () => {
      if (!slug) return null;

      // Public-safe path: call edge function proxy that does NOT leak user_id.
      const { data, error } = await supabase.functions.invoke('public-booking-proxy', {
        body: { action: 'get_page', slug },
      });
      if (error) throw error;
      const page = (data as { page?: Record<string, unknown> & { host_token?: string; custom_questions?: unknown[] } } | null)?.page;
      if (!page) return null;

      return {
        ...page,
        custom_questions: Array.isArray(page.custom_questions) ? page.custom_questions : [],
        // Opaque token used as a stable key for slot fetching (no real user_id leaked)
        user_id: page.host_token,
      } as unknown as BookingPage & {
        booking_types: BookingType[];
        host: { nom: string; prenom: string; avatar_url: string | null } | null;
        hosts: { is_required: boolean; role: string }[];
      };
    },
    enabled: !!slug,
  });
}

export function useCreateBookingPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: Partial<BookingPage>) => {
      const { data, error } = await supabase
        .from('booking_pages')
        .insert({
          ...input,
          user_id: user?.id,
          custom_questions: JSON.stringify(input.custom_questions || [])
        } as unknown as BookingPageInsert)
        .select('id, title, slug, description, user_id, is_active, theme_color, logo_url, cover_image_url, welcome_message, timezone, default_video_provider, require_phone, require_company, custom_questions, success_redirect_url, created_at, updated_at')
        .single(); // safe: guaranteed-row

      if (error) throw error;
      return data as unknown as BookingPage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-pages'] });
      toast.success('Page de réservation créée');
    },
    onError: (error: Error & { code?: string }) => {
      if (error.code === '23505') {
        toast.error('Ce slug est déjà utilisé');
      } else {
        toast.error('Erreur lors de la création');
      }
    }
  });
}

export function useUpdateBookingPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BookingPage> & { id: string }) => {
      // Préparation des données avec sérialisation des questions personnalisées
      const updatePayload: Record<string, unknown> = { ...updates };
      if (updates.custom_questions) {
        updatePayload.custom_questions = JSON.stringify(updates.custom_questions);
      }

      const { data, error } = await supabase
        .from('booking_pages')
        .update(updatePayload as never)
        .eq('id', id)
        .select('id, title, slug, description, user_id, is_active, theme_color, logo_url, cover_image_url, welcome_message, timezone, default_video_provider, require_phone, require_company, custom_questions, success_redirect_url, created_at, updated_at')
        .single(); // safe: guaranteed-row

      if (error) throw error;
      return data as unknown as BookingPage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-pages'] });
      toast.success('Page mise à jour');
    }
  });
}

// =====================================================
// AVAILABILITY SLOTS
// =====================================================

export function useBookingAvailabilitySlots(userId?: string) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: ['booking-availability-slots', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      
      const { data, error } = await supabase
        .from('booking_availability_slots')
        .select('id, user_id, booking_type_id, day_of_week, start_time, end_time, is_active, created_at, updated_at')
        .eq('user_id', targetUserId)
        .eq('is_active', true)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as BookingAvailabilitySlot[];
    },
    enabled: !!targetUserId
  });
}

export function useCreateAvailabilitySlot() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: Partial<BookingAvailabilitySlot>) => {
      const { data, error } = await supabase
        .from('booking_availability_slots')
        .insert({
          ...input,
          user_id: user?.id
        } as unknown as BookingSlotInsert)
        .select('id, user_id, booking_type_id, day_of_week, start_time, end_time, is_active, created_at, updated_at')
        .single(); // safe: guaranteed-row

      if (error) throw error;
      return data as unknown as BookingAvailabilitySlot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-availability-slots'] });
      toast.success('Créneau ajouté');
    }
  });
}

export function useDeleteAvailabilitySlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('booking_availability_slots')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-availability-slots'] });
      toast.success('Créneau supprimé');
    }
  });
}

// =====================================================
// BOOKING EXCEPTIONS
// =====================================================

export function useBookingExceptions(userId?: string, startDate?: string, endDate?: string) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: ['booking-exceptions', targetUserId, startDate, endDate],
    queryFn: async () => {
      if (!targetUserId) return [];
      
      let query = supabase
        .from('booking_exceptions')
        .select('id, user_id, date, start_time, end_time, is_available, reason, created_at')
        .eq('user_id', targetUserId);

      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query.order('date', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as BookingException[];
    },
    enabled: !!targetUserId
  });
}

export function useCreateBookingException() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: Partial<BookingException>) => {
      const { data, error } = await supabase
        .from('booking_exceptions')
        .insert({
          ...input,
          user_id: user?.id
        } as unknown as BookingExceptionInsert)
        .select('id, user_id, date, start_time, end_time, is_available, reason, created_at')
        // safe: guaranteed-row
        .single();

      if (error) throw error;
      return data as unknown as BookingException;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-exceptions'] });
      toast.success('Exception ajoutée');
    }
  });
}

// =====================================================
// BOOKINGS
// =====================================================

export function useBookings(status?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['bookings', user?.id, status],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('bookings')
        .select(`
          id, booking_type_id, host_user_id, start_time, end_time, guest_name, guest_email, guest_phone, guest_company, guest_notes, status, booking_page_id, etablissement_id, calendar_event_id, tache_id, location, video_conference_url, custom_answers, timezone, source, referrer, confirmation_token, confirmed_at, cancelled_at, cancelled_by, cancellation_reason, reminder_sent_24h, reminder_sent_1h, created_at, updated_at,
          booking_type:booking_types(id, name, duration_minutes, category, color, location_type),
          etablissements(id, nom)
        `)
        .eq('host_user_id', user.id)
        .order('start_time', { ascending: true });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as (Booking & { etablissements?: { id: string; nom: string } })[];
    },
    enabled: !!user?.id
  });
}

export function useUpcomingBookings(limit = 10) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['upcoming-bookings', user?.id, limit],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, booking_type_id, host_user_id, start_time, end_time, guest_name, guest_email, guest_phone, guest_company, guest_notes, status, booking_page_id, etablissement_id, location, video_conference_url, custom_answers, timezone, confirmed_at, cancelled_at, created_at, updated_at,
          booking_type:booking_types(id, name, duration_minutes, category, color)
        `)
        .eq('host_user_id', user?.id)
        .in('status', ['pending', 'confirmed'])
        .gte('start_time', now)
        .order('start_time', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return (data || []) as unknown as Booking[];
    },
    enabled: !!user?.id
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBookingInput & { slug?: string }) => {
      const slug = input.slug;
      if (!slug) {
        throw new Error("slug requis pour la création publique d'un RDV");
      }
      const { data, error } = await supabase.functions.invoke('public-booking-proxy', {
        body: {
          action: 'create_booking',
          slug,
          booking_type_id: input.booking_type_id,
          start_time: input.start_time,
          end_time: input.end_time,
          guest_name: input.guest_name,
          guest_email: input.guest_email,
          guest_phone: input.guest_phone,
          guest_company: input.guest_company,
          guest_notes: input.guest_notes,
          timezone: input.timezone,
        },
      });
      if (error) throw error;
      const created = (data as { booking?: unknown } | null)?.booking;
      if (!created) throw new Error('Réservation non créée');
      return created as unknown as Booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-bookings'] });
    }
  });
}

import { notifyBooking } from './notifyBooking';

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      cancellation_reason 
    }: { 
      id: string; 
      status: Booking['status']; 
      cancellation_reason?: string 
    }) => {
      // Type explicite pour les mises à jour de statut
      const updates: {
        status: Booking['status'];
        confirmed_at?: string;
        cancelled_at?: string;
        cancelled_by?: 'host' | 'guest';
        cancellation_reason?: string;
      } = { status };
      
      if (status === 'confirmed') {
        updates.confirmed_at = new Date().toISOString();
      } else if (status === 'cancelled') {
        updates.cancelled_at = new Date().toISOString();
        updates.cancelled_by = 'host';
        if (cancellation_reason) {
          updates.cancellation_reason = cancellation_reason;
        }
      }

      const { data, error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', id)
        .select('id, booking_type_id, host_user_id, start_time, end_time, guest_name, guest_email, status, confirmed_at, cancelled_at, cancelled_by, cancellation_reason, created_at, updated_at')
        // safe: guaranteed-row
        .single();

      if (error) throw error;
      return data as unknown as Booking;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-bookings'] });

      // Auto-notify guest by email
      if (variables.status === 'confirmed') {
        notifyBooking(variables.id, 'confirmed');
      } else if (variables.status === 'cancelled') {
        notifyBooking(variables.id, 'cancelled', { reason: variables.cancellation_reason });
      }

      const messages: Record<string, string> = {
        confirmed: 'RDV confirmé — email envoyé au client',
        cancelled: 'RDV annulé — email envoyé au client',
        completed: 'RDV marqué comme terminé',
        no_show: 'Marqué comme absent'
      };
      toast.success(messages[variables.status] || 'Statut mis à jour');
    }
  });
}

// Reschedule / cancel / guest info mutations extracted to ./useBookingMutations
export {
  useRescheduleBooking,
  useCancelBooking,
  useUpdateBookingGuestInfo,
} from './useBookingMutations';

// =====================================================
// AVAILABLE SLOTS CALCULATION
// =====================================================

export function useAvailableSlots(
  hostKey: string | undefined,           // opaque token (page id) returned by proxy
  bookingTypeId: string | undefined,
  date: Date | undefined,
  _additionalHostIds?: string[],         // co-host conflict checks now done server-side
  slug?: string,
) {
  return useQuery({
    queryKey: ['available-slots', hostKey, bookingTypeId, date?.toISOString(), slug],
    queryFn: async (): Promise<TimeSlot[]> => {
      if (!slug || !bookingTypeId || !date) return [];
      const dateStr = format(date, 'yyyy-MM-dd');
      const { data, error } = await supabase.functions.invoke('public-booking-proxy', {
        body: {
          action: 'get_slots',
          slug,
          booking_type_id: bookingTypeId,
          date: dateStr,
        },
      });
      if (error) throw error;
      const slots = ((data as { slots?: { start: string; end: string }[] } | null)?.slots || []) as { start: string; end: string }[];
      return slots.map((s) => ({ start: s.start, end: s.end, available: true }));
    },
    enabled: !!slug && !!bookingTypeId && !!date,
  });
}

// Page types/hosts management hooks extracted to ./useBookingPageAssociations
export {
  useBookingPageTypes,
  useUpdateBookingPageTypes,
  useAddBookingTypeToPage,
  useBookingPageHosts,
  useUpdateBookingPageHosts,
} from './useBookingPageAssociations';
