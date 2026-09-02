import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryPresets } from "@/lib/queryPresets";

interface TimelineItem {
  id: string;
  type: 'email' | 'task';
  date: string;
  title: string;
  description?: string;
  status?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export function useEtablissementTimeline(etablissementId: string | null) {
  return useQuery({
    queryKey: ['etablissement-timeline', etablissementId],
    queryFn: async () => {
      if (!etablissementId) return [];

      // Récupérer les emails
      const { data: emailThreads, error: emailError } = await supabase
        .from('email_threads')
        .select(`
          id,
          subject,
          last_message_date,
          message_count,
          unread_count,
          is_archived,
          category,
          priority,
          messages:email_messages(
            id,
            subject,
            from_address,
            from_name,
            sent_date,
            body_text,
            body_html
          )
        `)
        .eq('etablissement_id', etablissementId)
        .order('last_message_date', { ascending: false });

      if (emailError) throw emailError;

      // Récupérer les tâches
      const { data: tasks, error: tasksError } = await supabase
        .from('taches')
        .select(`
          id,
          titre,
          description,
          statut,
          priorite,
          echeance,
          date_realisation,
          created_at,
          updated_at,
          categorie:categories_taches(nom, couleur),
          responsable:profiles!taches_responsable_id_fkey(nom, prenom)
        `)
        .eq('etablissement_id', etablissementId)
        .eq('archive', false)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Créer les items de la timeline
      const timelineItems: TimelineItem[] = [];

      // Ajouter les emails
      emailThreads?.forEach((thread) => {
        timelineItems.push({
          id: `email-${thread.id}`,
          type: 'email',
          date: thread.last_message_date,
          title: thread.subject,
          description: thread.messages?.[0]?.body_text?.substring(0, 200) || '',
          status: thread.is_archived ? 'archived' : thread.unread_count > 0 ? 'unread' : 'read',
          data: thread,
        });
      });

      // Ajouter les tâches
      tasks?.forEach((task) => {
        const taskDate = task.date_realisation || task.updated_at || task.created_at;
        timelineItems.push({
          id: `task-${task.id}`,
          type: 'task',
          date: taskDate,
          title: task.titre,
          description: task.description || '',
          status: task.statut,
          data: task,
        });
      });

      // Trier par date décroissante
      timelineItems.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      return timelineItems;
    },
    enabled: !!etablissementId,
    ...queryPresets.standard, // 2min staleTime, 30min gcTime - explicit for timeline data
  });
}
