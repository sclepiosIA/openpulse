import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { debug } from "@/lib/debug";
import { useAuth } from "@/components/AuthProvider";

export interface SupportTicket {
  id: string;
  numero_ticket: string;
  email_thread_id: string | null;
  etablissement_id: string | null;
  partenaire_id: string | null;
  tache_id: string | null;
  titre: string;
  description: string | null;
  type_probleme: string;
  priorite: string;
  statut: string;
  assigne_a: string | null;
  contact_nom: string | null;
  contact_email: string | null;
  ai_summary: string | null;
  ai_suggested_solution: string | null;
  ai_urgency_score: number | null;
  date_ouverture: string;
  date_premiere_reponse: string | null;
  date_resolution: string | null;
  date_fermeture: string | null;
  date_derniere_activite: string;
  sla_deadline: string | null;
  sla_breached: boolean;
  tags: string[];
  created_via_portal?: boolean;
  client_portal_user_id?: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  etablissement?: { id: string; nom: string; ville: string } | null;
  client_portal_user?: { id: string; email: string; prenom: string | null; nom: string | null } | null;
  partenaire?: { id: string; nom: string } | null;
  assigne?: { id: string; prenom: string; nom: string; email: string } | null;
  tache?: { id: string; titre: string; statut: string } | null;
}

export interface SupportTicketComment {
  id: string;
  ticket_id: string;
  author_id: string | null;
  content: string;
  is_internal: boolean;
  created_at: string;
  author?: { prenom: string; nom: string } | null;
}

export interface SupportStats {
  total: number;
  nouveau: number;
  en_cours: number;
  en_attente: number;
  resolu: number;
  critique: number;
  sla_breached: number;
  avg_resolution_hours: number | null;
}

export function useSupportTickets(filters?: {
  statut?: string;
  priorite?: string;
  assigne_a?: string;
  etablissement_id?: string;
  origine?: "tous" | "portail" | "interne";
}) {
  return useQuery({
    queryKey: ["support-tickets", filters],
    queryFn: async () => {
      // NOTE: les jointures embarquées (`profiles`, `taches`) provoquaient un blocage côté
      // PostgREST pour les rôles dont la RLS est restreinte (ex: chef_projet) —
      // la requête restait pendante et la page affichait « Chargement... »
      // indéfiniment. On charge donc ces relations dans des requêtes tolérantes séparées.
      let query = supabase
        .from("support_tickets")
        .select(`
          *,
          etablissement:etablissements(id, nom, ville),
          partenaire:partenaires(id, nom)
        `)
        .order("date_ouverture", { ascending: false });

      if (filters?.statut && filters.statut !== "tous") {
        query = query.eq("statut", filters.statut);
      }
      if (filters?.priorite && filters.priorite !== "toutes") {
        query = query.eq("priorite", filters.priorite);
      }
      if (filters?.assigne_a) {
        query = query.eq("assigne_a", filters.assigne_a);
      }
      if (filters?.etablissement_id) {
        query = query.eq("etablissement_id", filters.etablissement_id);
      }
      if (filters?.origine === "portail") {
        query = query.eq("created_via_portal", true);
      } else if (filters?.origine === "interne") {
        query = query.or("created_via_portal.is.null,created_via_portal.eq.false");
      }

      // Timeout protect: si PostgREST ne répond pas sous 8s on lève une erreur
      // explicite plutôt que de laisser la page bloquée indéfiniment.
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Délai dépassé lors du chargement des tickets (8s)")), 8000)
      );
      const { data, error } = await Promise.race([
        query as unknown as Promise<{ data: unknown; error: unknown }>,
        timeoutPromise,
      ]);

      if (error) throw error;

      const tickets = (data ?? []) as SupportTicket[];

      // Hydratation tolérante: profils assignés
      const assigneIds = Array.from(
        new Set(tickets.map((t) => t.assigne_a).filter((v): v is string => !!v))
      );
      if (assigneIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, prenom, nom, email")
          .in("id", assigneIds);
        type ProfLite = { id: string; prenom: string; nom: string; email: string };
        const byId = new Map(((profs ?? []) as ProfLite[]).map((p) => [p.id, p]));

        for (const t of tickets) {
          if (t.assigne_a) t.assigne = byId.get(t.assigne_a) ?? null;
        }
      }

      // Hydratation tolérante: tâches liées (RLS lourde sur taches → requête séparée)
      const tacheIds = Array.from(
        new Set(tickets.map((t) => t.tache_id).filter((v): v is string => !!v))
      );
      if (tacheIds.length > 0) {
        const { data: taches } = await supabase
          .from("taches")
          .select("id, titre, statut")
          .in("id", tacheIds);
        type TacheLite = { id: string; titre: string; statut: string };
        const byId = new Map(((taches ?? []) as TacheLite[]).map((t) => [t.id, t]));

        for (const t of tickets) {
          if (t.tache_id) t.tache = byId.get(t.tache_id) ?? null;
        }
      }

      return tickets;
    },
    staleTime: 2 * 60 * 1000, // 2 min
    gcTime: 30 * 60 * 1000, // 30 min
    refetchInterval: 10 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useSupportTicketById(ticketId: string | null) {
  return useQuery({
    queryKey: ["support-ticket", ticketId],
    queryFn: async () => {
      if (!ticketId) return null;
      
      const { data, error } = await supabase
        .from("support_tickets")
        .select(`
          *,
          etablissement:etablissements(id, nom, ville, logo_url),
          partenaire:partenaires(id, nom)
        `)
        .eq("id", ticketId)
        .maybeSingle();

      if (error) throw error;
      const ticket = (data ?? null) as SupportTicket | null;
      if (!ticket) return null;

      // Les relations facultatives sont tolérantes : leur RLS ne doit jamais bloquer le ticket.
      const [assigne, tache, portalUser] = await Promise.all([
        ticket.assigne_a
          ? supabase.from("profiles").select("id, prenom, nom, email").eq("id", ticket.assigne_a).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        ticket.tache_id
          ? supabase.from("taches").select("id, titre, statut, description").eq("id", ticket.tache_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        ticket.client_portal_user_id
          ? supabase.from("client_portal_users").select("id, email, prenom, nom").eq("id", ticket.client_portal_user_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      ticket.assigne = (assigne.data as SupportTicket["assigne"]) ?? null;
      ticket.tache = (tache.data as SupportTicket["tache"]) ?? null;
      ticket.client_portal_user = (portalUser.data as SupportTicket["client_portal_user"]) ?? null;
      return ticket;
    },
    enabled: !!ticketId,
    staleTime: 15 * 1000,
  });
}

export function useSupportTicketComments(ticketId: string | null) {
  return useQuery({
    queryKey: ["support-ticket-comments", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      
      const { data, error } = await supabase
        .from("support_ticket_comments")
        .select(`
          *,
          author:profiles(prenom, nom)
        `)
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as SupportTicketComment[];
    },
    enabled: !!ticketId,
  });
}

export function useSupportStats() {
  return useQuery({
    queryKey: ["support-stats"],
    queryFn: async () => {
      const { data: tickets, error } = await supabase
        .from("support_tickets")
        .select("statut, priorite, sla_breached, date_ouverture, date_resolution");

      if (error) throw error;

      const stats: SupportStats = {
        total: tickets.length,
        nouveau: tickets.filter(t => t.statut === "nouveau").length,
        en_cours: tickets.filter(t => t.statut === "en_cours").length,
        en_attente: tickets.filter(t => t.statut === "en_attente_client" || t.statut === "en_attente_interne").length,
        resolu: tickets.filter(t => t.statut === "resolu" || t.statut === "ferme").length,
        critique: tickets.filter(t => t.priorite === "critique" && t.statut !== "resolu" && t.statut !== "ferme").length,
        sla_breached: tickets.filter(t => t.sla_breached).length,
        avg_resolution_hours: null,
      };

      // Calculate average resolution time
      const resolvedTickets = tickets.filter((t): t is typeof t & { date_resolution: string } => t.date_resolution !== null);
      if (resolvedTickets.length > 0) {
      const totalHours = resolvedTickets.reduce((sum, t) => {
          const openDate = new Date(t.date_ouverture || new Date());
          const resolveDate = new Date(t.date_resolution);
          return sum + (resolveDate.getTime() - openDate.getTime()) / (1000 * 60 * 60);
        }, 0);
        stats.avg_resolution_hours = Math.round(totalHours / resolvedTickets.length * 10) / 10;
      }

      return stats;
    },
    // Uses global staleTime from QueryClient (2 min)

  });
}

export function useUpdateSupportTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      ticketId, 
      updates 
    }: { 
      ticketId: string; 
      updates: Partial<SupportTicket>;
    }) => {
      const { data, error } = await supabase
        .from("support_tickets")
        .update(updates as never)
        .eq("id", ticketId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["support-ticket", data.id] });
      queryClient.invalidateQueries({ queryKey: ["support-stats"] });
      toast.success("Ticket mis à jour");
    },
    onError: (error) => {
      debug.error("Error updating ticket:", error);
      toast.error("Erreur lors de la mise à jour du ticket");
    },
  });
}

