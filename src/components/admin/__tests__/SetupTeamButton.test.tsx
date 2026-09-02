import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockInvoke = vi.fn().mockResolvedValue({ data: { success: true, results: [{ email: 'a@b.com', status: 'created', profileId: '1' }] }, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/supabaseErrorSanitizer', () => ({ sanitizeSupabaseError: (e: any) => e?.message || 'Error' }));
vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));

import { SetupTeamButton } from '../SetupTeamButton';
import { supabase } from '@/integrations/supabase/client';

describe('SetupTeamButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders button with label', () => {
    render(<SetupTeamButton />);
    expect(screen.getByText('Créer membres équipe')).toBeInTheDocument();
  });

  it('calls edge function on click', async () => {
    render(<SetupTeamButton />);
    fireEvent.click(screen.getByText('Créer membres équipe'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('setup-team-members', { body: {} }));
  });

  it('shows loading state during processing', async () => {
    mockInvoke.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<SetupTeamButton />);
    fireEvent.click(screen.getByText('Créer membres équipe'));
    expect(await screen.findByText('Création en cours...')).toBeInTheDocument();
  });

  it('disables button while loading', async () => {
    mockInvoke.mockImplementation(() => new Promise(() => {}));
    render(<SetupTeamButton />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toBeDisabled());
  });
});
