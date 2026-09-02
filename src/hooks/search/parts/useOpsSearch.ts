/**
 * DEBT-02 — Split de `useGlobalSearch.ts` (session 72).
 * Slice "Ops" : todos perso, R&D (stories/projets), tickets support, partenaires.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { sanitizePostgrestValue, buildIlikeOrFilter } from "@/lib/sanitize";
import type { SearchResult, SearchPermissions } from "../useGlobalSearch.types";

export function useOpsSearch(
  debouncedSearch: string,
  shouldSearch: boolean,
  permissions?: SearchPermissions,
) {
  const { data: todos = [], isLoading: l1 } = useQuery({
    queryKey: ["global-search-todos", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("personal_todos")
        .select("id, title, description, is_done, due_date")
        .or(buildIlikeOrFilter(["title", "description"], s))
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []).map((t): SearchResult => ({
        id: t.id, type: "todo", title: t.title,
        subtitle: t.due_date ? format(new Date(t.due_date), "d MMM yyyy", { locale: fr }) : undefined,
        badge: t.is_done ? "Terminé" : undefined,
        href: `/todos?id=${t.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: rdUserStories = [], isLoading: l2 } = useQuery({
    queryKey: ["global-search-rd-user-stories", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("rd_user_stories")
        .select("id, titre, description, statut, points, sprint:rd_sprints(id, nom)")
        .or(buildIlikeOrFilter(["titre", "description"], s))
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []).map((us): SearchResult => ({
        id: us.id, type: "rd_user_story", title: us.titre,
        subtitle: (us.sprint as { nom?: string } | null)?.nom || us.statut || undefined,
        badge: us.points ? `${us.points} pts` : undefined,
        href: `/rd?story=${us.id}`,
      }));
    },
    enabled: shouldSearch && (permissions?.canViewRD !== false),
    staleTime: 30000,
  });

  const { data: rdProjets = [], isLoading: l3 } = useQuery({
    queryKey: ["global-search-rd-projets", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("rd_projets")
        .select("id, nom, description, statut")
        .or(buildIlikeOrFilter(["nom", "description"], s))
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []).map((p): SearchResult => ({
        id: p.id, type: "rd_projet", title: p.nom,
        subtitle: p.description?.substring(0, 50) || undefined,
        badge: p.statut || undefined, href: `/rd?projet=${p.id}`,
      }));
    },
    enabled: shouldSearch && (permissions?.canViewRD !== false),
    staleTime: 30000,
  });

  const { data: supportTickets = [], isLoading: l4 } = useQuery({
    queryKey: ["global-search-support-tickets", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, titre, description, statut, priorite, numero_ticket")
        .or(buildIlikeOrFilter(["titre", "description", "numero_ticket"], s))
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []).map((t): SearchResult => ({
        id: t.id, type: "support_ticket",
        title: t.numero_ticket ? `#${t.numero_ticket}: ${t.titre}` : t.titre,
        subtitle: t.statut || undefined,
        badge: t.priorite === "haute" || t.priorite === "urgente" ? "Urgent" : undefined,
        href: `/support?ticket=${t.id}`,
      }));
    },
    enabled: shouldSearch && (permissions?.canViewAllTickets !== false),
    staleTime: 30000,
  });

  const { data: partenaires = [], isLoading: l5 } = useQuery({
    queryKey: ["global-search-partenaires", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("partenaires")
        .select("id, nom, type_partenaire, ville")
        .or(`nom.ilike.%${s}%,ville.ilike.%${s}%`)
        .limit(5);
      if (error) throw error;
      return (data || []).map((p): SearchResult => ({
        id: p.id, type: "partenaire", title: p.nom,
        subtitle: p.ville || undefined,
        badge: p.type_partenaire || undefined,
        href: `/partenaires/${p.id}`,
      }));
    },
    enabled: shouldSearch && (permissions?.canViewAllEtablissements !== false),
    staleTime: 30000,
  });

  return {
    slice: { todos, rdUserStories, rdProjets, supportTickets, partenaires },
    isLoading: l1 || l2 || l3 || l4 || l5,
  };
}
