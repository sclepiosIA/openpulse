import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';

const mockNavigate = vi.fn();
const mockToast = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/hooks/shared/useAppConfig', () => ({
  useInfraUrls: () => ({ cdn_url: 'https://cdn.test.com' }),
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      verifyOtp: vi.fn().mockResolvedValue({ data: { session: null }, error: { message: 'expired' } }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe('ResetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderReset = async (path = '/auth/reset-password') => {
    const ResetPassword = (await import('@/pages/ResetPassword')).default;
    return render(
      React.createElement(MemoryRouter, { initialEntries: [path] },
        React.createElement(ResetPassword)
      )
    );
  };

  it('should show invalid state when no recovery params', async () => {
    await renderReset();
    await waitFor(() => {
      expect(screen.getByText('Lien invalide ou expiré')).toBeInTheDocument();
    });
  });

  it('should show return to login button on invalid', async () => {
    await renderReset();
    await waitFor(() => {
      expect(screen.getByText('Retour à la connexion')).toBeInTheDocument();
    });
  });

  it('should navigate to auth on return button click', async () => {
    await renderReset();
    await waitFor(() => {
      const btn = screen.getByText('Retour à la connexion');
      fireEvent.click(btn);
      expect(mockNavigate).toHaveBeenCalledWith('/auth');
    });
  });

  it('should show help text on invalid page', async () => {
    await renderReset();
    await waitFor(() => {
      expect(screen.getByText(/Demandez un nouveau lien/)).toBeInTheDocument();
    });
  });
});
