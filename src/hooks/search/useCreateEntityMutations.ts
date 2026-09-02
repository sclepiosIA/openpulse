import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSupabaseError } from "@/lib/supabaseErrorSanitizer";

interface CreateEntityData {
  nom: string;
  ville?: string;
  type?: string;
  logo_url?: string | null;
}

export function useCreateEntityMutations() {
  const createEtablissement = useMutation({
    mutationFn: async (data: CreateEntityData) => {
      const { data: result, error } = await supabase
        .from("etablissements")
        .insert([{
          nom: data.nom,
          ville: data.ville || "",
          region: data.ville || "France",
          type: (data.type || "CH") as never,
          statut: "Prospect" as never,
          date_prise_contact: new Date().toISOString().split('T')[0],
          adresse: "",
          code_postal: "",
          slug: "",
          logo_url: data.logo_url,
        }])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
  });

  const createPartenaire = useMutation({
    mutationFn: async (data: CreateEntityData) => {
      const { data: result, error } = await supabase
        .from("partenaires")
        .insert({
          nom: data.nom,
          ville: data.ville || "",
          type_partenaire: data.type || "Éditeur de logiciels",
          logo_url: data.logo_url,
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
  });

  const createGroupe = useMutation({
    mutationFn: async (data: CreateEntityData) => {
      const { data: result, error } = await supabase
        .from("groupes_etablissements")
        .insert({
          nom: data.nom,
          type: data.type || "Groupe hospitalier",
          logo_url: data.logo_url,
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
  });

  const createEntity = async (
    type: "etablissement" | "partenaire" | "groupe",
    data: CreateEntityData
  ) => {
    switch (type) {
      case "etablissement":
        return createEtablissement.mutateAsync(data);
      case "partenaire":
        return createPartenaire.mutateAsync(data);
      case "groupe":
        return createGroupe.mutateAsync(data);
    }
  };

  return {
    createEntity,
    isCreating:
      createEtablissement.isPending ||
      createPartenaire.isPending ||
      createGroupe.isPending,
    error: sanitizeSupabaseError(
      createEtablissement.error || createPartenaire.error || createGroupe.error
    ),
  };
}
