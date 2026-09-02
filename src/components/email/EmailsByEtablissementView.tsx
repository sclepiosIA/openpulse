import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useEmailsByEtablissement } from "@/hooks/email/useEmailsByEtablissement";
import { EtablissementEmailCard } from "./EtablissementEmailCard";
import { EmailThread } from "./EmailThread";
import { EtablissementTimelineView } from "./EtablissementTimelineView";
import { ArrowLeft, Search, Mail, MessageSquare, Building2, AlertCircle, X, TrendingUp, Filter } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fixMalformedEncoding } from "@/lib/emailUtils";
import { cn } from "@/lib/utils";

type RelationshipStatusFilter = 'all' | 'engagement_actif' | 'prospect' | 'inactif' | 'suspendu' | 'high_engagement';
type SortOption = 'engagement' | 'recent' | 'threads';

const ITEMS_PER_PAGE = 12;

export function EmailsByEtablissementView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEtablissementId, setSelectedEtablissementId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RelationshipStatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const { data: emailsByEtablissement, isLoading, error } = useEmailsByEtablissement();

  // V3a: hooks (useMemo) appelés AVANT les early returns pour respecter rules-of-hooks.
  const filteredEtablissements = useMemo(() => {
    const result = emailsByEtablissement?.filter((etab) => {
      // Filtre par recherche
      if (searchQuery && 
          !etab.etablissement_nom.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !etab.etablissement_ville.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Filtre par statut de relation
      if (statusFilter !== 'all') {
        if (statusFilter === 'high_engagement') {
          return etab.engagement_score > 70;
        }
        return etab.relationship_status === statusFilter;
      }

      return true;
    }) || [];

    // Tri
    result.sort((a, b) => {
      switch (sortBy) {
        case 'engagement':
          return b.engagement_score - a.engagement_score;
        case 'threads':
          return b.total_threads - a.total_threads;
        case 'recent':
        default:
          if (!a.last_message_date) return 1;
          if (!b.last_message_date) return -1;
          return new Date(b.last_message_date).getTime() - new Date(a.last_message_date).getTime();
      }
    });

    return result;
  }, [emailsByEtablissement, searchQuery, statusFilter, sortBy]);

  // Si un thread est sélectionné, afficher la vue détaillée
  if (selectedThreadId) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setSelectedThreadId(null)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux conversations
        </Button>
        <EmailThread threadId={selectedThreadId} onBack={() => setSelectedThreadId(null)} />
      </div>
    );
  }

  // Si un établissement est sélectionné, afficher la timeline unifiée
  if (selectedEtablissementId) {
    const etablissement = emailsByEtablissement?.find(
      (e) => e.etablissement_id === selectedEtablissementId
    );

    if (!etablissement) return null;

    return (
      <EtablissementTimelineView
        etablissementId={selectedEtablissementId}
        etablissementNom={fixMalformedEncoding(etablissement.etablissement_nom)}
        etablissementVille={fixMalformedEncoding(etablissement.etablissement_ville)}
        onBack={() => setSelectedEtablissementId(null)}
      />
    );
  }

  // Calculs des stats
  const totalEtablissements = emailsByEtablissement?.length || 0;
  const totalConversations = filteredEtablissements.reduce((sum, e) => sum + e.total_threads, 0);
  const totalMessages = filteredEtablissements.reduce((sum, e) => sum + e.total_messages, 0);
  const totalUnread = filteredEtablissements.reduce((sum, e) => sum + e.unread_count, 0);
  const highEngagementCount = filteredEtablissements.filter(e => e.engagement_score > 50).length;

  // Établissements visibles (pagination)
  const visibleEtablissements = filteredEtablissements.slice(0, visibleCount);
  const hasMore = visibleCount < filteredEtablissements.length;

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter('all');
    setSortBy('recent');
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* En-tête compact */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Par établissement</h2>
          <p className="text-sm text-muted-foreground">
            {filteredEtablissements.length} sur {totalEtablissements} établissement{totalEtablissements > 1 ? 's' : ''}
          </p>
        </div>

        {/* Stats inline compactes */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span className="font-medium">{totalConversations}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            <span className="font-medium">{totalMessages}</span>
          </div>
          {totalUnread > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {totalUnread}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{totalUnread} email(s) non lu(s)</TooltipContent>
            </Tooltip>
          )}
          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <TrendingUp className="h-4 w-4" />
            <span className="font-medium">{highEngagementCount}</span>
          </div>
        </div>
      </div>

      {/* Filtres compacts */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RelationshipStatusFilter)}>
          <SelectTrigger className="w-[140px] h-9">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="engagement_actif">🟢 Actifs</SelectItem>
            <SelectItem value="prospect">🟡 Prospects</SelectItem>
            <SelectItem value="inactif">🔴 Inactifs</SelectItem>
            <SelectItem value="high_engagement">⚡ Engagés</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Trier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Récent</SelectItem>
            <SelectItem value="engagement">Engagement</SelectItem>
            <SelectItem value="threads">Volume</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1">
            <X className="h-4 w-4" />
            Effacer
          </Button>
        )}
      </div>

      {/* Liste des établissements */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={`emails-by-etablissement-skeleton-${i}`} className="p-6 space-y-4">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
              <Skeleton className="h-10 w-full" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-6">
          <p className="text-center text-destructive">
            Erreur lors du chargement des données
          </p>
        </Card>
      ) : filteredEtablissements.length === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Aucun établissement trouvé</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {hasActiveFilters
                ? "Essayez de modifier vos filtres de recherche"
                : "Aucun email associé à un établissement pour le moment"}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Effacer les filtres
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleEtablissements.map((etablissement, index) => (
              <div 
                key={etablissement.etablissement_id}
                className={cn(
                  "animate-fade-in",
                  index < 10 && `animation-delay-${index * 30}`
                )}
              >
                <EtablissementEmailCard
                  etablissementId={etablissement.etablissement_id}
                  etablissementNom={fixMalformedEncoding(etablissement.etablissement_nom)}
                  etablissementVille={fixMalformedEncoding(etablissement.etablissement_ville)}
                  totalThreads={etablissement.total_threads}
                  totalMessages={etablissement.total_messages}
                  unreadCount={etablissement.unread_count}
                  lastMessageDate={etablissement.last_message_date}
                  avgResponseTimeHours={etablissement.avg_response_time_hours}
                  activeThreads={etablissement.active_threads}
                  archivedThreads={etablissement.archived_threads}
                  relationshipStatus={etablissement.relationship_status}
                  engagementScore={etablissement.engagement_score}
                  lastEmailReceivedAt={etablissement.last_email_received_at}
                  lastEmailSentAt={etablissement.last_email_sent_at}
                  onViewDetails={setSelectedEtablissementId}
                />
              </div>
            ))}
          </div>

          {/* Bouton "Charger plus" */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button 
                variant="outline" 
                onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
              >
                Afficher plus ({filteredEtablissements.length - visibleCount} restants)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}