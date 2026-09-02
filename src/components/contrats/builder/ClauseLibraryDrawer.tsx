import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, FileText, Tag, TrendingUp, GripVertical } from "lucide-react";
import { useContratClauses } from "@/hooks/contracts/useContratTemplates";
import { useCreateSectionFromClause, useContractSections } from "@/hooks/contracts/useContractSections";
import { CLAUSE_CATEGORIES } from "@/types/contrats";
import DOMPurify from "dompurify";

interface ClauseLibraryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contratId: string;
  onClauseAdded: () => void;
}

export function ClauseLibraryDrawer({
  open,
  onOpenChange,
  contratId,
  onClauseAdded
}: ClauseLibraryDrawerProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: clauses = [], isLoading } = useContratClauses();
  const { data: existingSections = [] } = useContractSections(contratId);
  const createFromClause = useCreateSectionFromClause();

  // Filtrer les clauses
  const filteredClauses = clauses.filter(clause => {
    const clauseContent = clause.contenu_html || "";
    const matchesSearch = search === "" || 
      clause.titre.toLowerCase().includes(search.toLowerCase()) ||
      clauseContent.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || clause.categorie === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Regrouper par catégorie
  const clausesByCategory = CLAUSE_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = filteredClauses.filter(c => c.categorie === cat);
    return acc;
  }, {} as Record<string, typeof clauses>);

  const handleAddClause = (clause: typeof clauses[0]) => {
    const nextOrdre = existingSections.filter(s => !s.parent_id).length;
    const clauseContent = clause.contenu_html || "";
    
    createFromClause.mutate({
      contrat_id: contratId,
      clauseId: clause.id,
      titre: clause.titre,
      contenu: clauseContent,
      ordre: nextOrdre,
    }, {
      onSuccess: () => {
        onClauseAdded();
      }
    });
  };

  // Aperçu texte brut (150 chars)
  const getPreview = (html: string | null) => {
    if (!html) return "";
    const div = document.createElement('div');
    div.innerHTML = DOMPurify.sanitize(html);
    const text = div.textContent || "";
    return text.length > 150 ? text.substring(0, 150) + "..." : text;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[500px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Bibliothèque de clauses
          </SheetTitle>
        </SheetHeader>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une clause..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Categories tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 border-b">
            <TabsList className="h-auto p-1 flex flex-wrap gap-1 bg-transparent">
              <TabsTrigger value="all" className="text-xs">
                Toutes
              </TabsTrigger>
              {CLAUSE_CATEGORIES.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="text-xs capitalize">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <TabsContent value={selectedCategory} className="p-4 mt-0">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={`clause-library-skeleton-${i}`} className="h-32 w-full" />
                  ))}
                </div>
              ) : filteredClauses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucune clause trouvée</p>
                </div>
              ) : selectedCategory === "all" ? (
                // Vue par catégorie
                <div className="space-y-6">
                  {CLAUSE_CATEGORIES.map((cat) => {
                    const catClauses = clausesByCategory[cat];
                    if (catClauses.length === 0) return null;
                    
                    return (
                      <div key={cat}>
                        <h3 className="text-sm font-semibold mb-3 capitalize flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          {cat}
                          <Badge variant="secondary" className="text-xs">
                            {catClauses.length}
                          </Badge>
                        </h3>
                        <div className="space-y-2">
                          {catClauses.map((clause) => (
                            <ClauseCard
                              key={clause.id}
                              clause={clause}
                              preview={getPreview(clause.contenu_html)}
                              onAdd={() => handleAddClause(clause)}
                              isAdding={createFromClause.isPending}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Vue plate
                <div className="space-y-2">
                  {filteredClauses.map((clause) => (
                    <ClauseCard
                      key={clause.id}
                      clause={clause}
                      preview={getPreview(clause.contenu_html)}
                      onAdd={() => handleAddClause(clause)}
                      isAdding={createFromClause.isPending}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

interface ClauseCardProps {
  clause: {
    id: string;
    titre: string;
    categorie: string;
    usage_count?: number;
  };
  preview: string;
  onAdd: () => void;
  isAdding: boolean;
}

function ClauseCard({ clause, preview, onAdd, isAdding }: ClauseCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card
      className="p-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-3">
        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab mt-1" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium text-sm truncate">{clause.titre}</h4>
            {clause.usage_count !== undefined && clause.usage_count > 0 && (
              <Badge variant="secondary" className="text-xs shrink-0">
                <TrendingUp className="h-3 w-3 mr-1" />
                {clause.usage_count}
              </Badge>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {preview || "Aucun contenu"}
          </p>

          <div className="flex items-center justify-between mt-2">
            <Badge variant="outline" className="text-xs capitalize">
              {clause.categorie}
            </Badge>
            
            <Button
              size="sm"
              variant={isHovered ? "default" : "ghost"}
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              disabled={isAdding}
            >
              <Plus className="h-3 w-3 mr-1" />
              Ajouter
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
