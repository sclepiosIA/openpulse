import { useState } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Library,
  Eye,
  EyeOff,
  Save,
} from "lucide-react";
import { useIsMobile } from "@/hooks/ui/use-mobile";
import { ContractBinder } from "./ContractBinder";
import { ContractSectionEditor } from "./LazyContractSectionEditor";
import { ContractPreview } from "./ContractPreview";
import { ClauseLibraryDrawer } from "./ClauseLibraryDrawer";
import { ContractSection, buildSectionTree, useContractSections, useUpdateSection, useCreateSection, useReorderSections } from "@/hooks/contracts/useContractSections";

interface ContractBuilderLayoutProps {
  contratId: string;
  contratTitre?: string;
  onSave?: () => void;
}

export function ContractBuilderLayout({ 
  contratId, 
  contratTitre = "Nouveau contrat",
  onSave
}: ContractBuilderLayoutProps) {
  const isMobile = useIsMobile();
  const [showBinder, setShowBinder] = useState(true);
  const [showPreview, setShowPreview] = useState(!isMobile);
  const [showClauseLibrary, setShowClauseLibrary] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  const { data: sections = [], isLoading } = useContractSections(contratId);
  const updateSection = useUpdateSection();
  const createSection = useCreateSection();
  const reorderSections = useReorderSections();

  const sectionTree = buildSectionTree(sections);
  const selectedSection = sections.find(s => s.id === selectedSectionId);

  const handleSectionSelect = (sectionId: string) => {
    setSelectedSectionId(sectionId);
  };

  const handleSectionUpdate = (sectionId: string, data: Partial<ContractSection>) => {
    if (!contratId) return;
    updateSection.mutate({ id: sectionId, contrat_id: contratId as string, ...data });
  };

  const handleAddSection = (parentId?: string) => {
    const siblingCount = sections.filter(s => s.parent_id === (parentId || null)).length;
    createSection.mutate({
      contrat_id: contratId,
      parent_id: parentId ?? null,
      titre: "Nouvelle section",
      type: parentId ? "article" : "section",
      ordre: siblingCount,
    }, {
      onSuccess: (newSection) => {
        setSelectedSectionId(newSection.id);
      }
    });
  };

  const handleReorder = (reorderedSections: { id: string; ordre: number; parent_id: string | null }[]) => {
    reorderSections.mutate({ contrat_id: contratId, sections: reorderedSections });
  };

  // Mobile layout avec Sheet
  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        {/* Mobile toolbar */}
        <div className="flex items-center justify-between p-2 border-b bg-background/95 backdrop-blur">
          <div className="flex items-center gap-1">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <PanelLeftOpen className="h-4 w-4 mr-1" />
                  Structure
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle>Structure du contrat</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-auto">
                  <ContractBinder
                    sections={sectionTree}
                    selectedId={selectedSectionId}
                    onSelect={handleSectionSelect}
                    onAddSection={handleAddSection}
                    onReorder={handleReorder}
                    isLoading={isLoading}
                  />
                </div>
              </SheetContent>
            </Sheet>

            <Button variant="outline" size="sm" onClick={() => setShowClauseLibrary(true)}>
              <Library className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              aria-label={showPreview ? "Masquer l'aperçu" : "Afficher l'aperçu"}
              title={showPreview ? "Masquer l'aperçu" : "Afficher l'aperçu"}
              aria-pressed={showPreview}
            >
              {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button size="sm" onClick={onSave} aria-label="Enregistrer" title="Enregistrer">
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile content */}
        <div className="flex-1 overflow-hidden">
          {showPreview ? (
            <ContractPreview sections={sectionTree} titre={contratTitre} />
          ) : (
            <ContractSectionEditor
              section={selectedSection}
              onUpdate={(data) => selectedSection && handleSectionUpdate(selectedSection.id, data)}
              isSaving={updateSection.isPending}
            />
          )}
        </div>

        <ClauseLibraryDrawer
          open={showClauseLibrary}
          onOpenChange={setShowClauseLibrary}
          contratId={contratId}
          onClauseAdded={() => {}}
        />
      </div>
    );
  }

  // Desktop layout avec ResizablePanels
  return (
    <div className="flex flex-col h-full">
      {/* Desktop toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowBinder(!showBinder)}
                >
                  {showBinder ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{showBinder ? "Masquer le plan" : "Afficher le plan"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <span className="text-sm font-medium text-muted-foreground">
            {contratTitre}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowClauseLibrary(true)}>
            <Library className="h-4 w-4 mr-2" />
            Bibliothèque
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{showPreview ? "Masquer l'aperçu" : "Afficher l'aperçu"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

        </div>
      </div>

      {/* Desktop panels */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Binder panel */}
          {showBinder && (
            <>
              <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                <div className="h-full overflow-auto border-r bg-muted/30">
                  <ContractBinder
                    sections={sectionTree}
                    selectedId={selectedSectionId}
                    onSelect={handleSectionSelect}
                    onAddSection={handleAddSection}
                    onReorder={handleReorder}
                    isLoading={isLoading}
                  />
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          {/* Editor panel */}
          <ResizablePanel defaultSize={showPreview ? 45 : 80} minSize={30}>
            <div className="h-full overflow-auto">
              <ContractSectionEditor
                section={selectedSection}
                onUpdate={(data) => selectedSection && handleSectionUpdate(selectedSection.id, data)}
                isSaving={updateSection.isPending}
              />
            </div>
          </ResizablePanel>

          {/* Preview panel */}
          {showPreview && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={35} minSize={20} maxSize={50}>
                <div className="h-full overflow-auto border-l bg-muted/10">
                  <ContractPreview 
                    sections={sectionTree} 
                    titre={contratTitre}
                    highlightedSectionId={selectedSectionId}
                  />
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      <ClauseLibraryDrawer
        open={showClauseLibrary}
        onOpenChange={setShowClauseLibrary}
        contratId={contratId}
        onClauseAdded={() => {}}
      />
    </div>
  );
}
