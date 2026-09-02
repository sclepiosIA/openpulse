import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search, Filter, ChevronDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { EmailFilters as EmailFiltersType } from "@/hooks/email/useEmailFilters";
import { useEtablissementsListSimple } from '@/hooks/crm/useEtablissementsListSimple';

interface FilterChip {
  key: keyof EmailFiltersType;
  label: string;
  value: string;
  color?: string;
}

interface EmailFilterChipsProps {
  filters: EmailFiltersType;
  onFilterChange: <K extends keyof EmailFiltersType>(key: K, value: EmailFiltersType[K]) => void;
  onReset: () => void;
  stats?: {
    unread: number;
    total: number;
  };
}

const CATEGORIES = [
  { value: "Commercial", label: "Commercial", color: "bg-blue-500/10 text-blue-700 border-blue-200" },
  { value: "Support", label: "Support", color: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  { value: "Technique", label: "Technique", color: "bg-violet-500/10 text-violet-700 border-violet-200" },
  { value: "Administratif", label: "Administratif", color: "bg-amber-500/10 text-amber-700 border-amber-200" },
  { value: "Contractuel", label: "Contractuel", color: "bg-rose-500/10 text-rose-700 border-rose-200" },
  { value: "Formation", label: "Formation", color: "bg-cyan-500/10 text-cyan-700 border-cyan-200" },
];

const PRIORITIES = [
  { value: "high", label: "Haute", color: "bg-red-500/10 text-red-700 border-red-200" },
  { value: "medium", label: "Moyenne", color: "bg-amber-500/10 text-amber-700 border-amber-200" },
  { value: "low", label: "Basse", color: "bg-gray-500/10 text-foreground border-gray-200" },
];

export function EmailFilterChips({ 
  filters, 
  onFilterChange, 
  onReset,
  stats 
}: EmailFilterChipsProps) {
  const { data: etablissements = [] } = useEtablissementsListSimple();
  const [etabOpen, setEtabOpen] = useState(false);

  const activeFilters: FilterChip[] = [];
  
  if (filters.category) {
    const cat = CATEGORIES.find(c => c.value === filters.category);
    activeFilters.push({ 
      key: "category", 
      label: "Catégorie", 
      value: cat?.label || filters.category,
      color: cat?.color 
    });
  }
  
  if (filters.priority) {
    const prio = PRIORITIES.find(p => p.value === filters.priority);
    activeFilters.push({ 
      key: "priority", 
      label: "Priorité", 
      value: prio?.label || filters.priority,
      color: prio?.color 
    });
  }
  
  if (filters.etablissementId) {
    let label = "Non classés";
    if (filters.etablissementId === "internal") label = "Interne";
    else if (filters.etablissementId !== "unclassified") {
      const etab = etablissements.find(e => e.id === filters.etablissementId);
      label = etab?.nom || "Établissement";
    }
    activeFilters.push({ 
      key: "etablissementId", 
      label: "Établissement", 
      value: label 
    });
  }

  const removeFilter = (key: keyof EmailFiltersType) => {
    if (key === "unreadOnly") {
      onFilterChange(key, false);
    } else {
      onFilterChange(key, null);
    }
  };

  const hasFilters = filters.search || filters.category || filters.priority || filters.unreadOnly || filters.etablissementId;

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher dans les emails..."
          value={filters.search}
          onChange={(e) => onFilterChange("search", e.target.value)}
          className="pl-10 pr-10 h-11 bg-background border-border/50 focus-visible:ring-primary/30"
        />
        {filters.search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={() => onFilterChange("search", "")} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filter Chips Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Segmented Control: All / Unread */}
        <div className="flex rounded-lg border bg-muted/50 p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-3 rounded-md text-sm font-medium transition-all",
              !filters.unreadOnly && "bg-background shadow-sm"
            )}
            onClick={() => onFilterChange("unreadOnly", false)}
          >
            Tous
            {stats && <span className="ml-1.5 text-muted-foreground">({stats.total})</span>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-3 rounded-md text-sm font-medium transition-all",
              filters.unreadOnly && "bg-background shadow-sm"
            )}
            onClick={() => onFilterChange("unreadOnly", true)}
          >
            Non lus
            {stats && stats.unread > 0 && (
              <Badge variant="default" className="ml-1.5 h-5 px-1.5 text-xs">
                {stats.unread}
              </Badge>
            )}
          </Button>
        </div>

        {/* Category Dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5",
                filters.category && "border-primary/50 bg-primary/5"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Catégorie
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full justify-start h-9",
                  filters.category === cat.value && "bg-accent"
                )}
                onClick={() => onFilterChange("category", filters.category === cat.value ? null : cat.value)}
              >
                <span className={cn("w-2 h-2 rounded-full mr-2", cat.color?.split(" ")[0]?.replace("/10", ""))} />
                {cat.label}
              </Button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Priority Dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5",
                filters.priority && "border-primary/50 bg-primary/5"
              )}
            >
              Priorité
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start">
            {PRIORITIES.map((prio) => (
              <Button
                key={prio.value}
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full justify-start h-9",
                  filters.priority === prio.value && "bg-accent"
                )}
                onClick={() => onFilterChange("priority", filters.priority === prio.value ? null : prio.value)}
              >
                {prio.label}
              </Button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Etablissement Combobox */}
        <Popover open={etabOpen} onOpenChange={setEtabOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5",
                filters.etablissementId && "border-primary/50 bg-primary/5"
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              Établissement
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Rechercher..." />
              <CommandList>
                <CommandEmpty>Aucun résultat</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onFilterChange("etablissementId", filters.etablissementId === "internal" ? null : "internal");
                      setEtabOpen(false);
                    }}
                  >
                    Interne OpenPulse
                  </CommandItem>
                  <CommandItem
                    onSelect={() => {
                      onFilterChange("etablissementId", filters.etablissementId === "unclassified" ? null : "unclassified");
                      setEtabOpen(false);
                    }}
                  >
                    Non classés
                  </CommandItem>
                  {etablissements.map((etab) => (
                    <CommandItem
                      key={etab.id}
                      onSelect={() => {
                        onFilterChange("etablissementId", filters.etablissementId === etab.id ? null : etab.id);
                        setEtabOpen(false);
                      }}
                    >
                      {etab.nom}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Reset Button */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground hover:text-foreground"
            onClick={onReset}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Effacer
          </Button>
        )}
      </div>

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((filter) => (
            <Badge
              key={filter.key}
              variant="secondary"
              className={cn(
                "h-7 px-2.5 gap-1.5 cursor-pointer hover:bg-destructive/10",
                filter.color
              )}
              onClick={() => removeFilter(filter.key)}
            >
              <span className="text-xs text-muted-foreground">{filter.label}:</span>
              <span className="font-medium">{filter.value}</span>
              <X className="h-3 w-3 ml-0.5" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
