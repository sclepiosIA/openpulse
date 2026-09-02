import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PartenaireActivity {
  id: string;
  type: 'email' | 'contact_added' | 'status_change' | 'note' | 'meeting';
  title: string;
  description?: string;
  date: string | null;
  metadata?: Record<string, unknown>;
}

export function usePartenaireActivities(partenaireId: string) {
  return useQuery({
    queryKey: ['partenaire-activities', partenaireId],
    queryFn: async (): Promise<PartenaireActivity[]> => {
      const activities: PartenaireActivity[] = [];
      
      // 1. Récupérer les emails via les messages
      const { data: threads } = await supabase
        .from('email_threads')
        .select('id')
        .eq('partenaire_id', partenaireId);
      
      if (threads && threads.length > 0) {
        const { data: messages } = await supabase
          .from('email_messages')
          .select('id, subject, received_date, thread_id')
          .in('thread_id', threads.map(t => t.id))
          .order('received_date', { ascending: false })
          .limit(15);
        
        messages?.forEach(message => {
          if (message.received_date) {
            activities.push({
              id: `email-${message.id}`,
              type: 'email',
              title: message.subject || 'Email sans sujet',
              date: message.received_date,
            });
          }
        });
      }
      
      // 2. Récupérer les contacts ajoutés
      const { data: contacts } = await supabase
        .from('partenaires_contacts')
        .select('id, nom, prenom, created_at')
        .eq('partenaire_id', partenaireId)
        .order('created_at', { ascending: false })
        .limit(15);
      
      contacts?.forEach(contact => {
        activities.push({
          id: `contact-${contact.id}`,
          type: 'contact_added',
          title: `Contact ajouté : ${contact.prenom} ${contact.nom}`,
          date: contact.created_at,
        });
      });
      
      // Trier par date décroissante (filtrer les null)
      return activities
        .filter(a => a.date !== null)
        .sort((a, b) => 
          new Date(b.date!).getTime() - new Date(a.date!).getTime()
        )
        .slice(0, 20);
    },
    enabled: !!partenaireId,
  });
}
