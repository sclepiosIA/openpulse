export type PermissionLevel = 'view' | 'comment' | 'edit' | 'admin';

export interface UserGroup {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface UserGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  added_by: string | null;
  added_at: string | null;
  profile?: {
    id: string;
    nom: string | null;
    prenom: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export interface UserGroupWithMembers extends UserGroup {
  members: UserGroupMember[];
  member_count: number;
}

export interface DocumentShare {
  id: string;
  document_id: string;
  shared_with_user_id: string | null;
  shared_with_group_id: string | null;
  permission_level: PermissionLevel;
  shared_by: string;
  shared_at: string;
  expires_at: string | null;
  // Joined data
  shared_with_user?: {
    id: string;
    nom: string | null;
    prenom: string | null;
    email: string;
    avatar_url: string | null;
  };
  shared_with_group?: UserGroup;
  shared_by_user?: {
    id: string;
    nom: string | null;
    prenom: string | null;
  };
}

export interface FolderPermission {
  id: string;
  folder_id: string;
  user_id: string | null;
  group_id: string | null;
  access_level: PermissionLevel;
  granted_by: string;
  created_at: string | null;
  // Joined data
  user?: {
    id: string;
    nom: string | null;
    prenom: string | null;
    email: string;
    avatar_url: string | null;
  };
  group?: UserGroup;
}

export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  view: 'Lecture',
  comment: 'Commentaire',
  edit: 'Édition',
  admin: 'Admin',
};
