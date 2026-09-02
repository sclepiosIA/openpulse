import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useUpdateRDProjet } from '@/hooks/rd/useRD';
import { useProfiles } from '@/hooks/profile/useProfiles';
import type { RDProjet, RDProjetStatut, RDProjetDPI } from '@/types/rd';

interface EditProjetDialogProps {
  projet: RDProjet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROJET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

const STATUT_OPTIONS: { value: RDProjetStatut; label: string }[] = [
  { value: 'actif', label: 'Actif' },
  { value: 'en_pause', label: 'En pause' },
  { value: 'termine', label: 'Terminé' },
  { value: 'archive', label: 'Archivé' },
];

export function EditProjetDialog({ projet, open, onOpenChange }: EditProjetDialogProps) {
  const [nom, setNom] = useState(projet.nom);
  const [description, setDescription] = useState(projet.description || '');
  const [statut, setStatut] = useState<RDProjetStatut>(projet.statut);
  const [couleur, setCouleur] = useState(projet.couleur);
  const [dateDebut, setDateDebut] = useState(projet.date_debut || '');
  const [dateFinPrevue, setDateFinPrevue] = useState(projet.date_fin_prevue || '');
  const [responsableId, setResponsableId] = useState(projet.responsable_id || '');
  const [dpi, setDpi] = useState<RDProjetDPI | 'none'>(projet.dpi ?? 'none');
  const [visiblePortail, setVisiblePortail] = useState<boolean>(!!projet.visible_portail);
  
  const updateProjet = useUpdateRDProjet();
  const { data: profiles } = useProfiles();

  useEffect(() => {
    if (open) {
      setNom(projet.nom);
      setDescription(projet.description || '');
      setStatut(projet.statut);
      setCouleur(projet.couleur);
      setDateDebut(projet.date_debut || '');
      setDateFinPrevue(projet.date_fin_prevue || '');
      setResponsableId(projet.responsable_id || '');
      setDpi(projet.dpi ?? 'none');
      setVisiblePortail(!!projet.visible_portail);
    }
  }, [open, projet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProjet.mutateAsync({
      id: projet.id,
      nom,
      description: description || undefined,
      statut,
      couleur,
      date_debut: dateDebut || undefined,
      date_fin_prevue: dateFinPrevue || undefined,
      responsable_id: responsableId || undefined,
      dpi: dpi === 'none' ? null : dpi,
      visible_portail: visiblePortail,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le projet</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom du projet *</Label>
            <Input 
              id="nom" 
              value={nom} 
              onChange={e => setNom(e.target.value)} 
              required 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description" 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={statut} onValueChange={(v) => setStatut(v as RDProjetStatut)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Responsable</Label>
              <Select value={responsableId || 'none'} onValueChange={(v) => setResponsableId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {profiles?.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.prenom} {p.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateDebut">Date de début</Label>
              <Input 
                id="dateDebut" 
                type="date" 
                value={dateDebut} 
                onChange={e => setDateDebut(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateFinPrevue">Date de fin prévue</Label>
              <Input 
                id="dateFinPrevue" 
                type="date" 
                value={dateFinPrevue} 
                onChange={e => setDateFinPrevue(e.target.value)} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Couleur du projet</Label>
            <div className="flex gap-2 flex-wrap">
              {PROJET_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setCouleur(color)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    couleur === color ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
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
            <div className="space-y-0.5 pr-3">
              <Label htmlFor="visible_portail">Visible sur le portail client</Label>
              <p className="text-xs text-muted-foreground">
                Affiche les user stories dans la roadmap publique du portail
              </p>
            </div>
            <Switch
              id="visible_portail"
              checked={visiblePortail}
              onCheckedChange={setVisiblePortail}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={updateProjet.isPending}>
              {updateProjet.isPending ? 'Mise à jour...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
