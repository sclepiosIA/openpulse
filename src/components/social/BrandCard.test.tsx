/* @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrandCard } from './BrandCard';

const { SOCIAL } = vi.hoisted(() => ({
  SOCIAL: {
    BRAND_DEFAULT_PLATFORMS: {
      nike: ['instagram', 'tiktok', 'youtube'],
      single: ['instagram'],
    },
  },
}));

vi.mock('@/types/social', () => ({
  BRAND_DEFAULT_PLATFORMS: SOCIAL.BRAND_DEFAULT_PLATFORMS,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 data-testid="card-title" className={className}>
      {children}
    </h3>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: string }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

vi.mock('lucide-react', () => ({
  EyeOff: ({ className }: { className?: string }) => (
    <svg data-testid="eye-off-icon" className={className} />
  ),
}));

vi.mock('./PlatformBadge', () => ({
  PlatformBadge: ({ platform, variant }: { platform: string; variant: string }) => (
    <span data-testid="platform-badge" data-platform={platform} data-variant={variant}>
      {platform}:{variant}
    </span>
  ),
}));

describe('BrandCard', () => {
  it('affiche les informations de la marque, le badge anonyme, le tagline et les plateformes connectées', () => {
    const brand = {
      id: 'b1',
      slug: 'nike',
      name: 'Nike',
      color_hex: '#112233',
      is_anonymous: true,
      tagline: 'Just test it',
    };

    const connections = [
      { id: 'c1', platform: 'instagram', status: 'active' },
      { id: 'c2', platform: 'tiktok', status: 'inactive' },
      { id: 'c3', platform: 'youtube', status: 'active' },
      { id: 'c4', platform: 'instagram', status: 'active' },
    ];

    const { container } = render(<BrandCard brand={brand} connections={connections} />);

    expect(screen.getByText('Nike')).toBeInTheDocument();
    expect(screen.getByText('Just test it')).toBeInTheDocument();
    expect(screen.getByText('Anonyme')).toBeInTheDocument();
    expect(screen.getByTestId('eye-off-icon')).toBeInTheDocument();

    const topBar = container.querySelector('.h-1\\.5') as HTMLElement | null;
    expect(topBar).not.toBeNull();
    expect(topBar?.style.backgroundColor).toBe('rgb(17, 34, 51)');

    const badges = screen.getAllByTestId('platform-badge');
    expect(badges).toHaveLength(3);

    expect(screen.getByText('instagram:default')).toHaveAttribute('data-variant', 'default');
    expect(screen.getByText('tiktok:outline')).toHaveAttribute('data-variant', 'outline');
    expect(screen.getByText('youtube:default')).toHaveAttribute('data-variant', 'default');

    expect(screen.getByText('2/3 comptes connectés')).toBeInTheDocument();
  });

  it('utilise la couleur par défaut, masque le badge anonyme et gère le singulier correctement', () => {
    const brand = {
      id: 'b2',
      slug: 'single',
      name: 'Solo Brand',
      color_hex: null,
      is_anonymous: false,
      tagline: '',
    };

    const connections = [{ id: 'c5', platform: 'instagram', status: 'active' }];

    const { container } = render(<BrandCard brand={brand} connections={connections} />);

    expect(screen.getByText('Solo Brand')).toBeInTheDocument();
    expect(screen.queryByText('Anonyme')).not.toBeInTheDocument();
    expect(screen.queryByText('Just test it')).not.toBeInTheDocument();

    const topBar = container.querySelector('.h-1\\.5') as HTMLElement | null;
    expect(topBar).not.toBeNull();
    expect(topBar?.getAttribute('style')).toContain('hsl(var(--primary))');

    expect(screen.getByText('instagram:default')).toHaveAttribute('data-variant', 'default');
    expect(screen.getByText('1/1 compte connecté')).toBeInTheDocument();
  });

  it('affiche 0 plateforme attendue quand le slug ne correspond à aucune configuration', () => {
    const brand = {
      id: 'b3',
      slug: 'unknown',
      name: 'Unknown Brand',
      color_hex: '#abcdef',
      is_anonymous: false,
      tagline: 'No defaults',
    };

    const connections = [{ id: 'c6', platform: 'instagram', status: 'active' }];

    render(<BrandCard brand={brand} connections={connections} />);

    expect(screen.getByText('Unknown Brand')).toBeInTheDocument();
    expect(screen.getByText('No defaults')).toBeInTheDocument();
    expect(screen.queryAllByTestId('platform-badge')).toHaveLength(0);
    expect(screen.getByText('1/0 compte connecté')).toBeInTheDocument();
  });
});