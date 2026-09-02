import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { debug } from "@/lib/debug";

export interface ContractSection {
  id: string;
  contrat_id: string | null;
  parent_id: string | null;
  titre: string;
  contenu_html: string | null;
  ordre: number;
  type: 'section' | 'article' | 'clause' | 'annexe';
  clause_source_id: string | null;
  variables_values: Record<string, string>;
  metadata: Record<string, unknown>;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  children?: ContractSection[];
}

export interface SectionVersion {
  id: string;
  section_id: string;
  contenu_html: string | null;
  titre: string | null;
  note: string | null;
  version_number: number;
  created_by: string | null;
  created_at: string;
}

// Récupérer les sections d'un contrat (structure plate)
export function useContractSections(contratId: string | undefined) {
  return useQuery({
    queryKey: ["contract-sections", contratId],
    queryFn: async () => {
      if (!contratId) return [];
      
      const { data, error } = await supabase
        .from("contrat_sections")
        .select("id, contrat_id, parent_id, titre, contenu_html, ordre, type, clause_source_id, variables_values, metadata, is_locked, created_at, updated_at")
        .eq("contrat_id", contratId)
        .order("ordre", { ascending: true })
        .limit(500);

      if (error) throw error;
      return data as ContractSection[];
    },
    enabled: !!contratId,
  });
}

// Construire l'arborescence hiérarchique
export function buildSectionTree(sections: ContractSection[]): ContractSection[] {
  const sectionMap = new Map<string, ContractSection>();
  const roots: ContractSection[] = [];

  // Créer une map et initialiser children
  sections.forEach(section => {
    sectionMap.set(section.id, { ...section, children: [] });
  });

  // Construire l'arbre
  sections.forEach(section => {
    const node = sectionMap.get(section.id)!;
    if (section.parent_id && sectionMap.has(section.parent_id)) {
      sectionMap.get(section.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  // Trier les enfants par ordre
  const sortChildren = (nodes: ContractSection[]) => {
    nodes.sort((a, b) => a.ordre - b.ordre);
    nodes.forEach(node => {
      if (node.children?.length) {
        sortChildren(node.children);
      }
    });
  };

  sortChildren(roots);
  return roots;
}

// Créer une section
export function useCreateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<ContractSection>) => {
      const insertData: Record<string, unknown> = {
        contrat_id: data.contrat_id,
        parent_id: data.parent_id || null,
        titre: data.titre || "Nouvelle section",
        contenu_html: data.contenu_html || "",
        ordre: data.ordre ?? 0,
        type: data.type || "section",
        clause_source_id: data.clause_source_id || null,
        variables_values: data.variables_values || {},
        metadata: data.metadata || {},
        is_locked: data.is_locked ?? false,
      };

      const { data: result, error } = await supabase
        .from("contrat_sections")
        .insert(insertData as never)
        .select()
        .single(); // safe: guaranteed-row

      if (error) throw error;
      return result as ContractSection;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contract-sections", variables.contrat_id] });
    },
    onError: (error) => {
      debug.error("Erreur création section:", error);
      toast.error("Erreur lors de la création de la section");
    },
  });
}

// Mettre à jour une section
export function useUpdateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, contrat_id, ...data }: Partial<ContractSection> & { id: string; contrat_id: string | null }) => {
      const updateData: Record<string, unknown> = {};
      if (data.titre !== undefined) updateData.titre = data.titre;
      if (data.contenu_html !== undefined) updateData.contenu_html = data.contenu_html;
      if (data.ordre !== undefined) updateData.ordre = data.ordre;
      if (data.parent_id !== undefined) updateData.parent_id = data.parent_id;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.is_locked !== undefined) updateData.is_locked = data.is_locked;
      if (data.variables_values !== undefined) updateData.variables_values = data.variables_values;

      const { data: result, error } = await supabase
        .from("contrat_sections")
        .update(updateData as never)
        .eq("id", id)
        .select()
        .single(); // safe: guaranteed-row

      if (error) throw error;
      return { ...result, contrat_id } as ContractSection;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["contract-sections", result.contrat_id] });
    },
    onError: (error) => {
      debug.error("Erreur mise à jour section:", error);
      toast.error("Erreur lors de la mise à jour");
    },
  });
}

