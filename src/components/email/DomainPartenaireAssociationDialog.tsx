import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePartenaires } from "@/hooks/crm/usePartenaires";
import { Handshake, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface DomainPartenaireAssociationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  onConfirm: (partenaireId: string, confidenceLevel: 'high' | 'medium' | 'low') => void;
  isLoading?: boolean;
}

export function DomainPartenaireAssociationDialog({
  open,
  onOpenChange,
  domain,
  onConfirm,
  isLoading = false
}: DomainPartenaireAssociationDialogProps) {
  const [selectedPartenaireId, setSelectedPartenaireId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [confidenceLevel, setConfidenceLevel] = useState<'high' | 'medium' | 'low'>('high');
  
  const { data: partenaires, isLoading: partenairesLoading } = usePartenaires();

  const filteredPartenaires = partenaires?.filter(p => 
    p.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.type_partenaire?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.ville?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleConfirm = () => {
    if (selectedPartenaireId) {
      onConfirm(selectedPartenaireId, confidenceLevel);
      setSelectedPartenaireId(null);
      setSearchQuery("");
      onOpenChange(false);
    }
  };

  const getTypeVariant = (type: string) => {
    switch(type) {
      case 'institutionnel': return 'default';
      case 'industriel': return 'secondary';
      case 'prestataire': return 'outline';
      default: return 'outline';
    }
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'institutionnel': return 'Institutionnel';
      case 'industriel': return 'Industriel';
      case 'prestataire': return 'Prestataire';
      default: return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Associer le domaine à un partenaire</DialogTitle>
          <DialogDescription>
            Domaine : <span className="font-semibold text-foreground">{domain}</span>
            <br />
            Sélectionnez le partenaire auquel ce domaine appartient. Les emails de ce domaine seront liés au partenaire.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un partenaire..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Niveau de confiance */}
          <div className="space-y-2">
            <Label>Niveau de confiance</Label>
            <Select value={confidenceLevel} onValueChange={(v: any) => setConfidenceLevel(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">Élevé (domaine officiel du partenaire)</SelectItem>
                <SelectItem value="medium">Moyen (domaine probable)</SelectItem>
                <SelectItem value="low">Faible (à vérifier)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Liste des partenaires */}
          <div className="space-y-2">
            <Label>Partenaires disponibles ({filteredPartenaires.length})</Label>
            <ScrollArea className="h-[300px] border rounded-md">
              <div className="p-2 space-y-2">
                {partenairesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Chargement des partenaires...
                  </div>
                ) : filteredPartenaires.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucun partenaire trouvé
                  </div>
                ) : (
                  filteredPartenaires.map((partenaire) => (
                    <button
                      key={partenaire.id}
                      onClick={() => setSelectedPartenaireId(partenaire.id)}
                      className={`w-full p-3 rounded-lg border transition-colors text-left ${
                        selectedPartenaireId === partenaire.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Handshake className="h-5 w-5 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{partenaire.nom}</span>
                            <Badge variant={getTypeVariant(partenaire.type_partenaire)}>
                              {getTypeLabel(partenaire.type_partenaire)}
                            </Badge>
                          </div>
                          {partenaire.ville && (
                            <div className="text-sm text-muted-foreground">
                              {partenaire.ville}
                            </div>
                          )}
                          {partenaire.sous_type && (
                            <div className="text-xs text-muted-foreground">
                              {partenaire.sous_type}
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
            disabled={!selectedPartenaireId || isLoading}
          >
            {isLoading ? "Association..." : "Confirmer l'association"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
