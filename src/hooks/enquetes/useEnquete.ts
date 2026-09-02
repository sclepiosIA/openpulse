import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EnqueteContext {
  success: boolean;
  error?: string;
  type?: string;
  etablissement?: { id: string; nom: string } | null;
  user?: { id: string; nom: string } | null;
  csm?: { id: string; nom: string } | null;
  session?: { id: string; titre: string; date: string } | null;
}

export function useEnqueteContext(token: string | undefined) {
  return useQuery({
    queryKey: ['enquete-context', token],
    queryFn: async (): Promise<EnqueteContext> => {
      if (!token) return { success: false, error: 'token_invalide' };
      const { data, error } = await supabase.rpc('get_enquete_context', { p_token: token });
      if (error) throw error;
      return data as unknown as EnqueteContext;
    },
    enabled: !!token,
    retry: false,
    staleTime: 60_000,
  });
}

export function useSubmitEnquete(token: string | undefined, type: string) {
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!token) throw new Error('token_invalide');
      const { data, error } = await supabase.rpc('submit_enquete', {
        p_token: token,
        p_type: type,
        p_payload: payload as never,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; id?: string };
      if (!result.success) throw new Error(result.error || 'submit_failed');
      return result;
    },
  });
}
