import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Activity } from "lucide-react";
import { EditableCell } from "@/components/csm/EditableCell";
import { useCsmKpisMensuels } from "@/hooks/csm/useCsmKpisMensuels";
import { cn } from "@/lib/utils";

interface CsmEtabKpisMensuelsProps {
  etablissementId: string;
}

export function CsmEtabKpisMensuels({ etablissementId }: CsmEtabKpisMensuelsProps) {
  const { data: kpis, upsert, remove } = useCsmKpisMensuels(etablissementId);

  const computeTaux = (passages: number | null, dossiers: number | null) =>
    passages && dossiers ? Math.round((dossiers / passages) * 100) : null;

  const kpisWithTaux = kpis.map(k => ({
    ...k,
    computed_taux: computeTaux(k.passages_total, k.dossiers_traites) ?? k.taux_utilisation ?? 0,
  }));

  const avgUtil =
    kpisWithTaux.length > 0 ? Math.round(kpisWithTaux.reduce((s, k) => s + (k.computed_taux || 0), 0) / kpisWithTaux.length) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Suivi utilisation mensuel
          </CardTitle>
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              avgUtil >= 60
                ? "bg-emerald-100 text-emerald-700"
                : avgUtil >= 40
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700",
            )}
          >
            Moy. {avgUtil}%
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="min-w-[140px]">Période</TableHead>
                <TableHead className="min-w-[140px]">UHCD Backend</TableHead>
                <TableHead className="min-w-[140px]">UHCD Compte</TableHead>
                <TableHead className="min-w-[140px]">Utilisation</TableHead>
                <TableHead className="min-w-[80px]">Passages</TableHead>
                <TableHead className="min-w-[80px]">Dossiers</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpisWithTaux.map((kpi) => (
                <TableRow key={kpi.id} className="hover:bg-muted/20">
                  <TableCell>
                    <EditableCell value={kpi.mois} placeholder="Mois" onSave={(v) => { const { computed_taux, ...rest } = kpi; upsert({ ...rest, mois: v }); }} />
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={kpi.taux_uhcd_backend?.toString()}
                      placeholder="%"
                      onSave={(v) => { const { computed_taux, ...rest } = kpi; upsert({ ...rest, taux_uhcd_backend: v ? Number(v) : null }); }}
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={kpi.taux_uhcd_compte?.toString()}
                      placeholder="%"
                      onSave={(v) => { const { computed_taux, ...rest } = kpi; upsert({ ...rest, taux_uhcd_compte: v ? Number(v) : null }); }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={kpi.computed_taux || 0} className="h-2 flex-1" />
                      <span className="text-xs font-medium text-muted-foreground w-10 text-right">
                        {kpi.computed_taux != null ? `${kpi.computed_taux}%` : '—'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={kpi.passages_total?.toString()}
                      placeholder="0"
                      onSave={(v) => {
                        const { computed_taux, ...rest } = kpi;
                        const passages = v ? Number(v) : null;
                        const taux = computeTaux(passages, rest.dossiers_traites);
                        upsert({ ...rest, passages_total: passages, taux_utilisation: taux });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={kpi.dossiers_traites?.toString()}
                      placeholder="0"
                      onSave={(v) => {
                        const { computed_taux, ...rest } = kpi;
                        const dossiers = v ? Number(v) : null;
                        const taux = computeTaux(rest.passages_total, dossiers);
                        upsert({ ...rest, dossiers_traites: dossiers, taux_utilisation: taux });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(kpi.id)} aria-label="Supprimer">
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 gap-1 text-xs"
          onClick={() => {
            const minSort = kpis.length > 0 ? Math.min(...kpis.map(k => k.sort_order ?? 0)) : 0;
            upsert({
              etablissement_id: etablissementId,
              mois: `Mois ${kpis.length + 1}`,
              sort_order: minSort - 1,
            });
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter une période
        </Button>
      </CardContent>
    </Card>
  );
}
