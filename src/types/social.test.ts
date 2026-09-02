/* @vitest-environment jsdom */

import { describe, it, expect } from 'vitest';
import {
  PLATFORM_LABELS,
  BRAND_DEFAULT_PLATFORMS,
  type SocialPlatform,
  type SocialConnectionStatus,
  type SocialPostStatus,
  type SocialBrand,
  type SocialConnection,
} from './social';

describe('social.ts', () => {
  it('expose les labels attendus pour chaque plateforme', () => {
    expect(PLATFORM_LABELS.facebook).toBe('Facebook');
    expect(PLATFORM_LABELS.instagram).toBe('Instagram');
    expect(PLATFORM_LABELS.linkedin).toBe('LinkedIn');
    expect(PLATFORM_LABELS.tiktok).toBe('TikTok');

    const keys = Object.keys(PLATFORM_LABELS).sort();
    expect(keys).toEqual(['facebook', 'instagram', 'linkedin', 'tiktok']);
  });

  it('définit les plateformes par défaut par marque métier', () => {
    expect(BRAND_DEFAULT_PLATFORMS['marque-ia']).toEqual(['linkedin']);
    expect(BRAND_DEFAULT_PLATFORMS['produit-b']).toEqual(['facebook', 'linkedin', 'tiktok']);
    expect(BRAND_DEFAULT_PLATFORMS['marque-mobile']).toEqual(['facebook', 'instagram', 'linkedin']);
    expect(BRAND_DEFAULT_PLATFORMS['urgentiste-masque']).toEqual(['instagram', 'facebook']);
  });

  it('n’inclut que des plateformes valides dans les mappings', () => {
    const validPlatforms: SocialPlatform[] = ['facebook', 'instagram', 'linkedin', 'tiktok'];

    Object.values(BRAND_DEFAULT_PLATFORMS).forEach((platforms) => {
      platforms.forEach((platform) => {
        expect(validPlatforms).toContain(platform);
      });
    });

    Object.keys(PLATFORM_LABELS).forEach((platform) => {
      expect(validPlatforms).toContain(platform as SocialPlatform);
    });
  });

  it('permet de typer correctement une marque sociale', () => {
    const brand: SocialBrand = {
      id: 'brand-1',
      slug: 'crok',
      name: 'Produit B',
      tagline: 'Snack social',
      description: 'Description',
      color_hex: '#ffffff',
      logo_url: '/logo.png',
      is_active: true,
      is_anonymous: false,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-02T00:00:00.000Z',
    };

    expect(brand.slug).toBe('crok');
    expect(brand.is_active).toBe(true);
    expect(brand.tagline).toBe('Snack social');
  });

  it('permet de typer correctement une connexion sociale', () => {
    const connection: SocialConnection = {
      id: 'conn-1',
      brand_id: 'brand-1',
      platform: 'linkedin',
      status: 'active',
      scopes: ['read', 'write'],
      external_user_id: 'ext-1',
      external_user_name: 'Jane Doe',
      expires_at: null,
      last_refresh_at: '2024-01-03T00:00:00.000Z',
      last_error: null,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-03T00:00:00.000Z',
    };

    expect(connection.platform).toBe('linkedin');
    expect(connection.status).toBe('active');
    expect(connection.scopes).toEqual(['read', 'write']);
  });

  it('couvre les unions de statuts attendues au runtime via tableaux typés', () => {
    const connectionStatuses: SocialConnectionStatus[] = ['active', 'expired', 'revoked', 'error', 'pending'];
    const postStatuses: SocialPostStatus[] = ['draft', 'scheduled', 'processing', 'published', 'failed', 'cancelled'];

    expect(connectionStatuses).toContain('expired');
    expect(connectionStatuses).toContain('pending');
    expect(postStatuses).toContain('published');
    expect(postStatuses).toContain('failed');
    expect(connectionStatuses).toHaveLength(5);
    expect(postStatuses).toHaveLength(6);
  });
});