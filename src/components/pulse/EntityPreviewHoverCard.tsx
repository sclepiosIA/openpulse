import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { debug } from "@/lib/debug";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  CheckSquare,
  User,
  Users,
  Calendar,
  Target,
  Phone,
  Mail,
  AlertCircle,
  Clock,
  ExternalLink,
  ListTodo,
  MessageSquare,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { EntityType } from '@/hooks/search/useEntitySearch';
import { supabase } from "@/integrations/supabase/client";

interface EntityPreviewHoverCardProps {
  entityType: EntityType | 'evenement' | 'todo' | 'partenaire';
  entityId: string;
  children: React.ReactNode;
}

const STATUS_COLORS: Record<string, string> = {
  'Prospect': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Contractuel': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'En négociation': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Suspendu': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'Refus': 'bg-gray-100 text-foreground dark:bg-gray-900/30 dark:text-muted-foreground',
  'Production': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const TASK_STATUS_COLORS: Record<string, string> = {
  'A faire': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'En cours': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Terminé': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Bloqué': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  'low': 'text-muted-foreground',
  'medium': 'text-foreground',
  'high': 'text-orange-500',
};

function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />
      <span>{message}</span>
    </div>
  );
}

function EtablissementPreview({ entityId }: { entityId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['entity-preview', 'etablissement', entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etablissements')
        .select('nom, ville, statut, progression, engagement_score')
        .eq('id', entityId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60000,
  });

  // Fetch upcoming tasks
  const { data: upcomingTasks } = useQuery({
    queryKey: ['entity-preview', 'etablissement-tasks', entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taches')
        .select('id, titre, statut, echeance, responsable_id')
        .eq('etablissement_id', entityId)
        .eq('archive', false)
        .neq('statut', 'Terminé')
        .order('echeance', { ascending: true, nullsFirst: false })
        .limit(4);
      if (error) throw error;
      return data;
    },
    enabled: !!entityId,
    staleTime: 60000,
  });

  // Fetch latest email threads
  const { data: latestEmails } = useQuery({
    queryKey: ['entity-preview', 'etablissement-emails', entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_threads')
        .select('id, subject, ai_generated_title, ai_summary, last_message_date')
        .eq('etablissement_id', entityId)
        .order('last_message_date', { ascending: false })
        .limit(3);
      if (error) {
        // RLS may block access - not a fatal error, only log in dev
        if (import.meta.env.DEV) {
          debug.warn('Emails non accessibles:', error.message);
        }
        return null;
      }
      return data;
    },
    enabled: !!entityId,
    staleTime: 60000,
  });

  if (isLoading) return <PreviewSkeleton />;
  if (error) return <ErrorDisplay message="Établissement introuvable" />;
  if (!data) return <ErrorDisplay message="Aucune donnée" />;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold truncate">{data.nom}</h4>
          {data.ville && <p className="text-sm text-muted-foreground">{data.ville}</p>}
        </div>
      </div>

      {data.statut && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Statut:</span>
          <Badge className={STATUS_COLORS[data.statut] || 'bg-gray-100'}>
            {data.statut}
          </Badge>
        </div>
      )}

      {data.progression !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progression</span>
            <span className="font-medium">{data.progression}%</span>
          </div>
          <Progress value={data.progression || 0} className="h-2" />
        </div>
      )}

      {data.engagement_score !== null && (
        <div className="flex items-center gap-2 text-sm">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Engagement:</span>
          <span className="font-medium">{data.engagement_score}/100</span>
        </div>
      )}

      {/* Upcoming tasks */}
      {upcomingTasks && upcomingTasks.length > 0 && (
        <div className="pt-2 border-t space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CheckSquare className="h-3 w-3" />
            <span>Tâches à venir</span>
          </div>
          {upcomingTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className={`${TASK_STATUS_COLORS[task.statut] || ''} py-0 px-1.5 text-[10px]`}>
                {task.statut}
              </Badge>
              <span className="truncate flex-1">{task.titre}</span>
              {task.echeance && (
                <span className="text-muted-foreground flex-shrink-0">
                  {format(new Date(task.echeance), 'dd/MM', { locale: fr })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Latest emails */}
      {latestEmails && latestEmails.length > 0 && (
        <div className="pt-2 border-t space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            <span>Derniers échanges</span>
          </div>
          {latestEmails.map((email) => (
            <div key={email.id} className="text-xs space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">
                  {email.ai_generated_title || email.subject}
                </span>
                <span className="text-muted-foreground flex-shrink-0">
                  {format(new Date(email.last_message_date), 'dd/MM', { locale: fr })}
                </span>
              </div>
              {email.ai_summary && (
                <p className="text-muted-foreground line-clamp-1">{email.ai_summary}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TachePreview({ entityId }: { entityId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['entity-preview', 'tache', entityId],
    queryFn: async () => {
      const { data: tache } = await supabase
        .from('taches')
        .select('titre, statut, priorite, echeance, responsable_id')
        .eq('id', entityId)
        .maybeSingle();

      if (!tache) return null;

      let responsable: { nom: string; prenom: string } | null = null;
      if (tache.responsable_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('nom, prenom')
          .eq('id', tache.responsable_id)
          .maybeSingle();
        responsable = profileData;
      }
      
      return { 
        titre: tache.titre,
        statut: tache.statut,
        priorite: tache.priorite,
        echeance: tache.echeance,
        responsable 
      };
    },
    staleTime: 60000,
  });

  if (isLoading) return <PreviewSkeleton />;
  if (!data) return null;

  const isOverdue = data.echeance && new Date(data.echeance) < new Date() && data.statut !== 'Terminé';

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <CheckSquare className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold truncate">{data.titre}</h4>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge className={TASK_STATUS_COLORS[data.statut] || 'bg-gray-100'}>
          {data.statut}
        </Badge>
        {data.priorite && data.priorite !== 'medium' && (
          <Badge variant="outline" className={PRIORITY_COLORS[data.priorite] || ''}>
            {data.priorite === 'high' ? 'Haute' : data.priorite === 'low' ? 'Basse' : data.priorite}
          </Badge>
        )}
      </div>

      {data.echeance && (
        <div className={`flex items-center gap-2 text-sm ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
          {isOverdue ? <AlertCircle className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
          <span>Échéance: {format(new Date(data.echeance), 'dd MMM yyyy', { locale: fr })}</span>
        </div>
      )}

      {data.responsable && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>Responsable: {data.responsable.prenom} {data.responsable.nom}</span>
        </div>
      )}
    </div>
  );
}

function ContactPreview({ entityId }: { entityId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['entity-preview', 'contact', entityId],
    queryFn: async () => {
      const { data: contact } = await supabase
        .from('contacts')
        .select('nom, prenom, fonction, email, telephone, etablissement_id')
        .eq('id', entityId)
        .maybeSingle();

      if (!contact) return null;

      let etablissementNom: string | null = null;
      if (contact.etablissement_id) {
        const { data: etab } = await supabase
          .from('etablissements')
          .select('nom')
          .eq('id', contact.etablissement_id)
          .maybeSingle();
        etablissementNom = etab?.nom || null;
      }
      
      return { ...contact, etablissementNom };
    },
    staleTime: 60000,
  });

  if (isLoading) return <PreviewSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <User className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold truncate">
            {data.prenom} {data.nom}
          </h4>
          {data.fonction && <p className="text-sm text-muted-foreground">{data.fonction}</p>}
        </div>
      </div>

      {data.email && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span className="truncate">{data.email}</span>
        </div>
      )}

      {data.telephone && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-4 w-4" />
          <span>{data.telephone}</span>
        </div>
      )}

      {data.etablissementNom && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span className="truncate">{data.etablissementNom}</span>
        </div>
      )}
    </div>
  );
}

function GroupePreview({ entityId }: { entityId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['entity-preview', 'groupe', entityId],
    queryFn: async () => {
      const { data: groupe, error: groupeError } = await supabase
        .from('groupes_etablissements')
        .select('nom, description, type, ville_siege')
        .eq('id', entityId)
        .maybeSingle();

      if (groupeError) throw groupeError;
      if (!groupe) return null;
      
      // Get etablissements via junction table
      const { data: etablissementsGroupe, error: egError } = await supabase
        .from('etablissements_groupes')
        .select('etablissement_id, etablissements(id, nom)')
        .eq('groupe_id', entityId);

      if (egError && import.meta.env.DEV) {
        debug.warn('Erreur récupération établissements:', egError.message);
      }

      const etablissementIds = etablissementsGroupe?.map(eg => eg.etablissement_id).filter(Boolean) || [];
      const etablissementNoms = etablissementsGroupe
        ?.map(eg => {
          const etab = eg.etablissements as { id: string; nom: string } | null;
          return etab?.nom;
        })
        .filter(Boolean)
        .slice(0, 3) || [];

      // Fetch upcoming tasks for all establishments in the group
      interface GroupTask { id: string; titre: string; statut: string; echeance: string | null; etablissement_id: string }
      let upcomingTasks: GroupTask[] = [];
      if (etablissementIds.length > 0) {
        const { data: tasks } = await supabase
          .from('taches')
          .select('id, titre, statut, echeance, etablissement_id')
          .in('etablissement_id', etablissementIds)
          .eq('archive', false)
          .neq('statut', 'Terminé')
          .order('echeance', { ascending: true, nullsFirst: false })
          .limit(4);
        upcomingTasks = (tasks || []) as GroupTask[];
      }

      // Fetch latest emails for all establishments in the group
      interface GroupEmail { id: string; subject: string | null; ai_generated_title: string | null; ai_summary: string | null; last_message_date: string | null }
      let latestEmails: GroupEmail[] = [];
      if (etablissementIds.length > 0) {
        const { data: emails } = await supabase
          .from('email_threads')
          .select('id, subject, ai_generated_title, ai_summary, last_message_date')
          .in('etablissement_id', etablissementIds)
          .order('last_message_date', { ascending: false })
          .limit(3);
        latestEmails = (emails || []) as GroupEmail[];
      }

      return { 
        ...groupe, 
        etablissementsCount: etablissementIds.length,
        etablissementNoms,
        upcomingTasks,
        latestEmails,
      };
    },
    staleTime: 60000,
  });

  if (isLoading) return <PreviewSkeleton />;
  if (error) return <ErrorDisplay message="Groupe introuvable" />;
  if (!data) return <ErrorDisplay message="Aucune donnée" />;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold truncate">{data.nom}</h4>
          {data.type && <p className="text-xs text-muted-foreground">{data.type}</p>}
          {data.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{data.description}</p>
          )}
        </div>
      </div>

      {data.ville_siege && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Target className="h-4 w-4" />
          <span>{data.ville_siege}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span className="font-medium">{data.etablissementsCount}</span>
        <span>établissement{data.etablissementsCount > 1 ? 's' : ''}</span>
      </div>

      {/* Noms des établissements */}
      {data.etablissementNoms && data.etablissementNoms.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {data.etablissementNoms.join(', ')}
          {data.etablissementsCount > 3 && ` +${data.etablissementsCount - 3}`}
        </div>
      )}

      {/* Upcoming tasks */}
      {data.upcomingTasks && data.upcomingTasks.length > 0 && (
        <div className="pt-2 border-t space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CheckSquare className="h-3 w-3" />
            <span>Tâches à venir</span>
          </div>
          {data.upcomingTasks.map((task: any) => (
            <div key={task.id} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className={`${TASK_STATUS_COLORS[task.statut] || ''} py-0 px-1.5 text-[10px]`}>
                {task.statut}
              </Badge>
              <span className="truncate flex-1">{task.titre}</span>
              {task.echeance && (
                <span className="text-muted-foreground flex-shrink-0">
                  {format(new Date(task.echeance), 'dd/MM', { locale: fr })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Latest emails */}
      {data.latestEmails && data.latestEmails.length > 0 && (
        <div className="pt-2 border-t space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            <span>Derniers échanges</span>
          </div>
          {data.latestEmails.map((email: any) => (
            <div key={email.id} className="text-xs space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">
                  {email.ai_generated_title || email.subject}
                </span>
                <span className="text-muted-foreground flex-shrink-0">
                  {format(new Date(email.last_message_date), 'dd/MM', { locale: fr })}
                </span>
              </div>
              {email.ai_summary && (
                <p className="text-muted-foreground line-clamp-1">{email.ai_summary}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PartenairePreview({ entityId }: { entityId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['entity-preview', 'partenaire', entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partenaires')
        .select('nom, type_partenaire, sous_type, ville, statut_relation, engagement_score, dernier_contact')
        .eq('id', entityId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60000,
  });

  if (isLoading) return <PreviewSkeleton />;
  if (error) return <ErrorDisplay message="Partenaire introuvable" />;
  if (!data) return <ErrorDisplay message="Aucune donnée" />;

  const statusColors: Record<string, string> = {
    'actif': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'prospect': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'en_pause': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'termine': 'bg-gray-100 text-foreground dark:bg-gray-900/30 dark:text-muted-foreground',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold truncate">{data.nom}</h4>
          {data.type_partenaire && (
            <p className="text-xs text-muted-foreground">{data.type_partenaire}{data.sous_type ? ` - ${data.sous_type}` : ''}</p>
          )}
        </div>
      </div>

      {data.ville && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Target className="h-4 w-4" />
          <span>{data.ville}</span>
        </div>
      )}

      {data.statut_relation && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Statut:</span>
          <Badge className={statusColors[data.statut_relation] || 'bg-gray-100'}>
            {data.statut_relation}
          </Badge>
        </div>
      )}

      {data.engagement_score !== null && (
        <div className="flex items-center gap-2 text-sm">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Engagement:</span>
          <span className="font-medium">{data.engagement_score}/100</span>
        </div>
      )}

      {data.dernier_contact && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Dernier contact: {format(new Date(data.dernier_contact), 'dd MMM yyyy', { locale: fr })}</span>
        </div>
      )}
    </div>
  );
}

function EvenementPreview({ entityId }: { entityId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['entity-preview', 'evenement', entityId],
    queryFn: async () => {
      const { data } = await supabase
        .from('calendar_events')
        .select('title, start_time, end_time, location, all_day')
        .eq('id', entityId)
        .maybeSingle();
      return data;
    },
    staleTime: 60000,
  });

  if (isLoading) return <PreviewSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold truncate">{data.title}</h4>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>
          {data.all_day 
            ? format(new Date(data.start_time), 'dd MMM yyyy', { locale: fr })
            : `${format(new Date(data.start_time), 'dd MMM HH:mm', { locale: fr })} - ${format(new Date(data.end_time), 'HH:mm', { locale: fr })}`
          }
        </span>
      </div>

      {data.location && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Target className="h-4 w-4" />
          <span className="truncate">{data.location}</span>
        </div>
      )}
    </div>
  );
}

function TodoPreview({ entityId }: { entityId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['entity-preview', 'todo', entityId],
    queryFn: async () => {
      const { data: todoList, error: listError } = await supabase
        .from('pulse_todo_lists')
        .select('id, title, created_at')
        .eq('id', entityId)
        .maybeSingle();

      if (listError) throw listError;
      if (!todoList) return null;

      const { data: items, error: itemsError } = await supabase
        .from('pulse_todo_items')
        .select('id, content, is_done')
        .eq('todo_list_id', entityId)
        .order('position', { ascending: true });

      if (itemsError) throw itemsError;

      return { ...todoList, items: items || [] };
    },
    staleTime: 30000,
  });

  if (isLoading) return <PreviewSkeleton />;
  if (error) return <ErrorDisplay message="Todo introuvable" />;
  if (!data) return <ErrorDisplay message="Aucune donnée" />;

  const doneCount = data.items.filter((i: any) => i.is_done).length;
  const totalCount = data.items.length;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <ListTodo className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold truncate">{data.title}</h4>
          <p className="text-xs text-muted-foreground">
            {doneCount}/{totalCount} complétés
          </p>
        </div>
      </div>

      <div className="space-y-1">
        {data.items.slice(0, 5).map((item: any) => (
          <div key={item.id} className="flex items-center gap-2 text-sm">
            <span className={item.is_done ? 'text-green-500' : 'text-muted-foreground'}>
              {item.is_done ? '✓' : '○'}
            </span>
            <span className={item.is_done ? 'line-through text-muted-foreground' : ''}>
              {item.content}
            </span>
          </div>
        ))}
        {data.items.length > 5 && (
          <p className="text-xs text-muted-foreground">
            +{data.items.length - 5} autres éléments
          </p>
        )}
      </div>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-5 w-5 rounded" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
  );
}

export function EntityPreviewHoverCard({ entityType, entityId, children }: EntityPreviewHoverCardProps) {
  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-72" side="top" align="start">
        {entityType === 'etablissement' && <EtablissementPreview entityId={entityId} />}
        {entityType === 'tache' && <TachePreview entityId={entityId} />}
        {entityType === 'contact' && <ContactPreview entityId={entityId} />}
        {entityType === 'groupe' && <GroupePreview entityId={entityId} />}
        {entityType === 'evenement' && <EvenementPreview entityId={entityId} />}
        {entityType === 'todo' && <TodoPreview entityId={entityId} />}
        {entityType === 'partenaire' && <PartenairePreview entityId={entityId} />}
        
        <div className="mt-3 pt-2 border-t flex items-center gap-1 text-xs text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          <span>Cliquer pour ouvrir</span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
