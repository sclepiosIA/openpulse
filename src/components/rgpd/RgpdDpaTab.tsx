import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { RgpdDpa } from '@/types/rgpd';
import { useCreateRgpdDpa } from '@/hooks/auth/useRgpd';

interface RgpdDpaTabProps {
  dpas: RgpdDpa[] | undefined;
}

interface NewDpa {
  nom_sous_traitant: string;
  type_service: string;
  pays: string;
  est_hds: boolean;
}

const initialDpa: NewDpa = {
  nom_sous_traitant: '',
  type_service: '',
  pays: 'France',
  est_hds: false,
};

export function RgpdDpaTab({ dpas }: RgpdDpaTabProps) {
  const [showNewDpa, setShowNewDpa] = useState(false);
  const [newDpa, setNewDpa] = useState<NewDpa>(initialDpa);
  const createDpa = useCreateRgpdDpa();

  const handleCreate = async () => {
    await createDpa.mutateAsync(newDpa);
    setShowNewDpa(false);
    setNewDpa(initialDpa);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sous-traitants & DPA</h2>
        <Dialog open={showNewDpa} onOpenChange={setShowNewDpa}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau sous-traitant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau sous-traitant</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nom du sous-traitant *</Label>
                <Input
                  value={newDpa.nom_sous_traitant}
                  onChange={(e) => setNewDpa({ ...newDpa, nom_sous_traitant: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Type de service *</Label>
                <Input
                  value={newDpa.type_service}
                  onChange={(e) => setNewDpa({ ...newDpa, type_service: e.target.value })}
                  placeholder="Ex: Hébergement, Email, CRM..."
                />
              </div>
              <div className="grid gap-2">
                <Label>Pays</Label>
                <Input
                  value={newDpa.pays}
                  onChange={(e) => setNewDpa({ ...newDpa, pays: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewDpa(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={!newDpa.nom_sous_traitant || !newDpa.type_service}>
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sous-traitant</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Pays</TableHead>
              <TableHead>HDS</TableHead>
              <TableHead>Expiration DPA</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dpas?.map((dpa) => (
              <TableRow key={dpa.id}>
                <TableCell className="font-medium">{dpa.nom_sous_traitant}</TableCell>
                <TableCell>{dpa.type_service}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {dpa.pays}
                    {dpa.est_hors_ue && <Badge variant="outline" className="text-xs">Hors UE</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  {dpa.est_hds ? (
                    <Badge className="bg-green-100 text-green-800">Certifié HDS</Badge>
                  ) : (
                    <Badge variant="outline">Non</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {dpa.date_expiration ? format(parseISO(dpa.date_expiration), 'dd/MM/yyyy', { locale: fr }) : '-'}
                </TableCell>
                <TableCell>
                  {dpa.est_actif ? (
                    <Badge className="bg-green-100 text-green-800">Actif</Badge>
                  ) : (
                    <Badge variant="secondary">Inactif</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!dpas || dpas.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Aucun sous-traitant enregistré
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
