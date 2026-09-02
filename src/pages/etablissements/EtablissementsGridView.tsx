/**
 * EtablissementsGridView - Vue Grid (cartes virtualisées ou grid) + Résumé + Empty state
 * Extrait de src/pages/Etablissements.tsx (session 98)
 */
import { Loader2, Building2, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VirtualList } from '@/components/ui/virtual-list';
import { EnhancedEtablissementCard } from '@/components/etablissement/EnhancedEtablissementCard';
import { countByPhase } from '@/lib/phaseUtils';
import type { Etablissement } from '@/hooks/crm/useEtablissements';

interface EtablissementsGridViewProps {
  etablissements: Etablissement[];
  allEtablissementsData: Etablissement[] | undefined;
  allProfiles: unknown[] | undefined;
  isSelectionMode: boolean;
  selectedIds: Set<string>;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  searchTerm: string;
  loadMoreRef: React.RefObject<HTMLDivElement>;
  onSelect: (id: string) => void;
  onEdit: (etab: Etablissement) => void;
  onDelete: (etab: Etablissement) => void;
  onCreateClick: () => void;
}

export function EtablissementsGridView({
  etablissements,
  allEtablissementsData,
  allProfiles,
  isSelectionMode,
  selectedIds,
  isLoading,
  isFetchingNextPage,
  searchTerm,
  loadMoreRef,
  onSelect,
  onEdit,
  onDelete,
  onCreateClick,
}: EtablissementsGridViewProps) {
  const renderCard = (etablissement: Etablissement) => (
    <EnhancedEtablissementCard
      key={etablissement.id}
      etablissement={etablissement}
      profiles={allProfiles as never}
      isSelectionMode={isSelectionMode}
      isSelected={selectedIds.has(etablissement.id)}
      onSelect={onSelect}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );

  return (
    <>
      {etablissements.length > 50 ? (
        <VirtualList
          items={etablissements}
          height={600}
          itemHeight={280}
          className="rounded-lg border overflow-x-clip w-full max-w-full min-w-0"
          renderItem={(etablissement) => (
            <div className="p-3 w-full max-w-full min-w-0 overflow-x-clip">
              {renderCard(etablissement)}
            </div>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 w-full max-w-full min-w-0 items-stretch">
          {etablissements.map(renderCard)}
        </div>
      )}

      {etablissements.length > 0 && (
        <div ref={loadMoreRef} className="flex items-center justify-center py-8">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Chargement...</span>
            </div>
          )}
        </div>
      )}

      {!isLoading && etablissements.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">
              {searchTerm ? 'Aucun établissement trouvé' : 'Aucun établissement'}
            </CardTitle>
            <CardDescription className="text-center mb-4">
              {searchTerm
                ? `Aucun établissement ne correspond à votre recherche "${searchTerm}"`
                : "Commencez par créer votre premier établissement client"}
            </CardDescription>
            {!searchTerm && (
              <Button onClick={onCreateClick}>
                <Plus className="w-4 h-4 mr-2" />
                Créer le premier établissement
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {etablissements.length > 0 && (
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-lg sm:text-xl">Résumé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 text-center">
              <div className="p-2 sm:p-3 rounded-lg bg-muted/20">
                <div className="text-xl sm:text-2xl font-bold text-primary">{etablissements?.length || 0}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Résultats filtrés</div>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-muted/20">
                <div className="text-xl sm:text-2xl font-bold text-muted-foreground">{allEtablissementsData?.length || 0}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Total global</div>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-muted/20">
                <div className="text-xl sm:text-2xl font-bold text-warning">
                  {countByPhase(etablissements || [], 'deploiement')}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">En déploiement</div>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-muted/20">
                <div className="text-xl sm:text-2xl font-bold text-success">
                  {countByPhase(etablissements || [], 'production')}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">En production</div>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-muted/20 col-span-2 sm:col-span-1">
                <div className="text-xl sm:text-2xl font-bold text-muted-foreground">
                  {etablissements?.length
                    ? Math.round(etablissements.reduce((acc, e) => acc + (e.progression || 0), 0) / etablissements.length)
                    : 0}
                  %
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Progression moyenne (filtrée)</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </>
  );
}
