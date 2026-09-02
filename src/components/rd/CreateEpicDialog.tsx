import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateRDEpic } from '@/hooks/rd/useRD';

interface CreateEpicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetId: string;
}

export function CreateEpicDialog({ open, onOpenChange, projetId }: CreateEpicDialogProps) {
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [couleur, setCouleur] = useState('#6366f1');
  const createEpic = useCreateRDEpic();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createEpic.mutateAsync({ projet_id: projetId, titre, description, couleur });
    setTitre('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvel Epic</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titre">Titre</Label>
            <Input id="titre" value={titre} onChange={e => setTitre(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="couleur">Couleur</Label>
            <Input id="couleur" type="color" value={couleur} onChange={e => setCouleur(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={createEpic.isPending}>Créer</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
