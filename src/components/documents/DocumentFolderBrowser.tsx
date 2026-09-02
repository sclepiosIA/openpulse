import { useState, useMemo } from "react";
import {
  Search,
  ChevronRight,
  Building2,
  Loader2,
  FolderOpen,
  ArrowLeft,
  LayoutGrid,
  List,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { useEtablissementsWithDocuments } from "@/hooks/documents/useEtablissementsWithDocuments";
import { EtablissementDocumentFolder } from "./EtablissementDocumentFolder";
import { EtablissementDocumentListItem } from "./EtablissementDocumentListItem";
import { DocumentBrowser } from "./DocumentBrowser";

interface FolderState {
  type: 'root' | 'etablissement';
  id?: string;
  name?: string;
}

interface DocumentFolderBrowserProps {
  className?: string;
}

export function DocumentFolderBrowser({ className }: DocumentFolderBrowserProps) {
  const [currentFolder, setCurrentFolder] = useState<FolderState>({ type: 'root' });
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: etablissements = [], isLoading, error } = useEtablissementsWithDocuments();

  // Recherche multimodale : nom, ville, groupe
  const filteredEtablissements = useMemo(() => {
    if (!searchQuery.trim()) return etablissements;
    
    const query = searchQuery.toLowerCase().trim();
    const words = query.split(/\s+/);
    
    return etablissements.filter(e => {
      // Construire le texte cherchable
      const searchableText = [
        e.nom,
        e.ville,
        e.groupe_nom
      ].filter(Boolean).join(' ').toLowerCase();
      
      // Tous les mots de la recherche doivent matcher
      return words.every(word => searchableText.includes(word));
    });
  }, [etablissements, searchQuery]);

  // Total des documents
  const totalDocuments = useMemo(() => {
    return etablissements.reduce((sum, e) => sum + e.document_count, 0);
  }, [etablissements]);

  // Navigation vers un établissement
  const navigateToEtablissement = (id: string, name: string) => {
    setCurrentFolder({ type: 'etablissement', id, name });
    setSearchQuery('');
  };

  // Retour à la racine
  const navigateToRoot = () => {
    setCurrentFolder({ type: 'root' });
    setSearchQuery('');
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Fil d'ariane */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink 
              onClick={navigateToRoot}
              className={cn(
                "cursor-pointer flex items-center gap-1.5",
                currentFolder.type === 'root' && "pointer-events-none"
              )}
            >
              <Building2 className="w-4 h-4" />
              Établissements
            </BreadcrumbLink>
          </BreadcrumbItem>
          
          {currentFolder.type === 'etablissement' && currentFolder.name && (
            <>
              <BreadcrumbSeparator>
                <ChevronRight className="w-4 h-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage className="flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4" />
                  {currentFolder.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Vue racine : liste des établissements */}
      {currentFolder.type === 'root' && (
        <>
          {/* Barre de recherche et options */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, ville ou groupe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <div className="flex items-center gap-3">
              {/* Toggle vue grille/liste */}
              <ToggleGroup 
                type="single" 
                value={viewMode} 
                onValueChange={(v) => v && setViewMode(v as 'grid' | 'list')}
                className="border rounded-lg"
              >
                <ToggleGroupItem value="grid" aria-label="Vue grille" className="px-2.5">
                  <LayoutGrid className="w-4 h-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="Vue liste" className="px-2.5">
                  <List className="w-4 h-4" />
                </ToggleGroupItem>
              </ToggleGroup>
              
              {/* Stats */}
              <div className="text-sm text-muted-foreground flex items-center gap-2 whitespace-nowrap">
                <Building2 className="w-4 h-4" />
                {etablissements.length}
                <span className="mx-1">•</span>
                <FolderOpen className="w-4 h-4" />
                {totalDocuments}
              </div>
            </div>
          </div>

          {/* Contenu */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Building2 className="w-12 h-12 mb-4" />
              <p className="text-sm">Erreur lors du chargement</p>
            </div>
          ) : filteredEtablissements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Building2 className="w-12 h-12 mb-4" />
              <p className="text-sm font-medium">
                {searchQuery ? "Aucun établissement trouvé" : "Aucun document lié aux établissements"}
              </p>
              <p className="text-xs mt-1">
                {searchQuery 
                  ? "Essayez avec un autre terme : nom, ville ou groupe"
                  : "Les documents liés aux établissements apparaîtront ici"
                }
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            // Vue grille
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredEtablissements.map(etablissement => (
                <EtablissementDocumentFolder
                  key={etablissement.id}
                  etablissement={etablissement}
                  onClick={() => navigateToEtablissement(etablissement.id, etablissement.nom)}
                />
              ))}
            </div>
          ) : (
            // Vue liste
            <div className="space-y-1 border rounded-lg divide-y bg-card">
              {filteredEtablissements.map(etablissement => (
                <EtablissementDocumentListItem
                  key={etablissement.id}
                  etablissement={etablissement}
                  onClick={() => navigateToEtablissement(etablissement.id, etablissement.nom)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Vue établissement : documents de l'établissement */}
      {currentFolder.type === 'etablissement' && currentFolder.id && (
        <>
          {/* Bouton retour */}
          <Button
            variant="ghost"
            size="sm"
            onClick={navigateToRoot}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux établissements
          </Button>

          {/* Browser de documents filtré par établissement */}
          <DocumentBrowser
            relatedEtablissementId={currentFolder.id}
            showUpload={true}
          />
        </>
      )}
    </div>
  );
}
