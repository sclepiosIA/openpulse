import { useState, useMemo } from "react";
import { debug } from "@/lib/debug";
import {
  Cloud,
  Folder,
  File,
  FileText,
  Image,
  FileSpreadsheet,
  FileType,
  Download,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useNextcloudFiles, useNextcloudStatus } from "@/hooks/documents/useNextcloudFiles";
import { downloadNextcloudFile, type NextcloudFile } from "@/hooks/documents/useNextcloudStorage";
import { formatFileSize } from "@/types/documents";
import { safeFormat } from "@/lib/safeDate";
import { fr } from "date-fns/locale";

// Icône selon le type MIME
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("pdf")) return FileText;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
  if (mimeType.includes("word") || mimeType.includes("document")) return FileType;
  return File;
}

// Couleur selon le type
function getFileColor(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "text-purple-500";
  if (mimeType.includes("pdf")) return "text-red-500";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "text-green-500";
  if (mimeType.includes("word") || mimeType.includes("document")) return "text-blue-500";
  return "text-muted-foreground";
}

export function NextcloudBrowser() {
  const [currentPath, setCurrentPath] = useState("/");
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  
  const { data: status, isLoading: statusLoading } = useNextcloudStatus();
  const { data: files = [], isLoading, error, refetch, isRefetching } = useNextcloudFiles(currentPath);

  // Construire le breadcrumb
  const breadcrumbItems = useMemo(() => {
    const parts = currentPath.split("/").filter(Boolean);
    const items: { name: string; path: string }[] = [{ name: "Racine", path: "/" }];
    
    let accumPath = "";
    for (const part of parts) {
      accumPath += `/${part}`;
      items.push({ name: part, path: accumPath });
    }
    
    return items;
  }, [currentPath]);

  const handleNavigate = (file: NextcloudFile) => {
    if (file.isDirectory) {
      setCurrentPath(file.path);
    }
  };

  const handleDownload = async (file: NextcloudFile) => {
    if (file.isDirectory) return;
    
    setDownloadingPath(file.path);
    try {
      const { content } = await downloadNextcloudFile(file.path);
      
      // Créer le lien de téléchargement
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`${file.name} téléchargé`);
    } catch (err) {
      debug.error("Erreur téléchargement:", err);
      toast.error("Erreur lors du téléchargement");
    } finally {
      setDownloadingPath(null);
    }
  };

  const handleGoBack = () => {
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf("/")) || "/";
    setCurrentPath(parentPath);
  };

  // État de chargement initial
  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Nextcloud non configuré
  if (!status?.configured) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="font-medium text-lg mb-2">Nextcloud non configuré</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Les secrets Nextcloud ne sont pas configurés. Veuillez configurer NEXTCLOUD_URL, 
          NEXTCLOUD_USERNAME et NEXTCLOUD_APP_PASSWORD dans les paramètres Supabase.
        </p>
      </div>
    );
  }

  // Erreur de connexion
  if (!status?.connected || error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Cloud className="w-12 h-12 text-destructive mb-4" />
        <h3 className="font-medium text-lg mb-2">Connexion impossible</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          {status?.error || error?.message || "Impossible de se connecter au serveur Nextcloud."}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header avec breadcrumb et actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {currentPath !== "/" && (
            <Button variant="ghost" size="icon" onClick={handleGoBack} aria-label="Retour">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbItems.map((item, index) => (
                <BreadcrumbItem key={item.path}>
                  {index > 0 && <BreadcrumbSeparator><ChevronRight className="w-4 h-4" /></BreadcrumbSeparator>}
                  <BreadcrumbLink 
                    onClick={() => setCurrentPath(item.path)}
                    className={`cursor-pointer hover:text-primary ${
                      item.path === currentPath ? "font-medium text-foreground" : ""
                    }`}
                  >
                    {index === 0 ? (
                      <span className="flex items-center gap-1">
                        <Cloud className="w-4 h-4" />
                        Nextcloud
                      </span>
                    ) : item.name}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* Liste des fichiers */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Folder className="w-12 h-12 mb-4" />
                <p className="text-sm">Dossier vide</p>
              </div>
            ) : (
              <div className="divide-y">
                {files.map((file) => {
                  const FileIcon = file.isDirectory ? Folder : getFileIcon(file.mimeType);
                  const iconColor = file.isDirectory ? "text-amber-500" : getFileColor(file.mimeType);
                  const isDownloading = downloadingPath === file.path;
                  
                  return (
                    <div
                      key={file.path}
                      className={`flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${
                        file.isDirectory ? "cursor-pointer" : ""
                      }`}
                      onClick={() => file.isDirectory && handleNavigate(file)}
                    >
                      <div className={`p-2 rounded-lg ${file.isDirectory ? "bg-amber-500/10" : "bg-muted"}`}>
                        <FileIcon className={`w-5 h-5 ${iconColor}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{file.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {!file.isDirectory && <span>{formatFileSize(file.size)}</span>}
                          {file.modified && (
                            <>
                              {!file.isDirectory && <span>•</span>}
                              <span>
                                {safeFormat(file.modified, "dd MMM yyyy", { locale: fr })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {!file.isDirectory && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(file);
                          }}
                          disabled={isDownloading} aria-label="Chargement">
                          {isDownloading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      
                      {file.isDirectory && (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
