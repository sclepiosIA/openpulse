import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { debug } from '@/lib/debug';
import type {
  Document,
  DocumentWithRelations,
  DocumentFilters,
  DocumentSort,
  DocumentRelation,
} from "@/types/documents";

const DOCUMENTS_QUERY_KEY = "documents";

export function useDocuments(
  filters?: DocumentFilters,
  sort: DocumentSort = { field: 'created_at', order: 'desc' },
  limit: number = 50
) {
  return useQuery({
    queryKey: [DOCUMENTS_QUERY_KEY, filters, sort, limit],
    queryFn: async (): Promise<DocumentWithRelations[]> => {
      // Si on a des filtres par relation (établissement, tâche, profile), 
      // on doit d'abord récupérer les IDs des documents liés
      let documentIdFilter: string[] | null = null;

      if (filters?.relatedEtablissementId || filters?.relatedTacheId || filters?.relatedProfileId) {
        let relQuery = supabase
          .from("document_relations")
          .select("document_id");

        if (filters.relatedEtablissementId) {
          relQuery = relQuery.eq("related_etablissement_id", filters.relatedEtablissementId);
        }
        if (filters.relatedTacheId) {
          relQuery = relQuery.eq("related_tache_id", filters.relatedTacheId);
        }
        if (filters.relatedProfileId) {
          relQuery = relQuery.eq("related_profile_id", filters.relatedProfileId);
        }

        const { data: relations, error: relError } = await relQuery;
        
        if (relError) throw relError;
        if (!relations || relations.length === 0) return [];
        
        documentIdFilter = [...new Set(relations.map(r => r.document_id))];
      }

      let query = supabase
        .from("documents")
        .select(`
          *,
          creator:profiles!documents_created_by_fkey(id, nom, prenom, avatar_url),
          relations:document_relations(
            id,
            relation_type,
            related_etablissement_id,
            related_tache_id,
            related_profile_id,
            related_groupe_id,
            related_partenaire_id,
            etablissement:etablissements(id, nom),
            tache:taches(id, titre),
            groupe:groupes_etablissements(id, nom),
            partenaire:partenaires(id, nom)
          )
        `)
        .eq("is_hard_deleted", false);

      // Appliquer le filtre par IDs de documents si nécessaire
      if (documentIdFilter) {
        query = query.in("id", documentIdFilter);
      }

      // Filtres standard
      if (!filters?.showDeleted) {
        query = query.is("deleted_at", null);
      }

      if (filters?.search) {
        // Recherche plein texte sur la colonne engendrée `recherche`, qui
        // couvre le titre, la description ET le corps des pages, balises HTML
        // retirées et accents ignorés (cf. supabase/schema-08-pages.sql).
        //
        // La version précédente faisait un ILIKE sur le seul nom et la seule
        // description. Sur un wiki, c'est l'inverse de ce qu'on cherche : on se
        // souvient d'un mot lu DANS une page, pas de son titre. L'index plein
        // texte existait déjà et n'était utilisé nulle part.
        //
        // Le mode « websearch » accepte ce qu'un utilisateur tape réellement —
        // plusieurs mots, des guillemets, un `-` d'exclusion — sans exiger la
        // syntaxe de `tsquery`, qui échoue sur une simple apostrophe.
        //
        // LA CONFIGURATION DOIT ÊTRE NOMMÉE, ET C'EST LE PIÈGE
        // Sans `config`, PostgREST emploie `default_text_search_config`, qui
        // vaut `pg_catalog.english` sur une installation neuve. Or la colonne
        // `recherche` est construite avec `francais_sans_accent`. Les deux
        // configurations produisent parfois le MÊME radical — « responsable »
        // et « télétravail » donnent `respons` et `teletravail` des deux
        // côtés — et parfois non : « ergonomie » donne `ergonomi` en anglais,
        // `ergonom` en français.
        //
        // Une recherche qui marche pour un mot sur deux, sans jamais d'erreur,
        // est le pire cas : l'utilisateur conclut que la page n'existe pas.
        // Mesuré sur l'instance avant correction.
        query = query.textSearch('recherche', filters.search, {
          type: 'websearch',
          // SANS le schéma : PostgREST refuse un nom qualifié et rend
          // « failed to parse filter (wfts(public.francais_sans_accent)…) »
          // en HTTP 400. Vérifié sur l'instance : la forme qualifiée rend
          // 400, la forme nue rend 200.
          config: 'francais_sans_accent',
        });
      }

      if (filters?.mimeTypes && filters.mimeTypes.length > 0) {
        query = query.in("mime_type", filters.mimeTypes);
      }

      if (filters?.tags && filters.tags.length > 0) {
        query = query.overlaps("tags", filters.tags);
      }

      if (filters?.createdBy) {
        query = query.eq("created_by", filters.createdBy);
      }

      if (filters?.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte("created_at", filters.dateTo);
      }

      // Tri
      query = query.order(sort.field, { ascending: sort.order === 'asc' });
      query = query.limit(limit);

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as unknown as DocumentWithRelations[];
    },
    staleTime: 30000,
  });
}

