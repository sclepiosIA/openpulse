import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockUseEnrichProspect, mockUseEnrichmentHistory, mockFrom } = vi.hoisted(() => {
  const mockUseEnrichProspect = vi.fn();
  const mockUseEnrichmentHistory = vi.fn();

  const builder: any = {};
  const chain = () => builder;
  Object.assign(builder, {
    select: chain,
    eq: chain,
    gte: chain,
    lte: chain,
    in: chain,
    order: chain,
    limit: chain,
    insert: chain,
    update: chain,
    delete: chain,
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (...args: any[]) => Promise.resolve({ data: null, error: null }).then(...args),
    catch: (...args: any[]) => Promise.resolve({ data: null, error: null }).catch(...args),
  });
  const mockFrom = vi.fn(() => builder);

  return { mockUseEnrichProspect, mockUseEnrichmentHistory, mockFrom };
});

vi.mock('@/hooks/crm/useEnrichProspect', () => ({
  useEnrichProspect: mockUseEnrichProspect,
  useEnrichmentHistory: mockUseEnrichmentHistory,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...rest }: any) => <button {...rest}>{children}</button>,
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <span>{children}</span>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('lucide-react', () => ({
  Sparkles: (props: any) => <svg data-testid="sparkles" {...props} />,
  Loader2: (props: any) => <svg data-testid="loader" {...props} />,
  Clock: (props: any) => <svg data-testid="clock" {...props} />,
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

import { EnrichProspectButton } from './EnrichProspectButton';

describe('EnrichProspectButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEnrichProspect.mockReturnValue({ isPending: false, mutate: vi.fn() });
    mockUseEnrichmentHistory.mockReturnValue({ data: [] });
  });

  it('affiche le loader et désactive le bouton quand la mutation est en cours', () => {
    const mutate = vi.fn();
    mockUseEnrichProspect.mockReturnValue({ isPending: true, mutate });
    mockUseEnrichmentHistory.mockReturnValue({ data: [] });

    renderWithClient(
      <EnrichProspectButton etablissementId="e1" enrichmentStatus={null} enrichmentAt={null} />
    );

    const btn = screen.getByRole('button', { name: /Enrichir/i });
    expect(btn).toBeDisabled();
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('au succès: affiche Re-enrichir, le résumé des champs mis à jour et appelle mutate avec le bon id', () => {
    const mutate = vi.fn();
    mockUseEnrichProspect.mockReturnValue({ isPending: false, mutate });
    mockUseEnrichmentHistory.mockReturnValue({
      data: [
        {
          success: true,
          fields_updated: ['siret', 'naf', 'dirigeants'],
          error_message: null,
        },
      ],
    });

    renderWithClient(
      <EnrichProspectButton
        etablissementId="e1"
        enrichmentStatus="enriched"
        enrichmentAt="2023-01-01T12:00:00"
      />
    );

    const btn = screen.getByRole('button', { name: /Re-enrichir/i });
    expect(btn).toBeEnabled();

    fireEvent.click(btn);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith('e1');

    expect(screen.getByText(/3 champ\(s\) mis à jour/i)).toBeInTheDocument();
    expect(screen.getByText(/Dernier\s*:/i)).toBeInTheDocument();
  });

  it('affiche le message d’erreur de la dernière tentative échouée', () => {
    const mutate = vi.fn();
    mockUseEnrichProspect.mockReturnValue({ isPending: false, mutate });
    mockUseEnrichmentHistory.mockReturnValue({
      data: [
        {
          success: false,
          fields_updated: [],
          error_message: 'service indisponible',
        },
      ],
    });

    renderWithClient(
      <EnrichProspectButton etablissementId="e2" enrichmentStatus={null} enrichmentAt={null} />
    );

    expect(screen.getByText(/Échec\s*:\s*service indisponible/i)).toBeInTheDocument();
  });
});