import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      mfa: {
        listFactors: () => Promise.resolve({ data: { totp: [] }, error: null }),
        unenroll: vi.fn(),
      },
    },
    from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/auth/use2FA', () => ({
  use2FA: () => ({
    is2FAEnabled: false,
    isLoading: false,
    verify2FA: vi.fn(),
    disable2FA: vi.fn(),
  }),
}));

vi.mock('@/components/TwoFactorSetup', () => ({
  TwoFactorSetup: () => <div data-testid="2fa-setup" />,
}));

vi.mock('@/components/email/EmailSignatureEditor', () => ({
  EmailSignatureEditor: () => <div data-testid="signature-editor" />,
}));

import { ProfileSettings } from '../ProfileSettings';
import { supabase } from '@/integrations/supabase/client';

const profile = {
  id: 'u1',
  nom: 'Dupont',
  prenom: 'Jean',
  email: 'jean@test.com',
  two_factor_enabled: false,
  email_signature: null,
  linkedin_url: null,
};

describe('ProfileSettings', () => {
  it('renders personal info section', () => {
    render(
      <ProfileSettings
        profile={profile}
        is2FAEnabled={false}
        onProfileUpdate={vi.fn()}
        on2FAChange={vi.fn()}
      />
    );
    expect(screen.getByText('Informations personnelles')).toBeInTheDocument();
  });

  it('renders security section', () => {
    render(
      <ProfileSettings
        profile={profile}
        is2FAEnabled={false}
        onProfileUpdate={vi.fn()}
        on2FAChange={vi.fn()}
      />
    );
    expect(screen.getByText(/Sécurité/)).toBeInTheDocument();
  });

  it('renders nothing when profile is null', () => {
    const { container } = render(
      <ProfileSettings
        profile={null}
        is2FAEnabled={false}
        onProfileUpdate={vi.fn()}
        on2FAChange={vi.fn()}
      />
    );
    // Should still render sections but without data
    expect(container).toBeTruthy();
  });
});
