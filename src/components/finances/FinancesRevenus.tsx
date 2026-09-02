import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageDataState } from "@/components/common/PageDataState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useContrats } from "@/hooks/contracts/useContrats";
import { FileSignature, Search, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import type { Contrat, ContratStatut } from "@/types/contrats";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const SIGNED_STATUTS: ContratStatut[] = ["signe", "actif", "en_renouvellement"];

const STATUT_LABELS: Record<string, string> = {
  signe: "Signé",
  actif: "Actif",
  en_renouvellement: "En renouvellement",
};

const STATUT_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  signe: "secondary",
  actif: "default",
  en_renouvellement: "outline",
};

const TYPE_LABELS: Record<string, string> = {
  licence: "Licence",
  maintenance: "Maintenance",
  formation: "Formation",
  consulting: "Consulting",
  hebergement: "Hébergement",
  support: "Support",
  partenariat: "Partenariat",
  autre: "Autre",
};

export function FinancesRevenus() {
  const [search, setSearch] = useState("");
  const contratsQ = useContrats();

  const contrats = useMemo(() => {
    const list = (contratsQ.data || []).filter((c) => SIGNED_STATUTS.includes(c.statut));
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (c) =>
        c.titre?.toLowerCase().includes(term) ||
        c.numero?.toLowerCase().includes(term) ||
        c.client_nom?.toLowerCase().includes(term) ||
        c.etablissement?.nom?.toLowerCase().includes(term)
    );
  }, [contratsQ.data, search]);

  const totalMensuel = contrats.reduce((s, c) => s + (c.montant_mensuel_ht || 0), 0);
  const totalAnnuel = contrats.reduce((s, c) => s + (c.montant_annuel_ht || 0), 0);

  const clientLabel = (c: Contrat) => c.etablissement?.nom || c.client_nom || "—";

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <PageDataState
        isLoading={contratsQ.isLoading}
        isError={contratsQ.isError}
        error={contratsQ.error}
        onRetry={() => contratsQ.refetch()}
      >
        {/* Totaux */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Contrats signés</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{contrats.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenu mensuel HT</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold break-words">{formatCurrency(totalMensuel)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenu annuel HT</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold break-words">{formatCurrency(totalAnnuel)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSignature className="h-4 w-4 text-muted-foreground" />
                Contrats signés
              </CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un contrat..."
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {contrats.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {search ? "Aucun contrat ne correspond à la recherche." : "Aucun contrat signé pour le moment."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[80px]">N°</TableHead>
                      <TableHead className="min-w-[180px]">Client</TableHead>
                      <TableHead className="min-w-[160px]">Titre</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Signature</TableHead>
                      <TableHead className="text-right">Mensuel HT</TableHead>
                      <TableHead className="text-right">Annuel HT</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contrats.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{c.numero || "—"}</TableCell>
                        <TableCell className="font-medium max-w-[220px] truncate">{clientLabel(c)}</TableCell>
                        <TableCell className="max-w-[240px] truncate text-muted-foreground">{c.titre}</TableCell>
                        <TableCell className="whitespace-nowrap">{TYPE_LABELS[c.type] || c.type}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {c.date_signature ? format(parseISO(c.date_signature), "dd MMM yyyy", { locale: fr }) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">
                          {formatCurrency(c.montant_mensuel_ht || 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">
                          {formatCurrency(c.montant_annuel_ht || 0)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUT_VARIANTS[c.statut] || "secondary"} className="whitespace-nowrap">
                            {STATUT_LABELS[c.statut] || c.statut}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <Link to={`/contrats?contrat=${c.id}`} aria-label={`Ouvrir le contrat ${c.numero || c.titre}`}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </PageDataState>
    </div>
  );
}
