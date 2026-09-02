import { memo } from "react";
import { debug } from "@/lib/debug";
import {
  FolderOpen,
  FileIcon,
  Loader2,
  Download,
  Cloud,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  FileCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useNextcloudFolderContents,
  getNextcloudPathFromId,
  createNextcloudFolderId,
} from "@/hooks/documents/useNextcloudFolderTree";
import { getNextcloudDownloadUrl } from "@/hooks/documents/useNextcloudStorage";
import { formatFileSize } from "@/types/documents";
import { safeFormat } from "@/lib/safeDate";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface NextcloudContentPaneProps {
  folderId: string; // Format: "nextcloud:/path/to/folder"
  viewMode: 'grid' | 'list';
  onFolderClick: (folderId: string) => void;
  className?: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("word")) return FileText;
  if (mimeType.includes("javascript") || mimeType.includes("json") || mimeType.includes("html") || mimeType.includes("css")) return FileCode;
  return File;
}

export const NextcloudContentPane = memo(function NextcloudContentPane({
  folderId,
  viewMode,
  onFolderClick,
  className,
}: NextcloudContentPaneProps) {
  const path = getNextcloudPathFromId(folderId) || "/";
  const { data, isLoading, error } = useNextcloudFolderContents(path);

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const url = await getNextcloudDownloadUrl(filePath);
      // Ouvrir dans un nouvel onglet ou télécharger
      window.open(url, '_blank');
      toast.success(`Téléchargement de ${fileName}`);
    } catch (err) {
      debug.error("Erreur téléchargement:", err);
      toast.error("Erreur lors du téléchargement");
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-muted-foreground", className)}>
        <Cloud className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm font-medium mb-1">Erreur de connexion Nextcloud</p>
        <p className="text-xs">{error instanceof Error ? error.message : "Erreur inconnue"}</p>
      </div>
    );
  }

  const { folders = [], files = [] } = data || {};
  const isEmpty = folders.length === 0 && files.length === 0;

  if (isEmpty) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-muted-foreground", className)}>
        <FolderOpen className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm font-medium mb-1">Ce dossier Nextcloud est vide</p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="p-4 space-y-4">
        {/* Folders section */}
        {folders.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Dossiers</h3>
              <Badge variant="secondary" className="text-xs">
                {folders.length}
              </Badge>
            </div>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {folders.map(folder => (
                  <div
                    key={folder.path}
                    onClick={() => onFolderClick(createNextcloudFolderId(folder.path))}
                    className="group cursor-pointer rounded-lg border bg-card p-3 hover:bg-accent/50 hover:border-primary/50 transition-all"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <FolderOpen className="h-8 w-8 text-primary" />
                      <span className="text-xs font-medium text-center line-clamp-2">
                        {folder.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {folders.map(folder => (
                  <div
                    key={folder.path}
                    onClick={() => onFolderClick(createNextcloudFolderId(folder.path))}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm font-medium flex-1 truncate">
                      {folder.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {safeFormat(folder.lastModified, "dd MMM yyyy", { locale: fr })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Separator */}
        {folders.length > 0 && files.length > 0 && (
          <div className="border-t" />
        )}

        {/* Files section */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileIcon className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Fichiers</h3>
              <Badge variant="secondary" className="text-xs">
                {files.length}
              </Badge>
            </div>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {files.map(file => {
                  const IconComponent = getFileIcon(file.mimeType);
                  return (
                    <div
                      key={file.path}
                      className="group rounded-lg border bg-card p-4 hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <IconComponent className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {safeFormat(file.lastModified, "dd MMM yyyy", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(file.path, file.name)}
                          className="gap-1.5 text-xs"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Télécharger
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1">
                {files.map(file => {
                  const IconComponent = getFileIcon(file.mimeType);
                  return (
                    <div
                      key={file.path}
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors group"
                    >
                      <IconComponent className="h-5 w-5 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {safeFormat(file.lastModified, "dd MMM", { locale: fr })}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDownload(file.path, file.name)} aria-label="Télécharger">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );
});
