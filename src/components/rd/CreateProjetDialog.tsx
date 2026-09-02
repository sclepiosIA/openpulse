import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCreateRDProjet } from '@/hooks/rd/useRD';
import type { RDProjetDPI } from '@/types/rd';

interface CreateProjetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (projetId: string) => void;
}

export function CreateProjetDialog({ open, onOpenChange, onSuccess }: CreateProjetDialogProps) {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [dpi, setDpi] = useState<RDProjetDPI | 'none'>('none');
  const [visiblePortail, setVisiblePortail] = useState(false);
  const createProjet = useCreateRDProjet();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createProjet.mutateAsync({
      nom,
      description,
      dpi: dpi === 'none' ? null : dpi,
      visible_portail: visiblePortail,
    });
    setNom('');
    setDescription('');
    setDpi('none');
    setVisiblePortail(false);
    onSuccess?.(result.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau projet R&D</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom du projet</Label>
            <Input id="nom" value={nom} onChange={e => setNom(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>DPI / Solution</Label>
            <Select value={dpi} onValueChange={(v) => setDpi(v as RDProjetDPI | 'none')}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                <SelectItem value="hm">HM (Hôpital Manager)</SelectItem>
                <SelectItem value="resurgences">Résurgences</SelectItem>
                <SelectItem value="transverse">Transverse</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="visible_portail">Visible sur le portail client</Label>
              <p className="text-xs text-muted-foreground">
                Affiche les user stories de ce projet dans la roadmap publique
              </p>
            </div>
            <Switch
              id="visible_portail"
              checked={visiblePortail}
              onCheckedChange={setVisiblePortail}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={createProjet.isPending}>Créer</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
