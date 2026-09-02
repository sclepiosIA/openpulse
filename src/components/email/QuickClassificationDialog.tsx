import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Users, Briefcase, Search, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { CreateEntityDialog } from "./CreateEntityDialog";
import { fetchEtablissementsWithVilleType, fetchPartenairesLite, fetchGroupesLite } from '@/services/etablissements/entitiesLite';

/** Type pour un item de classification (établissement, partenaire ou groupe) */
interface ClassificationItem {
  id: string;
  nom: string;
  ville?: string | null;
  type?: string | null;
  type_partenaire?: string | null;
}

interface QuickClassificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "etablissement" | "partenaire" | "groupe";
  onSelect: (id: string, name: string) => void;
  threadData?: {
    subject: string;
    participants: Record<string, unknown> | null;
  };
}

export function QuickClassificationDialog({
  open,
  onOpenChange,
  type,
  onSelect,
  threadData,
}: QuickClassificationDialogProps) {
  const [search, setSearch] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: items, isLoading } = useQuery<ClassificationItem[]>({
    queryKey: ["quick-classification", type],
    queryFn: async (): Promise<ClassificationItem[]> => {
      if (type === "etablissement") {
        return (await fetchEtablissementsWithVilleType()) as ClassificationItem[];
      } else if (type === "partenaire") {
        return (await fetchPartenairesLite()) as unknown as ClassificationItem[];
      } else {
        return (await fetchGroupesLite()) as ClassificationItem[];
      }
    },
    enabled: open,
  });

  const filteredItems = useMemo((): ClassificationItem[] => {
    if (!items) return [];
    if (!search) return items;
    
    const searchLower = search.toLowerCase();
    return items.filter((item) => 
      item.nom?.toLowerCase().includes(searchLower) ||
      item.ville?.toLowerCase().includes(searchLower)
    );
  }, [items, search]);

  const getIcon = () => {
    switch (type) {
      case "etablissement":
        return <Building2 className="h-5 w-5" />;
      case "partenaire":
        return <Briefcase className="h-5 w-5" />;
      case "groupe":
        return <Users className="h-5 w-5" />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case "etablissement":
        return "Classer l'établissement";
      case "partenaire":
        return "Classer le partenaire";
      case "groupe":
        return "Classer le groupe";
    }
  };

  const handleSelect = (item: ClassificationItem) => {
    onSelect(item.id, item.nom);
    onOpenChange(false);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>
            {threadData && (
              <span className="text-sm text-muted-foreground">
                Pour: {threadData.subject}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Rechercher ${type === "etablissement" ? "un établissement" : type === "partenaire" ? "un partenaire" : "un groupe"}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Aucun résultat trouvé</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors",
                      "hover:bg-accent hover:border-primary"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{item.nom}</p>
                        {item.ville && (
                          <p className="text-sm text-muted-foreground">{item.ville}</p>
                        )}
                      </div>
                      {(item.type || item.type_partenaire) && (
                        <Badge variant="outline" className="ml-2">
                          {item.type || item.type_partenaire}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Créer un nouveau {type === "etablissement" ? "établissement" : type === "partenaire" ? "partenaire" : "groupe"}
          </Button>
        </div>
      </DialogContent>

      <CreateEntityDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        type={type}
        onCreated={(id, name) => {
          handleSelect({ id, nom: name });
          setCreateDialogOpen(false);
        }}
      />
    </Dialog>
  );
}
