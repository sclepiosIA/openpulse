/**
 * DEBT-02 — Split de `useGlobalSearch.ts` (session 72).
 * Slice "Business" : facturation, contrats, formations, KB, dashboards custom,
 * workflows, recrutement, forum, social, catalogue, notes de frais.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { sanitizePostgrestValue, buildIlikeOrFilter } from "@/lib/sanitize";
import type { SearchResult } from "../useGlobalSearch.types";

export function useBusinessSearch(debouncedSearch: string, shouldSearch: boolean) {
  const { data: factures = [], isLoading: l1 } = useQuery({
    queryKey: ["global-search-factures", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("factures")
        .select("id, numero, client_nom, statut, date_emission")
        .or(`numero.ilike.%${s}%,client_nom.ilike.%${s}%`)
        .order("date_emission", { ascending: false }).limit(5);
      if (error) throw error;
      return (data || []).map((f): SearchResult => ({
        id: f.id, type: "facture",
        title: f.numero ? `Facture ${f.numero}` : "Facture",
        subtitle: f.client_nom || undefined, badge: f.statut || undefined,
        href: `/facturation?facture=${f.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: devis = [], isLoading: l2 } = useQuery({
    queryKey: ["global-search-devis", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("devis")
        .select("id, numero, client_nom, statut, date_emission")
        .or(`numero.ilike.%${s}%,client_nom.ilike.%${s}%`)
        .order("date_emission", { ascending: false }).limit(5);
      if (error) throw error;
      return (data || []).map((d): SearchResult => ({
        id: d.id, type: "devis",
        title: d.numero ? `Devis ${d.numero}` : "Devis",
        subtitle: d.client_nom || undefined, badge: d.statut || undefined,
        href: `/facturation?devis=${d.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: contrats = [], isLoading: l3 } = useQuery({
    queryKey: ["global-search-contrats", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("contrats")
        .select("id, numero, titre, client_nom, statut")
        .or(`numero.ilike.%${s}%,titre.ilike.%${s}%,client_nom.ilike.%${s}%`)
        .order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (data || []).map((c): SearchResult => ({
        id: c.id, type: "contrat",
        title: c.titre || (c.numero ? `Contrat ${c.numero}` : "Contrat"),
        subtitle: c.client_nom || c.numero || undefined,
        badge: c.statut || undefined, href: `/contrats/${c.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  // Les pages redigees du wiki, cherchees par leur CONTENU et non par leur
  // seul titre : la colonne engendree `documents.recherche` couvre le corps,
  // balises retirees et accents ignores (cf. supabase/schema-08-pages.sql).
  const { data: kbArticles = [], isLoading: l5 } = useQuery({
    queryKey: ["global-search-pages", debouncedSearch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, description")
        .not("content", "is", null)
        .is("deleted_at", null)
        // La configuration doit etre NOMMEE et NON qualifiee par son schema :
        // sans elle PostgREST emploie `pg_catalog.english`, et avec le prefixe
        // `public.` il rend 400. Mesure sur instance.
        .textSearch("recherche", debouncedSearch, {
          type: "websearch", config: "francais_sans_accent",
        })
        .limit(5);
      if (error) throw error;
      return (data || []).map((a): SearchResult => ({
        id: a.id, type: "kb_article", title: a.name,
        subtitle: a.description?.substring(0, 60) || undefined,
        href: `/documents?doc=${a.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: customDashboards = [], isLoading: l6 } = useQuery({
    queryKey: ["global-search-custom-dashboards", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("custom_dashboards")
        .select("id, nom, description")
        .or(buildIlikeOrFilter(["nom", "description"], s))
        .order("updated_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (data || []).map((d): SearchResult => ({
        id: d.id, type: "custom_dashboard", title: d.nom,
        subtitle: d.description?.substring(0, 60) || undefined,
        href: `/rapports-custom/${d.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: workflows = [], isLoading: l7 } = useQuery({
    queryKey: ["global-search-workflows", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("jarvis_workflows")
        .select("id, name, description")
        .or(buildIlikeOrFilter(["name", "description"], s))
        .order("updated_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (data || []).map((w): SearchResult => ({
        id: w.id, type: "workflow", title: w.name,
        subtitle: w.description?.substring(0, 60) || undefined,
        href: `/automatisations/${w.id}/edit`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: candidates = [], isLoading: l8 } = useQuery({
    queryKey: ["global-search-candidates", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("candidates")
        .select("id, prenom, nom, email, statut")
        .or(buildIlikeOrFilter(["nom", "prenom", "email"], s))
        .order("date_candidature", { ascending: false, nullsFirst: false }).limit(5);
      if (error) throw error;
      return (data || []).map((c): SearchResult => ({
        id: c.id, type: "candidate",
        title: `${c.prenom || ""} ${c.nom || ""}`.trim() || c.email,
        subtitle: c.email || undefined, badge: c.statut || undefined,
        href: `/recrutement?candidate=${c.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: jobOffers = [], isLoading: l9 } = useQuery({
    queryKey: ["global-search-jobs", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("job_offers")
        .select("id, titre, description, statut")
        .or(buildIlikeOrFilter(["titre", "description"], s))
        .order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (data || []).map((j): SearchResult => ({
        id: j.id, type: "job_offer", title: j.titre,
        subtitle: j.description?.substring(0, 60) || undefined,
        badge: j.statut || undefined, href: `/recrutement?offer=${j.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: forumPosts = [], isLoading: l10 } = useQuery({
    queryKey: ["global-search-forum", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("forum_posts")
        .select("id, titre, contenu, theme")
        .eq("archive", false)
        .or(`titre.ilike.%${s}%,contenu.ilike.%${s}%`)
        .order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (data || []).map((p): SearchResult => ({
        id: p.id, type: "forum_post", title: p.titre,
        subtitle: p.contenu?.substring(0, 60) || undefined,
        badge: p.theme || undefined, href: `/forum/post/${p.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: socialPosts = [], isLoading: l11 } = useQuery({
    queryKey: ["global-search-social", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("social_posts")
        .select("id, message, platform, published_at")
        .ilike("message", `%${s}%`)
        .order("published_at", { ascending: false, nullsFirst: false }).limit(5);
      if (error) throw error;
      return (data || []).map((p): SearchResult => ({
        id: p.id, type: "social_post",
        title: p.message ? p.message.substring(0, 80) : `Publication ${p.platform || ""}`,
        subtitle: p.platform || undefined,
        badge: p.published_at ? format(new Date(p.published_at), "d MMM", { locale: fr }) : undefined,
        href: `/social?post=${p.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: produits = [], isLoading: l12 } = useQuery({
    queryKey: ["global-search-produits", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("catalogue_produits")
        .select("id, code, nom, description, type, est_actif")
        .eq("est_actif", true)
        .or(`nom.ilike.%${s}%,code.ilike.%${s}%,description.ilike.%${s}%`)
        .limit(5);
      if (error) throw error;
      return (data || []).map((p): SearchResult => ({
        id: p.id, type: "produit", title: p.nom,
        subtitle: p.code || p.description?.substring(0, 60) || undefined,
        badge: p.type || undefined, href: `/catalogue-produits?id=${p.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  const { data: notesFrais = [], isLoading: l13 } = useQuery({
    queryKey: ["global-search-notes-frais", debouncedSearch],
    queryFn: async () => {
      const s = sanitizePostgrestValue(debouncedSearch);
      const { data, error } = await supabase
        .from("rh_notes_frais")
        .select("id, libelle, categorie, statut, montant_ttc, date_depense")
        .or(buildIlikeOrFilter(["libelle", "categorie"], s))
        .order("date_depense", { ascending: false, nullsFirst: false }).limit(5);
      if (error) throw error;
      return (data || []).map((n): SearchResult => ({
        id: n.id, type: "note_frais",
        title: n.libelle || "Note de frais",
        subtitle: n.categorie || undefined, badge: n.statut || undefined,
        href: `/people?frais=${n.id}`,
      }));
    },
    enabled: shouldSearch, staleTime: 30000,
  });

  return {
    slice: {
      factures, devis, contrats, kbArticles, customDashboards,
      workflows, candidates, jobOffers, forumPosts, socialPosts, produits, notesFrais,
    },
    isLoading: l1 || l2 || l3 || l5 || l6 || l7 || l8 || l9 || l10 || l11 || l12 || l13,
  };
}
