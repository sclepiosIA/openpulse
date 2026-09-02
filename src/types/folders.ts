export type FolderType = 'personal' | 'etablissement' | 'system' | 'shared';

export interface FolderShareInfo {
  type: 'user' | 'group';
  name: string;
  avatar_url?: string | null;
  color?: string | null;
  access_level: string;
}

export interface DocumentFolder {
  id: string;
  name: string;
  parent_folder_id: string | null;
  owner_id: string;
  folder_type: FolderType;
  related_etablissement_id: string | null;
  icon: string | null;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface FolderWithSharing extends DocumentFolder {
  is_restricted: boolean;
  permissions_count: number;
  shared_with: FolderShareInfo[];
}

export interface FolderWithCounts extends DocumentFolder {
  documents_count: number;
  subfolders_count: number;
}

export interface FolderBreadcrumbItem {
  id: string | null;
  name: string;
}

export interface FolderTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  folderType: FolderType;
  icon: string | null;
  color: string | null;
  children: FolderTreeNode[];
  documentsCount: number;
  subfoldersCount: number;
  isExpanded: boolean;
  isLoading: boolean;
  sharedWith?: FolderShareInfo[];
  isRestricted?: boolean;
}

export interface CreateFolderData {
  name: string;
  parent_folder_id?: string | null;
  folder_type?: FolderType;
  related_etablissement_id?: string | null;
  icon?: string;
  color?: string;
}

export interface UpdateFolderData {
  name?: string;
  parent_folder_id?: string | null;
  icon?: string;
  color?: string;
  position?: number;
}

export type DocumentViewStyle = 'tree' | 'finder' | 'classic';
