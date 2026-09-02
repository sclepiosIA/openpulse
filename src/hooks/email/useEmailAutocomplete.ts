import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { debug } from "@/lib/debug";

export interface EmailSuggestion {
  email: string;
  name?: string;
  source: "contact" | "profile" | "history";
  etablissement?: string;
}

export function useEmailAutocomplete(searchQuery: string) {
  return useQuery({
    queryKey: ["email-autocomplete", searchQuery],
    queryFn: async (): Promise<EmailSuggestion[]> => {
      if (!searchQuery || searchQuery.length < 2) {
        return [];
      }

      const query = searchQuery.toLowerCase();
      const suggestions: EmailSuggestion[] = [];
      const seenEmails = new Set<string>();

      try {
        // Paralléliser les 3 requêtes pour plus de performance
        const [
          { data: contacts },
          { data: profiles },
          { data: messages }
        ] = await Promise.all([
          // 1. Fetch from contacts table
          supabase
            .from("contacts")
            .select(`
              email,
              nom,
              prenom,
              etablissement:etablissements(nom)
            `)
            .not("email", "is", null)
            .ilike("email", `%${query}%`)
            .limit(10),
          
          // 2. Fetch from profiles (internal team)
          supabase
            .from("profiles")
            .select("email, nom, prenom")
            .not("email", "is", null)
            .ilike("email", `%${query}%`)
            .limit(10),
          
          // 3. Fetch from email_messages (history)
          supabase
            .from("email_messages")
            .select("from_address, from_name")
            .ilike("from_address", `%${query}%`)
            .limit(10)
        ]);

        // Process contacts
        if (contacts) {
          contacts.forEach((contact) => {
            if (contact.email && !seenEmails.has(contact.email)) {
              seenEmails.add(contact.email);
              /** Type pour la jointure établissement */
              type ContactWithEtab = typeof contact & { etablissement: { nom: string } | null };
              const c = contact as ContactWithEtab;
              suggestions.push({
                email: contact.email,
                name: `${contact.prenom || ""} ${contact.nom}`.trim(),
                source: "contact",
                etablissement: c.etablissement?.nom,
              });
            }
          });
        }

        // Process profiles
        if (profiles) {
          profiles.forEach((profile) => {
            if (profile.email && !seenEmails.has(profile.email)) {
              seenEmails.add(profile.email);
              suggestions.push({
                email: profile.email,
                name: `${profile.prenom || ""} ${profile.nom}`.trim(),
                source: "profile",
              });
            }
          });
        }

        // Process messages
        if (messages) {
          const uniqueMessages = Array.from(
            new Map(
              messages.map((msg) => [msg.from_address, msg])
            ).values()
          );

          uniqueMessages.forEach((message) => {
            if (message.from_address && !seenEmails.has(message.from_address)) {
              seenEmails.add(message.from_address);
              suggestions.push({
                email: message.from_address,
                name: message.from_name || undefined,
                source: "history",
              });
            }
          });
        }

        // Sort: profiles first, then contacts, then history
        const sourceOrder = { profile: 0, contact: 1, history: 2 };
        return suggestions.sort((a, b) => sourceOrder[a.source] - sourceOrder[b.source]);
      } catch (error) {
        debug.error("Error fetching email suggestions:", error);
        return [];
      }
    },
    enabled: searchQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
