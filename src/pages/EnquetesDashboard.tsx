// Dashboard d'analyse consolidée des enquêtes (sera enrichi)
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEnquetesDashboard } from "@/services/enquetes/enquetesDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Download, TrendingUp, Users, Sparkles, Heart } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import AdminSatisfaction from "./AdminSatisfaction";
import AdminSatisfactionCampagnes from "./AdminSatisfactionCampagnes";
import { satisfactionOnFive } from "@/services/satisfaction/satisfactionV3";

function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = r[h];
      const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(';') : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(',')),
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function useEnquetes() {
  return useQuery({
    queryKey: ['enquetes-dashboard'],
    queryFn: fetchEnquetesDashboard,
  });
}

function Kpi({ label, value, suffix, icon: Icon }: { label: string; value: string | number; suffix?: string; icon: typeof TrendingUp }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="size-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold">{value}{suffix}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EnquetesDashboard() {
  const { data, isLoading, isError, error, refetch } = useEnquetes();

  const kpis = useMemo(() => {
    if (!data) return null;
    const v3Rows = data.v3 ?? [];
    const avg = (arr: any[], key: string) => {
      const vals = arr.map(r => r[key]).filter((v): v is number => typeof v === 'number');
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };
    const nps = [
      ...data.solution.map((r: any) => r.nps_score),
      ...v3Rows.map((r) => r.recommendation),
    ].filter((v): v is number => typeof v === 'number');
    const promoteurs = nps.filter((v) => v >= 9).length;
    const detracteurs = nps.filter((v) => v <= 6).length;
    const npsCalc = nps.length ? Math.round(((promoteurs - detracteurs) / nps.length) * 100) : 0;
    const tauxResp = data.campagnes.length
      ? Math.round((data.campagnes.filter((c: any) => c.status === 'responded').length / data.campagnes.length) * 100)
      : 0;
    const gainTemps = data.solution.filter((r: any) => ['10_15min', '5_10min'].includes(r.gain_temps_estime)).length;
    const pctGain = data.solution.length ? Math.round((gainTemps / data.solution.length) * 100) : 0;
    return {
      csatFormation: avg(data.formation, 'note_globale').toFixed(1),
      csatSolution: avg(data.solution, 'satisfaction_globale').toFixed(1),
      csatV3: (() => {
        const vals = v3Rows
          .map((r: any) => satisfactionOnFive(r.satisfaction, r.source))
          .filter((v): v is number => typeof v === 'number');
        return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—';
      })(),
      cesAvg: avg(data.ces, 'effort_score').toFixed(1),
      csmAvg: avg(data.csm, 'note_globale').toFixed(1),
      nps: npsCalc,
      tauxResp,
      pctGain,
      totalReponses: data.formation.length + data.ces.length + data.solution.length + data.csm.length + v3Rows.length,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError || !data || !kpis) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Card className="border-destructive/30">
          <CardContent className="p-8 text-center space-y-3">
            <h1 className="text-xl font-semibold">Impossible de charger les enquêtes</h1>
            <p className="text-sm text-muted-foreground">{(error as Error)?.message || "Erreur de chargement des données"}</p>
            <Button onClick={() => refetch()} variant="outline">Réessayer</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <ClipboardCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Enquêtes de suivi clients</h1>
            <p className="text-sm text-muted-foreground">Analyse consolidée des 4 questionnaires de satisfaction.</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="CSAT Formation" value={kpis.csatFormation} suffix="/10" icon={Sparkles} />
        <Kpi label="CSAT Solution" value={kpis.csatSolution} suffix="/10" icon={Heart} />
        <Kpi label="CSAT OpenPulse V3" value={kpis.csatV3} suffix="/5" icon={Heart} />
        <Kpi label="CES moyen" value={kpis.cesAvg} suffix="/10" icon={TrendingUp} />
        <Kpi label="Note CSM" value={kpis.csmAvg} suffix="/10" icon={Users} />
        <Kpi label="NPS" value={kpis.nps} suffix="" icon={TrendingUp} />
        <Kpi label="Taux de réponse" value={kpis.tauxResp} suffix="%" icon={ClipboardCheck} />
        <Kpi label="% gain >5min/patient" value={kpis.pctGain} suffix="%" icon={TrendingUp} />
        <Kpi label="Total réponses" value={kpis.totalReponses} icon={Users} />
      </div>

      <Tabs defaultValue="v3">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="v3">OpenPulse V3</TabsTrigger>
          <TabsTrigger value="v3-campagnes">Campagnes V3</TabsTrigger>
          <TabsTrigger value="formation">Formation ({data.formation.length})</TabsTrigger>
          <TabsTrigger value="ces">CES ({data.ces.length})</TabsTrigger>
          <TabsTrigger value="solution">Satisfaction/NPS ({data.solution.length})</TabsTrigger>
          <TabsTrigger value="csm">Suivi CSM ({data.csm.length})</TabsTrigger>
          <TabsTrigger value="campagnes">Campagnes ({data.campagnes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="v3" className="mt-4">
          <AdminSatisfaction />
        </TabsContent>
        <TabsContent value="v3-campagnes" className="mt-4">
          <AdminSatisfactionCampagnes />
        </TabsContent>

        {[
          { key: 'formation' as const, rows: data.formation, scoreKey: 'note_globale', scoreLabel: 'Note /10' },
          { key: 'ces' as const, rows: data.ces, scoreKey: 'effort_score', scoreLabel: 'Effort /10' },
          { key: 'solution' as const, rows: data.solution, scoreKey: 'satisfaction_globale', scoreLabel: 'Sat /10' },
          { key: 'csm' as const, rows: data.csm, scoreKey: 'note_globale', scoreLabel: 'Note /10' },
        ].map(({ key, rows, scoreKey, scoreLabel }) => (
          <TabsContent key={key} value={key}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Réponses récentes</CardTitle>
                <Button size="sm" variant="outline" onClick={() => exportCSV(rows as any[], `enquete-${key}.csv`)}>
                  <Download className="size-4 mr-2" />Exporter CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Établissement</TableHead>
                        <TableHead>Répondant</TableHead>
                        <TableHead>Fonction</TableHead>
                        <TableHead>DPI</TableHead>
                        <TableHead>{scoreLabel}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Aucune réponse</TableCell></TableRow>
                      ) : rows.slice(0, 50).map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell>{format(new Date(r.date_reponse), 'dd MMM yyyy', { locale: fr })}</TableCell>
                          <TableCell>{r.etablissements?.nom || '-'}</TableCell>
                          <TableCell>{r.nom_prenom}</TableCell>
                          <TableCell>{r.fonction}</TableCell>
                          <TableCell>{r.dpi}</TableCell>
                          <TableCell><Badge variant={r[scoreKey] >= 6 ? 'default' : 'destructive'}>{r[scoreKey]}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        <TabsContent value="campagnes">
          <Card>
            <CardHeader><CardTitle className="text-base">Campagnes d'envoi</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Planifiée</TableHead>
                      <TableHead>Envoyée</TableHead>
                      <TableHead>Répondue</TableHead>
                      <TableHead>Expire</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.campagnes.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Aucune campagne</TableCell></TableRow>
                    ) : data.campagnes.slice(0, 100).map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                        <TableCell>{c.canal}</TableCell>
                        <TableCell><Badge>{c.status}</Badge></TableCell>
                        <TableCell>{format(new Date(c.scheduled_at), 'dd/MM/yy HH:mm', { locale: fr })}</TableCell>
                        <TableCell>{c.sent_at ? format(new Date(c.sent_at), 'dd/MM/yy HH:mm', { locale: fr }) : '-'}</TableCell>
                        <TableCell>{c.responded_at ? format(new Date(c.responded_at), 'dd/MM/yy HH:mm', { locale: fr }) : '-'}</TableCell>
                        <TableCell>{format(new Date(c.expires_at), 'dd/MM/yy', { locale: fr })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
