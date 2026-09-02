import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FolderTreeNode } from "@/types/folders";

export interface NextcloudTreeNode extends FolderTreeNode {
  nextcloudPath: string;
  isNextcloud: true;
}

export interface NextcloudFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastModified: string;
  mimeType: string;
}

/**
 * Hook pour gérer l'arborescence des dossiers Nextcloud
 */
export function useNextcloudFolderTree() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Récupérer les dossiers à la racine Nextcloud
  const { data: rootFolders = [], isLoading, error } = useQuery({
    queryKey: ["nextcloud-tree-root"],
    queryFn: async (): Promise<NextcloudFile[]> => {
      const { data, error } = await supabase.functions.invoke("nextcloud-files", {
        body: { action: "list", path: "/" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Filtrer uniquement les dossiers
      return (data as NextcloudFile[] || []).filter(f => f.isDirectory);
    },
    staleTime: 60000, // 1 minute
    retry: 1,
  });

  // Construire l'arbre de dossiers
  const tree: NextcloudTreeNode[] = useMemo(() => {
    return rootFolders.map(folder => ({
      id: `nextcloud:${folder.path}`,
      name: folder.name,
      parentId: null,
      folderType: 'personal' as const,
      icon: null,
      color: null,
      documentsCount: 0,
      subfoldersCount: 0,
      isExpanded: expandedIds.has(`nextcloud:${folder.path}`),
      isLoading: false,
      children: [],
      nextcloudPath: folder.path,
      isNextcloud: true as const,
    }));
  }, [rootFolders, expandedIds]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds = new Set(rootFolders.map(f => `nextcloud:${f.path}`));
    setExpandedIds(allIds);
  }, [rootFolders]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  return {
    tree,
    isLoading,
    error,
    expandedIds,
    toggleExpand,
    expandAll,
    collapseAll,
  };
}

/**
 * Hook pour récupérer le contenu d'un dossier Nextcloud spécifique
 */
export function useNextcloudFolderContents(path: string) {
  return useQuery({
    queryKey: ["nextcloud-folder-contents", path],
    queryFn: async (): Promise<{ folders: NextcloudFile[]; files: NextcloudFile[] }> => {
      const { data, error } = await supabase.functions.invoke("nextcloud-files", {
        body: { action: "list", path },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const items = (data as NextcloudFile[]) || [];
      return {
        folders: items.filter(f => f.isDirectory).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
        files: items.filter(f => !f.isDirectory).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      };
    },
    staleTime: 30000, // 30 secondes
    retry: 1,
  });
}

/**
 * Utilitaire pour extraire le path Nextcloud depuis un folderId
 */
export function getNextcloudPathFromId(folderId: string): string | null {
  if (folderId.startsWith("nextcloud:")) {
    return folderId.replace("nextcloud:", "");
  }
  return null;
}

/**
 * Utilitaire pour créer un folderId Nextcloud
 */
export function createNextcloudFolderId(path: string): string {
  return `nextcloud:${path}`;
}

/**
 * Vérifier si un folderId est un ID Nextcloud
 */
export function isNextcloudFolderId(folderId: string | null): boolean {
  return folderId !== null && folderId.startsWith("nextcloud:");
}
