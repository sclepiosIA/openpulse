import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import { EmailFilters as EmailFiltersType } from "@/hooks/email/useEmailFilters";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { fetchEtablissementsLite } from '@/services/etablissements/etablissementsLite';
interface MobileEmailFiltersProps {
  filters: EmailFiltersType;
  onChange: <K extends keyof EmailFiltersType>(key: K, value: EmailFiltersType[K]) => void;
  onReset: () => void;
  onClose: () => void;
}

/**
 * Filtres d'emails optimisés pour mobile (drawer)
 * Layout vertical avec sections collapsibles
 */
export function MobileEmailFilters({ 
  filters, 
  onChange, 
  onReset, 
  onClose 
}: MobileEmailFiltersProps) {
  const [etablissements, setEtablissements] = useState<Array<{ id: string; nom: string }>>([]);

  useEffect(() => {
    fetchEtablissementsLite().then((data) => {
      if (data.length) setEtablissements(data);
    });
  }, []);

  const handleApply = () => {
    onClose();
  };

  const hasActiveFilters = 
    filters.search || 
    filters.category || 
    filters.priority || 
    filters.unreadOnly ||
    filters.etablissementId;

  return (
    <div className="flex flex-col h-full">
      {/* Recherche sticky en haut */}
      <div className="p-4 border-b bg-background sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={filters.search}
            onChange={(e) => onChange("search", e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Filtres scrollables */}
      <div className="flex-1 overflow-y-auto p-4">
        <Accordion type="multiple" defaultValue={["switches", "category", "priority"]}>
          {/* Quick switches */}
          <AccordionItem value="switches" className="border-b">
            <AccordionTrigger className="text-sm font-medium">
              Affichage rapide
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="unread-only" className="text-sm">
                  Non lus uniquement
                </Label>
                <Switch
                  id="unread-only"
                  checked={filters.unreadOnly}
                  onCheckedChange={(checked) => onChange("unreadOnly", checked)}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Catégorie */}
          <AccordionItem value="category" className="border-b">
            <AccordionTrigger className="text-sm font-medium">
              Catégorie
              {filters.category && (
                <span className="ml-2 text-xs text-muted-foreground">({filters.category})</span>
              )}
            </AccordionTrigger>
            <AccordionContent className="pt-2">
              <RadioGroup 
                value={filters.category || "all"}
                onValueChange={(value) => onChange("category", value === "all" ? null : value)}
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="cat-all" />
                    <Label htmlFor="cat-all" className="text-sm font-normal">Toutes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Commercial" id="cat-com" />
                    <Label htmlFor="cat-com" className="text-sm font-normal">Commercial</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Support" id="cat-sup" />
                    <Label htmlFor="cat-sup" className="text-sm font-normal">Support</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Technique" id="cat-tech" />
                    <Label htmlFor="cat-tech" className="text-sm font-normal">Technique</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Administratif" id="cat-admin" />
                    <Label htmlFor="cat-admin" className="text-sm font-normal">Administratif</Label>
                  </div>
                </div>
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>

          {/* Priorité */}
          <AccordionItem value="priority" className="border-b">
            <AccordionTrigger className="text-sm font-medium">
              Priorité
              {filters.priority && (
                <span className="ml-2 text-xs text-muted-foreground">({filters.priority})</span>
              )}
            </AccordionTrigger>
            <AccordionContent className="pt-2">
              <RadioGroup 
                value={filters.priority || "all"}
                onValueChange={(value) => onChange("priority", value === "all" ? null : value)}
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="pri-all" />
                    <Label htmlFor="pri-all" className="text-sm font-normal">Toutes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="pri-high" />
                    <Label htmlFor="pri-high" className="text-sm font-normal">Haute</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="pri-med" />
                    <Label htmlFor="pri-med" className="text-sm font-normal">Moyenne</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="pri-low" />
                    <Label htmlFor="pri-low" className="text-sm font-normal">Basse</Label>
                  </div>
                </div>
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>

          {/* Établissement */}
          <AccordionItem value="etablissement" className="border-b">
            <AccordionTrigger className="text-sm font-medium">
              Établissement
            </AccordionTrigger>
            <AccordionContent className="pt-2">
              <RadioGroup 
                value={filters.etablissementId || "all"}
                onValueChange={(value) => onChange("etablissementId", value === "all" ? null : value)}
              >
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="etab-all" />
                    <Label htmlFor="etab-all" className="text-sm font-normal">Tous</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="internal" id="etab-int" />
                    <Label htmlFor="etab-int" className="text-sm font-normal">Interne OpenPulse</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="unclassified" id="etab-unc" />
                    <Label htmlFor="etab-unc" className="text-sm font-normal">Non classés</Label>
                  </div>
                  {etablissements.map((etab) => (
                    <div key={etab.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={etab.id} id={`etab-${etab.id}`} />
                      <Label htmlFor={`etab-${etab.id}`} className="text-sm font-normal">
                        {etab.nom}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Footer sticky */}
      <div className="p-4 border-t bg-background flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => {
            onReset();
            onClose();
          }}
          disabled={!hasActiveFilters}
          className="flex-1"
        >
          Réinitialiser
        </Button>
        <Button onClick={handleApply} className="flex-1">
          Appliquer
        </Button>
      </div>
    </div>
  );
}
