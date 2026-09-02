import { useMemo } from 'react';
import { debug } from '@/lib/debug';
import { Card, CardContent } from '@/components/ui/card';

import { TrendingUp, TrendingDown, Minus, Star, Mail } from 'lucide-react';
import { WeatherIcon, WeatherLegend, WEATHER_CONFIG } from '@/components/csm/WeatherIcon';
import { EditableCell } from '@/components/csm/EditableCell';
import { EditableSelectCell } from '@/components/csm/EditableSelectCell';
import { EditableListCell } from '@/components/csm/EditableListCell';
import type { ActionItem } from '@/components/csm/EditableListCell';

import { supabase } from '@/lib/supabaseBrowser';
import { useCsmSante } from '@/hooks/csm/useCsmSante';
import { useCsmKpisTrimestriels } from '@/hooks/csm/useCsmKpisTrimestriels';
import { useProduction } from '@/hooks/production/useProduction';
import { useProfilesMap } from '@/hooks/profile/useProfilesMap';
import { useLastEmailByEtablissement } from '@/hooks/email/useLastEmailByEtablissement';

import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { sanitizeEmailSubject } from '@/lib/emailUtils';
import type { WeatherType, TrendType } from '@/types/csm';

const TrendIcon = ({ trend }: {trend: TrendType;}) => {
  if (trend === 'up') return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
};

