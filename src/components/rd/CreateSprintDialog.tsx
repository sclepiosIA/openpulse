import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateRDSprint } from '@/hooks/rd/useRD';
import { format, addDays } from 'date-fns';

interface CreateSprintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetId: string;
  nextSprintNumber: number;
}

export function CreateSprintDialog({ open, onOpenChange, projetId, nextSprintNumber }: CreateSprintDialogProps) {
  const today = new Date();
  const [nom, setNom] = useState(`Sprint ${nextSprintNumber}`);
  const [dateDebut, setDateDebut] = useState(format(today, 'yyyy-MM-dd'));
  const [dateFin, setDateFin] = useState(format(addDays(today, 14), 'yyyy-MM-dd'));
  const [objectif, setObjectif] = useState('');
  const [velocityPrevue, setVelocityPrevue] = useState('');
  
  const createSprint = useCreateRDSprint();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSprint.mutateAsync({
      projet_id: projetId,
      nom,
      numero: nextSprintNumber,
      date_debut: dateDebut,
      date_fin: dateFin,
      objectif: objectif || undefined,
      velocity_prevue: velocityPrevue ? parseInt(velocityPrevue) : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau Sprint</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom</Label>
            <Input id="nom" value={nom} onChange={e => setNom(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateDebut">Date début</Label>
              <Input id="dateDebut" type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateFin">Date fin</Label>
              <Input id="dateFin" type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="objectif">Objectif du sprint</Label>
            <Textarea id="objectif" value={objectif} onChange={e => setObjectif(e.target.value)} placeholder="Quel est l'objectif principal de ce sprint ?" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="velocity">Vélocité prévue (points)</Label>
            <Input id="velocity" type="number" value={velocityPrevue} onChange={e => setVelocityPrevue(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={createSprint.isPending}>Créer</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
