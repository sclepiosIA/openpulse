import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { debug } from '@/lib/debug';
import type {
  RgpdTraitement,
  RgpdConsentement,
  RgpdDemandeDroit,
  RgpdDpa,
  RgpdViolation,
  RgpdCertification,
  RgpdAuditLog,
  RgpdKPIs,
  RgpdBaseLegale,
  RgpdDemandeStatut,
  RgpdDroitType,
  RgpdViolationSeverite,
} from '@/types/rgpd';
import { addDays, isBefore, parseISO } from 'date-fns';

import type { Database as _DB } from '@/integrations/supabase/types';
type RgpdTraitementInsert = _DB['public']['Tables']['rgpd_traitements']['Insert'];
type RgpdTraitementUpdate = _DB['public']['Tables']['rgpd_traitements']['Update'];
type RgpdConsentementInsert = _DB['public']['Tables']['rgpd_consentements']['Insert'];
type RgpdConsentementUpdate = _DB['public']['Tables']['rgpd_consentements']['Update'];
type RgpdDemandeDroitInsert = _DB['public']['Tables']['rgpd_demandes_droits']['Insert'];
type RgpdDemandeDroitUpdate = _DB['public']['Tables']['rgpd_demandes_droits']['Update'];
type RgpdDpaInsert = _DB['public']['Tables']['rgpd_dpa']['Insert'];
type RgpdDpaUpdate = _DB['public']['Tables']['rgpd_dpa']['Update'];
type RgpdViolationInsert = _DB['public']['Tables']['rgpd_violations']['Insert'];
type RgpdViolationUpdate = _DB['public']['Tables']['rgpd_violations']['Update'];
type RgpdCertificationInsert = _DB['public']['Tables']['rgpd_certifications']['Insert'];
type RgpdCertificationUpdate = _DB['public']['Tables']['rgpd_certifications']['Update'];

// =====================================================
// TRAITEMENTS
// =====================================================

export function useRgpdTraitements(activeOnly = true) {
  return useQuery({
    queryKey: ['rgpd-traitements', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('rgpd_traitements')
        .select('id, nom, description, base_legale, finalites, categories_donnees, categories_personnes, destinataires, duree_conservation, mesures_securite, dpia_requis, dpia_realise, donnees_sensibles, est_actif, responsable_id, created_at, updated_at')
        .order('nom', { ascending: true })
        .limit(200);

      if (activeOnly) {
        query = query.eq('est_actif', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as RgpdTraitement[];
    }
  });
}

export function useCreateRgpdTraitement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<RgpdTraitement>) => {
      const { data, error } = await supabase
        .from('rgpd_traitements')
        .insert({
          ...input,
          base_legale: input.base_legale as RgpdBaseLegale,
        } as unknown as RgpdTraitementInsert)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as RgpdTraitement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rgpd-traitements'] });
      toast.success('Traitement créé');
    },
    onError: (error) => {
      toast.error('Erreur lors de la création');
      debug.error(error);
    }
  });
}

export function useUpdateRgpdTraitement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RgpdTraitement> & { id: string }) => {
      const { data, error } = await supabase
        .from('rgpd_traitements')
        .update(updates as unknown as RgpdTraitementUpdate)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as RgpdTraitement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rgpd-traitements'] });
      toast.success('Traitement mis à jour');
    }
  });
}

// =====================================================
// CONSENTEMENTS
// =====================================================

export function useRgpdConsentements(email?: string) {
  return useQuery({
    queryKey: ['rgpd-consentements', email],
    queryFn: async () => {
      let query = supabase
        .from('rgpd_consentements')
        .select('id, personne_nom, personne_email, finalite, traitement_id, est_accorde, date_consentement, date_retrait, mode_collecte, preuve_url, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (email) {
        query = query.eq('personne_email', email);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as RgpdConsentement[];
    }
  });
}

export function useCreateRgpdConsentement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<RgpdConsentement>) => {
      const { data, error } = await supabase
        .from('rgpd_consentements')
        .insert(input as unknown as RgpdConsentementInsert)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as RgpdConsentement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rgpd-consentements'] });
      toast.success('Consentement enregistré');
    }
  });
}

