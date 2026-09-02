import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEtablissements } from "@/hooks/crm/useEtablissements";
import { Loader2 } from "lucide-react";
import { fixMalformedEncoding } from "@/lib/emailUtils";

interface DomainMultiAssociationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  onConfirm: (etablissementIds: string[], confidenceLevel: 'high' | 'medium' | 'low') => void;
  isLoading?: boolean;
}

export function DomainMultiAssociationDialog({
  open,
  onOpenChange,
  domain,
  onConfirm,
  isLoading
}: DomainMultiAssociationDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [confidenceLevel, setConfidenceLevel] = useState<'high' | 'medium' | 'low'>('high');
  
  const { data: etablissements, isLoading: isLoadingEtablissements } = useEtablissements();

  const filteredEtablissements = etablissements?.filter(e => 
    e.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.ville?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleConfirm = () => {
    if (selectedIds.size > 0) {
      onConfirm(Array.from(selectedIds), confidenceLevel);
      setSelectedIds(new Set());
      setSearchQuery("");
      setConfidenceLevel('high');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Associer le domaine {domain}</DialogTitle>
          <DialogDescription>
            Sélectionnez un ou plusieurs établissements à associer à ce domaine.
            Utile pour les GHT ou groupements hospitaliers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="search">Rechercher un établissement</Label>
            <Input
              id="search"
              placeholder="Nom ou ville..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="confidence">Niveau de confiance</Label>
            <Select value={confidenceLevel} onValueChange={(v: any) => setConfidenceLevel(v)}>
              <SelectTrigger id="confidence" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">Élevé (vérifié manuellement)</SelectItem>
                <SelectItem value="medium">Moyen (probable)</SelectItem>
                <SelectItem value="low">Faible (à vérifier)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Établissements ({selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''})</Label>
            <ScrollArea className="h-[300px] border rounded-md mt-1">
              {isLoadingEtablissements ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {filteredEtablissements?.map((etablissement) => (
                    <div
                      key={etablissement.id}
                      className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer"
                      onClick={() => toggleSelection(etablissement.id)}
                    >
                      <Checkbox
                        checked={selectedIds.has(etablissement.id)}
                        onCheckedChange={() => toggleSelection(etablissement.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{fixMalformedEncoding(etablissement.nom)}</p>
                        {etablissement.ville && (
                          <p className="text-sm text-muted-foreground">{fixMalformedEncoding(etablissement.ville)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredEtablissements?.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Aucun établissement trouvé
                    </p>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annuler
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={selectedIds.size === 0 || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Associer à {selectedIds.size} établissement{selectedIds.size > 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
