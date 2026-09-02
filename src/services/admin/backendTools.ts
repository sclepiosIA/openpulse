import { supabase } from '@/integrations/supabase/client';

/**
 * Services d'administration — extraction pour découplage Supabase (audit Fable 5 · action 180.1).
 */

export interface ImportCommercialInput {
  etablissements: unknown[];
  partenaires: unknown[];
  commercial_category_id: string;
  tasks_only?: boolean;
}

export interface ImportCommercialResult {
  report?: unknown;
  [k: string]: unknown;
}

export const importCommercialData = async (
  input: ImportCommercialInput,
): Promise<ImportCommercialResult> => {
  const { data, error } = await supabase.functions.invoke('import-commercial-data', {
    body: input,
  });
  if (error) throw error;
  return (data ?? {}) as ImportCommercialResult;
};

/**
 * Récupère une URL signée d'autologin pour un backend interne (edge function dédiée).
 */
export const fetchBackendAutologinUrl = async (
  functionName: string,
  backendKey: string,
): Promise<string> => {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { backend: backendKey },
  });
  if (error) throw error;
  const url = (data as { url?: string } | null)?.url;
  if (!url) throw new Error('Réponse autologin invalide.');
  return url;
};
