import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { RgpdConsentement } from '@/types/rgpd';

interface RgpdConsentementsTabProps {
  consentements: RgpdConsentement[] | undefined;
}

export function RgpdConsentementsTab({ consentements }: RgpdConsentementsTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Registre des consentements</CardTitle>
          <CardDescription>
            Suivi des consentements collectés par finalité
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Finalité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Mode</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consentements?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.personne_email}</TableCell>
                  <TableCell>{c.finalite}</TableCell>
                  <TableCell>
                    {c.est_accorde && !c.date_retrait ? (
                      <Badge className="bg-green-100 text-green-800">Accordé</Badge>
                    ) : (
                      <Badge variant="secondary">Retiré</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.date_consentement && format(parseISO(c.date_consentement), 'dd/MM/yyyy', { locale: fr })}
                  </TableCell>
                  <TableCell>{c.mode_collecte}</TableCell>
                </TableRow>
              ))}
              {(!consentements || consentements.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Aucun consentement enregistré
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
