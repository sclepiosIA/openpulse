import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import type { EmployeeCertification, ReferentielCertification } from '@/types/competences';
import { addDays, differenceInDays, isPast, isFuture } from 'date-fns';

interface CertificationFilters {
  profileId?: string;
  statut?: EmployeeCertification['statut'];
  expiringInDays?: number;
}

export function useReferentielCertifications() {
  const queryClient = useQueryClient();

  const { data: certifications = [], isLoading, error } = useQuery({
    queryKey: ['referentiel-certifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referentiel_certifications')
        .select('id, nom, description, organisme, duree_validite_mois, niveau_difficulte, est_actif, created_at, updated_at')
        .eq('est_actif', true)
        .order('nom')
        .limit(200);

      if (error) throw error;
      return data as ReferentielCertification[];
    },
  });

  const createCertification = useMutation({
    mutationFn: async (certification: Partial<ReferentielCertification>) => {
      const { data, error } = await supabase
        .from('referentiel_certifications')
        .insert(certification as never)
        .select()
        .single();

      if (error) throw error;
      return data as ReferentielCertification;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referentiel-certifications'] });
      toast.success('Certification ajoutée au référentiel');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  const updateCertification = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ReferentielCertification> & { id: string }) => {
      const { data, error } = await supabase
        .from('referentiel_certifications')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referentiel-certifications'] });
      toast.success('Certification mise à jour');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  return {
    certifications,
    isLoading,
    error,
    createCertification,
    updateCertification,
  };
}

export function useEmployeeCertifications(filters: CertificationFilters = {}) {
  const queryClient = useQueryClient();

  const { data: employeeCertifications = [], isLoading, error } = useQuery({
    queryKey: ['employee-certifications', filters],
    queryFn: async () => {
      let query = supabase
        .from('employee_certifications')
        .select(`
          *,
          certification:referentiel_certifications(id, nom, description, organisme, duree_validite_mois, niveau_difficulte),
          profile:profiles!employee_certifications_profile_id_fkey(id, nom, prenom)
        `)
        .order('date_expiration', { ascending: true, nullsFirst: false });

      if (filters.profileId) {
        query = query.eq('profile_id', filters.profileId);
      }

      if (filters.statut) {
        query = query.eq('statut', filters.statut);
      }

      const { data, error } = await query;

      if (error) throw error;

      let result = data as EmployeeCertification[];

      // Filter by expiring in X days if needed
      if (filters.expiringInDays) {
        const limitDate = addDays(new Date(), filters.expiringInDays);
        result = result.filter(cert => {
          if (!cert.date_expiration) return false;
          const expDate = new Date(cert.date_expiration);
          return isFuture(expDate) && expDate <= limitDate;
        });
      }

      return result;
    },
  });

  const addCertification = useMutation({
    mutationFn: async (certification: Partial<EmployeeCertification>) => {
      // Calculate expiration date if certification has validity period
      let dateExpiration = certification.date_expiration;
      if (!dateExpiration && certification.certification_id && certification.date_obtention) {
        const { data: certRef } = await supabase
          .from('referentiel_certifications')
          .select('duree_validite_mois')
          .eq('id', certification.certification_id)
          .maybeSingle();

        if (certRef?.duree_validite_mois) {
          const obtentionDate = new Date(certification.date_obtention);
          const expirationDate = new Date(obtentionDate);
          expirationDate.setMonth(expirationDate.getMonth() + certRef.duree_validite_mois);
          dateExpiration = expirationDate.toISOString().split('T')[0];
        }
      }

      // Determine status
      let statut: EmployeeCertification['statut'] = 'valide';
      if (dateExpiration) {
        const expDate = new Date(dateExpiration);
        if (isPast(expDate)) {
          statut = 'expiree';
        } else if (differenceInDays(expDate, new Date()) <= 30) {
          statut = 'a_renouveler';
        }
      }

      const { data, error } = await supabase
        .from('employee_certifications')
        .insert({
          ...certification,
          date_expiration: dateExpiration,
          statut,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data as EmployeeCertification;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-certifications'] });
      queryClient.invalidateQueries({ queryKey: ['competences-kpis'] });
      toast.success('Certification ajoutée');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  const updateCertification = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EmployeeCertification> & { id: string }) => {
      const { data, error } = await supabase
        .from('employee_certifications')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-certifications'] });
      queryClient.invalidateQueries({ queryKey: ['competences-kpis'] });
      toast.success('Certification mise à jour');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  const deleteCertification = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('employee_certifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-certifications'] });
      queryClient.invalidateQueries({ queryKey: ['competences-kpis'] });
      toast.success('Certification supprimée');
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });

  // Certifications expiring soon
  const expiringCertifications = employeeCertifications.filter(cert => {
    if (!cert.date_expiration) return false;
    const expDate = new Date(cert.date_expiration);
    const daysUntilExpiry = differenceInDays(expDate, new Date());
    return daysUntilExpiry > 0 && daysUntilExpiry <= 90;
  });

  return {
    employeeCertifications,
    expiringCertifications,
    isLoading,
    error,
    addCertification,
    updateCertification,
    deleteCertification,
  };
}
