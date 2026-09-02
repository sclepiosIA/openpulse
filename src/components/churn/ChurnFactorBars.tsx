import { Progress } from '@/components/ui/progress';

interface Props { factors: Record<string, number> }

const FACTOR_DEF = [
  { key: 'open_tickets', label: '🎫 Tickets ouverts', max: 30, weight: 30, valueText: (v: number) => `${v} ticket${v > 1 ? 's' : ''}`, scoreFn: (v: number) => v >= 5 ? 30 : v >= 3 ? 15 : 0 },
  { key: 'emails_30d', label: '📧 Emails 30j', max: 25, weight: 25, valueText: (v: number) => `${v} échange${v > 1 ? 's' : ''}`, scoreFn: (v: number) => v === 0 ? 25 : v < 3 ? 10 : 0 },
  { key: 'unpaid_invoices', label: '💸 Impayés', max: 25, weight: 25, valueText: (v: number) => `${v} facture${v > 1 ? 's' : ''}`, scoreFn: (v: number) => v >= 2 ? 25 : v === 1 ? 10 : 0 },
  { key: 'days_since_last_interaction', label: '⏰ Dernière interaction', max: 20, weight: 20, valueText: (v: number) => v >= 999 ? 'jamais' : `${v}j`, scoreFn: (v: number) => v > 60 ? 20 : v > 30 ? 10 : 0 },
];

export function ChurnFactorBars({ factors }: Props) {
  return (
    <div className="space-y-3">
      {FACTOR_DEF.map(f => {
        const value = Number(factors?.[f.key] ?? 0);
        const score = f.scoreFn(value);
        const pct = (score / f.max) * 100;
        return (
          <div key={f.key}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="truncate">{f.label}</span>
              <span className="text-xs">
                <span className="text-muted-foreground">{f.valueText(value)} · </span>
                <span className="font-mono">{score}/{f.max}</span>
              </span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
        );
      })}
    </div>
  );
}
