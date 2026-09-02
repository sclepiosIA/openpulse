/**
 * Insertion de graphique dans un tableur : lit une plage, produit un SVG (recharts non
 * nécessaire — SVG natif pour rester léger) et l'ancre dans le tableur comme "chart block".
 * L'appelant reçoit le SVG et le stocke dans son état ; on l'affiche en superposition.
 */
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type ChartKind = 'bar' | 'line' | 'pie';

export interface ChartSpec {
  kind: ChartKind;
  title: string;
  range: string; // ex A1:B10
  labelsFrom: 'firstCol' | 'firstRow';
  data: { label: string; value: number }[];
}

function parseA1(range: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const m = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!m) return null;
  const col = (s: string) => s.toUpperCase().split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
  return { c1: col(m[1]), r1: parseInt(m[2]) - 1, c2: col(m[3]), r2: parseInt(m[4]) - 1 };
}

export function renderChartSvg(spec: ChartSpec): string {
  const W = 640;
  const H = 360;
  const P = 40;
  const data = spec.data.filter((d) => isFinite(d.value));
  if (data.length === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><text x="20" y="30">Aucune donnée</text></svg>`;
  const max = Math.max(...data.map((d) => d.value), 0);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const colors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  let body = '';
  if (spec.kind === 'bar') {
    const bw = (W - P * 2) / data.length;
    body = data
      .map((d, i) => {
        const h = ((d.value - min) / range) * (H - P * 2);
        const x = P + i * bw + bw * 0.15;
        const y = H - P - h;
        return `<rect x="${x}" y="${y}" width="${bw * 0.7}" height="${h}" fill="${colors[i % colors.length]}"/><text x="${x + bw * 0.35}" y="${H - P + 14}" text-anchor="middle" font-size="10" fill="#666">${d.label}</text>`;
      })
      .join('');
  } else if (spec.kind === 'line') {
    const step = (W - P * 2) / Math.max(1, data.length - 1);
    const pts = data.map((d, i) => `${P + i * step},${H - P - ((d.value - min) / range) * (H - P * 2)}`).join(' ');
    body = `<polyline points="${pts}" fill="none" stroke="${colors[0]}" stroke-width="2"/>` +
      data
        .map((d, i) => {
          const x = P + i * step;
          const y = H - P - ((d.value - min) / range) * (H - P * 2);
          return `<circle cx="${x}" cy="${y}" r="3" fill="${colors[0]}"/><text x="${x}" y="${H - P + 14}" text-anchor="middle" font-size="10" fill="#666">${d.label}</text>`;
        })
        .join('');
  } else {
    const cx = W / 2, cy = H / 2, r = 130;
    const total = data.reduce((a, d) => a + Math.max(0, d.value), 0) || 1;
    let angle = -Math.PI / 2;
    body = data
      .map((d, i) => {
        const v = Math.max(0, d.value);
        const slice = (v / total) * Math.PI * 2;
        const x1 = cx + r * Math.cos(angle);
        const y1 = cy + r * Math.sin(angle);
        angle += slice;
        const x2 = cx + r * Math.cos(angle);
        const y2 = cy + r * Math.sin(angle);
        const large = slice > Math.PI ? 1 : 0;
        return `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${colors[i % colors.length]}"/>`;
      })
      .join('') +
      data
        .map((d, i) => `<g><rect x="${W - 130}" y="${20 + i * 18}" width="12" height="12" fill="${colors[i % colors.length]}"/><text x="${W - 112}" y="${30 + i * 18}" font-size="11">${d.label} (${d.value})</text></g>`)
        .join('');
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="white"/><text x="${W / 2}" y="20" text-anchor="middle" font-size="14" font-weight="bold">${spec.title || ''}</text>${body}</svg>`;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  getCellValue: (key: string) => string;
  onInsert: (spec: ChartSpec, svg: string) => void;
}

export function ChartInsertDialog({ open, onOpenChange, getCellValue, onInsert }: Props) {
  const [kind, setKind] = useState<ChartKind>('bar');
  const [title, setTitle] = useState('Graphique');
  const [range, setRange] = useState('A1:B6');
  const [labelsFrom, setLabelsFrom] = useState<'firstCol' | 'firstRow'>('firstCol');

  const spec = useMemo<ChartSpec>(() => {
    const p = parseA1(range);
    const data: { label: string; value: number }[] = [];
    if (p) {
      if (labelsFrom === 'firstCol') {
        for (let r = p.r1; r <= p.r2; r++) {
          const label = getCellValue(`${String.fromCharCode(65 + p.c1)}${r + 1}`);
          for (let c = p.c1 + 1; c <= p.c2; c++) {
            const v = parseFloat(getCellValue(`${String.fromCharCode(65 + c)}${r + 1}`));
            if (isFinite(v)) { data.push({ label: label || `L${r + 1}`, value: v }); break; }
          }
        }
      } else {
        for (let c = p.c1; c <= p.c2; c++) {
          const label = getCellValue(`${String.fromCharCode(65 + c)}${p.r1 + 1}`);
          for (let r = p.r1 + 1; r <= p.r2; r++) {
            const v = parseFloat(getCellValue(`${String.fromCharCode(65 + c)}${r + 1}`));
            if (isFinite(v)) { data.push({ label: label || `C${c + 1}`, value: v }); break; }
          }
        }
      }
    }
    return { kind, title, range, labelsFrom, data };
  }, [kind, title, range, labelsFrom, getCellValue, open]);

  const svg = useMemo(() => renderChartSvg(spec), [spec]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Insérer un graphique</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ChartKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Barres</SelectItem>
                  <SelectItem value="line">Ligne</SelectItem>
                  <SelectItem value="pie">Camembert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Titre</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Plage (A1:B10)</Label>
              <Input value={range} onChange={(e) => setRange(e.target.value.toUpperCase())} className="font-mono" />
            </div>
            <div>
              <Label className="text-xs">Étiquettes depuis</Label>
              <Select value={labelsFrom} onValueChange={(v) => setLabelsFrom(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="firstCol">Première colonne</SelectItem>
                  <SelectItem value="firstRow">Première ligne</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="border rounded overflow-hidden bg-muted/20">
            <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => { onInsert(spec, svg); onOpenChange(false); }} disabled={spec.data.length === 0}>
            Insérer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
