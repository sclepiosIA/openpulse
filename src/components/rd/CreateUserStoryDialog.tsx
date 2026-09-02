import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Plus, Trash2, Sparkles, Loader2, Building2 } from 'lucide-react';
import { useCreateRDUserStory, useRDEpics } from '@/hooks/rd/useRD';
import { useProfiles } from '@/hooks/profile/useProfiles';
import { useClientEtablissementsForRD } from '@/hooks/rd/useClientEtablissementsForRD';
import { STORY_POINTS, KANBAN_COLUMNS, PRIORITE_CONFIG, type StoryPoints, type RDPriorite, type RDUserStoryStatut } from '@/types/rd';
import { RichTextEditor } from '@/components/email/LazyRichTextEditor';
import { invokeEdge } from "@/services/edgeFunctions";
import { toast } from 'sonner';
import { debug } from '@/lib/debug';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CreateUserStoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetId: string;
  defaultEpicId?: string;
}

export function CreateUserStoryDialog({ open, onOpenChange, projetId, defaultEpicId }: CreateUserStoryDialogProps) {
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [epicId, setEpicId] = useState(defaultEpicId || '');
  const [points, setPoints] = useState<string>('');
  const [priorite, setPriorite] = useState<RDPriorite>('medium');
  const [statut, setStatut] = useState<RDUserStoryStatut>('backlog');
  const [responsableId, setResponsableId] = useState<string>('');
  const [etablissementId, setEtablissementId] = useState<string>('');
  const [dateDebut, setDateDebut] = useState<Date | undefined>(undefined);
  const [dateFin, setDateFin] = useState<Date | undefined>(undefined);
  const [criteres, setCriteres] = useState<string[]>([]);
  const [newCritere, setNewCritere] = useState('');
  const [isAIProcessing, setIsAIProcessing] = useState(false);

  const { data: epics } = useRDEpics(projetId);
  const { data: profiles } = useProfiles();
  const { data: clientEtabs } = useClientEtablissementsForRD();
  const createStory = useCreateRDUserStory();

  const resetForm = () => {
    setTitre('');
    setDescription('');
    setEpicId(defaultEpicId || '');
    setPoints('');
    setPriorite('medium');
    setStatut('backlog');
    setResponsableId('');
    setEtablissementId('');
    setDateDebut(undefined);
    setDateFin(undefined);
    setCriteres([]);
    setNewCritere('');
  };

  const handleAddCritere = () => {
    if (newCritere.trim()) {
      setCriteres([...criteres, newCritere.trim()]);
      setNewCritere('');
    }
  };

  const handleRemoveCritere = (i: number) => {
    setCriteres(criteres.filter((_, idx) => idx !== i));
  };

  const handleAIAssist = async () => {
    if (!titre.trim()) {
      toast.error("Veuillez d'abord saisir un titre");
      return;
    }
    setIsAIProcessing(true);
    try {
      const data = await invokeEdge<any>('rd-ai-assist', { titre, description });
      if (data.improved_description) setDescription(data.improved_description);
      if (data.criteres && data.criteres.length > 0) {
        setCriteres((prev) => [...prev, ...data.criteres]);
      }
      toast.success(`IA: description améliorée${data.criteres?.length ? `, ${data.criteres.length} critères ajoutés` : ''}`);
    } catch (err) {
      debug.error('AI assist error:', err);
      toast.error("Erreur lors de l'assistance IA");
    } finally {
      setIsAIProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre.trim()) return;

    await createStory.mutateAsync({
      projet_id: projetId,
      titre: titre.trim(),
      description: description || undefined,
      epic_id: epicId || undefined,
      points: points ? (parseInt(points) as StoryPoints) : undefined,
      priorite,
      statut,
      responsable_id: responsableId || undefined,
      etablissement_id: etablissementId || null,
      date_debut: dateDebut ? format(dateDebut, 'yyyy-MM-dd') : undefined,
      date_fin: dateFin ? format(dateFin, 'yyyy-MM-dd') : undefined,
      criteres_acceptation: criteres.length > 0 ? criteres : undefined,
    });
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle User Story</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Titre */}
          <div className="space-y-2">
            <Label htmlFor="titre">Titre *</Label>
            <Input
              id="titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              required
              placeholder="En tant que... je veux... afin de..."
            />
          </div>

          {/* Description riche + IA */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAIAssist}
                disabled={isAIProcessing || !titre.trim()}
                className="gap-2"
              >
                {isAIProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isAIProcessing ? 'IA en cours...' : 'Gérer par IA'}
              </Button>
            </div>
            <RichTextEditor
              content={description}
              onChange={setDescription}
              placeholder="Description (formatage riche supporté)..."
              isProcessing={isAIProcessing}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date de début</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !dateDebut && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateDebut ? format(dateDebut, 'dd MMM yyyy', { locale: fr }) : 'Sélectionner'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <Calendar mode="single" selected={dateDebut} onSelect={setDateDebut} locale={fr} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Date de fin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !dateFin && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFin ? format(dateFin, 'dd MMM yyyy', { locale: fr }) : 'Sélectionner'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <Calendar mode="single" selected={dateFin} onSelect={setDateFin} locale={fr} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Selects: Epic, Statut, Points, Priorité, Responsable, Établissement client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Epic</Label>
              <Select value={epicId || '__none__'} onValueChange={(v) => setEpicId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sans epic" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sans epic</SelectItem>
                  {epics?.map((e) => (
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

            <div className="space-y-2">
              <Label>Statut initial</Label>
              <Select value={statut} onValueChange={(v) => setStatut(v as RDUserStoryStatut)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KANBAN_COLUMNS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Points</Label>
              <Select value={points || '__none__'} onValueChange={(v) => setPoints(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Non estimé" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Non estimé</SelectItem>
                  {STORY_POINTS.map((p) => (
                    <SelectItem key={p} value={p.toString()}>{p} pts</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select value={priorite} onValueChange={(v) => setPriorite(v as RDPriorite)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITE_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Responsable</Label>
              <Select value={responsableId || '__none__'} onValueChange={(v) => setResponsableId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Non assigné" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Non assigné</SelectItem>
                  {profiles?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.prenom} {p.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                Assigner à un client
              </Label>
              <Select value={etablissementId || '__none__'} onValueChange={(v) => setEtablissementId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
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
              {etablissementId && (
                <p className="text-xs text-muted-foreground">
                  Une tâche sera créée automatiquement dans le portail client de cet établissement.
                </p>
              )}
            </div>
          </div>

          {/* Critères d'acceptation */}
          <div className="space-y-2">
            <Label>Critères d'acceptation</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nouveau critère..."
                value={newCritere}
                onChange={(e) => setNewCritere(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCritere();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddCritere} disabled={!newCritere.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {criteres.length > 0 && (
              <ul className="space-y-1">
                {criteres.map((c, i) => (
                  <li key={`create-story-critere-${c.slice(0, 24)}-${i}`} className="flex items-center gap-2 text-sm bg-muted/40 rounded px-2 py-1">
                    <span className="flex-1">{c}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRemoveCritere(i)} aria-label="Supprimer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={createStory.isPending || !titre.trim()}>
              {createStory.isPending ? 'Création...' : 'Créer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
