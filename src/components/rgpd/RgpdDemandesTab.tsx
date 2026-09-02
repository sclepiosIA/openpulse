import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ShieldX } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { invokeEdge } from "@/services/edgeFunctions";
import { toast } from 'sonner';

import {
  DEMANDE_STATUT_LABELS,
  DEMANDE_STATUT_COLORS,
  DROIT_TYPE_LABELS,
  type RgpdDroitType,
  type RgpdDemandeStatut,
  type RgpdDemandeDroit,
} from '@/types/rgpd';
import { useCreateRgpdDemande, useUpdateRgpdDemande } from '@/hooks/auth/useRgpd';

interface RgpdDemandesTabProps {
  demandes: RgpdDemandeDroit[] | undefined;
}

interface NewDemande {
  type_droit: RgpdDroitType;
  demandeur_email: string;
  demandeur_nom: string;
  description: string;
}

const initialDemande: NewDemande = {
  type_droit: 'acces',
  demandeur_email: '',
  demandeur_nom: '',
  description: '',
};

export function RgpdDemandesTab({ demandes }: RgpdDemandesTabProps) {
  const [showNewDemande, setShowNewDemande] = useState(false);
  const [newDemande, setNewDemande] = useState<NewDemande>(initialDemande);
  const [anonymizingId, setAnonymizingId] = useState<string | null>(null);
  const createDemande = useCreateRgpdDemande();
  const updateDemande = useUpdateRgpdDemande();

  const handleCreate = async () => {
    await createDemande.mutateAsync(newDemande);
    setShowNewDemande(false);
    setNewDemande(initialDemande);
  };

  const handleAnonymize = async (demande: RgpdDemandeDroit) => {
    if (!confirm(
      `Anonymiser définitivement les données de ${demande.demandeur_email} ?\n\n` +
      `Cette action pseudonymise les PII (nom, email, téléphone) dans contacts, ` +
      `bookings, chat, support, formations, enquêtes et emails. ` +
      `Les enregistrements sont conservés pour obligations légales/comptables. ` +
      `Action journalisée dans rgpd_audit_logs. Irréversible.`
    )) return;
    setAnonymizingId(demande.id);
    try {
      const data = await invokeEdge<any>('rgpd-anonymize', {
          personEmail: demande.demandeur_email,
          personName: demande.demandeur_nom,
          requestId: demande.id,
        });
      const total = data?.report?.total_records ?? 0;
      toast.success(`Anonymisation terminée — ${total} enregistrement(s) traité(s)`);
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors de l\'anonymisation');
    } finally {
      setAnonymizingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Demandes d'exercice de droits</h2>
        <Dialog open={showNewDemande} onOpenChange={setShowNewDemande}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle demande
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle demande de droit</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Type de droit *</Label>
                <Select
                  value={newDemande.type_droit}
                  onValueChange={(v) => setNewDemande({ ...newDemande, type_droit: v as RgpdDroitType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DROIT_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Email du demandeur *</Label>
                <Input
                  type="email"
                  value={newDemande.demandeur_email}
                  onChange={(e) => setNewDemande({ ...newDemande, demandeur_email: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Nom du demandeur</Label>
                <Input
                  value={newDemande.demandeur_nom}
                  onChange={(e) => setNewDemande({ ...newDemande, demandeur_nom: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea
                  value={newDemande.description}
                  onChange={(e) => setNewDemande({ ...newDemande, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewDemande(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={!newDemande.demandeur_email}>
                Créer la demande
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
              <TableHead>Type</TableHead>
              <TableHead>Demandeur</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {demandes?.map((demande) => {
              const joursRestants = differenceInDays(parseISO(demande.date_limite), new Date());
              const enRetard = joursRestants < 0 && (demande.statut === 'nouvelle' || demande.statut === 'en_cours');

              return (
                <TableRow key={demande.id}>
                  <TableCell className="font-mono text-sm">{demande.numero}</TableCell>
                  <TableCell>{DROIT_TYPE_LABELS[demande.type_droit]}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{demande.demandeur_nom || '-'}</div>
                      <div className="text-sm text-muted-foreground">{demande.demandeur_email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(parseISO(demande.date_demande), 'dd/MM/yyyy', { locale: fr })}
                  </TableCell>
                  <TableCell>
                    <div className={enRetard ? 'text-destructive font-medium' : ''}>
                      {format(parseISO(demande.date_limite), 'dd/MM/yyyy', { locale: fr })}
                      {enRetard && <span className="text-xs ml-1">({Math.abs(joursRestants)}j retard)</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={DEMANDE_STATUT_COLORS[demande.statut]}>
                      {DEMANDE_STATUT_LABELS[demande.statut]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(demande.statut === 'nouvelle' || demande.statut === 'en_cours') && (
                      <div className="flex gap-1 flex-wrap">
                        {demande.statut === 'nouvelle' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateDemande.mutate({ id: demande.id, statut: 'en_cours' as RgpdDemandeStatut })}
                          >
                            Traiter
                          </Button>
                        )}
                        {demande.type_droit === 'effacement' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={anonymizingId === demande.id}
                            onClick={() => handleAnonymize(demande)}
                          >
                            <ShieldX className="h-3 w-3 mr-1" />
                            {anonymizingId === demande.id ? 'Anonymisation…' : 'Anonymiser'}
                          </Button>
                        )}
                        {demande.statut === 'en_cours' && demande.type_droit !== 'effacement' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateDemande.mutate({
                              id: demande.id,
                              statut: 'completee' as RgpdDemandeStatut,
                              date_traitement: new Date().toISOString()
                            })}
                          >
                            Compléter
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>

                </TableRow>
              );
            })}
            {(!demandes || demandes.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Aucune demande enregistrée
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
