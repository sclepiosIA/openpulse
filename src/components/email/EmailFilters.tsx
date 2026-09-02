import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { useEtablissementsListSimple } from "@/hooks/crm/useEtablissementsListSimple";
import { EmailFilters as EmailFiltersType } from "@/hooks/email/useEmailFilters";

interface EmailFiltersProps {
  filters: EmailFiltersType;
  onFilterChange: <K extends keyof EmailFiltersType>(key: K, value: EmailFiltersType[K]) => void;
  onReset: () => void;
}

export function EmailFilters({ filters, onFilterChange, onReset }: EmailFiltersProps) {
  const { data: etablissements = [] } = useEtablissementsListSimple();

  const hasActiveFilters = 
    filters.search || 
    filters.category || 
    filters.priority || 
    filters.unreadOnly ||
    filters.etablissementId;

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher (sujet, expéditeur, contenu, IA)..."
            value={filters.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
            className="pl-9 min-w-0"
          />
        </div>
        
        {/* PHASE 3: Filtre par catégorie */}
        <Select
          value={filters.category || "all"}
          onValueChange={(value) => onFilterChange("category", value === "all" ? null : value)}
        >
          <SelectTrigger className="w-full sm:w-[180px] min-w-0">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            <SelectItem value="Commercial">Commercial</SelectItem>
            <SelectItem value="Support">Support</SelectItem>
            <SelectItem value="Technique">Technique</SelectItem>
            <SelectItem value="Administratif">Administratif</SelectItem>
            <SelectItem value="Contractuel">Contractuel</SelectItem>
            <SelectItem value="Relation">Relation</SelectItem>
            <SelectItem value="Formation">Formation</SelectItem>
            <SelectItem value="Configuration">Configuration</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.priority || "all"}
          onValueChange={(value) => onFilterChange("priority", value === "all" ? null : value)}
        >
          <SelectTrigger className="w-full sm:w-[180px] min-w-0">
            <SelectValue placeholder="Priorité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes priorités</SelectItem>
            <SelectItem value="high">Haute</SelectItem>
            <SelectItem value="medium">Moyenne</SelectItem>
            <SelectItem value="low">Basse</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.etablissementId || "all"}
          onValueChange={(value) => onFilterChange("etablissementId", value === "all" ? null : value)}
        >
          <SelectTrigger className="w-full sm:w-[200px] min-w-0">
            <SelectValue placeholder="Établissement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous établissements</SelectItem>
            <SelectItem value="internal">Interne OpenPulse</SelectItem>
            <SelectItem value="unclassified">Non classés</SelectItem>
            {etablissements.map((etab) => (
              <SelectItem key={etab.id} value={etab.id}>
                {etab.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={onReset} title="Réinitialiser les filtres" aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="unread-only"
          checked={filters.unreadOnly}
          onCheckedChange={(checked) => onFilterChange("unreadOnly", checked)}
        />
        <Label htmlFor="unread-only" className="text-sm cursor-pointer">
          Non lus uniquement
        </Label>
      </div>
    </div>
  );
}
