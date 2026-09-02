import { supabase } from '@/integrations/supabase/client';

/**
 * Services du domaine Social — extraction pour découplage Supabase (audit Fable 5 · action 180.1).
 * Toutes les invocations d'edge functions / RPC / tables `social_*` transitent par ce module.
 */

export type SocialPlatform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok';

export interface SyncSocialResult {
  connections?: number;
  [k: string]: unknown;
}

export const syncSocialBrand = async (brandId?: string): Promise<SyncSocialResult> => {
  const { data, error } = await supabase.functions.invoke('social-sync', {
    body: brandId ? { brand_id: brandId } : {},
  });
  if (error) throw error;
  return (data ?? {}) as SyncSocialResult;
};

export type CommentAction = 'reply' | 'hide' | 'handle' | 'unhandle';

export const performCommentAction = async (
  commentId: string,
  action: CommentAction,
  message?: string,
): Promise<void> => {
  const { data, error } = await supabase.functions.invoke('social-comment-reply', {
    body: { comment_id: commentId, action, message },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
};

export interface PublishSocialResult {
  published?: Record<string, unknown>;
  errors?: Record<string, unknown>;
}

export const publishSocialNow = async (
  message: string,
  accountIds: string[],
  mediaUrl?: string,
): Promise<PublishSocialResult> => {
  const { data, error } = await supabase.functions.invoke('social-publish', {
    body: { message, media_url: mediaUrl || undefined, account_ids: accountIds },
  });
  if (error) throw error;
  return (data ?? {}) as PublishSocialResult;
};

export interface ScheduleSocialInput {
  brandId: string;
  message: string;
  accountIds: string[];
  scheduledAt: string;
  mediaUrl?: string;
  createdBy?: string;
}

export const scheduleSocialPost = async (input: ScheduleSocialInput): Promise<void> => {
  const { error } = await (supabase as any).from('social_scheduled_posts').insert({
    brand_id: input.brandId,
    message: input.message,
    media_paths: input.mediaUrl ? [input.mediaUrl] : [],
    target_account_ids: input.accountIds,
    scheduled_at: new Date(input.scheduledAt).toISOString(),
    status: 'scheduled',
    created_by: input.createdBy,
  });
  if (error) throw error;
};

export const startSocialOAuth = async (
  brandId: string,
  platform: SocialPlatform,
  returnTo: string,
): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('social-oauth-start', {
    body: { brand_id: brandId, platform, return_to: returnTo },
  });
  if (error) throw error;
  const url = (data as any)?.auth_url;
  if (!url) throw new Error("URL d'autorisation manquante");
  return url as string;
};
