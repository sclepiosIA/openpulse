import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChurnSparkline } from './ChurnSparkline';
import { ShieldAlert, AlertTriangle, TrendingDown, Activity, BellOff, ExternalLink, Wand2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { ChurnPrediction, ChurnRiskLevel } from '@/hooks/csm/useChurnPredictions';

const RISK_CFG: Record<ChurnRiskLevel, { label: string; cls: string; icon: typeof ShieldAlert }> = {
  critical: { label: 'Critique', cls: 'bg-destructive text-destructive-foreground', icon: ShieldAlert },
  high: { label: 'Élevé', cls: 'bg-amber-600 text-white', icon: AlertTriangle },
  medium: { label: 'Modéré', cls: 'bg-yellow-500 text-white', icon: TrendingDown },
  low: { label: 'Faible', cls: 'bg-emerald-600 text-white', icon: Activity },
};

interface Props {
  prediction: ChurnPrediction;
  onOpenAction: (id: string) => void;
}

export function ChurnAccountCard({ prediction: p, onOpenAction }: Props) {
  const cfg = RISK_CFG[p.risk_level];
  const Icon = cfg.icon;
  const isSnoozed = p.acknowledged_until && new Date(p.acknowledged_until) > new Date();

  const factorBadges: Array<{ label: string; cls: string }> = [];
  const f = p.factors || {};
  if (Number(f.open_tickets) >= 3) factorBadges.push({ label: `${f.open_tickets} tickets`, cls: 'border-destructive/40 text-destructive' });
  if (Number(f.unpaid_invoices) >= 1) factorBadges.push({ label: `${f.unpaid_invoices} impayée${Number(f.unpaid_invoices) > 1 ? 's' : ''}`, cls: 'border-amber-600/40 text-amber-700' });
  if (Number(f.emails_30d) === 0) factorBadges.push({ label: '0 email/30j', cls: 'border-violet-500/40 text-violet-700' });
  if (Number(f.days_since_last_interaction) > 30) factorBadges.push({ label: `${f.days_since_last_interaction}j sans contact`, cls: 'border-orange-500/40 text-orange-700' });

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-wrap items-start gap-3">
        {/* Identité */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/etablissements/${p.etablissement_id}`} className="font-semibold hover:underline truncate">
              {p.etablissement?.nom ?? 'Établissement'}
            </Link>
            <Badge className={cfg.cls}>
              <Icon className="h-3 w-3 mr-1" />{cfg.label}
            </Badge>
            {isSnoozed && <Badge variant="outline" className="text-amber-700 border-amber-600/40"><BellOff className="h-3 w-3 mr-1" />Suivi jusqu'au {format(new Date(p.acknowledged_until!), 'd MMM', { locale: fr })}</Badge>}
            {p.etablissement?.type_offre && <Badge variant="outline" className="text-xs">{p.etablissement.type_offre}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Calculé {format(new Date(p.predicted_at), "'le' d MMM 'à' HH:mm", { locale: fr })}
          </p>

          {factorBadges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {factorBadges.map((b) => (
                <Badge key={`churn-factor-badge-${b.label}`} variant="outline" className={`text-xs ${b.cls}`}>{b.label}</Badge>
              ))}
            </div>
          )}
        </div>

        {/* Score + sparkline */}
        <div className="text-right shrink-0">
          <div className="text-3xl font-bold tabular-nums leading-none">
            {Number(p.score).toFixed(0)}
            <span className="text-sm text-muted-foreground font-normal">/100</span>
          </div>
          <div className="w-32 mt-1">
            <ChurnSparkline etablissementId={p.etablissement_id} days={30} height={36} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
        <Button size="sm" onClick={() => onOpenAction(p.etablissement_id)}>
          <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Plan d'action
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to={`/etablissements/${p.etablissement_id}`}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Fiche
          </Link>
        </Button>
      </div>
    </Card>
  );
}
