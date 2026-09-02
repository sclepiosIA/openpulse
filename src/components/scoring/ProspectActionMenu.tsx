import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Eye, ListPlus, BellOff, ExternalLink } from 'lucide-react';
import { useAcknowledgeProspect } from '@/hooks/crm/useBehavioralScore';
import { useToast } from '@/hooks/shared/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  etablissementId: string;
  onOpenSheet?: (id: string) => void;
}

export function ProspectActionMenu({ etablissementId, onOpenSheet }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const ack = useAcknowledgeProspect();
  const [open, setOpen] = useState(false);
  const defaultUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [until, setUntil] = useState(defaultUntil);
  const [note, setNote] = useState('');

  const snooze = async () => {
    try {
      await ack.mutateAsync({ id: etablissementId, until, note });
      toast({ title: 'Prospect mis en pause', description: `Jusqu'au ${until}` });
      setOpen(false);
      setNote('');
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message ?? String(e), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => e.stopPropagation()} aria-label="Plus d'options">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {onOpenSheet && (
            <DropdownMenuItem onClick={() => onOpenSheet(etablissementId)}>
              <Eye className="h-4 w-4 mr-2" /> Détail scoring
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => navigate(`/etablissements/${etablissementId}`)}>
            <ExternalLink className="h-4 w-4 mr-2" /> Fiche complète
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/taches/new?etablissement_id=${etablissementId}`)}>
            <ListPlus className="h-4 w-4 mr-2" /> Créer une tâche
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DialogTrigger asChild>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <BellOff className="h-4 w-4 mr-2" /> Mettre en pause (snooze)
            </DropdownMenuItem>
          </DialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mettre en pause ce prospect</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="until">Jusqu'au</Label>
            <Input id="until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="note">Note (optionnelle)</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Pourquoi cette mise en pause ?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={snooze} disabled={ack.isPending}>Confirmer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
