/**
 * DEBT-02 — Split de `useGlobalSearch.ts` (session 72).
 * Slice "Finance & RH" : absences, revenus, dépenses, alertes proactives,
 * sondages Pulse, notes dashboard, évaluations candidats.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { sanitizePostgrestValue, buildIlikeOrFilter } from "@/lib/sanitize";
import type { SearchResult } from "../useGlobalSearch.types";

export function useFinanceSearch(debouncedSearch: string, shouldSearch: boolean) {
  const { data: absences = [], isLoading: l1 } = useQuery({
    queryKey: ["global-search-absences", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("rh_absences")
        .select("id, type_absence, statut, date_debut, date_fin, demandeur_commentaire")
        .or(`type_absence.ilike.%${s}%,demandeur_commentaire.ilike.%${s}%`)
        .order("date_debut", { ascending: false }).limit(5);
      if (error) throw error;
      return (data || []).map((a): SearchResult => ({
        id: a.id, type: "absence",
        title: a.type_absence || "Absence",
        subtitle: a.date_debut ? format(new Date(a.date_debut), "d MMM yyyy", { locale: fr }) : undefined,
        badge: a.statut || undefined, href: `/people?absence=${a.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: revenus = [], isLoading: l2 } = useQuery({
    queryKey: ["global-search-revenus", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("tresorerie_revenus")
        .select("id, numero_facture, notes, type_revenu, statut, montant_prevu, date_prevue")
        .or(`numero_facture.ilike.%${s}%,notes.ilike.%${s}%,reference_paiement.ilike.%${s}%`)
        .order("date_prevue", { ascending: false, nullsFirst: false }).limit(5);
      if (error) throw error;
      return (data || []).map((r): SearchResult => ({
        id: r.id, type: "revenu",
        title: r.numero_facture ? `Revenu ${r.numero_facture}` : (r.notes?.substring(0, 60) || "Revenu"),
        subtitle: r.type_revenu || undefined, badge: r.statut || undefined,
        href: `/tresorerie?revenu=${r.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: depenses = [], isLoading: l3 } = useQuery({
    queryKey: ["global-search-depenses", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("tresorerie_depenses")
        .select("id, nom, notes, sous_categorie, statut, montant, date_prevue")
        .or(`nom.ilike.%${s}%,notes.ilike.%${s}%,sous_categorie.ilike.%${s}%`)
        .order("date_prevue", { ascending: false, nullsFirst: false }).limit(5);
      if (error) throw error;
      return (data || []).map((d): SearchResult => ({
        id: d.id, type: "depense",
        title: d.nom || "Dépense", subtitle: d.sous_categorie || undefined,
        badge: d.statut || undefined, href: `/tresorerie?depense=${d.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: proactiveAlerts = [], isLoading: l4 } = useQuery({
    queryKey: ["global-search-proactive-alerts", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("proactive_alerts")
        .select("id, titre, description, severite, statut, etablissement_id")
        .or(buildIlikeOrFilter(["titre", "description"], s))
        .neq("statut", "resolved")
        .order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (data || []).map((a): SearchResult => ({
        id: a.id, type: "proactive_alert", title: a.titre,
        subtitle: a.description?.substring(0, 60) || undefined,
        badge: a.severite || undefined,
        href: a.etablissement_id ? `/etablissements/${a.etablissement_id}?alert=${a.id}` : `/alertes?id=${a.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: polls = [], isLoading: l5 } = useQuery({
    queryKey: ["global-search-polls", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("pulse_polls")
        .select("id, question, conversation_id, created_at")
        .ilike("question", `%${s}%`)
        .order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (data || []).map((p): SearchResult => ({
        id: p.id, type: "poll", title: p.question,
        subtitle: p.created_at ? format(new Date(p.created_at), "d MMM yyyy", { locale: fr }) : undefined,
        href: `/pulse?conversation=${p.conversation_id}&poll=${p.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: dashboardNotes = [], isLoading: l6 } = useQuery({
    queryKey: ["global-search-dashboard-notes", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("dashboard_notes")
        .select("id, tab_name, content, updated_at")
        .or(`tab_name.ilike.%${s}%,content.ilike.%${s}%`)
        .order("updated_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (data || []).map((n): SearchResult => ({
        id: n.id, type: "dashboard_note",
        title: n.tab_name || "Note",
        subtitle: n.content?.substring(0, 80) || undefined,
        href: `/?note=${n.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: candidateEvaluations = [], isLoading: l7 } = useQuery({
    queryKey: ["global-search-candidate-evaluations", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("candidate_evaluations")
        .select("id, candidate_id, commentaire_general, recommandation, note_globale, points_forts")
        .or(`commentaire_general.ilike.%${s}%,points_forts.ilike.%${s}%,recommandation.ilike.%${s}%`)
        .order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (data || []).map((e): SearchResult => ({
        id: e.id, type: "candidate_evaluation",
        title: e.commentaire_general?.substring(0, 60) || "Évaluation",
        subtitle: e.recommandation || undefined,
        badge: e.note_globale != null ? `${e.note_globale}/10` : undefined,
        href: `/recrutement?candidate=${e.candidate_id}&evaluation=${e.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  return {
    slice: {
      absences, revenus, depenses, proactiveAlerts, polls,
      dashboardNotes, candidateEvaluations,
    },
    isLoading: l1 || l2 || l3 || l4 || l5 || l6 || l7,
  };
}
