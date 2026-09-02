import { Database } from '@/integrations/supabase/types';

export type ForumPostRow = Database['public']['Tables']['forum_posts']['Row'];
export type ForumPostInsert = Database['public']['Tables']['forum_posts']['Insert'];
export type ForumPostUpdate = Database['public']['Tables']['forum_posts']['Update'];

export type ForumTheme = 'pmsi' | 'smr' | 'urgences' | 'completion_dossier' | 'dictee_vocale' | 'astuces' | 'bugs' | 'support' | 'autre';
export type ForumVisibilite = 'etablissement' | 'global';

export interface ForumPost {
  id: string;
  user_id: string | null;
  etablissement_id?: string | null;
  titre: string;
  contenu: string;
  theme: string;
  tags?: string[] | null;
  visibilite: string;
  upvotes: number | null;
  nombre_commentaires: number | null;
  nombre_vues: number | null;
  epingle: boolean | null;
  resolu: boolean | null;
  archive: boolean | null;
  modere?: boolean | null;
  modere_par?: string | null;
  modere_at?: string | null;
  raison_moderation?: string | null;
  author_nom?: string | null;
  author_prenom?: string | null;
  author_role?: string | null;
  author_service?: string | null;
  author_etablissement_nom?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForumPostFilters {
  theme?: string;
  visibilite?: ForumVisibilite;
  sortBy?: 'recent' | 'popular' | 'mostCommented' | 'unresolved';
}

export interface ForumPostWithAuthor extends ForumPost {
  etablissement_users: {
    nom: string;
    prenom: string;
    fonction: string;
  };
}

export interface VoteResult {
  action: 'added' | 'removed';
  postId: string;
}

export interface MutationContext {
  previousPosts?: ForumPost[];
  previousPost?: ForumPostWithAuthor;
}
