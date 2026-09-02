import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Play,
  Pause,
  Mail,
  Clock,
  ArrowDown,
  Zap,
  MoreHorizontal,
  Users,
  Edit,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  useEmailSequences,
  useCreateSequence,
  useUpdateSequence,
  useDeleteSequence,
  useSequenceEnrollments,
  type SequenceStep,
  type EmailSequence,
} from '@/hooks/email/useEmailSequences';

import { SequenceABTestingPanel } from '@/components/email/SequenceABTestingPanel';

function StepEditor({ 
  step, index, onChange, onRemove 
}: { 
  step: SequenceStep; 
  index: number; 
  onChange: (step: SequenceStep) => void; 
  onRemove: () => void;
}) {
  return (
    <div className="relative">
      {index > 0 && (
        <div className="flex items-center justify-center py-2">
          <ArrowDown className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground ml-1">Après J+{step.delay_days}</span>
        </div>
      )}
      <Card className="border-dashed">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="gap-1">
              <Mail className="h-3 w-3" />
              Étape {index + 1}
            </Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onRemove} aria-label="Supprimer">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Délai (jours)</label>
              <Input
                type="number"
                min={0}
                value={step.delay_days}
                onChange={(e) => onChange({ ...step, delay_days: parseInt(e.target.value) || 0 })}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Condition</label>
              <Select value={step.condition || 'always'} onValueChange={(v) => onChange({ ...step, condition: v as any })}>
                <SelectTrigger className="h-8 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">Toujours</SelectItem>
                  <SelectItem value="no_reply">Sans réponse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Sujet</label>
            <Input
              value={step.subject}
              onChange={(e) => onChange({ ...step, subject: e.target.value })}
              placeholder="Objet de l'email..."
              className="h-8 mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Contenu</label>
            <Textarea
              value={step.body_html}
              onChange={(e) => onChange({ ...step, body_html: e.target.value })}
              placeholder="Corps de l'email... (HTML supporté)"
              rows={4}
              className="mt-1 text-sm"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SequenceCard({ 
  sequence, onEdit, onToggle, onDelete 
}: { 
  sequence: EmailSequence; 
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { data: enrollments } = useSequenceEnrollments(sequence.id);
  const activeCount = enrollments?.filter(e => e.statut === 'active').length || 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm truncate">{sequence.nom}</h3>
              <Badge 
                variant={sequence.statut === 'active' ? 'default' : 'secondary'}
                className="text-[10px] shrink-0"
              >
                {sequence.statut === 'active' ? 'Active' : sequence.statut === 'draft' ? 'Brouillon' : sequence.statut === 'paused' ? 'En pause' : 'Archivée'}
              </Badge>
            </div>
            {sequence.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{sequence.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {(sequence.etapes as SequenceStep[])?.length || 0} étape(s)
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {activeCount} actif(s)
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {(() => {
                  const steps = sequence.etapes as SequenceStep[];
                  const totalDays = steps?.reduce((sum, s) => sum + (s.delay_days || 0), 0) || 0;
                  return `${totalDays}j`;
                })()}
              </span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Plus d'options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" /> Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggle}>
                {sequence.statut === 'active' ? (
                  <><Pause className="h-4 w-4 mr-2" /> Mettre en pause</>
                ) : (
                  <><Play className="h-4 w-4 mr-2" /> Activer</>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmailSequenceBuilder() {
  const { data: sequences, isLoading } = useEmailSequences();
  const createSequence = useCreateSequence();
  const updateSequence = useUpdateSequence();
  const deleteSequence = useDeleteSequence();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<EmailSequence | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSteps, setFormSteps] = useState<SequenceStep[]>([
    { delay_days: 0, subject: '', body_html: '', condition: 'always' },
  ]);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormSteps([{ delay_days: 0, subject: '', body_html: '', condition: 'always' }]);
    setEditingSequence(null);
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEdit = (seq: EmailSequence) => {
    setFormName(seq.nom);
    setFormDescription(seq.description || '');
    setFormSteps((seq.etapes as SequenceStep[]) || []);
    setEditingSequence(seq);
    setIsCreateOpen(true);
  };

  const addStep = () => {
    setFormSteps([...formSteps, { delay_days: 7, subject: '', body_html: '', condition: 'no_reply' }]);
  };

  const updateStep = (index: number, step: SequenceStep) => {
    const newSteps = [...formSteps];
    newSteps[index] = step;
    setFormSteps(newSteps);
  };

  const removeStep = (index: number) => {
    setFormSteps(formSteps.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!formName.trim() || formSteps.length === 0) return;

    if (editingSequence) {
      await updateSequence.mutateAsync({
        id: editingSequence.id,
        nom: formName,
        description: formDescription,
        etapes: formSteps,
      });
    } else {
      await createSequence.mutateAsync({
        nom: formName,
        description: formDescription,
        etapes: formSteps,
      });
    }
    setIsCreateOpen(false);
    resetForm();
  };

  const handleToggle = (seq: EmailSequence) => {
    updateSequence.mutate({
      id: seq.id,
      statut: seq.statut === 'active' ? 'paused' : 'active',
    });
  };

  const handleDelete = (seq: EmailSequence) => {
    if (window.confirm(`Supprimer la séquence "${seq.nom}" ?`)) {
      deleteSequence.mutate(seq.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Séquences de prospection</h2>
          <p className="text-sm text-muted-foreground">
            Automatisez vos relances email avec des séquences programmées
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nouvelle séquence
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSequence ? 'Modifier la séquence' : 'Créer une séquence'}
              </DialogTitle>
              <DialogDescription>
                Définissez les étapes de votre séquence de prospection automatisée
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Nom</label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Relance prospect J+7"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optionnel..."
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Étapes</label>
                {formSteps.map((step, i) => (
                  <StepEditor
                    key={i}
                    step={step}
                    index={i}
                    onChange={(s) => updateStep(i, s)}
                    onRemove={() => removeStep(i)}
                  />
                ))}
                <Button variant="outline" size="sm" className="w-full mt-2 gap-1.5" onClick={addStep}>
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter une étape
                </Button>
              </div>

              {editingSequence && (
                <div className="pt-4 border-t">
                  <SequenceABTestingPanel
                    sequenceId={editingSequence.id}
                    stepsCount={formSteps.length}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Annuler</Button>
              <Button 
                onClick={handleSave} 
                disabled={!formName.trim() || formSteps.length === 0 || createSequence.isPending || updateSequence.isPending}
              >
                {editingSequence ? 'Mettre à jour' : 'Créer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Zap className="h-5 w-5 animate-pulse mr-2" />
          Chargement...
        </div>
      ) : !sequences?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Mail className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <h3 className="font-medium mb-1">Aucune séquence</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Créez votre première séquence pour automatiser vos relances
            </p>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Créer une séquence
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sequences.map((seq) => (
            <SequenceCard
              key={seq.id}
              sequence={seq}
              onEdit={() => openEdit(seq)}
              onToggle={() => handleToggle(seq)}
              onDelete={() => handleDelete(seq)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
