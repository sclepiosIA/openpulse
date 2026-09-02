import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckSquare, Loader2, Calendar as CalendarIcon } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { usePulseTaskCreate } from '@/hooks/calendar/useCalendarEventActions';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { fetchProfilesLite } from "@/services/profile/profilesLite";

interface TaskCreatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onTaskCreated: (task: { id: string; titre: string }) => void;
}

type Priority = 'basse' | 'normale' | 'haute' | 'urgente';

export function TaskCreatorModal({
  open,
  onOpenChange,
  conversationId,
  onTaskCreated,
}: TaskCreatorModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('normale');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [assigneeId, setAssigneeId] = useState<string>('');
  
  const { data: currentProfile } = useCurrentProfile();
  const taskCreate = usePulseTaskCreate();

  // Fetch team members for assignee selection
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['profiles-for-assignment'],
    queryFn: fetchProfilesLite,
    staleTime: 60000,
  });

  const handleCreate = () => {
    if (!currentProfile?.id || !title.trim()) return;

    const prioriteMap: Record<Priority, string> = {
      basse: 'Basse',
      normale: 'Normale',
      haute: 'Haute',
      urgente: 'Critique',
    };

    taskCreate.mutate(
      {
        titre: title.trim(),
        description: description.trim() || 'Créée depuis Pulse',
        priorite: prioriteMap[priority],
        echeance: dueDate ? dueDate.toISOString().split('T')[0] : null,
        responsable_id: assigneeId || currentProfile.id,
      },
      {
        onSuccess: (data) => {
          toast.success('Tâche créée');
          onTaskCreated(data);
          resetForm();
        },
      }
    );
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('normale');
    setDueDate(undefined);
    setAssigneeId('');
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Créer une tâche
          </DialogTitle>
          <DialogDescription>
            La tâche sera automatiquement liée à votre message
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="task-title">Titre *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la tâche..."
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description de la tâche..."
              rows={2}
            />
          </div>

          {/* Priority and Due Date - side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basse">🟢 Basse</SelectItem>
                  <SelectItem value="normale">🔵 Normale</SelectItem>
                  <SelectItem value="haute">🟠 Haute</SelectItem>
                  <SelectItem value="urgente">🔴 Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Échéance</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'dd/MM/yyyy', { locale: fr }) : 'Choisir...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    locale={fr}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <Label>Assigner à</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un membre..." />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.prenom} {member.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!title.trim() || taskCreate.isPending}
          >
            {taskCreate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