// Supprimer une section
export function useDeleteSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, contrat_id }: { id: string; contrat_id: string }) => {
      const { error } = await supabase
        .from("contrat_sections")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return contrat_id;
    },
    onSuccess: (contrat_id) => {
      queryClient.invalidateQueries({ queryKey: ["contract-sections", contrat_id] });
      toast.success("Section supprimée");
    },
    onError: (error) => {
      debug.error("Erreur suppression section:", error);
      toast.error("Erreur lors de la suppression");
    },
  });
}

// Réordonner les sections (drag & drop)
export function useReorderSections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contrat_id, sections }: { contrat_id: string; sections: { id: string; ordre: number; parent_id: string | null }[] }) => {
      // Mettre à jour en batch
      const promises = sections.map(({ id, ordre, parent_id }) =>
        supabase
          .from("contrat_sections")
          .update({ ordre, parent_id })
          .eq("id", id)
      );

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      if (errors.length) throw errors[0].error;

      return contrat_id;
    },
    onSuccess: (contrat_id) => {
      queryClient.invalidateQueries({ queryKey: ["contract-sections", contrat_id] });
    },
    onError: (error) => {
      debug.error("Erreur réordonnancement:", error);
      toast.error("Erreur lors du réordonnancement");
    },
  });
}

// Versions d'une section
export function useSectionVersions(sectionId: string | undefined) {
  return useQuery({
    queryKey: ["section-versions", sectionId],
    queryFn: async () => {
      if (!sectionId) return [];
      
      const { data, error } = await supabase
        .from("contrat_section_versions")
        .select("id, section_id, contenu_html, titre, note, version_number, created_by, created_at")
        .eq("section_id", sectionId)
        .order("version_number", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []).map(v => ({
        ...v,
        titre: v.titre ?? undefined,
        note: v.note ?? undefined,
      })) as SectionVersion[];
    },
    enabled: !!sectionId,
  });
}

// Restaurer une version
export function useRestoreVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sectionId, version }: { sectionId: string; version: SectionVersion }) => {
      const { error } = await supabase
        .from("contrat_sections")
        .update({
          contenu_html: version.contenu_html ?? undefined,
          titre: version.titre ?? undefined,
        })
        .eq("id", sectionId);

      if (error) throw error;
      return sectionId;
    },
    onSuccess: (sectionId) => {
      queryClient.invalidateQueries({ queryKey: ["contract-sections"] });
      queryClient.invalidateQueries({ queryKey: ["section-versions", sectionId] });
      toast.success("Version restaurée");
    },
    onError: (error) => {
      debug.error("Erreur restauration:", error);
      toast.error("Erreur lors de la restauration");
    },
  });
}

// Créer une section à partir d'une clause type
export function useCreateSectionFromClause() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      contrat_id, 
      clauseId, 
      titre, 
      contenu, 
      ordre,
      parent_id 
    }: { 
      contrat_id: string; 
      clauseId: string; 
      titre: string; 
      contenu: string;
      ordre: number;
      parent_id?: string;
    }) => {
      // Créer la section
      const { data: result, error } = await supabase
        .from("contrat_sections")
        .insert([{
          contrat_id,
          parent_id: parent_id || null,
          titre,
          contenu_html: contenu,
          ordre,
          type: "clause",
          clause_source_id: clauseId,
          variables_values: {},
          metadata: {},
        }])
        .select()
        .single(); // safe: guaranteed-row

      if (error) throw error;

      // Incrémenter le compteur d'usage (optionnel, on ignore les erreurs)
      try {
        await supabase
          .from("contrat_clauses")
          .update({ usage_count: 1 })
          .eq("id", clauseId);
      } catch { /* ignore */ }

      return result as ContractSection;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contract-sections", variables.contrat_id] });
      queryClient.invalidateQueries({ queryKey: ["contrat-clauses"] });
      toast.success("Clause ajoutée au contrat");
    },
    onError: (error) => {
      debug.error("Erreur ajout clause:", error);
      toast.error("Erreur lors de l'ajout de la clause");
    },
  });
}
