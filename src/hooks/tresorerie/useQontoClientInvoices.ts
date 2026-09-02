import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { debug } from "@/lib/debug";

export interface QontoClientInvoice {
  id: string;
  numero: string;
  status: string;
  montant_ttc: number;
  currency: string;
  date_emission: string;
  date_echeance: string | null;
  client_name: string;
  client_email: string | null;
  file_url: string | null;
}

interface QontoClientInvoicesResponse {
  success: boolean;
  invoices: QontoClientInvoice[];
  total_a_encaisser: number;
  count: number;
  error?: string;
  meta?: {
    current_page: number;
    total_pages: number;
    total_count: number;
  };
}

export function useQontoClientInvoices() {
  const query = useQuery({
    queryKey: ['qonto-client-invoices'],
    queryFn: async (): Promise<QontoClientInvoicesResponse> => {
      const { data, error } = await supabase.functions.invoke<QontoClientInvoicesResponse>(
        'qonto-get-client-invoices',
        { method: 'POST' }
      );

      if (error) {
        debug.error('[useQontoClientInvoices] Error:', error);
        return {
          success: false,
          invoices: [],
          total_a_encaisser: 0,
          count: 0,
          error: error.message,
        };
      }

      return data || {
        success: false,
        invoices: [],
        total_a_encaisser: 0,
        count: 0,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });

  return {
    invoices: query.data?.invoices || [],
    totalAEncaisser: query.data?.total_a_encaisser || 0,
    count: query.data?.count || 0,
    isLoading: query.isLoading,
    isError: query.isError || (query.data?.success === false),
    error: query.error?.message || query.data?.error,
    refetch: query.refetch,
  };
}
