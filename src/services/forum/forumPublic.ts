import { supabase } from '@/integrations/supabase/client';

/**
 * Services de découplage forum public (audit Fable 5).
 */

export interface ForumAnonymousPost {
  id: string;
  titre: string;
  contenu: string;
  theme: string;
  author_nom: string | null;
  author_prenom: string | null;
  author_role: string | null;
  author_service: string | null;
  author_etablissement_nom: string | null;
  created_at: string;
  upvotes: number | null;
  nombre_commentaires: number | null;
  nombre_vues: number | null;
  epingle: boolean | null;
  resolu: boolean | null;
  archive: boolean | null;
  updated_at: string | null;
  visibilite: string | null;
  modere: boolean | null;
}

export interface ForumAnonymousComment {
  id: string;
  contenu: string;
  author_nom: string | null;
  author_prenom: string | null;
  author_etablissement_nom: string | null;
  created_at: string;
  upvotes: number | null;
}

export const fetchAnonymousForumPosts = async (): Promise<ForumAnonymousPost[]> => {
  const { data, error } = await supabase
    .from('forum_posts')
    .select('id, titre, contenu, theme, author_nom, author_prenom, author_role, author_service, author_etablissement_nom, created_at, upvotes, nombre_commentaires, nombre_vues, epingle, resolu, archive, updated_at, visibilite, modere')
    .eq('visibilite', 'global')
    .eq('modere', false)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as ForumAnonymousPost[]) || [];
};

export const fetchAnonymousForumComments = async (postId: string): Promise<ForumAnonymousComment[]> => {
  const { data, error } = await supabase
    .from('forum_comments')
    .select('id, contenu, author_nom, author_prenom, author_etablissement_nom, created_at, upvotes')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as ForumAnonymousComment[]) || [];
};

export const invokeForumAction = async (body: Record<string, unknown>): Promise<void> => {
  const { error } = await supabase.functions.invoke('forum-actions', { body });
  if (error) throw error;
};

export const fetchForumEtablissementsForPost = async (): Promise<Array<{ id: string; nom: string; ville: string | null; statut: string | null }>> => {
  const { data, error } = await supabase
    .from('etablissements')
    .select('id, nom, ville, statut')
    .in('statut', ['Production', 'Déploiement'])
    .order('nom');
  if (error) throw error;
  return (data as Array<{ id: string; nom: string; ville: string | null; statut: string | null }>) || [];
};

export const fetchForumPostAuthorIsTeamMember = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['admin', 'csm', 'chef_projet', 'commercial'])
    .maybeSingle();
  return !!data && !error;
};
