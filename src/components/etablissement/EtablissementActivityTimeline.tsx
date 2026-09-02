/**
 * EtablissementActivityTimeline
 *
 * Vague 3 (inspirée de Twenty CRM) : timeline unifiée multi-sources
 * (emails, tâches, calendrier, devis, factures, signatures, interactions, workflows)
 * filtrée sur un établissement précis.
 *
 * Réutilise le même hook + composant timeline que la page /activite.
 */
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ActivityFeedTimeline } from '@/components/activity/ActivityFeedTimeline';
import { ActivityFeedFilters as FiltersBar } from '@/components/activity/ActivityFeedFilters';
import { useGlobalActivityFeed } from '@/hooks/activity/useGlobalActivityFeed';
import { PageDataState } from '@/components/common/PageDataState';
import { useState } from 'react';
import type { ActivityFeedFilters } from '@/types/activity';

interface Props {
  etablissementId: string;
}

export function EtablissementActivityTimeline({ etablissementId }: Props) {
  const [extraFilters, setExtraFilters] = useState<ActivityFeedFilters>({});

  const filters = useMemo<ActivityFeedFilters>(
    () => ({ ...extraFilters, etablissement_ids: [etablissementId] }),
    [extraFilters, etablissementId],
  );

  const {
    items,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    pendingNew,
    refresh,
  } = useGlobalActivityFeed({ filters, pageSize: 30, realtime: true });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <FiltersBar
            filters={extraFilters}
            onChange={setExtraFilters}
            hideEtablissementFilter
          />
        </CardContent>
      </Card>

      <PageDataState isLoading={false} isError={isError} error={error} onRetry={refresh}>
        <ActivityFeedTimeline
          items={items}
          isLoading={isLoading}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={() => fetchNextPage()}
          pendingNew={pendingNew}
          onRefresh={refresh}
          emptyLabel="Aucune activité enregistrée pour cet établissement"
        />
      </PageDataState>
    </div>
  );
}
