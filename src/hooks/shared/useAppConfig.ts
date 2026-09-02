/**
 * Hook centralisé pour accéder à la configuration de l'application
 * Remplace toutes les données hardcodées (infos société, URLs, paramètres)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

const APP_CONFIG_QUERY_TIMEOUT_MS = 5000;

const withTimeout = async <T,>(promise: PromiseLike<T>, ms: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Configuration temporairement indisponible')), ms);
  });

  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export interface AppConfigRow {
  key: string;
  value: Record<string, any>;
  category: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface CompanyInfo {
  name: string;
  address: string;
  city: string;
  siret: string;
  tva_intracom: string;
  email: string;
  phone: string;
  iban: string;
  bic: string;
  logo_url: string | null;
}

export interface EmailSenderConfig {
  default_from: string;
  notifications_from: string;
  formations_from: string;
  support_from: string;
}

export interface DocumentFooterConfig {
  company_name: string;
  email: string;
  phone: string;
  confidential_text: string;
}

// Fetch all app_config entries
function useAllAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: async () => {
      const { data, error } = await withTimeout(
        supabase
          .from('app_config')
          .select('key, value, category, description, updated_at, updated_by')
          .order('key'),
        APP_CONFIG_QUERY_TIMEOUT_MS
      );
      if (error) throw error;
      return data as AppConfigRow[];
    },
    staleTime: 60 * 1000, // 1 minute — config admin peut changer
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnMount: 'always',
  });
}

// Get a single config value by key
export function useAppConfig<T = Record<string, unknown>>(key: string) {
  const { data: allConfig, ...rest } = useAllAppConfig();
  const configEntry = allConfig?.find(c => c.key === key);
  return {
    ...rest,
    data: configEntry?.value as T | undefined,
    rawEntry: configEntry,
  };
}

// Get all configs
export function useAllAppConfigs() {
  return useAllAppConfig();
}

// Typed helpers
export function useCompanyInfo() {
  return useAppConfig<CompanyInfo>('company_info');
}

export function useEmailSenderConfig() {
  return useAppConfig<EmailSenderConfig>('email_sender');
}

export function useDocumentFooterConfig() {
  return useAppConfig<DocumentFooterConfig>('document_footer');
}

export function useProductionUrl() {
  const { data } = useAppConfig<{ url: string }>('production_url');
  return data?.url || '';
}

export function useVapidPublicKey() {
  const { data } = useAppConfig<{ key: string }>('vapid_public_key');
  return data?.key || '';
}

// Internal team emails (loaded from DB instead of hardcoded)
export function useInternalTeamEmails(): string[] {
  const { data } = useAppConfig<{ emails: string[] }>('internal_team_emails');
  return data?.emails || [];
}

// Infrastructure URLs (CDN, Jitsi, Nextcloud, Passbolt)
export interface InfraUrls {
  cdn_url: string;
  jitsi_url: string;
  nextcloud_url: string;
  passbolt_url: string;
}

export function useInfraUrls(): InfraUrls {
  const { data } = useAppConfig<InfraUrls>('infrastructure_urls');
  return {
    cdn_url: data?.cdn_url || '',
    jitsi_url: data?.jitsi_url || '',
    nextcloud_url: data?.nextcloud_url || '',
    passbolt_url: data?.passbolt_url || '',
  };
}

// Qonto configuration
export interface QontoConfig {
  dashboard_url: string;
  organization_id: string;
}

export function useQontoConfig(): QontoConfig {
  const { data } = useAppConfig<QontoConfig>('qonto_config');
  return {
    dashboard_url: data?.dashboard_url || '',
    organization_id: data?.organization_id || '',
  };
}

// Mutation to update a config value
export function useUpdateAppConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Record<string, any> }) => {
      const { error } = await supabase
        .from('app_config')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-config'] });
      toast({ title: 'Configuration mise à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    },
  });
}
