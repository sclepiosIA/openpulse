import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGroupes } from "@/hooks/crm/useGroupes";
import { Building2, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GroupeBadge } from "@/components/ui/groupe-badge";

type ConfidenceLevel = 'high' | 'medium' | 'low';

interface DomainGroupeAssociationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  onConfirm: (groupeId: string, confidenceLevel: ConfidenceLevel) => void;
  isLoading?: boolean;
}

export function DomainGroupeAssociationDialog({
  open,
  onOpenChange,
  domain,
  onConfirm,
  isLoading = false
}: DomainGroupeAssociationDialogProps) {
  const [selectedGroupeId, setSelectedGroupeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel>('high');
  
  const { data: groupes, isLoading: groupesLoading } = useGroupes();

  const filteredGroupes = groupes?.filter(g => 
    g.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.ville_siege?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleConfirm = () => {
    if (selectedGroupeId) {
      onConfirm(selectedGroupeId, confidenceLevel);
      setSelectedGroupeId(null);
      setSearchQuery("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Associer le domaine à un groupe</DialogTitle>
          <DialogDescription>
            Domaine : <span className="font-semibold text-foreground">{domain}</span>
            <br />
            Sélectionnez le groupe auquel ce domaine appartient. Les emails de ce domaine seront liés au groupe et à tous ses établissements.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un groupe..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Niveau de confiance */}
          <div className="space-y-2">
            <Label>Niveau de confiance</Label>
            <Select value={confidenceLevel} onValueChange={(v) => setConfidenceLevel(v as ConfidenceLevel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">Élevé (domaine officiel du groupe)</SelectItem>
                <SelectItem value="medium">Moyen (domaine probable)</SelectItem>
                <SelectItem value="low">Faible (à vérifier)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Liste des groupes */}
          <div className="space-y-2">
            <Label>Groupes disponibles ({filteredGroupes.length})</Label>
            <ScrollArea className="h-[300px] border rounded-md">
              <div className="p-2 space-y-2">
                {groupesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Chargement des groupes...
                  </div>
                ) : filteredGroupes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucun groupe trouvé
                  </div>
                ) : (
                  filteredGroupes.map((groupe) => (
                    <button
                      key={groupe.id}
                      onClick={() => setSelectedGroupeId(groupe.id)}
                      className={`w-full p-3 rounded-lg border transition-colors text-left ${
                        selectedGroupeId === groupe.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Building2 className="h-5 w-5 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{groupe.nom}</span>
                            <GroupeBadge type={groupe.type} />
                          </div>
                          {groupe.ville_siege && (
                            <div className="text-sm text-muted-foreground">
                              {groupe.ville_siege}
                            </div>
                          )}
                          {groupe.nombre_etablissements > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {groupe.nombre_etablissements} établissement(s)
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annuler
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedGroupeId || isLoading}
          >
            {isLoading ? "Association..." : "Confirmer l'association"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
