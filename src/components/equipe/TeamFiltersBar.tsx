import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, SortAsc, SortDesc, X, Filter } from "lucide-react";
import { TeamFilters } from "@/hooks/hr/useTeamFilters";
import { useIsMobile } from "@/hooks/ui/use-mobile";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";

interface TeamFiltersBarProps {
  filters: TeamFilters;
  onFilterChange: <K extends keyof TeamFilters>(key: K, value: TeamFilters[K]) => void;
  onReset: () => void;
}

export function TeamFiltersBar({ filters, onFilterChange, onReset }: TeamFiltersBarProps) {
  const isMobile = useIsMobile();
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const hasActiveFilters = 
    filters.search !== '' ||
    filters.role !== 'all' ||
    filters.status !== 'all' ||
    filters.workload !== 'all';

  return (
    <div className="space-y-3">
      {/* Recherche toujours visible */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou email..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="pl-10"
          />
        </div>
        
        {isMobile && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowAdvanced(!showAdvanced)} aria-label="Filtrer">
            <Filter className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filtres avancés - collapsible sur mobile */}
      <Collapsible open={!isMobile || showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleContent>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Role Filter */}
            <Select
              value={filters.role}
              onValueChange={(value) => onFilterChange('role', value as TeamFilters['role'])}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="chef_projet">Chef de projet</SelectItem>
                <SelectItem value="csm">CSM</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select
              value={filters.status}
              onValueChange={(value) => onFilterChange('status', value as TeamFilters['status'])}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="actif">Actif</SelectItem>
                <SelectItem value="inactif">Inactif</SelectItem>
              </SelectContent>
            </Select>

            {/* Workload Filter */}
            <Select
              value={filters.workload}
              onValueChange={(value) => onFilterChange('workload', value as TeamFilters['workload'])}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Charge" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes charges</SelectItem>
                <SelectItem value="low">Faible</SelectItem>
                <SelectItem value="medium">Moyenne</SelectItem>
                <SelectItem value="high">Élevée</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-col sm:flex-row justify-between gap-3">
        {/* Sort */}
        <div className="flex gap-2">
          <Select
            value={filters.sortBy}
            onValueChange={(value) => onFilterChange('sortBy', value as TeamFilters['sortBy'])}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nom</SelectItem>
              <SelectItem value="projects">Projets</SelectItem>
              <SelectItem value="tasks">Tâches</SelectItem>
              <SelectItem value="completion">Complétion</SelectItem>
              <SelectItem value="lastActivity">Dernière activité</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => onFilterChange('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
            aria-label={filters.sortOrder === 'asc' ? "Trier par ordre décroissant" : "Trier par ordre croissant"}
            title={filters.sortOrder === 'asc' ? "Ordre croissant" : "Ordre décroissant"}
          >
            {filters.sortOrder === 'asc' ? (
              <SortAsc className="w-4 h-4" />
            ) : (
              <SortDesc className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Reset */}
        {hasActiveFilters && (
          <Button variant="ghost" onClick={onReset} className="w-full sm:w-auto">
            <X className="w-4 h-4 mr-2" />
            Réinitialiser les filtres
          </Button>
        )}
      </div>
    </div>
  );
}
