import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database as _DB } from '@/integrations/supabase/types';

type BookingPageTypeInsert = _DB['public']['Tables']['booking_page_types']['Insert'];
type BookingPageHostInsert = _DB['public']['Tables']['booking_page_hosts']['Insert'];

// =====================================================
// PAGE TYPES MANAGEMENT
// =====================================================

export function useBookingPageTypes(pageId: string | undefined) {
  return useQuery({
    queryKey: ['booking-page-types', pageId],
    queryFn: async () => {
      if (!pageId) return [];

      const { data, error } = await supabase
        .from('booking_page_types')
        .select('id, booking_page_id, booking_type_id, order_index, is_visible')
        .eq('booking_page_id', pageId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as { id: string; booking_page_id: string; booking_type_id: string; order_index: number; is_visible: boolean }[];
    },
    enabled: !!pageId
  });
}

export function useUpdateBookingPageTypes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pageId, typeIds }: { pageId: string; typeIds: string[] }) => {
      const { error: deleteError } = await supabase
        .from('booking_page_types')
        .delete()
        .eq('booking_page_id', pageId);

      if (deleteError) throw deleteError;

      if (typeIds.length > 0) {
        const inserts = typeIds.map((typeId, index) => ({
          booking_page_id: pageId,
          booking_type_id: typeId,
          order_index: index,
          is_visible: true
        }));

        const { error: insertError } = await supabase
          .from('booking_page_types')
          .insert(inserts as unknown as BookingPageTypeInsert);

        if (insertError) throw insertError;
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['booking-page-types', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['booking-pages'] });
      queryClient.invalidateQueries({ queryKey: ['booking-page'] });
    }
  });
}

export function useAddBookingTypeToPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pageId, typeId }: { pageId: string; typeId: string }) => {
      const { data, error } = await supabase
        .from('booking_page_types')
        .insert({
          booking_page_id: pageId,
          booking_type_id: typeId
        } as unknown as BookingPageTypeInsert)
        .select('id, booking_page_id, booking_type_id, order_index, is_visible')
        // safe: guaranteed-row
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-pages'] });
      queryClient.invalidateQueries({ queryKey: ['booking-page-types'] });
      toast.success('Type de RDV ajouté à la page');
    }
  });
}

// =====================================================
// PAGE HOSTS MANAGEMENT
// =====================================================

export function useBookingPageHosts(pageId: string | undefined) {
  return useQuery({
    queryKey: ['booking-page-hosts', pageId],
    queryFn: async () => {
      if (!pageId) return [];

      const { data, error } = await supabase
        .from('booking_page_hosts')
        .select(`
          id, booking_page_id, user_id, is_required, role, created_at,
          profile:profiles!booking_page_hosts_user_id_fkey(id, nom, prenom, avatar_url, email)
        `)
        .eq('booking_page_id', pageId);

      if (error) {
        const { data: simpleData, error: simpleError } = await supabase
          .from('booking_page_hosts')
          .select('id, booking_page_id, user_id, is_required, role')
          .eq('booking_page_id', pageId);

        if (simpleError) throw simpleError;
        return (simpleData || []) as unknown as { id: string; booking_page_id: string; user_id: string; is_required: boolean; role: string }[];
      }

      return (data || []) as unknown as { id: string; booking_page_id: string; user_id: string; is_required: boolean; role: string; profile?: { id: string; nom: string; prenom: string; avatar_url: string | null; email: string } }[];
    },
    enabled: !!pageId
  });
}

export function useUpdateBookingPageHosts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pageId, userIds }: { pageId: string; userIds: string[] }) => {
      const { error: deleteError } = await supabase
        .from('booking_page_hosts')
        .delete()
        .eq('booking_page_id', pageId);

      if (deleteError) throw deleteError;

      if (userIds.length > 0) {
        const inserts = userIds.map((userId, index) => ({
          booking_page_id: pageId,
          user_id: userId,
          is_required: index === 0,
          role: index === 0 ? 'host' : 'co-host'
        }));

        const { error: insertError } = await supabase
          .from('booking_page_hosts')
          .insert(inserts as unknown as BookingPageHostInsert);

        if (insertError) throw insertError;
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['booking-page-hosts', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['booking-pages'] });
    }
  });
}