export function useDocument(documentId: string | null) {
  return useQuery({
    queryKey: [DOCUMENTS_QUERY_KEY, documentId],
    queryFn: async (): Promise<DocumentWithRelations | null> => {
      if (!documentId) return null;

      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          creator:profiles!documents_created_by_fkey(id, nom, prenom, avatar_url),
          relations:document_relations(
            id,
            relation_type,
            related_etablissement_id,
            related_tache_id,
            related_profile_id,
            related_groupe_id,
            related_partenaire_id,
            etablissement:etablissements(id, nom),
            tache:taches(id, titre),
            groupe:groupes_etablissements(id, nom),
            partenaire:partenaires(id, nom)
          ),
          shares:document_shares(
            id,
            permission_level,
            shared_at,
            expires_at,
            shared_with_user:profiles!document_shares_shared_with_user_id_fkey(id, nom, prenom, email, avatar_url),
            shared_by_user:profiles!document_shares_shared_by_fkey(id, nom, prenom)
          )
        `)
        .eq("id", documentId)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as DocumentWithRelations;
    },
    enabled: !!documentId,
  });
}

export function useDocumentsByEntity(
  entityType: 'etablissement' | 'tache' | 'profile' | 'groupe' | 'partenaire' | 'email_thread' | 'rd_user_story' | 'support_ticket',
  entityId: string | null
) {
  const relationField = `related_${entityType}_id`;

  return useQuery({
    queryKey: [DOCUMENTS_QUERY_KEY, 'by-entity', entityType, entityId],
    queryFn: async (): Promise<DocumentWithRelations[]> => {
      if (!entityId) return [];

      // D'abord récupérer les IDs de documents liés
      const { data: relations, error: relError } = await supabase
        .from("document_relations")
        .select("document_id")
        .eq(relationField as never, entityId);

      if (relError) throw relError;
      if (!relations || relations.length === 0) return [];

      const documentIds = relations.map(r => r.document_id);

      // Ensuite récupérer les documents
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          creator:profiles!documents_created_by_fkey(id, nom, prenom, avatar_url),
          relations:document_relations(
            id,
            relation_type,
            related_etablissement_id,
            related_tache_id,
            etablissement:etablissements(id, nom),
            tache:taches(id, titre)
          )
        `)
        .in("id", documentIds)
        .is("deleted_at", null)
        .eq("is_hard_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as DocumentWithRelations[];
    },
    enabled: !!entityId,
    staleTime: 30000,
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (documentId: string) => {
      if (!user) throw new Error("Non authentifié");

      // Soft delete
      const { error } = await supabase
        .from("documents")
        .update({ 
          deleted_at: new Date().toISOString(),
          deleted_by: user.id 
        })
        .eq("id", documentId);

      if (error) throw error;

      // Log audit via RPC
      await supabase.rpc('log_document_audit' as never, {
        p_document_id: documentId,
        p_action: 'deleted',
      } as never);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] });
      toast.success("Document supprimé");
    },
    onError: (error) => {
      debug.error("Erreur suppression document:", error);
      toast.error("Erreur lors de la suppression");
    },
  });
}

export function useRestoreDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (documentId: string) => {
      if (!user) throw new Error("Non authentifié");

      const { error } = await supabase
        .from("documents")
        .update({ 
          deleted_at: null,
          deleted_by: null 
        })
        .eq("id", documentId);

      if (error) throw error;

      // Log audit via RPC
      await supabase.rpc('log_document_audit' as never, {
        p_document_id: documentId,
        p_action: 'restored',
      } as never);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] });
      toast.success("Document restauré");
    },
    onError: (error) => {
      debug.error("Erreur restauration document:", error);
      toast.error("Erreur lors de la restauration");
    },
  });
}

export function useUpdateDocumentTags() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ documentId, tags }: { documentId: string; tags: string[] }) => {
      if (!user) throw new Error("Non authentifié");

      // Récupérer les anciens tags
      const { data: oldDoc } = await supabase
        .from("documents")
        .select("tags")
        .eq("id", documentId)
        .maybeSingle();

      const { error } = await supabase
        .from("documents")
        .update({ tags })
        .eq("id", documentId);

      if (error) throw error;

      // Log audit via RPC
      await supabase.rpc('log_document_audit' as never, {
        p_document_id: documentId,
        p_action: 'tagged',
        p_old_value: { tags: oldDoc?.tags || [] },
        p_new_value: { tags },
      } as never);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] });
      toast.success("Tags mis à jour");
    },
    onError: (error) => {
      debug.error("Erreur mise à jour tags:", error);
      toast.error("Erreur lors de la mise à jour des tags");
    },
  });
}

export function useRenameDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      if (!user) throw new Error("Non authentifié");

      // Récupérer l'ancien nom
      const { data: oldDoc } = await supabase
        .from("documents")
        .select("name")
        .eq("id", id)
        .maybeSingle();

      const { error } = await supabase
        .from("documents")
        .update({ name: newName })
        .eq("id", id);

      if (error) throw error;

      // Log audit via RPC
      await supabase.rpc('log_document_audit' as never, {
        p_document_id: id,
        p_action: 'renamed',
        p_old_value: { name: oldDoc?.name },
        p_new_value: { name: newName },
      } as never);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] });
      toast.success("Document renommé");
    },
    onError: (error) => {
      debug.error("Erreur renommage document:", error);
      toast.error("Erreur lors du renommage");
    },
  });
}

export function useAddDocumentRelation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (relation: Omit<DocumentRelation, 'id' | 'created_at'>) => {
      if (!user) throw new Error("Non authentifié");

      const { error } = await supabase
        .from("document_relations")
        .insert({
          ...relation,
          created_by: user.id,
        });

      if (error) throw error;

      // Log audit via RPC
      await supabase.rpc('log_document_audit' as never, {
        p_document_id: relation.document_id,
        p_action: 'relation_added',
        p_new_value: relation as never,
      } as never);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] });
      toast.success("Relation ajoutée");
    },
    onError: (error) => {
      debug.error("Erreur ajout relation:", error);
      toast.error("Erreur lors de l'ajout de la relation");
    },
  });
}
