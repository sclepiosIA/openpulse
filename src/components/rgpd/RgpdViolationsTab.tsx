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
import { AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  VIOLATION_SEVERITE_LABELS,
  VIOLATION_SEVERITE_COLORS,
  type RgpdViolationSeverite,
  type RgpdViolation,
} from '@/types/rgpd';
import { useCreateRgpdViolation } from '@/hooks/auth/useRgpd';

interface RgpdViolationsTabProps {
  violations: RgpdViolation[] | undefined;
}

interface NewViolation {
  titre: string;
  description: string;
  severite: RgpdViolationSeverite;
  origine: string;
}

const initialViolation: NewViolation = {
  titre: '',
  description: '',
  severite: 'moyenne',
  origine: '',
};

export function RgpdViolationsTab({ violations }: RgpdViolationsTabProps) {
  const [showNewViolation, setShowNewViolation] = useState(false);
  const [newViolation, setNewViolation] = useState<NewViolation>(initialViolation);
  const createViolation = useCreateRgpdViolation();

  const handleCreate = async () => {
    await createViolation.mutateAsync(newViolation);
    setShowNewViolation(false);
    setNewViolation(initialViolation);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Registre des violations</h2>
        <Dialog open={showNewViolation} onOpenChange={setShowNewViolation}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Déclarer une violation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Déclarer une violation de données</DialogTitle>
              <DialogDescription>
                Notification requise à la CNIL sous 72h si nécessaire
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Titre *</Label>
                <Input
                  value={newViolation.titre}
                  onChange={(e) => setNewViolation({ ...newViolation, titre: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Description *</Label>
                <Textarea
                  value={newViolation.description}
                  onChange={(e) => setNewViolation({ ...newViolation, description: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Sévérité</Label>
                <Select
                  value={newViolation.severite}
                  onValueChange={(v) => setNewViolation({ ...newViolation, severite: v as RgpdViolationSeverite })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VIOLATION_SEVERITE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Origine</Label>
                <Input
                  value={newViolation.origine}
                  onChange={(e) => setNewViolation({ ...newViolation, origine: e.target.value })}
                  placeholder="Ex: Erreur humaine, Cyberattaque..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewViolation(false)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleCreate}
                disabled={!newViolation.titre || !newViolation.description}
              >
                Déclarer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numéro</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead>Sévérité</TableHead>
              <TableHead>Date détection</TableHead>
              <TableHead>CNIL</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {violations?.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono text-sm">{v.numero}</TableCell>
                <TableCell className="font-medium">{v.titre}</TableCell>
                <TableCell>
                  <Badge className={VIOLATION_SEVERITE_COLORS[v.severite]}>
                    {VIOLATION_SEVERITE_LABELS[v.severite]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {format(parseISO(v.date_detection), 'dd/MM/yyyy HH:mm', { locale: fr })}
                </TableCell>
                <TableCell>
                  {v.notification_cnil_requise ? (
                    v.date_notification_cnil ? (
                      <Badge className="bg-green-100 text-green-800">Notifiée</Badge>
                    ) : (
                      <Badge variant="destructive">À notifier</Badge>
                    )
                  ) : (
                    <Badge variant="outline">Non requise</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={v.statut === 'cloturee' ? 'secondary' : 'default'}>
                    {v.statut === 'ouverte' ? 'Ouverte' : v.statut === 'en_cours' ? 'En cours' : 'Clôturée'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {(!violations || violations.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Aucune violation enregistrée
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
