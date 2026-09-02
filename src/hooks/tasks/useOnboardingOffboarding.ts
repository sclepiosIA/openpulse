import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { debug } from '@/lib/debug';

export interface DossierRH {
  cv: { status: boolean | null; ref: string | null; date: string | null };
  contrat: { status: boolean | null; ref: string | null; type: string | null; date: string | null };
  mutuelle: { status: boolean | null; ref: string | null; organisme: string | null; date: string | null };
  charte: { status: boolean | null; date: string | null };
  solde_tout_compte: { status: boolean | null; date: string | null };
  autre?: Array<{ label: string; description?: string }>;
}

export interface Materiel {
  pc_mac: { assigne: boolean; numero_serie: string | null; modele: string | null };
  laptop: { assigne: boolean; numero_serie: string | null; modele: string | null };
  smartphone: { assigne: boolean; numero_serie: string | null; modele: string | null; numero: string | null };
  licences: Array<{ nom: string; numero: string }>;
}

export type OnboardingStatut = 'en_cours' | 'actif' | 'sortie_prevue' | 'sorti';

export interface ComptesAcces {
  [key: string]: boolean;
}

export interface OnboardingOffboardingData {
  id: string;
  profile_id: string;
  date_entree: string | null;
  date_sortie: string | null;
  statut: OnboardingStatut;
  motif_sortie: string | null;
  dossier_rh: DossierRH;
  comptes_acces: ComptesAcces;
  materiel: Materiel;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface ProfileInfo {
  prenom: string;
  nom: string;
  email: string;
  fonction: string | null;
}

export interface OnboardingWithProfile extends OnboardingOffboardingData {
  profiles: ProfileInfo;
}

// Type pour l'insertion/mise à jour
interface OnboardingUpsertData {
  profile_id: string;
  date_entree?: string | null;
  date_sortie?: string | null;
  statut?: OnboardingStatut;
  motif_sortie?: string | null;
  dossier_rh?: DossierRH;
  comptes_acces?: ComptesAcces;
  materiel?: Materiel;
}

// Table name constant
const ONBOARDING_TABLE = 'rh_onboarding_offboarding' as const;

// Helper types pour les réponses Supabase
type OnboardingListResponse = PostgrestSingleResponse<OnboardingWithProfile[]>;
type OnboardingSingleResponse = PostgrestSingleResponse<OnboardingOffboardingData | null>;

// Hook pour récupérer toutes les fiches
export function useOnboardingOffboarding() {
  return useQuery({
    queryKey: ['onboarding-offboarding'],
    queryFn: async (): Promise<OnboardingWithProfile[]> => {
      const { data, error } = await (supabase
        .from(ONBOARDING_TABLE)
        .select('*, profiles!inner(prenom, nom, email, fonction)')
        .order('created_at', { ascending: false }) as unknown as Promise<OnboardingListResponse>);
      
      if (error) throw error;
      return data ?? [];
    }
  });
}

// Hook pour récupérer une fiche par profile_id
export function useOnboardingByProfile(profileId: string | null) {
  return useQuery({
    queryKey: ['onboarding-offboarding', profileId],
    queryFn: async (): Promise<OnboardingOffboardingData | null> => {
      if (!profileId) return null;
      
      const { data, error } = await (supabase
        .from(ONBOARDING_TABLE)
        .select('id, profile_id, date_entree, date_sortie, statut, motif_sortie, dossier_rh, comptes_acces, materiel, created_at, updated_at, created_by, updated_by')
        .eq('profile_id', profileId)
        .maybeSingle() as unknown as Promise<OnboardingSingleResponse>);
      
      if (error) throw error;
      return data;
    },
    enabled: !!profileId
  });
}

// Hook pour créer ou mettre à jour une fiche
export function useUpsertOnboarding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: OnboardingUpsertData): Promise<void> => {
      // Convertir DossierRH et Materiel en JSON pour Supabase
      const cleanData = {
        ...data,
        dossier_rh: data.dossier_rh ? JSON.parse(JSON.stringify(data.dossier_rh)) : undefined,
        materiel: data.materiel ? JSON.parse(JSON.stringify(data.materiel)) : undefined,
        comptes_acces: data.comptes_acces ? JSON.parse(JSON.stringify(data.comptes_acces)) : undefined,
      };
      
      const { error } = await supabase
        .from(ONBOARDING_TABLE)
        .upsert([cleanData], { onConflict: 'profile_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-offboarding'] });
      toast.success('Fiche mise à jour avec succès');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
      debug.error('Onboarding upsert error:', error);
    }
  });
}

// Hook pour supprimer une fiche
export function useDeleteOnboarding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from(ONBOARDING_TABLE)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-offboarding'] });
      toast.success('Fiche supprimée');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
      debug.error('Onboarding delete error:', error);
    }
  });
}
