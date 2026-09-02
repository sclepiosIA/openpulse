import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Heart, Info, Activity, Users, Target, Layers } from 'lucide-react';

import { EditableCell } from '@/components/csm/EditableCell';
import { EditableSelectCell } from '@/components/csm/EditableSelectCell';
import { WeatherSelectCell } from '@/components/csm/WeatherSelectCell';
import type { WeatherType } from '@/types/csm';
import { useCsmSante } from '@/hooks/csm/useCsmSante';
import { useCsmKpisTrimestriels } from '@/hooks/csm/useCsmKpisTrimestriels';
import { useCsmKpisMensuels } from '@/hooks/csm/useCsmKpisMensuels';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';

const TREND_OPTIONS = [
{ value: 'up', label: '↗ Hausse' },
{ value: 'down', label: '↘ Baisse' },
{ value: 'stable', label: '→ Stable' }];

const PALIER_COLORS: Record<number, {bg: string;text: string;dot: string;}> = {
  1: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  2: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
  3: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', dot: 'bg-amber-500' },
  4: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' }
};

function ReadOnlyHint({ source }: {source: string;}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="w-3 h-3 text-muted-foreground/40 cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">Éditable dans {source}</p>
      </TooltipContent>
    </Tooltip>);

}

interface CsmEtabSanteCardProps {
  etablissementId: string;
}

