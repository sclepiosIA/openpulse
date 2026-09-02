import { useQuery } from "@tanstack/react-query";
import { fromExtended } from "@/lib/supabaseTyped";

export interface EtablissementWithDocuments {
  id: string;
  nom: string;
  ville: string | null;
  logo_url: string | null;
  etablissement_logo_url: string | null;
  groupe_logo_url: string | null;
  groupe_nom: string | null;
  statut: string | null;
  document_count: number;
}

/** Raw row from the etablissements_with_documents view */
interface EtablissementWithDocumentsRow {
  id: string;
  nom: string;
  ville: string | null;
  logo_url: string | null;
  etablissement_logo_url: string | null;
  groupe_logo_url: string | null;
  groupe_nom: string | null;
  statut: string | null;
  document_count: number;
}

/**
 * Hook pour récupérer les établissements qui ont des documents liés
 * Utilise la vue SQL etablissements_with_documents avec logo groupe en fallback
 */
export function useEtablissementsWithDocuments() {
  return useQuery({
    queryKey: ['etablissements-with-documents'],
    queryFn: async (): Promise<EtablissementWithDocuments[]> => {
      const { data, error } = await fromExtended("etablissements_with_documents")
        .select("id, nom, ville, logo_url, etablissement_logo_url, groupe_logo_url, groupe_nom, statut, document_count")
        .order("nom", { ascending: true })
        .limit(1000);

      if (error) throw error;
      
      return ((data || []) as EtablissementWithDocumentsRow[]).map((e) => ({
        id: e.id,
        nom: e.nom,
        ville: e.ville,
        logo_url: e.logo_url,
        etablissement_logo_url: e.etablissement_logo_url,
        groupe_logo_url: e.groupe_logo_url,
        groupe_nom: e.groupe_nom,
        statut: e.statut,
        document_count: Number(e.document_count) || 0
      }));
    },
    staleTime: 60000,
  });
}