export function useUpdateRgpdConsentement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RgpdConsentement> & { id: string }) => {
      const { data, error } = await supabase
        .from('rgpd_consentements')
        .update(updates as unknown as RgpdConsentementUpdate)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as RgpdConsentement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rgpd-consentements'] });
      toast.success('Consentement mis à jour');
    }
  });
}

// =====================================================
// DEMANDES DE DROITS
// =====================================================

export function useRgpdDemandes(statut?: RgpdDemandeStatut) {
  return useQuery({
    queryKey: ['rgpd-demandes', statut],
    queryFn: async () => {
      let query = supabase
        .from('rgpd_demandes_droits')
        .select('id, numero, type_droit, demandeur_nom, demandeur_email, description, statut, date_demande, date_limite, date_traitement, reponse, traite_par, created_at, updated_at')
        .order('date_demande', { ascending: false })
        .limit(200);

      if (statut) {
        query = query.eq('statut', statut);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as RgpdDemandeDroit[];
    }
  });
}

export function useCreateRgpdDemande() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<RgpdDemandeDroit>) => {
      // Générer un numéro unique
      const numero = `DRO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      
      const { data, error } = await supabase
        .from('rgpd_demandes_droits')
        .insert({
          ...input,
          numero,
          type_droit: input.type_droit as RgpdDroitType,
          statut: 'nouvelle' as RgpdDemandeStatut,
        } as unknown as RgpdDemandeDroitInsert)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as RgpdDemandeDroit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rgpd-demandes'] });
      toast.success('Demande créée');
    }
  });
}

export function useUpdateRgpdDemande() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RgpdDemandeDroit> & { id: string }) => {
      const { data, error } = await supabase
        .from('rgpd_demandes_droits')
        .update(updates as unknown as RgpdDemandeDroitUpdate)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as RgpdDemandeDroit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rgpd-demandes'] });
      toast.success('Demande mise à jour');
    }
  });
}

// =====================================================
// DPA
// =====================================================

export function useRgpdDpas(activeOnly = true) {
  return useQuery({
    queryKey: ['rgpd-dpas', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('rgpd_dpa')
        .select('id, nom_sous_traitant, type_service, description, pays, est_hors_ue, garanties_adequation, categories_donnees, date_signature, date_expiration, document_url, contact_email, contact_nom, contact_telephone, certifications, est_hds, est_actif, created_at, updated_at')
        .order('nom_sous_traitant', { ascending: true })
        .limit(200);

      if (activeOnly) {
        query = query.eq('est_actif', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as RgpdDpa[];
    }
  });
}

export function useCreateRgpdDpa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<RgpdDpa>) => {
      const { data, error } = await supabase
        .from('rgpd_dpa')
        .insert(input as unknown as RgpdDpaInsert)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as RgpdDpa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rgpd-dpas'] });
      toast.success('DPA créé');
    }
  });
}

export function useUpdateRgpdDpa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RgpdDpa> & { id: string }) => {
      const { data, error } = await supabase
        .from('rgpd_dpa')
        .update(updates as unknown as RgpdDpaUpdate)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as RgpdDpa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rgpd-dpas'] });
      toast.success('DPA mis à jour');
    }
  });
}

// =====================================================
// VIOLATIONS
// =====================================================

export function useRgpdViolations(statut?: string) {
  return useQuery({
    queryKey: ['rgpd-violations', statut],
    queryFn: async () => {
      let query = supabase
        .from('rgpd_violations')
        .select('id, numero, titre, description, severite, categories_donnees, nombre_personnes_affectees, date_detection, date_incident, origine, date_notification_cnil, mesures_prises, statut, responsable_id, created_at, updated_at')
        .order('date_detection', { ascending: false })
        .limit(200);

      if (statut) {
        query = query.eq('statut', statut);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as RgpdViolation[];
    }
  });
}

export function useCreateRgpdViolation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<RgpdViolation>) => {
      const numero = `VIO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      
      const { data, error } = await supabase
        .from('rgpd_violations')
        .insert({
          ...input,
          numero,
          severite: input.severite as RgpdViolationSeverite,
        } as unknown as RgpdViolationInsert)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as RgpdViolation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rgpd-violations'] });
      toast.success('Violation déclarée');
    }
  });
}

