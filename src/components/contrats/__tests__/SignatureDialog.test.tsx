import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

import SignatureDialog from '../SignatureDialog';
import { supabase } from '@/integrations/supabase/client';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe('SignatureDialog', () => {
  const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    contratId: 'c1',
    contratTitre: 'Contrat test',
    clientNom: 'CHU Lyon',
    contactEmail: 'contact@chu.fr',
  };

  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('renders dialog title and description', () => {
    render(<SignatureDialog {...baseProps} />, { wrapper });
    expect(screen.getByText(/Signature électronique/i)).toBeInTheDocument();
    expect(screen.getByText(/Contrat test/)).toBeInTheDocument();
  });

  it('pre-fills the first signer with client data', () => {
    render(<SignatureDialog {...baseProps} />, { wrapper });
    expect(screen.getByDisplayValue('CHU Lyon')).toBeInTheDocument();
    expect(screen.getByDisplayValue('contact@chu.fr')).toBeInTheDocument();
  });

  it('renders expiration field with default value of 30 days', () => {
    render(<SignatureDialog {...baseProps} />, { wrapper });
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
  });

  it('renders custom message textarea', () => {
    render(<SignatureDialog {...baseProps} />, { wrapper });
    expect(screen.getByPlaceholderText(/Bonjour, merci/i)).toBeInTheDocument();
  });

  it('allows adding additional signers', () => {
    render(<SignatureDialog {...baseProps} />, { wrapper });
    fireEvent.click(screen.getByText(/Ajouter un signataire/));
    expect(screen.getAllByPlaceholderText(/Jean Dupont/i)).toHaveLength(2);
  });

  it('disables submit button when email is invalid', () => {
    render(<SignatureDialog {...baseProps} contactEmail="not-an-email" />, { wrapper });
    const btn = screen.getByRole('button', { name: /Envoyer/i });
    expect(btn).toBeDisabled();
  });
});
