/**
 * DEBT-02 — Split de `useGlobalSearch.ts` (session 72).
 * Slice "Core" : entités centrales (établissements, emails, tâches, contacts,
 * groupes, événements calendrier, messages/conversations Pulse, profils, documents).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { sanitizePostgrestValue, buildIlikeOrFilter } from "@/lib/sanitize";
import type { SearchResult, SearchPermissions } from "../useGlobalSearch.types";

export function useCoreSearch(
  debouncedSearch: string,
  shouldSearch: boolean,
  permissions?: SearchPermissions,
) {
  const { data: etablissements = [], isLoading: l1 } = useQuery({
    queryKey: ["global-search-etablissements", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("etablissements")
        .select("id, nom, ville, statut")
        .or(buildIlikeOrFilter(["nom", "ville"], s))
        .limit(5);
      if (error) throw error;
      return (data || []).map((e): SearchResult => ({
        id: e.id, type: "etablissement", title: e.nom,
        subtitle: e.ville || undefined, badge: e.statut || undefined,
        href: `/etablissements/${e.id}`,
      }));
    },
    enabled: shouldSearch && (permissions?.canViewAllEtablissements !== false),
    staleTime: 30000,
  });

  const { data: emails = [], isLoading: l2 } = useQuery({
    queryKey: ["global-search-emails", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("email_threads")
        .select("id, subject, ai_generated_title, category, last_message_date, etablissement:etablissements(id, nom)")
        .or(buildIlikeOrFilter(["subject", "ai_summary"], s))
        .order("last_message_date", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []).map((e): SearchResult => {
        const etab = e.etablissement as { id: string; nom: string } | null;
        return {
          id: e.id, type: "email",
          title: e.ai_generated_title || e.subject,
          subtitle: e.category || undefined, badge: e.category || undefined,
          href: `/emails?thread=${e.id}`,
          linkedEtablissement: etab?.id ? { id: etab.id, nom: etab.nom } : undefined,
        };
      });
    },
    enabled: shouldSearch && !!(permissions?.canViewAllEmails || permissions?.canViewSharedEmails),
    staleTime: 30000,
  });

  const { data: taches = [], isLoading: l3 } = useQuery({
    queryKey: ["global-search-taches", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("taches")
        .select("id, titre, statut, priorite, etablissement_id, etablissement:etablissements(id, nom)")
        .or(buildIlikeOrFilter(["titre", "description"], s))
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []).map((t): SearchResult => {
        const etab = t.etablissement as { id: string; nom: string } | null;
        return {
          id: t.id, type: "tache", title: t.titre,
          subtitle: t.statut || undefined,
          badge: t.priorite === "high" ? "Haute" : t.priorite === "medium" ? "Moyenne" : undefined,
          href: t.etablissement_id ? `/etablissements/${t.etablissement_id}?tab=kanban` : `/gantt`,
          linkedEtablissement: etab?.id ? { id: etab.id, nom: etab.nom } : undefined,
        };
      });
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: contacts = [], isLoading: l4 } = useQuery({
    queryKey: ["global-search-contacts", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("contacts")
        .select("id, nom, prenom, email, fonction, etablissement_id")
        .or(buildIlikeOrFilter(["nom", "prenom", "email"], s))
        .limit(5);
      if (error) throw error;
      return (data || []).map((c): SearchResult => {
        const fullName = `${c.prenom || ""} ${c.nom}`.trim();
        const href = c.email
          ? `/emails?compose=true&to=${encodeURIComponent(c.email)}&toName=${encodeURIComponent(fullName)}`
          : c.etablissement_id
            ? `/etablissements/${c.etablissement_id}?tab=contacts`
            : `/etablissements`;
        return {
          id: c.id, type: "contact", title: fullName,
          subtitle: c.fonction || c.email || undefined, href,
        };
      });
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: groupes = [], isLoading: l5 } = useQuery({
    queryKey: ["global-search-groupes", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("groupes_etablissements")
        .select("id, nom, type")
        .ilike("nom", `%${s}%`)
        .limit(5);
      if (error) throw error;
      return (data || []).map((g): SearchResult => ({
        id: g.id, type: "groupe", title: g.nom,
        subtitle: g.type || undefined, href: `/groupes/${g.id}`,
      }));
    },
    enabled: shouldSearch && (permissions?.canViewAllEtablissements !== false),
    staleTime: 30000,
  });

  const { data: events = [], isLoading: l6 } = useQuery({
    queryKey: ["global-search-events", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("calendar_events")
        .select("id, title, description, location, start_time, status, etablissement:etablissements(id, nom)")
        .or(buildIlikeOrFilter(["title", "description", "location"], s))
        .neq("status", "cancelled")
        .order("start_time", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []).map((e): SearchResult => {
        const etab = e.etablissement as { id: string; nom: string } | null;
        return {
          id: e.id, type: "event", title: e.title,
          subtitle: e.start_time ? format(new Date(e.start_time), "d MMM yyyy à HH:mm", { locale: fr }) : undefined,
          badge: e.location || undefined,
          href: `/calendrier?event=${e.id}`,
          linkedEtablissement: etab?.id ? { id: etab.id, nom: etab.nom } : undefined,
        };
      });
    },
    enabled: shouldSearch && (permissions?.canViewCalendar !== false),
    staleTime: 30000,
  });

  const { data: pulseMessages = [], isLoading: l7 } = useQuery({
    queryKey: ["global-search-pulse", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("pulse_messages")
        .select(`id, content, created_at, conversation_id, conversation:pulse_conversations!inner(name)`)
        .is("deleted_at", null)
        .ilike("content", `%${s}%`)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []).map((m): SearchResult => {
        const truncated = m.content.length > 60 ? m.content.substring(0, 60) + "..." : m.content;
        return {
          id: m.id, type: "pulse", title: truncated,
          subtitle: (m.conversation as { name?: string } | null)?.name || "Conversation",
          badge: format(new Date(m.created_at), "d MMM", { locale: fr }),
          href: `/pulse?conversation=${m.conversation_id}&message=${m.id}`,
        };
      });
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: pulseConversations = [], isLoading: l8 } = useQuery({
    queryKey: ["global-search-pulse-conversations", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("pulse_conversations")
        .select("id, name, description, updated_at")
        .or(buildIlikeOrFilter(["name", "description"], s))
        .order("updated_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []).map((c): SearchResult => ({
        id: c.id, type: "pulse_conversation",
        title: c.name || "Conversation sans nom",
        subtitle: c.description ? (c.description.length > 50 ? c.description.substring(0, 50) + "..." : c.description) : undefined,
        badge: format(new Date(c.updated_at), "d MMM", { locale: fr }),
        href: `/pulse?conversation=${c.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: profiles = [], isLoading: l9 } = useQuery({
    queryKey: ["global-search-profiles", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nom, prenom, email, fonction, avatar_url")
        .or(buildIlikeOrFilter(["nom", "prenom", "email", "fonction"], s))
        .limit(5);
      if (error) throw error;
      return (data || []).map((p): SearchResult => ({
        id: p.id, type: "profile",
        title: `${p.prenom || ""} ${p.nom || ""}`.trim() || p.email,
        subtitle: p.fonction || p.email || undefined,
        href: `/people?profile=${p.id}`,
      }));
    },
    enabled: shouldSearch && permissions?.viewScope !== "own",
    staleTime: 30000,
  });

  const { data: documents = [], isLoading: l10 } = useQuery({
    queryKey: ["global-search-central-documents", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, description, mime_type, created_at")
        .is("deleted_at", null)
        .or(buildIlikeOrFilter(["name", "description"], s))
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      const badge = (mt: string) => {
        if (mt?.startsWith("image/")) return "Image";
        if (mt?.includes("pdf")) return "PDF";
        if (mt?.includes("word") || mt?.includes("document")) return "Word";
        if (mt?.includes("sheet") || mt?.includes("excel")) return "Excel";
        if (mt?.includes("presentation") || mt?.includes("powerpoint")) return "PPT";
        return undefined;
      };
      return (data || []).map((d): SearchResult => ({
        id: d.id, type: "document", title: d.name,
        subtitle: d.description?.substring(0, 50) || undefined,
        badge: badge(d.mime_type), href: `/documents?doc=${d.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  return {
    slice: {
      etablissements, emails, taches, contacts, groupes, events,
      pulseMessages, pulseConversations, profiles, documents,
    },
    isLoading: l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8 || l9 || l10,
  };
}
