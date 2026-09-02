import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import { toast } from 'sonner';
import { debug } from '@/lib/debug';

/**
 * Hook pour créer une demande de formation RH
 */
export function useCreateDemandeFormation() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      titre: string;
      description: string;
      type: string;
      organisme: string;
      cout_estime: string;
      lien_formation: string;
      date_souhaitee: string;
    }) => {
      if (!user) throw new Error('Non authentifié');

      const { error } = await supabase.from('rh_demandes_formation').insert({
        profile_id: user.id,
        titre: data.titre,
        description: data.description,
        type: data.type,
        organisme: data.organisme,
        cout_estime: data.cout_estime ? parseFloat(data.cout_estime) : null,
        lien_formation: data.lien_formation || null,
        date_souhaitee: data.date_souhaitee || null,
        statut: 'en_attente',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Demande de formation soumise avec succès');
    },
    onError: (error) => {
      debug.error('Error creating formation request:', error);
      toast.error('Erreur lors de la soumission');
    },
  });
}

/**
 * Hook pour créer un objectif individuel RH
 */
export function useCreateObjectif() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      titre: string;
      description: string;
      type: string;
      cible_valeur: string;
      unite: string;
      periode: string;
      date_debut: string;
      date_fin: string;
    }) => {
      if (!user) throw new Error('Non authentifié');

      const today = new Date();
      const endOfYear = new Date(today.getFullYear(), 11, 31);
      const dateDebut = data.date_debut || today.toISOString().split('T')[0];
      const dateFin = data.date_fin || endOfYear.toISOString().split('T')[0];

      const { error } = await supabase.from('rh_objectifs').insert({
        profile_id: user.id,
        titre: data.titre,
        description: data.description || null,
        type: data.type,
        cible_valeur: data.cible_valeur ? parseFloat(data.cible_valeur) : null,
        unite: data.unite || null,
        periode: data.periode,
        date_debut: dateDebut,
        date_fin: dateFin,
        statut: 'en_cours',
        created_by: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Objectif créé avec succès');
      queryClient.invalidateQueries({ queryKey: ['rh-objectifs'] });
    },
    onError: (error) => {
      debug.error('Error creating objective:', error);
      toast.error("Erreur lors de la création de l'objectif");
    },
  });
}

/**
 * Hook pour créer une note rapide sur un établissement (production)
 */
export function useCreateProductionNote() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { etablissement_id: string; content: string }) => {
      if (!user) throw new Error('Non authentifié');

      const { error } = await supabase.from('customer_activities').insert({
        etablissement_id: data.etablissement_id,
        title: 'Note rapide',
        description: data.content,
        activity_type: 'note',
        created_by: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Note ajoutée avec succès');
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout de la note");
    },
  });
}
