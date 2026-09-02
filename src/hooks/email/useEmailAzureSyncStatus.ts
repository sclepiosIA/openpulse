/**
 * Hook de supervision du backend email Azure (lot 1 — lecture seule).
 *
 * Actif uniquement quand `VITE_EMAIL_BACKEND` vaut `azure` ou `hybrid`.
 * En mode `supabase` (défaut), la query est désactivée : zéro appel réseau,
 * zéro impact sur la messagerie existante.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isAzureEmailBackendEnabled, getEmailBackend } from '@/lib/emailBackend';
import {
  fetchEmailAzureSyncStatus,
  type EmailAzureSyncStatusResult,
} from '@/services/email/emailAzureApi';

export const EMAIL_AZURE_SYNC_STATUS_QUERY_KEY = ['email-azure-sync-status'] as const;

export function useEmailAzureSyncStatus() {
  const azureEnabled = isAzureEmailBackendEnabled();

  const query = useQuery<EmailAzureSyncStatusResult>({
    queryKey: EMAIL_AZURE_SYNC_STATUS_QUERY_KEY,
    enabled: azureEnabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return fetchEmailAzureSyncStatus({
        accessToken: data.session?.access_token ?? null,
      });
    },
  });

  return {
    backend: getEmailBackend(),
    azureEnabled,
    result: query.data ?? null,
    isLoading: azureEnabled && query.isLoading,
    refetch: query.refetch,
  };
}
