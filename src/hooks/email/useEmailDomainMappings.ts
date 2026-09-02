import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

export interface EmailDomainMapping {
  id: string;
  etablissement_id: string | null;
  groupe_id: string | null;
  partenaire_id: string | null;
  domain: string;
  confidence_level: 'high' | 'medium' | 'low';
  created_at: string;
  created_by: string | null;
  verified: boolean;
  is_excluded: boolean;
  prevent_auto: boolean;
  niveau_mapping: string | null;
  etablissement?: {
    nom: string;
    ville: string;
  };
  groupe?: {
    nom: string;
  };
  partenaire?: {
    nom: string;
  };
}

export function useEmailDomainMappings(params?: { 
  etablissementId?: string; 
  groupeId?: string; 
  partenaireId?: string;
  includeExcluded?: boolean;
}) {
  const queryKey = params?.etablissementId 
    ? ['email-domain-mappings', 'etablissement', params.etablissementId]
    : params?.groupeId
    ? ['email-domain-mappings', 'groupe', params.groupeId]
    : params?.partenaireId
    ? ['email-domain-mappings', 'partenaire', params.partenaireId]
    : ['email-domain-mappings'];

  return useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('email_domain_mappings')
        .select(`
          *,
          etablissement:etablissements(nom, ville),
          groupe:groupes_etablissements(nom),
          partenaire:partenaires(nom)
        `)
        .order('created_at', { ascending: false });

      // Par défaut, exclure les domaines marqués comme exclus
      // sauf si explicitement demandé
      if (!params?.includeExcluded) {
        query = query.eq('is_excluded', false);
      }

      if (params?.etablissementId) {
        query = query.eq('etablissement_id', params.etablissementId);
      } else if (params?.groupeId) {
        query = query.eq('groupe_id', params.groupeId);
      } else if (params?.partenaireId) {
        query = query.eq('partenaire_id', params.partenaireId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as EmailDomainMapping[];
    },
    staleTime: 30000,
  });
}

export function useAddDomainMapping() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      etablissementId?: string;
      groupeId?: string;
      partenaireId?: string;
      domain: string;
      confidenceLevel?: 'high' | 'medium' | 'low';
      isExcluded?: boolean;
      reactivate?: boolean; // Nouveau paramètre pour réactivation explicite
      preventAuto?: boolean; // Marquer le domaine comme ignoré sans l'exclure
    }) => {
      const domain = params.domain.toLowerCase().trim();
      
      // Déterminer le niveau de mapping
      const niveauMapping = params.groupeId
        ? 'groupe'
        : params.partenaireId
        ? 'partenaire'
        : 'etablissement';

      // Vérifier si le domaine existe déjà pour CETTE entité spécifique
      let query = supabase
        .from('email_domain_mappings')
        .select('id, is_excluded, prevent_auto')
        .eq('domain', domain);

      if (params.etablissementId) query = query.eq('etablissement_id', params.etablissementId);
      if (params.groupeId) query = query.eq('groupe_id', params.groupeId);
      if (params.partenaireId) query = query.eq('partenaire_id', params.partenaireId);

      const { data: existingMapping } = await query.maybeSingle();

      // Si le domaine existe pour cette entité
      if (existingMapping) {
        // Si exclu ou verrouillé, vérifier si réactivation explicite
        if (existingMapping.is_excluded || existingMapping.prevent_auto) {
          // Par défaut, refuser la réactivation automatique
          if (!params.reactivate) {
            throw new Error(
              `Le domaine "${params.domain}" a été exclu pour cette entité. ` +
              `Utilisez le bouton "Réactiver" pour le réassocier explicitement.`
            );
          }
          
          // Réactivation explicite demandée
          const updateData: Record<string, unknown> = {
            is_excluded: false,
            prevent_auto: false,
            confidence_level: params.confidenceLevel || 'high',
            verified: true,
            niveau_mapping: niveauMapping,
          };

          const { data, error } = await supabase
            .from('email_domain_mappings')
            .update(updateData as never)

            .eq('id', existingMapping.id)
            .select()
            .single();

          if (error) throw error;
          return data;
        }
        throw new Error("Ce domaine est déjà associé à cette entité");
      }

      // Créer un nouveau mapping
      const insertData: Record<string, unknown> = {
        domain,
        confidence_level: params.confidenceLevel || 'high',
        verified: true,
        is_excluded: params.isExcluded || false,
        prevent_auto: params.preventAuto || false,
      };

      // Cas exclusion ou ignore : aucun niveau_mapping ni ID
      if (params.isExcluded || params.preventAuto) {
        insertData.niveau_mapping = null;
      } else {
        insertData.niveau_mapping = niveauMapping;
        
        if (niveauMapping === 'etablissement') {
          insertData.etablissement_id = params.etablissementId;
        } else if (niveauMapping === 'groupe') {
          insertData.groupe_id = params.groupeId;
        } else if (niveauMapping === 'partenaire') {
          insertData.partenaire_id = params.partenaireId;
        }
      }
      
      const { data, error } = await supabase
        .from('email_domain_mappings')
        .insert(insertData as never)

        .select()
        .single();

      if (error) {
        // Gestion de l'erreur unique_violation
        if (error.code === '23505') {
          throw new Error("Ce domaine existe déjà pour cette entité");
        }
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      // Batch invalidation: single predicate instead of 6+ individual calls
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          if (['email-domain-mappings', 'email-threads', 'unclassified-domains'].includes(key)) return true;
          if (variables.groupeId && (key === 'groupes' || key === 'email-threads-groupe')) return true;
          if (variables.partenaireId && (key === 'partenaires' || key === 'email-threads-partenaire')) return true;
          return false;
        },
      });
      toast({
        title: variables.preventAuto
          ? "Domaine ignoré"
          : variables.isExcluded 
          ? "Domaine exclu" 
          : variables.groupeId 
          ? "Domaine ajouté au groupe" 
          : variables.partenaireId
          ? "Domaine ajouté au partenaire"
          : "Domaine ajouté",
        description: variables.preventAuto
          ? "Ce domaine est marqué comme ignoré et ne sera plus proposé dans cette liste."
          : variables.isExcluded 
          ? "Les emails de ce domaine seront masqués" 
          : variables.groupeId 
          ? "Le domaine a été associé au groupe" 
          : variables.partenaireId
          ? "Le domaine a été associé au partenaire"
          : "Le domaine a été associé à l'établissement",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });
}

export function useRemoveDomainMapping() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (mappingId: string) => {
      // TOUJOURS faire un soft delete (is_excluded + prevent_auto)
      // Ne JAMAIS supprimer physiquement pour conserver le "tombstone"
      const { error } = await supabase
        .from('email_domain_mappings')
        .update({ 
          is_excluded: true,
          prevent_auto: true, // Empêcher toute réassociation automatique
        })
        .eq('id', mappingId);

      if (error) throw error;
      return { deleted: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-domain-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      toast({
        title: "Domaine exclu",
        description: "Le domaine ne sera plus associé automatiquement",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });
}

export function useUpdateDomainMapping() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      mappingId: string;
      verified?: boolean;
      confidenceLevel?: 'high' | 'medium' | 'low';
    }) => {
      const updates: Record<string, unknown> = {};
      if (params.verified !== undefined) updates.verified = params.verified;
      if (params.confidenceLevel) updates.confidence_level = params.confidenceLevel;

      const { error } = await supabase
        .from('email_domain_mappings')
        .update(updates as never)

        .eq('id', params.mappingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-domain-mappings'] });
      toast({
        title: "Domaine mis à jour",
        description: "Les modifications ont été enregistrées",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    },
  });
}