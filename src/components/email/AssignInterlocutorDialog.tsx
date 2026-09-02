import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Users, Handshake, Search, Loader2, Mail, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssignInterlocutor, EntityType } from "@/hooks/email/useAssignInterlocutor";
import { queryPresets } from "@/lib/queryPresets";
import { fetchEtablissementsWithVille, fetchGroupesLite, fetchPartenairesLite } from '@/services/etablissements/entitiesLite';

interface AssignInterlocutorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  senderEmail: string;
  senderName: string | null;
  onAssigned?: () => void;
}

interface EntityOption {
  id: string;
  nom: string;
  ville?: string | null;
  type?: string | null;
}

export function AssignInterlocutorDialog({
  open,
  onOpenChange,
  threadId,
  senderEmail,
  senderName,
  onAssigned,
}: AssignInterlocutorDialogProps) {
  const [entityType, setEntityType] = useState<EntityType>("etablissement");
  const [search, setSearch] = useState("");
  const { assignInterlocutor, isAssigning } = useAssignInterlocutor();

  // Fetch etablissements with React Query
  const { data: etablissements, isLoading: isLoadingEtab } = useQuery<EntityOption[]>({
    queryKey: ["etablissements-list-for-assign"],
    queryFn: async () => {
      return (await fetchEtablissementsWithVille()) as EntityOption[];
    },
    enabled: open && entityType === "etablissement",
    ...queryPresets.reference,
  });

  // Fetch groupes with React Query
  const { data: groupes, isLoading: isLoadingGroupes } = useQuery<EntityOption[]>({
    queryKey: ["groupes-list-for-assign"],
    queryFn: async () => {
      return (await fetchGroupesLite({ withType: true })) as EntityOption[];
    },
    enabled: open && entityType === "groupe",
    ...queryPresets.reference,
  });

  // Fetch partenaires with React Query
  const { data: partenaires, isLoading: isLoadingPartenaires } = useQuery<EntityOption[]>({
    queryKey: ["partenaires-list-for-assign"],
    queryFn: async () => {
      const data = await fetchPartenairesLite();
      return data.map(p => ({ ...p, type: p.type_partenaire })) as EntityOption[];
    },
    enabled: open && entityType === "partenaire",
    ...queryPresets.reference,
  });

  // Get current entities list and loading state
  const { entities, isLoading } = useMemo(() => {
    switch (entityType) {
      case "etablissement":
        return { entities: etablissements || [], isLoading: isLoadingEtab };
      case "groupe":
        return { entities: groupes || [], isLoading: isLoadingGroupes };
      case "partenaire":
        return { entities: partenaires || [], isLoading: isLoadingPartenaires };
      default:
        return { entities: [], isLoading: false };
    }
  }, [entityType, etablissements, groupes, partenaires, isLoadingEtab, isLoadingGroupes, isLoadingPartenaires]);

  // Filter entities by search
  const filteredEntities = useMemo(() => {
    if (!search.trim()) return entities;
    const searchLower = search.toLowerCase();
    return entities.filter(
      (e) =>
        e.nom.toLowerCase().includes(searchLower) ||
        e.ville?.toLowerCase().includes(searchLower)
    );
  }, [entities, search]);

  const handleSelect = async (entity: EntityOption) => {
    const success = await assignInterlocutor({
      threadId,
      entityType,
      entityId: entity.id,
      entityName: entity.nom,
      senderEmail,
      senderName,
    });

    if (success) {
      onAssigned?.();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Attribuer cet interlocuteur</DialogTitle>
          <DialogDescription>
            Associer l'expéditeur à un établissement, groupe ou partenaire
          </DialogDescription>
        </DialogHeader>

        {/* Sender info */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{senderName || "Nom inconnu"}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {senderEmail}
            </p>
          </div>
        </div>

        {/* Entity type tabs */}
        <Tabs value={entityType} onValueChange={(v) => setEntityType(v as EntityType)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="etablissement" className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Établissement</span>
              <span className="sm:hidden">Étab.</span>
            </TabsTrigger>
            <TabsTrigger value="groupe" className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Groupe
            </TabsTrigger>
            <TabsTrigger value="partenaire" className="flex items-center gap-1.5">
              <Handshake className="h-4 w-4" />
              Partenaire
            </TabsTrigger>
          </TabsList>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Entity lists */}
          <TabsContent value="etablissement" className="mt-2">
            <EntityList
              entities={filteredEntities}
              isLoading={isLoading}
              onSelect={handleSelect}
              isAssigning={isAssigning}
              entityType="etablissement"
            />
          </TabsContent>

          <TabsContent value="groupe" className="mt-2">
            <EntityList
              entities={filteredEntities}
              isLoading={isLoading}
              onSelect={handleSelect}
              isAssigning={isAssigning}
              entityType="groupe"
            />
          </TabsContent>

          <TabsContent value="partenaire" className="mt-2">
            <EntityList
              entities={filteredEntities}
              isLoading={isLoading}
              onSelect={handleSelect}
              isAssigning={isAssigning}
              entityType="partenaire"
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

interface EntityListProps {
  entities: EntityOption[];
  isLoading: boolean;
  onSelect: (entity: EntityOption) => void;
  isAssigning: boolean;
  entityType: EntityType;
}

function EntityList({ entities, isLoading, onSelect, isAssigning, entityType }: EntityListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        Aucun résultat trouvé
      </p>
    );
  }

  const Icon = entityType === "etablissement" ? Building2 : entityType === "groupe" ? Users : Handshake;

  return (
    <ScrollArea className="h-[280px]">
      <div className="space-y-1 pr-4">
        {entities.map((entity) => (
          <Button
            key={entity.id}
            variant="ghost"
            className={cn(
              "w-full justify-start h-auto py-2 px-3",
              "hover:bg-accent"
            )}
            onClick={() => onSelect(entity)}
            disabled={isAssigning}
          >
            <Icon className="h-4 w-4 mr-3 shrink-0 text-muted-foreground" />
            <div className="text-left min-w-0">
              <p className="font-medium truncate">{entity.nom}</p>
              {(entity.ville || entity.type) && (
                <p className="text-xs text-muted-foreground truncate">
                  {[entity.ville, entity.type].filter(Boolean).join(" • ")}
                </p>
              )}
            </div>
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}
