import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { RgpdCertification } from '@/types/rgpd';
import { useCreateRgpdCertification } from '@/hooks/auth/useRgpd';

interface RgpdCertificationsTabProps {
  certifications: RgpdCertification[] | undefined;
}

interface NewCertification {
  nom: string;
  type: string;
  organisme_certificateur: string;
  date_obtention: string;
  date_expiration: string;
}

const initialCertification: NewCertification = {
  nom: '',
  type: 'HDS',
  organisme_certificateur: '',
  date_obtention: '',
  date_expiration: '',
};

export function RgpdCertificationsTab({ certifications }: RgpdCertificationsTabProps) {
  const [showNewCertification, setShowNewCertification] = useState(false);
  const [newCertification, setNewCertification] = useState<NewCertification>(initialCertification);
  const createCertification = useCreateRgpdCertification();

  const handleCreate = async () => {
    await createCertification.mutateAsync(newCertification);
    setShowNewCertification(false);
    setNewCertification(initialCertification);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Certifications & Conformité</h2>
        <Dialog open={showNewCertification} onOpenChange={setShowNewCertification}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une certification
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle certification</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nom *</Label>
                <Input
                  value={newCertification.nom}
                  onChange={(e) => setNewCertification({ ...newCertification, nom: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={newCertification.type}
                  onValueChange={(v) => setNewCertification({ ...newCertification, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HDS">HDS (Hébergement Données Santé)</SelectItem>
                    <SelectItem value="ISO27001">ISO 27001</SelectItem>
                    <SelectItem value="SOC2">SOC 2</SelectItem>
                    <SelectItem value="HIPAA">HIPAA</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Organisme certificateur</Label>
                <Input
                  value={newCertification.organisme_certificateur}
                  onChange={(e) => setNewCertification({ ...newCertification, organisme_certificateur: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Date d'obtention *</Label>
                  <Input
                    type="date"
                    value={newCertification.date_obtention}
                    onChange={(e) => setNewCertification({ ...newCertification, date_obtention: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Date d'expiration</Label>
                  <Input
                    type="date"
                    value={newCertification.date_expiration}
                    onChange={(e) => setNewCertification({ ...newCertification, date_expiration: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewCertification(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newCertification.nom || !newCertification.date_obtention}
              >
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {certifications?.map((cert) => {
          const joursRestants = cert.date_expiration
            ? differenceInDays(parseISO(cert.date_expiration), new Date())
            : null;
          const expirantBientot = joursRestants !== null && joursRestants <= 90 && joursRestants > 0;
          const expiree = joursRestants !== null && joursRestants <= 0;

          return (
            <Card key={cert.id} className={expiree ? 'border-destructive' : expirantBientot ? 'border-warning' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{cert.nom}</CardTitle>
                  <Badge>{cert.type}</Badge>
                </div>
                {cert.organisme_certificateur && (
                  <CardDescription>{cert.organisme_certificateur}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Obtenue le</span>
                  <span>{format(parseISO(cert.date_obtention), 'dd/MM/yyyy', { locale: fr })}</span>
                </div>
                {cert.date_expiration && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Expire le</span>
                    <span className={expiree ? 'text-destructive font-medium' : expirantBientot ? 'text-warning font-medium' : ''}>
                      {format(parseISO(cert.date_expiration), 'dd/MM/yyyy', { locale: fr })}
                      {expirantBientot && <span className="text-xs ml-1">({joursRestants}j)</span>}
                      {expiree && <span className="text-xs ml-1">(expirée)</span>}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Statut</span>
                  {cert.est_valide ? (
                    <Badge className="bg-green-100 text-green-800">Valide</Badge>
                  ) : (
                    <Badge variant="secondary">Invalide</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {(!certifications || certifications.length === 0) && (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucune certification enregistrée
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