export function useAssignTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      ticketId, 
      profileId 
    }: { 
      ticketId: string; 
      profileId: string | null;
    }) => {
      const updates: Record<string, unknown> = { assigne_a: profileId };
      
      // If assigning and status is nouveau, move to en_cours
      if (profileId) {
        const { data: ticket } = await supabase
          .from("support_tickets")
          .select("statut")
          .eq("id", ticketId)
          .maybeSingle();

        if (ticket?.statut === "nouveau") {
          updates.statut = "en_cours";
        }
      }

      const { data, error } = await supabase
        .from("support_tickets")
        .update(updates as never)
        .eq("id", ticketId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["support-ticket", data?.id] });
      queryClient.invalidateQueries({ queryKey: ["support-stats"] });
      toast.success("Ticket assigné");
    },
    onError: (error: Error) => {
      debug.error("Error assigning ticket:", error);
      toast.error("Erreur lors de l'assignation du ticket");
    },
  });
}

export function useAddTicketComment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      ticketId, 
      content, 
      isInternal = true 
    }: { 
      ticketId: string; 
      content: string;
      isInternal?: boolean;
    }) => {
      // Get current user's profile
      if (!user?.id) throw new Error("User not authenticated");
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data, error } = await supabase
        .from("support_ticket_comments")
        .insert({
          ticket_id: ticketId,
          author_id: profile?.id,
          content,
          is_internal: isInternal,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["support-ticket-comments", data?.ticket_id] });
      toast.success("Commentaire ajouté");
    },
    onError: (error: Error) => {
      debug.error("Error adding comment:", error);
      toast.error("Erreur lors de l'ajout du commentaire");
    },
  });
}

export function useCreateSupportTicket() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticket: {
      titre: string;
      description?: string;
      type_probleme?: string;
      priorite?: string;
      etablissement_id?: string;
      partenaire_id?: string;
      contact_nom?: string;
      contact_email?: string;
    }) => {
      // Get current user's profile for created_by
      if (!user?.id) throw new Error("User not authenticated");
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          ...ticket,
          created_by: profile?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["support-stats"] });
      toast.success(`Ticket ${data.numero_ticket} créé`);
    },
    onError: (error) => {
      debug.error("Error creating ticket:", error);
      toast.error("Erreur lors de la création du ticket");
    },
  });
}
