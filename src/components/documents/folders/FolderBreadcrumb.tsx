import { ChevronRight, Home, Cloud } from "lucide-react";
import { useFolderBreadcrumb } from "@/hooks/documents/useFolders";
import { isNextcloudFolderId, getNextcloudPathFromId } from "@/hooks/documents/useNextcloudFolderTree";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";

interface FolderBreadcrumbProps {
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
}

// Construire le breadcrumb pour Nextcloud
function buildNextcloudBreadcrumb(folderId: string): { id: string | null; name: string }[] {
  const path = getNextcloudPathFromId(folderId) || "/";
  const parts = path.split("/").filter(Boolean);
  
  const items: { id: string | null; name: string }[] = [
    { id: null, name: "Mes documents" },
    { id: "nextcloud:/", name: "Nextcloud" },
  ];
  
  let currentPath = "";
  for (const part of parts) {
    currentPath += "/" + part;
    items.push({
      id: `nextcloud:${currentPath}`,
      name: part,
    });
  }
  
  return items;
}

export function FolderBreadcrumb({ currentFolderId, onNavigate }: FolderBreadcrumbProps) {
  // Si c'est un chemin Nextcloud, construire le breadcrumb manuellement
  const isNextcloud = currentFolderId && isNextcloudFolderId(currentFolderId);
  const nextcloudBreadcrumb = isNextcloud ? buildNextcloudBreadcrumb(currentFolderId) : null;
  
  const { data: breadcrumb, isLoading } = useFolderBreadcrumb(isNextcloud ? null : currentFolderId);

  // Utiliser le breadcrumb Nextcloud ou le breadcrumb normal
  const finalBreadcrumb = nextcloudBreadcrumb || breadcrumb;

  if (isLoading && !isNextcloud) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-16" />
      </div>
    );
  }

  if (!finalBreadcrumb || finalBreadcrumb.length === 0) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {finalBreadcrumb.map((item, index) => {
          const isLast = index === finalBreadcrumb.length - 1;
          const isNextcloudItem = item.id?.startsWith("nextcloud:") || item.name === "Nextcloud";
          
          return (
            <BreadcrumbItem key={item.id ?? 'root'}>
              {index > 0 && <BreadcrumbSeparator><ChevronRight className="h-4 w-4" /></BreadcrumbSeparator>}
              
              {isLast ? (
                <BreadcrumbPage className="flex items-center gap-1.5">
                  {index === 0 && <Home className="h-4 w-4" />}
                  {isNextcloudItem && index === 1 && <Cloud className="h-4 w-4 text-blue-500" />}
                  {item.name}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  className="flex items-center gap-1.5 cursor-pointer hover:text-foreground"
                  onClick={() => onNavigate(item.id)}
                >
                  {index === 0 && <Home className="h-4 w-4" />}
                  {isNextcloudItem && index === 1 && <Cloud className="h-4 w-4 text-blue-500" />}
                  {item.name}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
