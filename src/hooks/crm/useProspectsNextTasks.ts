import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProspectNextTask {
  id: string;
  etablissement_id: string;
  titre: string;
  echeance: string | null;
}

export const PROSPECTS_NEXT_TASKS_KEY = ["prospects-next-tasks"] as const;

export function useProspectsNextTasks() {
  return useQuery({
    queryKey: PROSPECTS_NEXT_TASKS_KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("taches")
        .select("id,etablissement_id,titre,echeance,statut,archive,created_at")
        .not("etablissement_id", "is", null)
        .neq("statut", "Terminé")
        .eq("archive", false)
        .order("created_at", { ascending: false })
        .limit(3000);
      if (error) throw error;

      const map = new Map<string, ProspectNextTask>();
      const rows = (data ?? []) as Array<{
        id: string;
        etablissement_id: string | null;
        titre: string;
        echeance: string | null;
      }>;

      for (const t of rows) {
        if (!t.etablissement_id) continue;
        if (!map.has(t.etablissement_id)) {
          map.set(t.etablissement_id, {
            id: t.id,
            etablissement_id: t.etablissement_id,
            titre: t.titre,
            echeance: t.echeance,
          });
        }
      }
      return map;

    },
  });
}
