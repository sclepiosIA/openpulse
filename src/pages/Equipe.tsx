import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, LayoutGrid, Table as TableIcon, Calendar, Keyboard } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useProfilesWithRoles, type ProfileWithRole } from "@/hooks/profile/useProfilesWithRoles";
import { useEtablissements } from "@/hooks/crm/useEtablissements";
import { useTeamStats } from "@/hooks/hr/useTeamStats";
import { useTeamFilters } from "@/hooks/hr/useTeamFilters";
import { useRolePermissions } from "@/hooks/auth/useRolePermissions";
import { useAuth } from "@/hooks/shared/useAuth";
import { PermissionBanner } from "@/components/security/PermissionBanner";
import { filterAndSortProfiles } from "@/lib/teamUtils";
import { TeamStatsOverview } from "@/components/equipe/TeamStatsOverview";
import { TeamFiltersBar } from "@/components/equipe/TeamFiltersBar";
import { TeamMemberCard } from "@/components/equipe/TeamMemberCard";
import { TeamTableView } from "@/components/equipe/TeamTableView";
import { TeamMemberDetailDialog } from "@/components/equipe/TeamMemberDetailDialog";
import { SetupTeamButton } from "@/components/admin/SetupTeamButton";
import { Skeleton } from "@/components/ui/skeleton";
import { UnifiedCalendar } from "@/components/shared/UnifiedCalendar";
import { UniversalSearchBar } from "@/components/shared/UniversalSearchBar";
import { KeyboardShortcutsHelp } from "@/components/shared/KeyboardShortcutsHelp";
import { CardSkeleton } from "@/components/shared/LoadingStates";
import { UnifiedPageHeader } from "@/components/layout/UnifiedPageHeader";

export default function Equipe() {
  const { user } = useAuth();
  const permissions = useRolePermissions();
  const { data: profiles, isLoading: profilesLoading } = useProfilesWithRoles();
  const { data: etablissements } = useEtablissements();
  const { data: teamStats, isLoading: statsLoading } = useTeamStats();
  const { filters, updateFilter, resetFilters } = useTeamFilters();
  
  // Filtrer les profils selon le scope de l'utilisateur
  const visibleProfiles = useMemo(() => {
    if (!profiles) return [];
    
    if (permissions.viewScope === 'all') {
      return profiles;
    }
    
    if (permissions.viewScope === 'managed') {
      // Filtrer uniquement les profils des établissements gérés par l'utilisateur
      const userProfileId = profiles.find(p => p.user_id === user?.id)?.id;
      return profiles.filter(profile => {
        const managedEtabs = etablissements?.filter(e => 
          e.csm_id === userProfileId || e.commercial_id === userProfileId
        );
        return managedEtabs?.some(e => 
          e.commercial_id === profile.id || 
          e.chef_projet_id === profile.id || 
          e.csm_id === profile.id
        );
      });
    }
    
    // 'own' scope - uniquement son propre profil
    return profiles.filter(p => p.user_id === user?.id);
  }, [profiles, permissions.viewScope, user?.id, etablissements]);
  
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'calendar'>('cards');
  const [selectedProfile, setSelectedProfile] = useState<ProfileWithRole | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Type-safe handler that accepts the component's Profile type and casts to our full type
  const handleViewDetails = (profile: Parameters<typeof TeamMemberCard>[0]['profile'] extends infer P ? P : never) => {
    // The profile from TeamMemberCard has at least the required properties
    setSelectedProfile(profile as ProfileWithRole);
    setDetailsOpen(true);
  };

  const getAssignedProjects = (profileId: string) => {
    return etablissements?.filter(e => 
      e.commercial_id === profileId || 
      e.chef_projet_id === profileId || 
      e.csm_id === profileId
    ) || [];
  };

  // Filter and sort profiles (sur les profils visibles uniquement)
  const filteredProfiles = visibleProfiles && teamStats
    ? filterAndSortProfiles(visibleProfiles, teamStats, filters)
    : [];

  const isLoading = profilesLoading || statsLoading;

  return (
    <div className="animate-fade-in">
      <UnifiedPageHeader
        title="Équipe"
        subtitle={permissions.viewScope === 'all' 
          ? 'Gestion et suivi des membres de l\'équipe OpenPulse'
          : 'Membres de vos projets'}
        icon={Users}
        actions={
          <div className="flex items-center gap-1">
            {permissions.viewScope === 'managed' && (
              <Badge variant="outline" className="text-xs h-6">Vue restreinte</Badge>
            )}
            <UniversalSearchBar />
            {permissions.isAdmin && <SetupTeamButton />}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setShowShortcuts(true)}>
                    <Keyboard className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Raccourcis clavier (Ctrl+?)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        }
      />

      <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">

      {/* Banner de permissions */}
      {permissions.viewScope === 'managed' && (
        <PermissionBanner type="restricted" />
      )}

      {/* Overview Stats */}
      <TeamStatsOverview />

      {/* Main Content */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList>
            <TabsTrigger value="cards" className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Cartes</span>
            </TabsTrigger>
            <TabsTrigger value="table" className="flex items-center gap-2">
              <TableIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Tableau</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Calendrier</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Filters (only show for cards and table views) */}
        {(viewMode === 'cards' || viewMode === 'table') && (
          <TeamFiltersBar
            filters={filters}
            onFilterChange={updateFilter}
            onReset={resetFilters}
          />
        )}

        {/* Cards View */}
        <TabsContent value="cards" className="space-y-6">
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {[...Array(6)].map((_, i) => (
                <CardSkeleton key={`equipe-card-skeleton-${i}`} />
              ))}
            </div>
          ) : filteredProfiles.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {filteredProfiles.map((profile) => {
                const stats = teamStats?.[profile.id];
                if (!stats) return null;

                return (
                  <TeamMemberCard
                    key={profile.id}
                    profile={profile}
                    stats={stats}
                    assignedProjects={getAssignedProjects(profile.id)}
                    onViewDetails={() => handleViewDetails(profile)}
                  />
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun membre d'équipe trouvé</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Essayez de modifier vos filtres
                </p>
                <Button variant="outline" onClick={resetFilters} className="mt-4">
                  Réinitialiser les filtres
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Table View */}
        <TabsContent value="table">
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={`equipe-table-skeleton-${i}`} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : filteredProfiles.length > 0 && teamStats ? (
            <TeamTableView
              profiles={filteredProfiles}
              stats={teamStats}
              onViewDetails={handleViewDetails}
            />
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun membre d'équipe trouvé</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Calendar View */}
        <TabsContent value="calendar">
          <UnifiedCalendar 
            showTasks={true}
            showAbsences={permissions.canViewAllAbsences}
          />
        </TabsContent>
      </Tabs>

      {/* Member Details Dialog */}
      {selectedProfile && teamStats && (
        <TeamMemberDetailDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          profile={selectedProfile}
          stats={teamStats[selectedProfile.id]}
        />
      )}
      
      <KeyboardShortcutsHelp 
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
        context="equipe"
      />
      </div>
    </div>
  );
}
