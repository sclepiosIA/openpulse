import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search } from 'lucide-react';
import { BASE_LEGALE_LABELS, type RgpdBaseLegale, type RgpdTraitement } from '@/types/rgpd';
import { useCreateRgpdTraitement } from '@/hooks/auth/useRgpd';

interface RgpdTraitementsTabProps {
  traitements: RgpdTraitement[] | undefined;
}

interface NewTraitement {
  nom: string;
  description: string;
  base_legale: RgpdBaseLegale;
  finalites: string[];
  categories_donnees: string[];
  categories_personnes: string[];
  donnees_sensibles: boolean;
}

const initialTraitement: NewTraitement = {
  nom: '',
  description: '',
  base_legale: 'contrat',
  finalites: [],
  categories_donnees: [],
  categories_personnes: [],
  donnees_sensibles: false,
};

export function RgpdTraitementsTab({ traitements }: RgpdTraitementsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewTraitement, setShowNewTraitement] = useState(false);
  const [newTraitement, setNewTraitement] = useState<NewTraitement>(initialTraitement);
  const createTraitement = useCreateRgpdTraitement();

  const handleCreate = async () => {
    await createTraitement.mutateAsync(newTraitement);
    setShowNewTraitement(false);
    setNewTraitement(initialTraitement);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un traitement..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
        </div>
        <Dialog open={showNewTraitement} onOpenChange={setShowNewTraitement}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau traitement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nouveau traitement de données</DialogTitle>
              <DialogDescription>
                Ajouter un traitement au registre (Article 30 RGPD)
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nom du traitement *</Label>
                <Input
                  value={newTraitement.nom}
                  onChange={(e) => setNewTraitement({ ...newTraitement, nom: e.target.value })}
                  placeholder="Ex: Gestion des clients"
                />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea
                  value={newTraitement.description}
                  onChange={(e) => setNewTraitement({ ...newTraitement, description: e.target.value })}
                  placeholder="Description détaillée du traitement..."
                />
              </div>
              <div className="grid gap-2">
                <Label>Base légale *</Label>
                <Select
                  value={newTraitement.base_legale}
                  onValueChange={(v) => setNewTraitement({ ...newTraitement, base_legale: v as RgpdBaseLegale })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BASE_LEGALE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewTraitement(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={!newTraitement.nom}>
                Créer le traitement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Base légale</TableHead>
              <TableHead>Données sensibles</TableHead>
              <TableHead>DPIA</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {traitements?.filter(t =>
              t.nom.toLowerCase().includes(searchTerm.toLowerCase())
            ).map((traitement) => (
              <TableRow key={traitement.id}>
                <TableCell className="font-medium">{traitement.nom}</TableCell>
                <TableCell>{BASE_LEGALE_LABELS[traitement.base_legale]}</TableCell>
                <TableCell>
                  {traitement.donnees_sensibles ? (
                    <Badge variant="destructive">Oui</Badge>
                  ) : (
                    <Badge variant="outline">Non</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {traitement.dpia_requis ? (
                    traitement.dpia_realise ? (
                      <Badge className="bg-green-100 text-green-800">Réalisée</Badge>
                    ) : (
                      <Badge variant="destructive">Requise</Badge>
                    )
                  ) : (
                    <Badge variant="outline">Non requise</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {traitement.est_actif ? (
                    <Badge className="bg-green-100 text-green-800">Actif</Badge>
                  ) : (
                    <Badge variant="secondary">Inactif</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!traitements || traitements.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Aucun traitement enregistré
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
