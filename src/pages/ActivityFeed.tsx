import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Activity, Users, User as UserIcon, Pin } from 'lucide-react';
import { useGlobalActivityFeed } from '@/hooks/activity/useGlobalActivityFeed';
import { useActivityFeedStats } from '@/hooks/activity/useActivityFeedStats';
import { useActivityPins } from '@/hooks/activity/useActivityPins';
import { useAuth } from '@/hooks/shared/useAuth';
import { ActivityFeedTimeline } from '@/components/activity/ActivityFeedTimeline';
import { ActivityFeedFilters as FiltersBar } from '@/components/activity/ActivityFeedFilters';
import { ActivityStatsHeader } from '@/components/activity/ActivityStatsHeader';
import { usePageTitle } from '@/hooks/shared/usePageTitle';
import { ImmersivePageBackground } from '@/components/layout/ImmersivePageBackground';
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader';
import { PageDataState } from '@/components/common/PageDataState';
import type { ActivityFeedFilters } from '@/types/activity';

import type { ActivityType } from '@/types/activity';

const VALID_TYPES: ActivityType[] = [
  'interaction', 'tache', 'calendar', 'email', 'devis', 'facture', 'signature', 'workflow',
];

function parseFiltersFromParams(params: URLSearchParams): ActivityFeedFilters {
  const f: ActivityFeedFilters = {};
  const q = params.get('q');
  if (q) f.search = q;
  const types = params.get('types');
  if (types) {
    const arr = types.split(',').filter((t): t is ActivityType => VALID_TYPES.includes(t as ActivityType));
    if (arr.length) f.types = arr;
  }
  const users = params.get('users');
  if (users) {
    const arr = users.split(',').filter(Boolean);
    if (arr.length) f.user_ids = arr;
  }
  const etabs = params.get('etabs');
  if (etabs) {
    const arr = etabs.split(',').filter(Boolean);
    if (arr.length) f.etablissement_ids = arr;
  }
  const df = params.get('from');
  if (df) f.date_from = df;
  const dt = params.get('to');
  if (dt) f.date_to = dt;
  return f;
}

function serializeFiltersToParams(filters: ActivityFeedFilters, base: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(base);
  const setOrDel = (key: string, val: string | undefined) => {
    if (val) next.set(key, val); else next.delete(key);
  };
  setOrDel('q', filters.search);
  setOrDel('types', filters.types?.length ? filters.types.join(',') : undefined);
  setOrDel('users', filters.user_ids?.length ? filters.user_ids.join(',') : undefined);
  setOrDel('etabs', filters.etablissement_ids?.length ? filters.etablissement_ids.join(',') : undefined);
  setOrDel('from', filters.date_from);
  setOrDel('to', filters.date_to);
  return next;
}

export default function ActivityFeed() {
  usePageTitle("Fil d'activité");
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'team' | 'mine' | 'pinned'>('team');
  const [filters, setFilters] = useState<ActivityFeedFilters>(() => parseFiltersFromParams(params));

  // Sync all filters with URL (replace, no history pollution)
  useEffect(() => {
    const next = serializeFiltersToParams(filters, params);
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const focusId = params.get('focus');

  const effectiveFilters: ActivityFeedFilters = useMemo(() => {
    if (tab === 'mine' && user?.id) {
      return { ...filters, user_ids: [user.id] };
    }
    return filters;
  }, [tab, filters, user?.id]);

  const { items, isLoading, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage, pendingNew, refresh } =
    useGlobalActivityFeed({ filters: effectiveFilters, pageSize: 30, realtime: true });

  const { data: stats, isLoading: statsLoading } = useActivityFeedStats(filters);
  const { pins, pinnedKeys } = useActivityPins();

  const pinnedItems = useMemo(
    () => items.filter((it) => pinnedKeys.has(it.id)),
    [items, pinnedKeys]
  );

  return (
    <ImmersivePageBackground>
      <ImmersivePageHeader
        icon={Activity}
        title="Fil d'activité"
        subtitle="Toutes les actions récentes de l'équipe — temps réel"
        stats={stats ? [
          { label: "aujourd'hui", value: stats.today ?? 0, highlight: true },
          { label: '7j', value: stats.week ?? 0 },
          { label: '30j', value: stats.month ?? 0 },
        ] : undefined}
      />

      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <PageDataState isLoading={false} isError={isError} error={error} onRetry={refresh}>
      <ActivityStatsHeader stats={stats} isLoading={statsLoading} />

      <Card>
        <CardContent className="pt-4 space-y-4">
          <FiltersBar filters={filters} onChange={setFilters} />
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="team" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Toute l'équipe
          </TabsTrigger>
          <TabsTrigger value="mine" className="gap-1.5">
            <UserIcon className="h-3.5 w-3.5" /> Mon activité
          </TabsTrigger>
          <TabsTrigger value="pinned" className="gap-1.5">
            <Pin className="h-3.5 w-3.5" /> Épinglées
            {pins.length > 0 && (
              <span className="ml-1 text-[10px] bg-primary/10 text-primary rounded-full px-1.5">
                {pins.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="mt-4">
          <ActivityFeedTimeline
            items={items}
            isLoading={isLoading}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
            pendingNew={pendingNew}
            onRefresh={refresh}
            focusId={focusId}
          />
        </TabsContent>

        <TabsContent value="mine" className="mt-4">
          <ActivityFeedTimeline
            items={items}
            isLoading={isLoading}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
            pendingNew={pendingNew}
            onRefresh={refresh}
            focusId={focusId}
            emptyLabel="Vous n'avez aucune activité enregistrée sur la période sélectionnée"
          />
        </TabsContent>

        <TabsContent value="pinned" className="mt-4">
          <ActivityFeedTimeline
            items={pinnedItems}
            isLoading={isLoading}
            emptyLabel={
              pins.length === 0
                ? "Aucune activité épinglée. Cliquez sur l'icône épingle d'une activité pour la garder en vue."
                : "Vos activités épinglées ne sont pas dans la page courante. Chargez plus d'éléments ou ajustez les filtres."
            }
          />
        </TabsContent>
      </Tabs>
      </PageDataState>
      </div>
    </ImmersivePageBackground>
  );
}
