/**
 * Récupère toutes les tâches portail client (assignée à marque) pour fusion
 * dans la vue /projets. Mappées au format TacheData pour réutiliser les vues existantes.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PortalTaskMapped {
  id: string; // préfixé "portal-"
  __isPortal: true;
  __portalRawId: string;
  titre: string;
  description: string | null;
  statut: string; // "A faire" | "En cours" | "Terminé"
  priorite: string;
  echeance: string | null;
  date_debut: string | null;
  date_realisation: string | null;
  responsable_id: string | null;
  etablissement_id: string | null;
  categorie_id: string | null;
  archive: boolean;
  created_at: string;
  updated_at: string;
  ordre: number;
  categories_taches: { id: string; nom: string; couleur: string } | null;
  etablissements: { id: string; nom: string } | null;
  responsable_profile: null;
  __phase: "deploiement" | "production" | null;
}

const STATUT_MAP: Record<string, string> = {
  todo: "A faire",
  in_progress: "En cours",
  done: "Terminé",
};

export function useAllPortalTasksForProjets() {
  return useQuery({
    queryKey: ["all_portal_tasks_for_projets"],
    queryFn: async (): Promise<PortalTaskMapped[]> => {
      const { data, error } = await supabase
        .from("client_portal_tasks")
        .select("id, etablissement_id, titre, description, assignee, statut, phase, due_date, created_at, updated_at, etablissements(id, nom)")
        .eq("assignee", "marque")
        .neq("statut", "done")
        .order("created_at", { ascending: false });

      if (error) throw error;

      type PortalTaskRow = {
        id: string;
        titre: string;
        description: string | null;
        statut: string;
        phase: PortalTaskMapped["__phase"];
        due_date: string | null;
        etablissement_id: string | null;
        created_at: string;
        updated_at: string;
        etablissements: { id: string; nom: string } | null;
      };
      return ((data ?? []) as PortalTaskRow[]).map((row): PortalTaskMapped => ({
        id: `portal-${row.id}`,
        __isPortal: true,
        __portalRawId: row.id,
        titre: row.titre,
        description: row.description,
        statut: STATUT_MAP[row.statut] ?? "A faire",
        priorite: "medium",
        echeance: row.due_date,
        date_debut: null,
        date_realisation: null,
        responsable_id: null,
        etablissement_id: row.etablissement_id,
        categorie_id: null,
        archive: false,
        created_at: row.created_at,
        updated_at: row.updated_at,
        ordre: 0,
        categories_taches: { id: "portal", nom: "Portail client", couleur: "#8b5cf6" },
        etablissements: row.etablissements ?? null,
        responsable_profile: null,
        __phase: row.phase ?? null,
      }));
    },
    staleTime: 60_000,
  });
}
