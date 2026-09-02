import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeSupabaseError } from "@/lib/supabaseErrorSanitizer";

interface SuccesData {
  type: "succes";
  etablissementId: string;
  etablissementNom?: string;
  pallierVise: string;
  tarifsData: Record<string, number>;
  seuilsData: Record<string, number>;
  fraisAcces: number;
}

interface StatiqueData {
  type: "statique";
  etablissementId: string;
  etablissementNom?: string;
  tarifAnnuel: number;
  fraisAcces: number;
}

type ValidateQuoteData = SuccesData | StatiqueData;

export function useQuoteValidationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ValidateQuoteData) => {
      if (data.type === "succes") {
        const { error } = await supabase
          .from("etablissements")
          .update({
            type_offre: "Au succès",
            pallier_vise: `Palier ${data.pallierVise}`,
            tarifs_palliers: data.tarifsData,
            seuils_palliers: data.seuilsData,
            modele_statique_succes: null,
          })
          .eq("id", data.etablissementId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("etablissements")
          .update({
            type_offre: "Statique",
            modele_statique_succes: String(data.tarifAnnuel),
            tarifs_palliers: { frais_acces: data.fraisAcces },
            pallier_vise: null,
            seuils_palliers: null,
          })
          .eq("id", data.etablissementId);
        if (error) throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      const label = data.type === "succes" ? "Au succès" : "Statique";
      toast.success(
        `Offre "${label}" enregistrée pour ${data.etablissementNom || "l'établissement"}`
      );
      queryClient.invalidateQueries({ queryKey: ["etablissement", data.etablissementId] });
      queryClient.invalidateQueries({ queryKey: ["etablissements"] });
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });
}
