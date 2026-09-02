import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogueStat {
  produit_id: string;
  nb_devis: number;
  nb_factures: number;
  ca_cumule_ht: number;
  derniere_utilisation: string | null;
}

export function useCatalogueStats() {
  return useQuery({
    queryKey: ["catalogue_stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_catalogue_stats");
      if (error) throw error;
      const map = new Map<string, CatalogueStat>();
      (data as CatalogueStat[] || []).forEach((s) => map.set(s.produit_id, s));
      return map;
    },
    staleTime: 60_000,
  });
}
