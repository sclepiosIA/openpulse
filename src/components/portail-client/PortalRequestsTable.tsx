import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientPortalRequest, useUpdateClientPortalRequest } from "@/hooks/portail/useClientPortal";
import { CheckCircle2, RotateCcw, XCircle, Eye } from "lucide-react";

const TYPE_LABEL: Record<ClientPortalRequest["type"], string> = {
  contact: "Contact",
  formation: "Formation",
  deploiement: "Déploiement",
  facture: "Facture",
  autre: "Autre",
};

const STATUS_VARIANT: Record<ClientPortalRequest["statut"], "default" | "secondary" | "outline"> = {
  nouveau: "default",
  en_cours: "default",
  traite: "secondary",
  ferme: "outline",
};

const STATUS_LABEL: Record<ClientPortalRequest["statut"], string> = {
  nouveau: "Nouveau",
  en_cours: "En cours",
  traite: "Traitée",
  ferme: "Fermée",
};

interface Props {
  requests: ClientPortalRequest[];
  isLoading?: boolean;
}

export function PortalRequestsTable({ requests, isLoading }: Props) {
  const [selected, setSelected] = useState<ClientPortalRequest | null>(null);
  const update = useUpdateClientPortalRequest();

  return (
    <>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Sujet</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : requests.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune demande</TableCell></TableRow>
            ) : (
              requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}</TableCell>
                  <TableCell><Badge variant="outline">{TYPE_LABEL[r.type]}</Badge></TableCell>
                  <TableCell className="font-medium max-w-xs truncate">{r.sujet}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[r.statut]}>{STATUS_LABEL[r.statut]}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {(r.statut === "nouveau" || r.statut === "en_cours") && (
                      <Button size="sm" variant="outline" onClick={() => update.mutate({ id: r.id, statut: "traite" })} disabled={update.isPending}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Traiter
                      </Button>
                    )}
                    {r.statut === "traite" && (
                      <Button size="sm" variant="outline" onClick={() => update.mutate({ id: r.id, statut: "ferme" })} disabled={update.isPending}>
                        <XCircle className="h-3.5 w-3.5 mr-1" />Fermer
                      </Button>
                    )}
                    {r.statut === "ferme" && (
                      <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: r.id, statut: "nouveau" })} disabled={update.isPending}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />Rouvrir
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.sujet}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="flex gap-2 text-sm flex-wrap items-center">
                <Badge variant="outline">{TYPE_LABEL[selected.type]}</Badge>
                <Badge variant={STATUS_VARIANT[selected.statut]}>{STATUS_LABEL[selected.statut]}</Badge>
                {selected.email && <span className="text-muted-foreground">{selected.email}</span>}
                <span className="text-muted-foreground ml-auto">{format(new Date(selected.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}</span>
              </div>
              <div className="bg-muted/50 rounded-md p-4 whitespace-pre-wrap text-sm">{selected.message}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
