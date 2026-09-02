import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { notifyBooking } from './notifyBooking';

export function useRescheduleBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      start_time,
      end_time,
    }: {
      id: string;
      start_time: string;
      end_time: string;
    }) => {
      const { data: current } = await supabase
        .from('bookings')
        .select('start_time, end_time')
        .eq('id', id)
        .maybeSingle();

      const { data, error } = await supabase
        .from('bookings')
        .update({
          start_time,
          end_time,
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id, start_time, end_time')
        // safe: guaranteed-row
        .single();

      if (error) throw error;
      return { booking: data, oldStartTime: current?.start_time, oldEndTime: current?.end_time };
    },
    onSuccess: ({ booking, oldStartTime, oldEndTime }) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-bookings'] });
      notifyBooking(booking!.id, 'rescheduled', { oldStartTime, oldEndTime });
      toast.success('RDV reprogrammé — email envoyé au client');
    },
    onError: (err) => {
      toast.error(sanitizeSupabaseError(err));
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: 'host',
          cancellation_reason: reason || null,
        })
        .eq('id', id)
        .select('id')
        // safe: guaranteed-row
        .single();
      if (error) throw error;
      return { id: data.id, reason };
    },
    onSuccess: ({ id, reason }) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-bookings'] });
      notifyBooking(id, 'cancelled', { reason });
      toast.success('RDV annulé — email envoyé au client');
    },
    onError: (err) => {
      toast.error(sanitizeSupabaseError(err));
    },
  });
}

export function useUpdateBookingGuestInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      guest_name,
      guest_email,
      guest_phone,
      guest_notes,
    }: {
      id: string;
      guest_name?: string;
      guest_email?: string;
      guest_phone?: string | null;
      guest_notes?: string | null;
    }) => {
      const updates: Record<string, unknown> = {};
      if (guest_name !== undefined) updates.guest_name = guest_name;
      if (guest_email !== undefined) updates.guest_email = guest_email;
      if (guest_phone !== undefined) updates.guest_phone = guest_phone;
      if (guest_notes !== undefined) updates.guest_notes = guest_notes;

      const { data, error } = await supabase
        .from('bookings')
        .update(updates as never)
        .eq('id', id)
        .select('id')
        // safe: guaranteed-row
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-bookings'] });
      notifyBooking(data!.id, 'updated');
      toast.success('Infos mises à jour — email envoyé au client');
    },
    onError: (err) => {
      toast.error(sanitizeSupabaseError(err));
    },
  });
}
