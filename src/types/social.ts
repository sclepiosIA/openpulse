export type SocialPlatform = 'facebook' | 'instagram' | 'linkedin' | 'tiktok';
export type SocialConnectionStatus = 'active' | 'expired' | 'revoked' | 'error' | 'pending';
export type SocialPostStatus = 'draft' | 'scheduled' | 'processing' | 'published' | 'failed' | 'cancelled';

export interface SocialBrand {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  color_hex: string | null;
  logo_url: string | null;
  is_active: boolean;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
}

export interface SocialConnection {
  id: string;
  brand_id: string;
  platform: SocialPlatform;
  status: SocialConnectionStatus;
  scopes: string[];
  external_user_id: string | null;
  external_user_name: string | null;
  expires_at: string | null;
  last_refresh_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
};

/** Plateformes attendues par défaut pour chaque marque (selon cadrage produit). */
export const BRAND_DEFAULT_PLATFORMS: Record<string, SocialPlatform[]> = {
  'marque-ia': ['linkedin'],
  'produit-b': ['facebook', 'linkedin', 'tiktok'],
  'marque-mobile': ['facebook', 'instagram', 'linkedin'],
  'urgentiste-masque': ['instagram', 'facebook'],
};