export function CsmEtabSanteCard({ etablissementId }: CsmEtabSanteCardProps) {
  const { single: sante, upsert } = useCsmSante(etablissementId);
  const { data: kpisTrimestriels } = useCsmKpisTrimestriels(etablissementId);
  const { data: kpisMensuels } = useCsmKpisMensuels(etablissementId);

  // Valeurs auto-calculées depuis la dernière période mensuelle complétée
  // La période la plus récente = sort_order le plus bas (les nouvelles périodes sont ajoutées en haut)
  const latestMensuelUtil = (() => {
    const completed = kpisMensuels.filter((k) => k.passages_total && k.passages_total > 0 && k.dossiers_traites != null);
    if (completed.length === 0) return null;
    const latest = completed.reduce((a, b) => (a.sort_order ?? 0) < (b.sort_order ?? 0) ? a : b);
    return Math.round((latest.dossiers_traites || 0) / latest.passages_total! * 100);
  })();

  const latestMensuelUhcdBackend = (() => {
    const completed = kpisMensuels.filter((k) => k.taux_uhcd_backend != null);
    if (completed.length === 0) return null;
    const latest = completed.reduce((a, b) => (a.sort_order ?? 0) < (b.sort_order ?? 0) ? a : b);
    return latest.taux_uhcd_backend;
  })();

  const latestMensuelUhcdDim = (() => {
    const completed = kpisMensuels.filter((k) => k.taux_uhcd_compte != null);
    if (completed.length === 0) return null;
    const latest = completed.reduce((a, b) => (a.sort_order ?? 0) < (b.sort_order ?? 0) ? a : b);
    return latest.taux_uhcd_compte;
  })();

  const { data: etablissementData } = useQuery({
    queryKey: ['etablissement-besoins-seuils', etablissementId],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('etablissements').
      select('besoins_du_compte, seuils_palliers').
      eq('id', etablissementId).
      maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000
  });

  // Calcul automatique du palier UHCD
  const computedPalier = (() => {
    const taux = sante?.taux_uhcd;
    const seuils = etablissementData?.seuils_palliers as Record<string, number> | null;
    if (taux == null || !seuils) return null;

    const entries = Object.entries(seuils).
    map(([key, val]) => {
      const num = key.match(/\d+/)?.[0];
      const threshold = typeof val === 'object' ? Object.values(val as Record<string, number>)[0] : Number(val);
      return { num: num ? parseInt(num) : 0, threshold: threshold || 0 };
    }).
    filter((e) => e.num > 0 && !isNaN(e.threshold)).
    sort((a, b) => b.threshold - a.threshold);

    for (const { num, threshold } of entries) {
      if (taux >= threshold) return { num, threshold };
    }
    return { num: 0, threshold: 0 };
  })();

  const latestKpi =
  kpisTrimestriels.length > 0 ?
  [...kpisTrimestriels].sort((a, b) => b.sort_order - a.sort_order)[0] :
  null;
  const tauxSatisfaction = latestKpi?.taux_satisfaction;

  const handleUpdate = (field: string, value: any) => {
    upsert({ ...(sante || {}), etablissement_id: etablissementId, [field]: value });
  };

  const palierStyle = computedPalier ? PALIER_COLORS[computedPalier.num] || PALIER_COLORS[4] : null;

  return (
    <Card className="overflow-hidden border-0 shadow-[0_1px_8px_-2px_hsl(var(--primary)/0.08)]">
      <CardHeader className="pb-1.5 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Heart className="w-4 h-4 text-primary" />
            Santé du compte
          </CardTitle>
          <WeatherSelectCell
            value={sante?.weather as WeatherType || 'not-started'}
            onSave={(v) => handleUpdate('weather', v)} />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-1 space-y-2">
        {/* KPIs principaux - grille compacte */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Taux utilisation */}
          <div className={cn(
            "rounded-lg border px-3 py-2.5 space-y-1.5 transition-colors",
            sante?.taux_utilisation_trend === 'up' && "border-emerald-200 bg-emerald-50/60",
            sante?.taux_utilisation_trend === 'down' && "border-red-200 bg-red-50/60",
            (!sante?.taux_utilisation_trend || sante.taux_utilisation_trend === 'stable') && "border-border/50 bg-gradient-to-b from-background to-muted/15"
          )}>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Activity className="w-3 h-3 text-primary/60" />
              Utilisation
              <ReadOnlyHint source="KPIs mensuels" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold tracking-tight text-foreground">
                {latestMensuelUtil != null ? latestMensuelUtil : '—'}
              </span>
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <Progress value={latestMensuelUtil ?? 0} className="h-1" />
            <EditableSelectCell
              value={sante?.taux_utilisation_trend || 'stable'}
              options={TREND_OPTIONS}
              className="w-full text-[10px]"
              onSave={(v) => handleUpdate('taux_utilisation_trend', v)} />
          </div>

          {/* Taux UHCD */}
          <div className={cn(
            "rounded-lg border px-3 py-2.5 space-y-1.5 transition-colors",
            sante?.taux_uhcd_trend === 'up' && "border-emerald-200 bg-emerald-50/60",
            sante?.taux_uhcd_trend === 'down' && "border-red-200 bg-red-50/60",
            (!sante?.taux_uhcd_trend || sante.taux_uhcd_trend === 'stable') && "border-border/50 bg-gradient-to-b from-background to-muted/15"
          )}>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Layers className="w-3 h-3 text-primary/60" />
              UHCD
              <ReadOnlyHint source="KPIs mensuels" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground/70 mb-0.5">Backend</p>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-lg font-bold tracking-tight text-foreground">
                    {latestMensuelUhcdBackend != null ? latestMensuelUhcdBackend : '—'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">%</span>
                </div>
              </div>
              <div className="border-l border-border/40 pl-2">
                <p className="text-[10px] text-muted-foreground/70 mb-0.5">DIM</p>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-lg font-bold tracking-tight text-foreground">
                    {latestMensuelUhcdDim != null ? latestMensuelUhcdDim : '—'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">%</span>
                </div>
              </div>
            </div>
            <EditableSelectCell
              value={sante?.taux_uhcd_trend || 'stable'}
              options={TREND_OPTIONS}
              className="w-full text-[10px]"
              onSave={(v) => handleUpdate('taux_uhcd_trend', v)} />
          </div>

          {/* Satisfaction */}
          <div className="rounded-lg border border-border/50 bg-gradient-to-b from-background to-muted/15 px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Users className="w-3 h-3 text-primary/60" />
              Satisfaction
              <ReadOnlyHint source="KPIs" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold tracking-tight text-foreground">
                {tauxSatisfaction != null ? tauxSatisfaction : '—'}
              </span>
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <Progress value={tauxSatisfaction ?? 0} className="h-1" />
          </div>
        </div>

        {/* Ligne secondaire : objectif + palier - inline compact */}
        <div className="flex flex-wrap gap-2">
          {/* Objectif EME */}
          <div className="rounded-lg border border-border/50 bg-background px-3 py-2 flex items-center gap-2 min-w-[140px]">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1 shrink-0">
              <Target className="w-3 h-3 text-primary/60" />
              Obj. EME
            </p>
            <EditableCell
              value={sante?.objectif_eme}
              placeholder="—"
              className="text-sm font-semibold"
              onSave={(v) => handleUpdate('objectif_eme', v)} />
          </div>

          {/* Palier UHCD (auto-calculé) */}
          <div
            className={cn(
              'rounded-lg border px-3 py-2 flex items-center gap-2 transition-colors',
              palierStyle ? palierStyle.bg : 'bg-background border-border/50'
            )}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1 shrink-0">
              <Layers className="w-3 h-3 text-primary/60" />
              Palier UHCD
              <ReadOnlyHint source="Infos contractuelles" />
            </p>
            {computedPalier && computedPalier.num > 0 ?
            <div className="flex items-center gap-1.5">
                <div className={cn('w-2 h-2 rounded-full', palierStyle?.dot)} />
                <span className={cn('text-sm font-bold', palierStyle?.text)}>
                  Palier {computedPalier.num}
                </span>
                <span className="text-[10px] text-muted-foreground">(≥{computedPalier.threshold}%)</span>
              </div> :
            computedPalier && computedPalier.num === 0 ?
            <span className="text-xs font-medium text-muted-foreground">Sous palier 1</span> :
            <span className="text-xs text-muted-foreground">—</span>
            }
          </div>
        </div>
      </CardContent>
    </Card>);

}