export function useUpdateRgpdViolation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RgpdViolation> & { id: string }) => {
      const { data, error } = await supabase
        .from('rgpd_violations')
        .update(updates as unknown as RgpdViolationUpdate)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as RgpdViolation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rgpd-violations'] });
      toast.success('Violation mise à jour');
    }
  });
}

// =====================================================
// CERTIFICATIONS
// =====================================================

export function useRgpdCertifications(validOnly = true) {
  return useQuery({
    queryKey: ['rgpd-certifications', validOnly],
    queryFn: async () => {
      let query = supabase
        .from('rgpd_certifications')
        .select('id, nom, organisme_certificateur, type, date_obtention, date_expiration, numero_certificat, perimetre, est_valide, created_at, updated_at')
        .order('date_expiration', { ascending: true })
        .limit(200);

      if (validOnly) {
        query = query.eq('est_valide', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as RgpdCertification[];
    }
  });
}

export function useCreateRgpdCertification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<RgpdCertification>) => {
      const { data, error } = await supabase
        .from('rgpd_certifications')
        .insert(input as unknown as RgpdCertificationInsert)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as RgpdCertification;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rgpd-certifications'] });
      toast.success('Certification ajoutée');
    }
  });
}

export function useUpdateRgpdCertification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RgpdCertification> & { id: string }) => {
      const { data, error } = await supabase
        .from('rgpd_certifications')
        .update(updates as unknown as RgpdCertificationUpdate)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as RgpdCertification;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rgpd-certifications'] });
      toast.success('Certification mise à jour');
    }
  });
}

// =====================================================
// AUDIT LOGS
// =====================================================

export function useRgpdAuditLogs(filters?: { table_name?: string; user_id?: string; limit?: number }) {
  return useQuery({
    queryKey: ['rgpd-audit-logs', filters],
    queryFn: async () => {
      let query = supabase
        .from('rgpd_audit_logs')
        .select('id, table_name, record_id, action, old_values, new_values, user_id, user_email, ip_address, user_agent, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 100);

      if (filters?.table_name) {
        query = query.eq('table_name', filters.table_name);
      }
      if (filters?.user_id) {
        query = query.eq('user_id', filters.user_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as RgpdAuditLog[];
    }
  });
}

// =====================================================
// KPIs
// =====================================================

export function useRgpdKPIs() {
  const { data: traitements } = useRgpdTraitements(false);
  const { data: demandes } = useRgpdDemandes();
  const { data: violations } = useRgpdViolations();
  const { data: dpas } = useRgpdDpas(false);
  const { data: certifications } = useRgpdCertifications(false);
  const { data: consentements } = useRgpdConsentements();

  const now = new Date();
  const in30Days = addDays(now, 30);
  const in90Days = addDays(now, 90);

  const kpis: RgpdKPIs = {
    total_traitements: traitements?.length || 0,
    traitements_actifs: traitements?.filter(t => t.est_actif).length || 0,
    traitements_sensibles: traitements?.filter(t => t.donnees_sensibles).length || 0,
    dpia_en_attente: traitements?.filter(t => t.dpia_requis && !t.dpia_realise).length || 0,
    demandes_en_cours: demandes?.filter(d => d.statut === 'nouvelle' || d.statut === 'en_cours').length || 0,
    demandes_en_retard: demandes?.filter(d =>
      (d.statut === 'nouvelle' || d.statut === 'en_cours') &&
      d.date_limite && isBefore(parseISO(d.date_limite), now)
    ).length || 0,
    violations_ouvertes: violations?.filter(v => v.statut === 'ouverte' || v.statut === 'en_cours').length || 0,
    dpa_actifs: dpas?.filter(d => d.est_actif).length || 0,
    dpa_expirant_bientot: dpas?.filter(d =>
      d.est_actif &&
      d.date_expiration &&
      isBefore(parseISO(d.date_expiration), in90Days)
    ).length || 0,
    certifications_valides: certifications?.filter(c => c.est_valide).length || 0,
    certifications_expirant_bientot: certifications?.filter(c =>
      c.est_valide &&
      c.date_expiration &&
      isBefore(parseISO(c.date_expiration), in90Days)
    ).length || 0,
    consentements_actifs: consentements?.filter(c => c.est_accorde && !c.date_retrait).length || 0,
  };

  return kpis;
}
