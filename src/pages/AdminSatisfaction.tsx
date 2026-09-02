import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  fetchSatisfactionCampaignsList,
  fetchSatisfactionResponsesPaged,
  fetchSatisfactionStats,
  fetchSatisfactionForExport,
  satisfactionOnFive,
} from '@/services/satisfaction/satisfactionV3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Settings2 } from 'lucide-react';

interface Response {
  id: string;
  campaign_id: string | null;
  source: string | null;
  dpi: string | null;
  etablissement: string | null;
  service: string | null;
  role: string | null;
  satisfaction: number | null;
  recommendation: number | null;
  comment: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;
const displaySatisfaction = (value: number | null, source: string | null) => {
  const normalized = satisfactionOnFive(value, source);
  return normalized === null ? '—' : `${normalized.toFixed(1)} / 5`;
};

export default function AdminSatisfaction() {
  const [page, setPage] = useState(0);
  const [source, setSource] = useState<string>('all');
  const [etab, setEtab] = useState('');
  const [dpi, setDpi] = useState<string>('all');
  const [service, setService] = useState('');
  const [campaignId, setCampaignId] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [commentOnly, setCommentOnly] = useState(false);

  const filters = { source, etab, dpi, service, campaignId, from, to, commentOnly };


  const campaignsList = useQuery({
    queryKey: ['satisfaction-v3-campaigns-list'],
    queryFn: fetchSatisfactionCampaignsList,
  });

  const responsesQ = useQuery({
    queryKey: ['satisfaction-v3-responses', filters, page],
    queryFn: () => fetchSatisfactionResponsesPaged(filters, page, PAGE_SIZE),
  });

  const statsQ = useQuery({
    queryKey: ['satisfaction-v3-stats', filters],
    queryFn: () => fetchSatisfactionStats(filters),
  });

  const stats = useMemo(() => {
    const rows = statsQ.data ?? [];
    const total = rows.length;
    const bySource = rows.reduce<Record<string, number>>((acc, r) => {
      const k = r.source ?? 'unknown';
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
    const sats = rows
      .map((r) => satisfactionOnFive(r.satisfaction, r.source))
      .filter((v): v is number => typeof v === 'number');
    const avgSat = sats.length ? sats.reduce((a, b) => a + b, 0) / sats.length : 0;
    const recs = rows.map((r) => r.recommendation).filter((v): v is number => typeof v === 'number');
    let nps = 0;
    if (recs.length) {
      const prom = recs.filter((v) => v >= 9).length;
      const det = recs.filter((v) => v <= 6).length;
      nps = ((prom - det) / recs.length) * 100;
    }
    const byMonth = new Map<string, number>();
    rows.forEach((r) => {
      const m = (r.created_at ?? '').slice(0, 7);
      if (m) byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
    });
    const trend = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));
    return { total, bySource, avgSat, nps, recCount: recs.length, satCount: sats.length, trend };
  }, [statsQ.data]);

  const exportCsv = async () => {
    let rows: Response[];
    try {
      rows = (await fetchSatisfactionForExport(filters)) as Response[];
    } catch {
      return;
    }
    const header = ['created_at', 'source', 'campaign_id', 'etablissement', 'dpi', 'service', 'role', 'satisfaction', 'recommendation', 'comment'];
    const csv = [
      header.join(','),
      ...rows.map((r) =>
        header
          .map((h) => {
            const v = (r as any)[h];
            if (v == null) return '';
            const s = String(v).replace(/"/g, '""');
            return `"${s}"`;
          })
          .join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `satisfaction-v3-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const total = responsesQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Satisfaction OpenPulse V3</h1>
          <p className="text-sm text-muted-foreground">
            Retours utilisateurs consolidés (DPI + formulaire public).
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/satisfaction/campagnes">
              <Settings2 className="w-4 h-4 mr-2" />
              Campagnes
            </Link>
          </Button>
          <Button onClick={exportCsv} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Réponses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground mt-1">
              DPI: {stats.bySource['v3-dpi'] ?? 0} · Public: {stats.bySource['public-form'] ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Satisfaction moyenne</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.satCount ? stats.avgSat.toFixed(2) : '—'}
              <span className="text-sm text-muted-foreground font-normal"> / 5</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{stats.satCount} note(s)</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">NPS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.recCount ? Math.round(stats.nps) : '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{stats.recCount} recommandation(s)</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tendance (mois)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-12">
              {stats.trend.slice(-12).map(([m, n]) => {
                const max = Math.max(1, ...stats.trend.map(([, v]) => v));
                const h = Math.max(4, Math.round((n / max) * 48));
                return (
                  <div key={m} className="flex-1 bg-primary/60 rounded-t" style={{ height: h }} title={`${m}: ${n}`} />
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Source</Label>
              <Select value={source} onValueChange={(v) => { setPage(0); setSource(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="v3-dpi">DPI (V3)</SelectItem>
                  <SelectItem value="public-form">Formulaire public</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">DPI</Label>
              <Select value={dpi} onValueChange={(v) => { setPage(0); setDpi(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="hm">HM</SelectItem>
                  <SelectItem value="mediboard">Mediboard</SelectItem>
                  <SelectItem value="easily">Easily</SelectItem>
                  <SelectItem value="resurgences">Resurgences</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Campagne</Label>
              <Select value={campaignId} onValueChange={(v) => { setPage(0); setCampaignId(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {(campaignsList.data ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.title || c.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Établissement</Label>
              <Input value={etab} onChange={(e) => { setPage(0); setEtab(e.target.value); }} placeholder="Nom / id" />
            </div>
            <div>
              <Label className="text-xs">Service</Label>
              <Input value={service} onChange={(e) => { setPage(0); setService(e.target.value); }} />
            </div>
            <div>
              <Label className="text-xs">Du</Label>
              <Input type="date" value={from} onChange={(e) => { setPage(0); setFrom(e.target.value); }} />
            </div>
            <div>
              <Label className="text-xs">Au</Label>
              <Input type="date" value={to} onChange={(e) => { setPage(0); setTo(e.target.value); }} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={commentOnly}
                  onChange={(e) => { setPage(0); setCommentOnly(e.target.checked); }}
                />
                Avec commentaire uniquement
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Réponses ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Établissement</TableHead>
                  <TableHead>DPI</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="text-right">Sat.</TableHead>
                  <TableHead className="text-right">Reco.</TableHead>
                  <TableHead>Commentaire</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responsesQ.isLoading && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Chargement…</TableCell></TableRow>
                )}
                {!responsesQ.isLoading && (responsesQ.data?.rows ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Aucune réponse.</TableCell></TableRow>
                )}
                {(responsesQ.data?.rows ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(r.created_at).toLocaleString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.source === 'public-form' ? 'secondary' : 'default'}>
                        {r.source ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">{r.etablissement ?? '—'}</TableCell>
                    <TableCell>{r.dpi ?? '—'}</TableCell>
                    <TableCell>{r.service ?? '—'}</TableCell>
                    <TableCell>{r.role ?? '—'}</TableCell>
                    <TableCell className="text-right">{displaySatisfaction(r.satisfaction, r.source)}</TableCell>
                    <TableCell className="text-right">{r.recommendation ?? '—'}</TableCell>
                    <TableCell className="max-w-[320px] whitespace-pre-wrap text-sm">{r.comment ?? ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-muted-foreground">
              Page {page + 1} / {totalPages}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Précédent
              </Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Suivant
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
