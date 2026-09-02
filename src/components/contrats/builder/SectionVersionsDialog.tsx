import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History, RotateCcw, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useSectionVersions, useRestoreVersion, type SectionVersion } from "@/hooks/contracts/useContractSections";

interface SectionVersionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string | undefined;
  sectionTitle?: string;
}

export function SectionVersionsDialog({
  open,
  onOpenChange,
  sectionId,
  sectionTitle,
}: SectionVersionsDialogProps) {
  const { data: versions = [], isLoading } = useSectionVersions(open ? sectionId : undefined);
  const restoreVersion = useRestoreVersion();

  const handleRestore = async (version: SectionVersion) => {
    if (!sectionId) return;
    if (!confirm(`Restaurer la version #${version.version_number} ? Le contenu actuel sera remplacé (une nouvelle version sera créée).`)) return;
    await restoreVersion.mutateAsync({ sectionId, version });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique des versions
          </DialogTitle>
          <DialogDescription>
            {sectionTitle ? `Section : ${sectionTitle}` : "Snapshots automatiques de cette section."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={`section-versions-skeleton-${i}`} className="h-20 w-full" />)}
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucune version enregistrée pour le moment.</p>
              <p className="text-xs mt-1">Les versions sont créées automatiquement lors des modifications.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((version) => {
                const preview = (version.contenu_html || "").replace(/<[^>]+>/g, "").trim().slice(0, 160);
                return (
                  <div
                    key={version.id}
                    className="border rounded-lg p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">v{version.version_number}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(version.created_at), { addSuffix: true, locale: fr })}
                          </span>
                        </div>
                        {version.titre && (
                          <p className="text-sm font-medium truncate">{version.titre}</p>
                        )}
                        {preview && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{preview}…</p>
                        )}
                        {version.note && (
                          <p className="text-xs italic text-muted-foreground mt-1">Note : {version.note}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestore(version)}
                        disabled={restoreVersion.isPending}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Restaurer
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
