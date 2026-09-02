import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DocumentFolder, FolderTreeNode, FolderShareInfo } from "@/types/folders";

type RawFolderUser = { id: string; nom: string | null; prenom: string | null; avatar_url: string | null };
type RawFolderGroup = { id: string; name: string; color: string | null };
type RawFolderPermission = {
  id: string;
  access_level: FolderShareInfo['access_level'];
  user_id: string | null;
  group_id: string | null;
  user: RawFolderUser | RawFolderUser[] | null;
  group: RawFolderGroup | RawFolderGroup[] | null;
};
type RawFolderRow = {
  id: string;
  name: string;
  parent_folder_id: string | null;
  folder_type: string;
  icon: string | null;
  color: string | null;
  position: number | null;
  created_at: string;
  is_restricted: boolean | null;
  document_folder_permissions: RawFolderPermission[] | null;
};

interface UseFolderTreeOptions {
  initialExpandedIds?: string[];
}

export function useFolderTree(options: UseFolderTreeOptions = {}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(options.initialExpandedIds || [])
  );

  // Fetch all folders at once for the tree
  const { data: allFolders = [], isLoading, error } = useQuery({
    queryKey: ['document-folders-tree'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_folders')
        .select(`
          id, name, parent_folder_id, folder_type, icon, color, position, created_at, is_restricted,
          document_folder_permissions(
            id, access_level, user_id, group_id,
            user:profiles!document_folder_permissions_user_id_fkey(id, nom, prenom, avatar_url),
            group:user_groups!document_folder_permissions_group_id_fkey(id, name, color)
          )
        `)
        .order('position')
        .order('name')
        .limit(1000);
      
      if (error) throw error;
      return (data ?? []) as unknown as RawFolderRow[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch document counts per folder
  const { data: documentCounts = {} } = useQuery({
    queryKey: ['document-folders-counts'],
    queryFn: async () => {
      // RPC server-side: GROUP BY folder_id (évite fetch 5000 docs)
      const { data, error } = await (supabase as any).rpc('get_folder_document_counts');

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((row: { folder_id: string; count: number | string }) => {
        if (row.folder_id) counts[row.folder_id] = Number(row.count) || 0;
      });
      return counts;
    },
    staleTime: 30000,
  });

  // Build tree structure
  const tree = useMemo((): FolderTreeNode[] => {
    const folderMap = new Map<string, FolderTreeNode>();
    const roots: FolderTreeNode[] = [];

    const mapPerms = (perms: RawFolderPermission[] | null | undefined): FolderShareInfo[] => {
      if (!Array.isArray(perms)) return [];
      return perms.map((p) => {
        if (p.user_id && p.user) {
          const u = Array.isArray(p.user) ? p.user[0] : p.user;
          return { type: 'user' as const, name: u ? [u.prenom, u.nom].filter(Boolean).join(' ') || 'Utilisateur' : 'Utilisateur', avatar_url: u?.avatar_url ?? undefined, access_level: p.access_level };
        }
        if (p.group_id && p.group) {
          const g = Array.isArray(p.group) ? p.group[0] : p.group;
          return { type: 'group' as const, name: g?.name || 'Groupe', color: g?.color ?? undefined, access_level: p.access_level };
        }
        return null;
      }).filter(Boolean) as FolderShareInfo[];
    };

    // Create nodes for all folders
    allFolders.forEach(folder => {
      folderMap.set(folder.id, {
        id: folder.id,
        name: folder.name,
        parentId: folder.parent_folder_id,
        folderType: folder.folder_type as FolderTreeNode['folderType'],
        icon: folder.icon,
        color: folder.color,
        children: [],
        documentsCount: documentCounts[folder.id] || 0,
        subfoldersCount: 0,
        isExpanded: expandedIds.has(folder.id),
        isLoading: false,
        sharedWith: mapPerms(folder.document_folder_permissions || []),
        isRestricted: folder.is_restricted ?? false,
      });
    });

    // Build tree by assigning children
    allFolders.forEach(folder => {
      const node = folderMap.get(folder.id)!;
      if (folder.parent_folder_id) {
        const parent = folderMap.get(folder.parent_folder_id);
        if (parent) {
          parent.children.push(node);
          parent.subfoldersCount++;
        }
      } else {
        roots.push(node);
      }
    });

    // Sort children alphabetically
    const sortChildren = (nodes: FolderTreeNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      nodes.forEach(node => sortChildren(node.children));
    };
    sortChildren(roots);

    return roots;
  }, [allFolders, documentCounts, expandedIds]);

  // Separate shared and personal folders
  const { sharedFolders, personalFolders } = useMemo(() => {
    const shared = tree.filter(f => f.folderType === 'shared');
    const personal = tree.filter(f => f.folderType !== 'shared');
    return { sharedFolders: shared, personalFolders: personal };
  }, [tree]);

  const toggleExpand = useCallback((folderId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds = new Set(allFolders.map(f => f.id));
    setExpandedIds(allIds);
  }, [allFolders]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const expandToFolder = useCallback((folderId: string) => {
    // Find the path to this folder and expand all ancestors
    const path: string[] = [];
    let currentId: string | null = folderId;
    
    const folderById = new Map(allFolders.map(f => [f.id, f]));
    
    while (currentId) {
      const folder = folderById.get(currentId);
      if (!folder) break;
      path.unshift(folder.id);
      currentId = folder.parent_folder_id;
    }

    setExpandedIds(prev => {
      const next = new Set(prev);
      path.forEach(id => next.add(id));
      return next;
    });
  }, [allFolders]);

  // Find a node by ID
  const findNode = useCallback((folderId: string): FolderTreeNode | null => {
    const search = (nodes: FolderTreeNode[]): FolderTreeNode | null => {
      for (const node of nodes) {
        if (node.id === folderId) return node;
        const found = search(node.children);
        if (found) return found;
      }
      return null;
    };
    return search(tree);
  }, [tree]);

  return {
    tree,
    sharedFolders,
    personalFolders,
    isLoading,
    error,
    expandedIds,
    toggleExpand,
    expandAll,
    collapseAll,
    expandToFolder,
    findNode,
  };
}

// Hook for Finder column view - gets folders and documents for a specific parent
export function useFolderContents(parentFolderId: string | null) {
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['document-folders', parentFolderId],
    queryFn: async () => {
      let query = supabase
        .from('document_folders')
        .select(`
          id, name, parent_folder_id, folder_type, icon, color, position, created_at, is_restricted,
          document_folder_permissions(
            id, access_level, user_id, group_id,
            user:profiles!document_folder_permissions_user_id_fkey(id, nom, prenom, avatar_url),
            group:user_groups!document_folder_permissions_group_id_fkey(id, name, color)
          )
        `)
        .order('position')
        .order('name')
        .limit(500);
      
      if (parentFolderId === null) {
        query = query.is('parent_folder_id', null);
      } else {
        query = query.eq('parent_folder_id', parentFolderId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as DocumentFolder[];
    },
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['documents-in-folder', parentFolderId],
    queryFn: async () => {
      let query = supabase
        .from('documents')
        .select('id, name, folder_id, storage_path, storage_bucket, mime_type, file_size_bytes, created_at, updated_at, created_by, deleted_at, deleted_by, is_hard_deleted, replaces_document_id, source_type, source_id, tags, color_tags, description, version_number, is_latest')
        .is('deleted_at', null)
        .eq('is_hard_deleted', false)
        .order('name')
        .limit(1000);
      
      if (parentFolderId === null) {
        query = query.is('folder_id', null);
      } else {
        query = query.eq('folder_id', parentFolderId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return {
    folders,
    documents,
    isLoading: foldersLoading || documentsLoading,
  };
}
