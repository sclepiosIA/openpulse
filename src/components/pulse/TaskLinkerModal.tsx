import { useState } from 'react';
import { debug } from '@/lib/debug';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckSquare,
  Link2,
  Plus,
  Search,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { fromExtended } from '@/lib/supabaseTyped';
import { useAuth } from '@/components/AuthProvider';
import { usePulseTaskCreate } from '@/hooks/calendar/useCalendarEventActions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { PulseMessage } from '@/types/pulse';
import { supabase } from "@/integrations/supabase/client";

interface TaskLinkerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: PulseMessage | null;
  conversationId: string;
}

interface Task {
  id: string;
  titre: string;
  statut: string;
  priorite: string;
  etablissement?: { nom: string } | null;
}

const STATUT_COLORS: Record<string, string> = {
  'a_faire': 'bg-gray-100 text-foreground dark:bg-gray-800 dark:text-muted-foreground',
  'en_cours': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'terminee': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'annulee': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function TaskLinkerModal({
  open,
  onOpenChange,
  message,
  conversationId,
}: TaskLinkerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'link' | 'create'>('link');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const taskCreate = usePulseTaskCreate();

  const { data: tasks, isLoading: isLoadingTasks } = useQuery({
    queryKey: ['tasks-search', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('taches')
        .select('id, titre, statut, priorite, etablissement:etablissements(nom)')
        .order('created_at', { ascending: false })
        .limit(20);

      if (searchQuery) {
        query = query.ilike('titre', `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Task[];
    },
    enabled: open && activeTab === 'link',
  });

  // Link task mutation
  const linkTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (!message) return;

      const { error } = await fromExtended('pulse_message_task_links')
        .insert({
          message_id: message.id,
          task_id: taskId,
          link_type: 'reference',
          created_by: user?.id || '',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-messages'] });
      toast.success('Tâche liée au message');
      onOpenChange(false);
      setSelectedTaskId(null);
      setSearchQuery('');
    },
    onError: (error: Error) => {
      debug.error('Error linking task:', error);
      toast.error('Erreur lors de la liaison');
    },
  });

  // Create task and link mutation
  const handleCreateAndLink = () => {
    if (!message || !newTaskTitle.trim()) return;

    taskCreate.mutate(
      {
        titre: newTaskTitle.trim(),
        description: `Créée depuis Pulse:\n\n"${message.content}"`,
      },
      {
        onSuccess: async (data) => {
          // Link the task to the message
          const { error: linkError } = await fromExtended('pulse_message_task_links')
            .insert({
              message_id: message.id,
              task_id: data.id,
              link_type: 'created_from',
              created_by: user?.id || '',
            });

          if (linkError) {
            debug.error('Error linking task:', linkError);
          }

          queryClient.invalidateQueries({ queryKey: ['pulse-messages'] });
          toast.success('Tâche créée et liée');
          onOpenChange(false);
          setNewTaskTitle('');
        },
      }
    );
  };

  // Pre-fill task title from message
  const handleCreateTab = () => {
    if (message && !newTaskTitle) {
      const truncated = message.content.length > 100 
        ? message.content.substring(0, 100) + '...'
        : message.content;
      setNewTaskTitle(truncated);
    }
    setActiveTab('create');
  };

  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Lier à une tâche
          </DialogTitle>
          <DialogDescription>
            Liez ce message à une tâche existante ou créez-en une nouvelle
          </DialogDescription>
        </DialogHeader>

        {/* Message preview */}
        <div className="p-3 bg-muted/50 rounded-lg text-sm">
          <p className="text-xs text-muted-foreground mb-1">Message de {message.user?.prenom}</p>
          <p className="line-clamp-2">{message.content}</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'link' | 'create')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link" className="gap-2">
              <Link2 className="h-4 w-4" />
              Lier existante
            </TabsTrigger>
            <TabsTrigger value="create" onClick={handleCreateTab} className="gap-2">
              <Plus className="h-4 w-4" />
              Créer nouvelle
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une tâche..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-64">
              {isLoadingTasks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : tasks && tasks.length > 0 ? (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={cn(
                        "w-full p-3 text-left rounded-lg border transition-colors",
                        selectedTaskId === task.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <CheckSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{task.titre}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant="secondary" 
                              className={cn("text-xs", STATUT_COLORS[task.statut])}
                            >
                              {task.statut.replace('_', ' ')}
                            </Badge>
                            {task.etablissement?.nom && (
                              <span className="text-xs text-muted-foreground truncate">
                                {task.etablissement.nom}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucune tâche trouvée</p>
                </div>
              )}
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => selectedTaskId && linkTask.mutate(selectedTaskId)}
                disabled={!selectedTaskId || linkTask.isPending}
              >
                {linkTask.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Lier la tâche
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Titre de la tâche</Label>
              <Input
                id="task-title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Titre de la nouvelle tâche..."
              />
            </div>

            <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
              <p>La description de la tâche contiendra automatiquement le contenu du message.</p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleCreateAndLink}
                disabled={!newTaskTitle.trim() || taskCreate.isPending}
              >
                {taskCreate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer et lier
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
