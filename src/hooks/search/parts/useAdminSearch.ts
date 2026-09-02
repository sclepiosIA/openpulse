/**
 * DEBT-02 — Split de `useGlobalSearch.ts` (session 72).
 * Slice "Admin" : avoirs, templates email/contrat, séquences, bookings, playbooks,
 * agents IA, segments, calendriers.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { sanitizePostgrestValue, buildIlikeOrFilter } from "@/lib/sanitize";
import type { SearchResult, SearchPermissions } from "../useGlobalSearch.types";

export function useAdminSearch(
  debouncedSearch: string,
  shouldSearch: boolean,
  permissions?: SearchPermissions,
) {
  const { data: avoirs = [], isLoading: l1 } = useQuery({
    queryKey: ["global-search-avoirs", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("avoirs")
        .select("id, numero, client_nom, statut")
        .or(`numero.ilike.%${s}%,client_nom.ilike.%${s}%`)
        .order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (data || []).map((a): SearchResult => ({
        id: a.id, type: "avoir",
        title: a.numero ? `Avoir ${a.numero}` : "Avoir",
        subtitle: a.client_nom || undefined, badge: a.statut || undefined,
        href: `/facturation?avoir=${a.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: emailTemplates = [], isLoading: l2 } = useQuery({
    queryKey: ["global-search-email-templates", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, name, subject")
        .or(`name.ilike.%${s}%,subject.ilike.%${s}%`).limit(5);
      if (error) throw error;
      return (data || []).map((t): SearchResult => ({
        id: t.id, type: "email_template",
        title: t.name, subtitle: t.subject || undefined,
        href: `/parametres?tab=email-templates&id=${t.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: emailSequences = [], isLoading: l3 } = useQuery({
    queryKey: ["global-search-email-sequences", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("email_sequences")
        .select("id, nom, description, statut")
        .or(buildIlikeOrFilter(["nom", "description"], s)).limit(5);
      if (error) throw error;
      return (data || []).map((seq): SearchResult => ({
        id: seq.id, type: "email_sequence",
        title: seq.nom, subtitle: seq.description?.substring(0, 60) || undefined,
        badge: seq.statut || undefined,
        href: `/emails?sequence=${seq.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: bookings = [], isLoading: l4 } = useQuery({
    queryKey: ["global-search-bookings", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("bookings")
        .select("id, guest_name, guest_email, guest_company, status, start_time")
        .or(`guest_name.ilike.%${s}%,guest_email.ilike.%${s}%,guest_company.ilike.%${s}%`)
        .order("start_time", { ascending: false }).limit(5);
      if (error) throw error;
      return (data || []).map((b): SearchResult => ({
        id: b.id, type: "booking",
        title: b.guest_name || b.guest_email || "Rendez-vous",
        subtitle: b.start_time ? format(new Date(b.start_time), "d MMM yyyy HH:mm", { locale: fr }) : (b.guest_company || undefined),
        badge: b.status || undefined, href: `/booking?id=${b.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: bookingPages = [], isLoading: l5 } = useQuery({
    queryKey: ["global-search-booking-pages", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("booking_pages")
        .select("id, title, description, slug")
        .or(buildIlikeOrFilter(["title", "description"], s)).limit(5);
      if (error) throw error;
      return (data || []).map((p): SearchResult => ({
        id: p.id, type: "booking_page",
        title: p.title, subtitle: p.slug ? `/${p.slug}` : undefined,
        href: `/booking/pages/${p.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: contratTemplates = [], isLoading: l6 } = useQuery({
    queryKey: ["global-search-contrat-templates", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("contrat_templates")
        .select("id, nom, description")
        .or(buildIlikeOrFilter(["nom", "description"], s)).limit(5);
      if (error) throw error;
      return (data || []).map((c): SearchResult => ({
        id: c.id, type: "contrat_template",
        title: c.nom, subtitle: c.description?.substring(0, 60) || undefined,
        href: `/contrats/templates/${c.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: csmPlaybooks = [], isLoading: l7 } = useQuery({
    queryKey: ["global-search-csm-playbooks", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("csm_playbooks")
        .select("id, name, description")
        .or(buildIlikeOrFilter(["name", "description"], s)).limit(5);
      if (error) throw error;
      return (data || []).map((p): SearchResult => ({
        id: p.id, type: "csm_playbook",
        title: p.name, subtitle: p.description?.substring(0, 60) || undefined,
        href: `/csm?playbook=${p.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: aiAgents = [], isLoading: l8 } = useQuery({
    queryKey: ["global-search-ai-agents", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("ai_agents_config")
        .select("id, name, description")
        .or(buildIlikeOrFilter(["name", "description"], s)).limit(5);
      if (error) throw error;
      return (data || []).map((a): SearchResult => ({
        id: a.id, type: "ai_agent",
        title: a.name, subtitle: a.description?.substring(0, 60) || undefined,
        href: `/parametres?tab=jarvis-agents&id=${a.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: clientSegments = [], isLoading: l9 } = useQuery({
    queryKey: ["global-search-client-segments", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("client_segments")
        .select("id, nom, description")
        .or(buildIlikeOrFilter(["nom", "description"], s)).limit(5);
      if (error) throw error;
      return (data || []).map((c): SearchResult => ({
        id: c.id, type: "client_segment",
        title: c.nom, subtitle: c.description?.substring(0, 60) || undefined,
        href: `/segments?id=${c.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: calendars = [], isLoading: l10 } = useQuery({
    queryKey: ["global-search-calendars", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("calendars")
        .select("id, name, description")
        .or(buildIlikeOrFilter(["name", "description"], s)).limit(5);
      if (error) throw error;
      return (data || []).map((c): SearchResult => ({
        id: c.id, type: "calendar",
        title: c.name, subtitle: c.description?.substring(0, 60) || undefined,
        href: `/calendrier?calendar=${c.id}`,
      }));
    },
    enabled: shouldSearch && (permissions?.canViewCalendar !== false),
    staleTime: 30000,
  });

  return {
    slice: {
      avoirs, emailTemplates, emailSequences, bookings, bookingPages,
      contratTemplates, csmPlaybooks, aiAgents, clientSegments, calendars,
    },
    isLoading: l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8 || l9 || l10,
  };
}
