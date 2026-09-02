import { useState } from 'react';
import { debug } from '@/lib/debug';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  X,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Clock,
  AlertCircle,
  CalendarIcon,
  Paperclip,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { invokeEdge } from "@/services/edgeFunctions";
import { useUpdateRDUserStory, useRDTasks, useCreateRDTask, useUpdateRDTask, useDeleteRDTask, useRDEpics } from '@/hooks/rd/useRD';
import { useProfiles } from '@/hooks/profile/useProfiles';
import { useClientEtablissementsForRD } from '@/hooks/rd/useClientEtablissementsForRD';
import { STORY_POINTS, PRIORITE_CONFIG, KANBAN_COLUMNS } from '@/types/rd';
import type { RDUserStory, RDPriorite, RDUserStoryStatut, StoryPoints, RDTask } from '@/types/rd';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AttachmentsSection } from './AttachmentsSection';
import { RichTextEditor } from '@/components/email/LazyRichTextEditor';
import { toast } from 'sonner';

interface StoryDetailDialogProps {
  story: RDUserStory;
  projetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StoryDetailDialog({ story, projetId, open, onOpenChange }: StoryDetailDialogProps) {
  const [titre, setTitre] = useState(story.titre);
  const [description, setDescription] = useState(story.description || '');
  const [points, setPoints] = useState<StoryPoints | null>(story.points);
  const [priorite, setPriorite] = useState<RDPriorite>(story.priorite);
  const [statut, setStatut] = useState<RDUserStoryStatut>(story.statut);
  const [epicId, setEpicId] = useState(story.epic_id || '');
  const [responsableId, setResponsableId] = useState(story.responsable_id || '');
  const [dateDebut, setDateDebut] = useState<Date | undefined>(
    story.date_debut ? new Date(story.date_debut) : undefined
  );
  const [dateFin, setDateFin] = useState<Date | undefined>(
    story.date_fin ? new Date(story.date_fin) : undefined
  );
  const [criteresAcceptation, setCriteresAcceptation] = useState<string[]>(story.criteres_acceptation || []);
  const [newCritere, setNewCritere] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [etablissementId, setEtablissementId] = useState<string>(story.etablissement_id || '');

  const updateStory = useUpdateRDUserStory();
  const { data: tasks, refetch: refetchTasks } = useRDTasks(story.id);
  const { data: epics } = useRDEpics(projetId);
  const { data: profiles } = useProfiles();
  const { data: clientEtabs } = useClientEtablissementsForRD();
  const createTask = useCreateRDTask();
  const updateTask = useUpdateRDTask();
  const deleteTask = useDeleteRDTask();

  const handleSave = async () => {
    await updateStory.mutateAsync({
      id: story.id,
      projet_id: projetId,
      titre,
      description: description || null,
      points,
      priorite,
      statut,
      epic_id: epicId || null,
      responsable_id: responsableId || null,
      etablissement_id: etablissementId || null,
      date_debut: dateDebut ? format(dateDebut, 'yyyy-MM-dd') : null,
      date_fin: dateFin ? format(dateFin, 'yyyy-MM-dd') : null,
      criteres_acceptation: criteresAcceptation.length > 0 ? criteresAcceptation : null,
    });
    setHasChanges(false);
  };

  const handleAddCritere = () => {
    if (newCritere.trim()) {
      setCriteresAcceptation([...criteresAcceptation, newCritere.trim()]);
      setNewCritere('');
      setHasChanges(true);
    }
  };

  const handleRemoveCritere = (index: number) => {
    setCriteresAcceptation(criteresAcceptation.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleAddTask = async () => {
    if (newTaskTitle.trim()) {
      await createTask.mutateAsync({
        user_story_id: story.id,
        titre: newTaskTitle.trim(),
      });
      setNewTaskTitle('');
    }
  };

  const handleToggleTask = async (task: RDTask) => {
    await updateTask.mutateAsync({
      id: task.id,
      user_story_id: task.user_story_id,
      statut: task.statut === 'done' ? 'todo' : 'done',
    });
  };

  const handleDeleteTask = async (task: RDTask) => {
    await deleteTask.mutateAsync({ id: task.id, user_story_id: task.user_story_id });
  };

  const handleAIAssist = async () => {
    if (!titre.trim()) {
      toast.error("Veuillez d'abord saisir un titre");
      return;
    }

    setIsAIProcessing(true);
    try {
      const data = await invokeEdge<any>('rd-ai-assist', { titre, description });
    const error = null;

      if (error) throw error;

      // Update description
      if (data.improved_description) {
        setDescription(data.improved_description);
        setHasChanges(true);
      }

      // Add generated tasks
      if (data.tasks && data.tasks.length > 0) {
        for (const task of data.tasks) {
          await createTask.mutateAsync({
            user_story_id: story.id,
            titre: task.titre,
            estimation_heures: task.estimation_heures || null,
          });
        }
        refetchTasks();
      }

      // Add generated criteria
      if (data.criteres && data.criteres.length > 0) {
        setCriteresAcceptation(prev => [...prev, ...data.criteres]);
        setHasChanges(true);
      }

      toast.success(`IA: Description améliorée, ${data.tasks?.length || 0} tâches et ${data.criteres?.length || 0} critères générés`);
    } catch (err) {
      debug.error('AI assist error:', err);
      toast.error("Erreur lors de l'assistance IA");
    } finally {
      setIsAIProcessing(false);
    }
  };

  const priorityConfig = PRIORITE_CONFIG[priorite];
  const completedTasks = tasks?.filter(t => t.statut === 'done').length || 0;
  const totalTasks = tasks?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline"
              style={{ 
                borderColor: priorityConfig.color,
                backgroundColor: `${priorityConfig.color}15`
              }}
            >
              {priorityConfig.label}
            </Badge>
            {points && (
              <Badge variant="secondary" className="font-bold">
                {points} pts
              </Badge>
            )}
            <Badge variant={statut === 'done' ? 'default' : 'outline'}>
              {KANBAN_COLUMNS.find(c => c.id === statut)?.label}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-2">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Détails</TabsTrigger>
            <TabsTrigger value="tasks" className="relative">
              Tâches
              {totalTasks > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs h-5 w-5 p-0 flex items-center justify-center">
                  {totalTasks}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="criteres">Critères</TabsTrigger>
            <TabsTrigger value="attachments">
              <Paperclip className="h-4 w-4 mr-1" />
              PJ
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="titre">Titre</Label>
              <Input
                id="titre"
                value={titre}
                onChange={(e) => { setTitre(e.target.value); setHasChanges(true); }}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Description</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAIAssist}
                  disabled={isAIProcessing || !titre.trim()}
                  className="gap-2"
                >
                  {isAIProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isAIProcessing ? 'IA en cours...' : 'Gérer par IA'}
                </Button>
              </div>
              <RichTextEditor
                content={description}
                onChange={(html) => { setDescription(html); setHasChanges(true); }}
                placeholder="Description de la user story (formatage riche supporté)..."
                isProcessing={isAIProcessing}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateDebut && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateDebut ? format(dateDebut, 'dd MMM yyyy', { locale: fr }) : 'Sélectionner'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateDebut}
                      onSelect={(d) => { setDateDebut(d); setHasChanges(true); }}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Date de fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateFin && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFin ? format(dateFin, 'dd MMM yyyy', { locale: fr }) : 'Sélectionner'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFin}
                      onSelect={(d) => { setDateFin(d); setHasChanges(true); }}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={statut} onValueChange={(v) => { setStatut(v as RDUserStoryStatut); setHasChanges(true); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KANBAN_COLUMNS.map(col => (
                      <SelectItem key={col.id} value={col.id}>{col.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Points</Label>
                <Select 
                  value={points?.toString() || '__none__'} 
                  onValueChange={(v) => { setPoints(v === '__none__' ? null : parseInt(v) as StoryPoints); setHasChanges(true); }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Non estimé" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Non estimé</SelectItem>
                    {STORY_POINTS.map(p => (
                      <SelectItem key={p} value={p.toString()}>{p} pts</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priorité</Label>
                <Select value={priorite} onValueChange={(v) => { setPriorite(v as RDPriorite); setHasChanges(true); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          {(key === 'critical' || key === 'high') && (
                            <AlertCircle className="h-3 w-3" style={{ color: config.color }} />
                          )}
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Responsable</Label>
                <Select value={responsableId || '__none__'} onValueChange={(v) => { setResponsableId(v === '__none__' ? '' : v); setHasChanges(true); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Non assigné" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Non assigné</SelectItem>
                    {profiles?.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.prenom} {p.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Epic</Label>
                <Select value={epicId || '__none__'} onValueChange={(v) => { setEpicId(v === '__none__' ? '' : v); setHasChanges(true); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun epic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun epic</SelectItem>
                    {epics?.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: e.couleur }} />
                          {e.titre}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  Assigner à un client (déploiement / production)
                </Label>
                <Select
                  value={etablissementId || '__none__'}
                  onValueChange={(v) => { setEtablissementId(v === '__none__' ? '' : v); setHasChanges(true); }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun établissement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun établissement</SelectItem>
                    {clientEtabs?.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        <div className="flex items-center gap-2">
                          <span>{e.nom}</span>
                          <Badge variant="outline" className="text-[10px]">{e.statut}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {etablissementId
                    ? "Une tâche miroir est créée/synchronisée dans le portail client de cet établissement."
                    : "Optionnel — assignez à un client en déploiement ou production pour créer une tâche dans son portail."}
                </p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Créé le {format(new Date(story.created_at), 'PPP', { locale: fr })}
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nouvelle tâche..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              />
              <Button onClick={handleAddTask} disabled={!newTaskTitle.trim() || createTask.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {tasks?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune tâche. Ajoutez-en une ci-dessus ou utilisez "Gérer par IA".
                </p>
              ) : (
                tasks?.map(task => (
                  <Card key={task.id} className={cn(
                    "transition-opacity",
                    task.statut === 'done' && "opacity-60"
                  )}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <Checkbox
                        checked={task.statut === 'done'}
                        onCheckedChange={() => handleToggleTask(task)}
                      />
                      <span className={cn(
                        "flex-1 text-sm",
                        task.statut === 'done' && "line-through"
                      )}>
                        {task.titre}
                      </span>
                      {task.estimation_heures && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {task.estimation_heures}h
                        </Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteTask(task)} aria-label="Supprimer">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Acceptance Criteria Tab */}
          <TabsContent value="criteres" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nouveau critère d'acceptation..."
                value={newCritere}
                onChange={(e) => setNewCritere(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCritere()}
              />
              <Button onClick={handleAddCritere} disabled={!newCritere.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {criteresAcceptation.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun critère d'acceptation. Ajoutez-en un ci-dessus ou utilisez "Gérer par IA".
                </p>
              ) : (
                criteresAcceptation.map((critere, index) => (
                  <div key={`critere-${critere.slice(0, 24)}-${index}`} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />
                    <span className="flex-1 text-sm">{critere}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleRemoveCritere(index)} aria-label="Fermer">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* Attachments Tab */}
          <TabsContent value="attachments" className="mt-4">
            <AttachmentsSection entityType="user_story" entityId={story.id} />
          </TabsContent>
        </Tabs>

        {/* Footer with Save */}
        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {totalTasks > 0 && (
              <span>{completedTasks}/{totalTasks} tâches terminées</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || updateStory.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
