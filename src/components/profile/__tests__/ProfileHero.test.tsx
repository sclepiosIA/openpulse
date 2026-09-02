import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: { storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) } },
}));

vi.mock('@/components/ui/UserAvatarUpload', () => ({
  UserAvatarUpload: () => <div data-testid="avatar-upload" />,
}));

import { ProfileHero } from '../ProfileHero';
import { supabase } from '@/integrations/supabase/client';

const profile = {
  id: 'u1',
  nom: 'Dupont',
  prenom: 'Jean',
  email: 'jean@test.com',
  avatar_url: null,
  created_at: '2025-06-15T00:00:00Z',
  two_factor_enabled: false,
};

describe('ProfileHero', () => {
  it('renders user name', () => {
    render(<ProfileHero profile={profile} userRole="csm" is2FAEnabled={false} />);
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
  });

  it('renders role badge', () => {
    render(<ProfileHero profile={profile} userRole="admin" is2FAEnabled={false} />);
    expect(screen.getByText('Administrateur')).toBeInTheDocument();
  });

  it('renders 2FA badge when enabled', () => {
    render(<ProfileHero profile={profile} userRole="csm" is2FAEnabled={true} />);
    expect(screen.getByText('2FA activé')).toBeInTheDocument();
  });

  it('renders nothing when profile is null', () => {
    const { container } = render(<ProfileHero profile={null} userRole="csm" is2FAEnabled={false} />);
    expect(container.innerHTML).toBe('');
  });
});
