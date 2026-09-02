import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SupportTicketSelectItem {
  id: string;
  numero_ticket: string;
  titre: string;
  statut: string;
  etablissement_nom: string | null;
}

/**
 * Hook to fetch open Support Tickets for selection in dropdowns
 */
export function useSupportTicketsSelect() {
  return useQuery({
    queryKey: ['support-tickets-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          id,
          numero_ticket,
          titre,
          statut,
          etablissement:etablissements(nom)
        `)
        .in('statut', ['nouveau', 'en_cours', 'en_attente'])
        .order('date_ouverture', { ascending: false })
        .limit(100);

      if (error) throw error;

      /** Type pour la jointure établissement */
      type TicketWithEtab = typeof data[number] & {
        etablissement: { nom: string } | null;
      };
      return (data || []).map((ticket) => {
        const t = ticket as TicketWithEtab;
        return {
          id: t.id,
          numero_ticket: t.numero_ticket,
          titre: t.titre,
          statut: t.statut,
          etablissement_nom: t.etablissement?.nom || null,
        };
      }) as SupportTicketSelectItem[];
    },
    staleTime: 60 * 1000,
  });
}
