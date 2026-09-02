import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Slider } from "@/components/ui/slider";
import { Search, X } from "lucide-react";

export interface AdvancedSearchFilters {
  nom?: string;
  types: string[];
  statuts: string[];
  ville?: string;
  region?: string;
  pays?: string;
  dateCreationMin?: string;
  dateCreationMax?: string;
  dernierContactMin?: string;
  dernierContactMax?: string;
  prochaineActionMin?: string;
  prochaineActionMax?: string;
  valeurMin?: number;
  valeurMax?: number;
  engagementMin?: number;
  engagementMax?: number;
  responsableId?: string;
  notesSearch?: string;
}

interface AdvancedSearchPartenairesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilters: (filters: AdvancedSearchFilters) => void;
}

export function AdvancedSearchPartenaires({ open, onOpenChange, onApplyFilters }: AdvancedSearchPartenairesProps) {
  const [filters, setFilters] = useState<AdvancedSearchFilters>({
    types: [],
    statuts: [],
    valeurMin: 0,
    valeurMax: 1000000,
    engagementMin: 0,
    engagementMax: 100,
  });

  const handleApply = () => {
    onApplyFilters(filters);
    onOpenChange(false);
  };

  const handleReset = () => {
    setFilters({
      types: [],
      statuts: [],
      valeurMin: 0,
      valeurMax: 1000000,
      engagementMin: 0,
      engagementMax: 100,
    });
  };

  const toggleType = (type: string) => {
    setFilters((prev) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type],
    }));
  };

  const toggleStatut = (statut: string) => {
    setFilters((prev) => ({
      ...prev,
      statuts: prev.statuts.includes(statut)
        ? prev.statuts.filter((s) => s !== statut)
        : [...prev.statuts, statut],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Recherche avancée
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Nom */}
          <div className="space-y-2">
            <Label>Nom du partenaire</Label>
            <Input
              placeholder="Rechercher dans le nom..."
              value={filters.nom || ""}
              onChange={(e) => setFilters({ ...filters, nom: e.target.value })}
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Type de partenaire</Label>
            <div className="flex flex-wrap gap-2">
              {["institutionnel", "industriel", "prestataire"].map((type) => (
                <Button
                  key={type}
                  variant={filters.types.includes(type) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleType(type)}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Statut */}
          <div className="space-y-2">
            <Label>Statut relationnel</Label>
            <div className="flex flex-wrap gap-2">
              {["actif", "prospect", "inactif", "termine"].map((statut) => (
                <Button
                  key={statut}
                  variant={filters.statuts.includes(statut) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleStatut(statut)}
                >
                  {statut.charAt(0).toUpperCase() + statut.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Localisation */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Ville</Label>
              <Input
                placeholder="Ville..."
                value={filters.ville || ""}
                onChange={(e) => setFilters({ ...filters, ville: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Région</Label>
              <Input
                placeholder="Région..."
                value={filters.region || ""}
                onChange={(e) => setFilters({ ...filters, region: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Pays</Label>
              <Input
                placeholder="Pays..."
                value={filters.pays || ""}
                onChange={(e) => setFilters({ ...filters, pays: e.target.value })}
              />
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date création (min)</Label>
                <Input
                  type="date"
                  value={filters.dateCreationMin || ""}
                  onChange={(e) => setFilters({ ...filters, dateCreationMin: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date création (max)</Label>
                <Input
                  type="date"
                  value={filters.dateCreationMax || ""}
                  onChange={(e) => setFilters({ ...filters, dateCreationMax: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dernier contact (min)</Label>
                <Input
                  type="date"
                  value={filters.dernierContactMin || ""}
                  onChange={(e) => setFilters({ ...filters, dernierContactMin: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Dernier contact (max)</Label>
                <Input
                  type="date"
                  value={filters.dernierContactMax || ""}
                  onChange={(e) => setFilters({ ...filters, dernierContactMax: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prochaine action (min)</Label>
                <Input
                  type="date"
                  value={filters.prochaineActionMin || ""}
                  onChange={(e) => setFilters({ ...filters, prochaineActionMin: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Prochaine action (max)</Label>
                <Input
                  type="date"
                  value={filters.prochaineActionMax || ""}
                  onChange={(e) => setFilters({ ...filters, prochaineActionMax: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Valeur partenariat */}
          <div className="space-y-2">
            <Label>Valeur partenariat (€)</Label>
            <div className="px-2">
              <Slider
                min={0}
                max={1000000}
                step={10000}
                value={[filters.valeurMin || 0, filters.valeurMax || 1000000]}
                onValueChange={([min, max]) =>
                  setFilters({ ...filters, valeurMin: min, valeurMax: max })
                }
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{(filters.valeurMin || 0).toLocaleString("fr-FR")}€</span>
                <span>{(filters.valeurMax || 1000000).toLocaleString("fr-FR")}€</span>
              </div>
            </div>
          </div>

          {/* Score engagement */}
          <div className="space-y-2">
            <Label>Score d'engagement (%)</Label>
            <div className="px-2">
              <Slider
                min={0}
                max={100}
                step={5}
                value={[filters.engagementMin || 0, filters.engagementMax || 100]}
                onValueChange={([min, max]) =>
                  setFilters({ ...filters, engagementMin: min, engagementMax: max })
                }
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{filters.engagementMin}%</span>
                <span>{filters.engagementMax}%</span>
              </div>
            </div>
          </div>

          {/* Recherche dans notes */}
          <div className="space-y-2">
            <Label>Recherche dans les notes</Label>
            <Input
              placeholder="Rechercher dans les notes..."
              value={filters.notesSearch || ""}
              onChange={(e) => setFilters({ ...filters, notesSearch: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            <X className="mr-2 h-4 w-4" />
            Réinitialiser
          </Button>
          <Button onClick={handleApply}>
            <Search className="mr-2 h-4 w-4" />
            Rechercher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}