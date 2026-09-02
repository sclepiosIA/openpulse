import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';

const mockProfile = {
  id: 'p1',
  nom: 'Dupont',
  prenom: 'Jean',
  email: 'jean@test.com',
  two_factor_enabled: false,
  created_at: '2025-01-01',
  updated_at: '2025-01-01',
  email_signature: null,
  avatar_url: null,
  linkedin_url: null,
};

const createChainableProxy = (resolvedValue: any) => {
  const handler: ProxyHandler<any> = {
    get: (_t, prop) => {
      if (prop === 'then') return (resolve: any) => resolve(resolvedValue);
      return new Proxy(() => {}, handler);
    },
    apply: () => new Proxy({}, handler),
  };
  return new Proxy({}, handler);
};

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'profiles') return createChainableProxy({ data: mockProfile, error: null });
      if (table === 'user_roles') return createChainableProxy({ data: { role: 'admin' }, error: null });
      return createChainableProxy({ data: null, error: null });
    },
  },
}));

vi.mock('@/hooks/auth/use2FA', () => ({
  use2FA: () => ({
    check2FAEnabled: vi.fn().mockResolvedValue(false),
  }),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/components/profile/ProfileHero', () => ({
  ProfileHero: ({ profile }: any) => React.createElement('div', null, `Hero: ${profile.prenom} ${profile.nom}`),
}));

vi.mock('@/components/profile/ProfileSettings', () => ({
  ProfileSettings: () => React.createElement('div', null, 'Profile Settings'),
}));

vi.mock('@/components/profile/EmailSettings', () => ({
  EmailSettings: () => React.createElement('div', null, 'Email Settings'),
}));

vi.mock('@/components/settings/NotificationPreferences', () => ({
  NotificationPreferences: () => React.createElement('div', null, 'Notification Preferences'),
}));

describe('Profil Page', () => {
  const renderProfil = async () => {
    const Profil = (await import('@/pages/Profil')).default;
    return render(
      React.createElement(MemoryRouter, null,
        React.createElement(Profil)
      )
    );
  };

  it('should render profile hero after loading', async () => {
    await renderProfil();
    await waitFor(() => {
      expect(screen.getByText('Hero: Jean Dupont')).toBeInTheDocument();
    });
  });

  it('should render tabs', async () => {
    await renderProfil();
    await waitFor(() => {
      expect(screen.getByText('Profil')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
  });

  it('should show back button', async () => {
    await renderProfil();
    await waitFor(() => {
      expect(screen.getByText('Retour aux paramètres')).toBeInTheDocument();
    });
  });
});
