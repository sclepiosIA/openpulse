import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

export interface PendingContact {
  id: string;
  email_thread_id: string | null;
  etablissement_id: string | null;
  partenaire_id: string | null;
  groupe_id: string | null;
  extracted_data: {
    nom: string;
    prenom?: string;
    fonction?: string;
    email?: string;
    telephone?: string;
  };
  confidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  email_threads?: {
    subject: string;
  };
  etablissements?: {
    nom: string;
  };
  partenaires?: {
    nom: string;
  };
  groupes_etablissements?: {
    nom: string;
  };
}

export function usePendingContacts() {
  return useQuery({
    queryKey: ['pending-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_contacts')
        .select(`
          id, email_thread_id, etablissement_id, partenaire_id, groupe_id, extracted_data, confidence, status, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at,
          email_threads(subject),
          etablissements(nom),
          partenaires(nom),
          groupes_etablissements(nom)
        `)
        .eq('status', 'pending')
        .order('confidence', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Déduplication côté client : ne garder qu'un contact par (email, entité, thread)
      const uniqueByEmailAndEntity = new Map<string, PendingContact>();
      
      for (const contact of (data as PendingContact[])) {
        const email = contact.extracted_data?.email?.toLowerCase() || '';
        const entityId = contact.etablissement_id || contact.groupe_id || contact.partenaire_id || '';
        const key = `${contact.email_thread_id || ''}-${email}-${entityId}`;
        
        const existing = uniqueByEmailAndEntity.get(key);
        if (!existing) {
          uniqueByEmailAndEntity.set(key, contact);
        } else {
          // Garder celui avec la meilleure confidence, ou le plus récent
          const currentConfidence = contact.confidence ?? 0;
          const existingConfidence = existing.confidence ?? 0;
          
          if (currentConfidence > existingConfidence || 
              (currentConfidence === existingConfidence && 
               new Date(contact.created_at) > new Date(existing.created_at))) {
            uniqueByEmailAndEntity.set(key, contact);
          }
        }
      }
      
      return Array.from(uniqueByEmailAndEntity.values());
    },
  });
}

export function useApprovePendingContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      id, 
      contactData,
      etablissementId,
      partenaireId,
      groupeId
    }: { 
      id: string; 
      contactData: PendingContact['extracted_data'];
      etablissementId?: string | null;
      partenaireId?: string | null;
      groupeId?: string | null;
    }) => {
      // Get the pending contact
      const { data: pendingContact, error: fetchError } = await supabase
        .from('pending_contacts')
        .select('id, email_thread_id, etablissement_id, partenaire_id, groupe_id, extracted_data, confidence, status')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Determine target table and create contact
      let tableName: 'contacts' | 'partenaires_contacts' = 'contacts';
      
      // Type explicite pour les données d'insertion
      interface ContactInsertData {
        nom: string;
        prenom?: string;
        fonction: string;
        email?: string;
        telephone?: string;
        etablissement_id?: string;
        partenaire_id?: string;
        groupe_id?: string;
        type_contact?: string;
        niveau_contact?: string;
        created_source?: string;
        created_metadata?: Record<string, unknown>;
      }
      
      const insertData: ContactInsertData = {
        nom: contactData.nom,
        prenom: contactData.prenom,
        fonction: contactData.fonction || 'Non spécifiée',
        email: contactData.email,
        telephone: contactData.telephone,
      };

      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      // Utiliser l'opérateur de coalescence nulle pour gérer correctement null et undefined
      const targetEtablissementId = etablissementId ?? pendingContact.etablissement_id;
      const targetPartenaireId = partenaireId ?? pendingContact.partenaire_id;
      const targetGroupeId = groupeId ?? pendingContact.groupe_id;

      // Vérifier qu'au moins un ID cible est défini
      if (!targetEtablissementId && !targetPartenaireId && !targetGroupeId) {
        throw new Error('Au moins un ID (établissement, partenaire ou groupe) doit être défini pour créer un contact');
      }

      if (targetEtablissementId) {
        insertData.etablissement_id = targetEtablissementId;
        insertData.type_contact = contactData.fonction?.toLowerCase().includes('direction') ? 'direction' : 'operationnel';
        insertData.niveau_contact = 'etablissement';
        insertData.created_source = 'email_ai';
        insertData.created_metadata = {
          email_thread_id: pendingContact.email_thread_id,
          confidence: pendingContact.confidence,
          approved_at: new Date().toISOString(),
          reviewed_by: profile?.id
        };
        tableName = 'contacts';
      } else if (targetPartenaireId) {
        insertData.partenaire_id = targetPartenaireId;
        insertData.created_source = 'email_ai';
        insertData.created_metadata = {
          email_thread_id: pendingContact.email_thread_id,
          confidence: pendingContact.confidence,
          approved_at: new Date().toISOString(),
          reviewed_by: profile?.id
        };
        tableName = 'partenaires_contacts';
      } else if (targetGroupeId) {
        insertData.groupe_id = targetGroupeId;
        insertData.niveau_contact = 'groupe';
        insertData.created_source = 'email_ai';
        insertData.created_metadata = {
          email_thread_id: pendingContact.email_thread_id,
          confidence: pendingContact.confidence,
          approved_at: new Date().toISOString(),
          reviewed_by: profile?.id
        };
        tableName = 'contacts';
      }

      // Insert or update contact to avoid unique constraint errors
      if (tableName === 'contacts' && insertData.email && insertData.etablissement_id) {
        // Try to find existing contact by email for the same établissement (case-insensitive)
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('etablissement_id', insertData.etablissement_id)
          .ilike('email', insertData.email)
          .maybeSingle();

        if (existing) {
          const { error: updateError } = await supabase
            .from('contacts')
            .update({
              nom: insertData.nom,
              prenom: insertData.prenom,
              fonction: insertData.fonction,
              telephone: insertData.telephone,
              updated_at: new Date().toISOString(),
              updated_by: profile?.id,
            })
            .eq('id', existing.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('contacts')
            .insert(insertData as never);
          if (insertError) throw insertError;
        }
      } else if (tableName === 'partenaires_contacts' && insertData.email && insertData.partenaire_id) {
        const { data: existing } = await supabase
          .from('partenaires_contacts')
          .select('id')
          .eq('partenaire_id', insertData.partenaire_id)
          .ilike('email', insertData.email)
          .maybeSingle();

        if (existing) {
          const { error: updateError } = await supabase
            .from('partenaires_contacts')
            .update({
              nom: insertData.nom,
              prenom: insertData.prenom,
              fonction: insertData.fonction,
              telephone: insertData.telephone,
            })
            .eq('id', existing.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('partenaires_contacts')
            .insert(insertData as never);
          if (insertError) throw insertError;
        }
      } else {
        const { error: insertError } = await supabase
          .from(tableName)
          .insert(insertData as never);
        if (insertError) throw insertError;
      }

      // Update pending contact status
      const { error: updateError } = await supabase
        .from('pending_contacts')
        .update({
          status: 'approved',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;

      return { success: true };
    },
    onSuccess: () => {
      toast.success('Contact créé avec succès');
      queryClient.invalidateQueries({ queryKey: ['pending-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['partenaires-contacts'] });
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });
}

export function useRejectPendingContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const { error } = await supabase
        .from('pending_contacts')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Contact rejeté');
      queryClient.invalidateQueries({ queryKey: ['pending-contacts'] });
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });
}