export function CsmSanteView() {
  const { data: etablissements } = useProduction();
  const { data: santeDonnees, upsert } = useCsmSante();
  const { data: allKpisTrimestriels } = useCsmKpisTrimestriels();
  const { map: profilesMap } = useProfilesMap();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const etablissementIds = useMemo(() => (etablissements || []).map((e) => e.id), [etablissements]);
  const { data: lastEmailMap } = useLastEmailByEtablissement(etablissementIds);

  const santeMap = useMemo(() => {
    const map = new Map<string, typeof santeDonnees[0]>();
    santeDonnees.forEach((s) => map.set(s.etablissement_id, s));
    return map;
  }, [santeDonnees]);

  // Map etablissement_id -> dernier taux_satisfaction (sort_order desc)
  const satisfactionMap = useMemo(() => {
    const map = new Map<string, number | null>();
    const grouped = new Map<string, typeof allKpisTrimestriels>();
    allKpisTrimestriels.forEach((k) => {
      const arr = grouped.get(k.etablissement_id) || [];
      arr.push(k);
      grouped.set(k.etablissement_id, arr);
    });
    grouped.forEach((kpis, etabId) => {
      const sorted = [...kpis].sort((a, b) => b.sort_order - a.sort_order);
      map.set(etabId, sorted[0]?.taux_satisfaction ?? null);
    });
    return map;
  }, [allKpisTrimestriels]);

  // Map etablissement_id -> besoins_du_compte
  const besoinsMap = useMemo(() => {
    const map = new Map<string, string | null>();
    etablissements?.forEach((e) => {
      map.set(e.id, (e as any).besoins_du_compte ?? null);
    });
    return map;
  }, [etablissements]);

  // Map etablissement_id -> prochaine_action_orga
  const actionsOrgaMap = useMemo(() => {
    const map = new Map<string, ActionItem[] | null>();
    etablissements?.forEach((e) => {
      map.set(e.id, (e as any).prochaine_action_orga ?? null);
    });
    return map;
  }, [etablissements]);

  const stats = useMemo(() => {
    const total = etablissements?.length || 0;
    const deployes = santeDonnees.filter((s) => s.weather !== 'not-started').length;
    const ok = santeDonnees.filter((s) => s.weather === 'sunny' || s.weather === 'partly-cloudy').length;
    const attention = santeDonnees.filter((s) => s.weather === 'rainy' || s.weather === 'stormy').length;
    return { total, deployes, ok, attention };
  }, [etablissements, santeDonnees]);

  const handleUpdate = (etablissementId: string, field: string, value: any) => {
    const existing = santeMap.get(etablissementId) || {};
    upsert({ ...existing, etablissement_id: etablissementId, [field]: value });
  };

  const handleUpdateEtablissement = async (etablissementId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('etablissements')
        .update({ [field]: value } as never)
        .eq('id', etablissementId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['production'] });
    } catch (err) {
      debug.error('Update error:', err);
    }
  };

  const WEATHER_OPTIONS = Object.entries(WEATHER_CONFIG).map(([value, config]) => ({
    value, label: config.label
  }));

  const TREND_OPTIONS = [
  { value: 'up', label: '↗ En hausse' },
  { value: 'down', label: '↘ En baisse' },
  { value: 'stable', label: '→ Stable' }];

  return (
    <div className="space-y-4">
      <WeatherLegend />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(etablissements || []).map((etab) => {
          const sante = santeMap.get(etab.id);
          const csmName = etab.csm_id ? profilesMap.get(etab.csm_id)?.full_name : null;
          const weather = (sante?.weather || 'not-started') as WeatherType;
          const tauxSatisfaction = satisfactionMap.get(etab.id) ?? null;
          const lastEmail = lastEmailMap?.get(etab.id);

          return (
            <Card key={etab.id} className="overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
              {/* Header avec fond coloré */}
              <div className="bg-gradient-to-r from-[hsl(var(--primary)/0.06)] to-[hsl(var(--marque-pastel-cyan)/0.2)] px-4 py-3 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3
                      className="font-bold text-sm text-primary truncate cursor-pointer hover:underline transition-colors"
                      onClick={() => navigate(`/etablissements/${etab.id}`)}
                    >
                      {etab.nom}
                    </h3>
                    {csmName && <p className="text-[11px] text-muted-foreground mt-0.5">{csmName}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <WeatherIcon weather={weather} size="md" />
                    <EditableSelectCell
                      value={weather}
                      options={WEATHER_OPTIONS}
                      onSave={(v) => handleUpdate(etab.id, 'weather', v)}
                      className="w-[110px] text-xs"
                    />
                  </div>
                </div>
              </div>

              <CardContent className="p-0">
                {/* Métriques KPI - grille compacte */}
                <div className="grid grid-cols-3 divide-x divide-border/40 border-b border-border/30">
                  {/* Utilisation */}
                  <div className="px-3 py-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Utilisation</p>
                    <div className="flex items-center justify-center gap-1">
                      <EditableCell
                        value={sante?.taux_utilisation?.toString() ?? ''}
                        placeholder="—"
                        className="text-center text-sm font-bold w-[40px] inline-block"
                        onSave={(v) => handleUpdate(etab.id, 'taux_utilisation', v ? Number(v) : null)}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                      <EditableSelectCell
                        value={sante?.taux_utilisation_trend || 'stable'}
                        options={TREND_OPTIONS}
                        onSave={(v) => handleUpdate(etab.id, 'taux_utilisation_trend', v)}
                        className="w-[80px] text-[10px]"
                      />
                    </div>
                  </div>

                  {/* UHCD */}
                  <div className="px-3 py-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">UHCD</p>
                    <div className="flex items-center justify-center gap-1">
                      <EditableCell
                        value={sante?.taux_uhcd?.toString() ?? ''}
                        placeholder="—"
                        className="text-center text-sm font-bold w-[40px] inline-block"
                        onSave={(v) => handleUpdate(etab.id, 'taux_uhcd', v ? Number(v) : null)}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                      <EditableSelectCell
                        value={sante?.taux_uhcd_trend || 'stable'}
                        options={TREND_OPTIONS}
                        onSave={(v) => handleUpdate(etab.id, 'taux_uhcd_trend', v)}
                        className="w-[80px] text-[10px]"
                      />
                    </div>
                  </div>

                  {/* Satisfaction */}
                  <div className="px-3 py-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                      <Star className="w-2.5 h-2.5" />
                      Satisfaction
                    </p>
                    <p className="text-sm font-bold">
                      {tauxSatisfaction != null ? `${tauxSatisfaction}%` : '—'}
                    </p>
                  </div>
                </div>

                {/* Dernier échange email */}
                <div className="px-4 py-2 border-b border-border/30">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    Dernier échange
                  </p>
                  {lastEmail ? (
                    <div
                      className="text-xs rounded bg-[hsl(var(--marque-pastel-cyan)/0.2)] px-2 py-1.5 cursor-pointer hover:bg-[hsl(var(--marque-pastel-cyan)/0.35)] transition-colors"
                      onClick={() => navigate(`/emails?thread=${lastEmail.id}`)}
                    >
                      <p className="font-medium truncate">
                        {sanitizeEmailSubject(lastEmail.ai_generated_title || lastEmail.subject)}
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(lastEmail.last_message_date), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/50 italic bg-muted/30 rounded px-2 py-1.5">
                      Aucun email associé
                    </p>
                  )}
                </div>

                {/* Actions organisationnelles */}
                <div className="px-4 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                    Actions organisationnelles
                  </p>
                  <EditableListCell
                    items={actionsOrgaMap.get(etab.id) ?? null}
                    placeholder="+ Ajouter une action"
                    onSave={(v) => handleUpdateEtablissement(etab.id, 'prochaine_action_orga', v)}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}