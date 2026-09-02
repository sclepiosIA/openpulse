// @vitest-environment jsdom

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EmailEstablishmentHoverCard } from './EmailEstablishmentHoverCard';

const {
  PREVIEW_LOADING,
  PREVIEW_SUCCESS,
  PREVIEW_ERROR_NULL,
  mockUseEmailEstablishmentPreview,
} = vi.hoisted(() => ({
  PREVIEW_LOADING: {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
  },
  PREVIEW_SUCCESS: {
    data: {
      nom: 'Clinique Saint Martin',
      ville: 'Lyon',
      statut: 'Production',
      progression: 72,
      engagement_score: 88,
      taches: [
        {
          titre: 'Appeler le directeur',
          echeance: '2025-01-15T00:00:00.000Z',
        },
      ],
    },
    isLoading: false,
    isError: false,
    error: null,
  },
  PREVIEW_ERROR_NULL: {
    data: null,
    isLoading: false,
    isError: true,
    error: { message: 'x' },
  },
  mockUseEmailEstablishmentPreview: vi.fn(),
}));

vi.mock('@/hooks/email/useEmailEstablishmentPreview', () => ({
  useEmailEstablishmentPreview: mockUseEmailEstablishmentPreview,
}));

vi.mock('@/components/ui/hover-card', () => ({
  HoverCard: ({ children }: { children: React.ReactNode }) => <div data-testid="hover-card">{children}</div>,
  HoverCardTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="hover-card-trigger">{children}</div>,
  HoverCardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="hover-card-content">{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value?: number; className?: string }) => (
    <div data-testid="progress" data-value={String(value ?? 0)} className={className} />
  ),
}));

vi.mock('lucide-react', () => ({
  Building2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-building" {...props} />,
  TrendingUp: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-trending" {...props} />,
  Calendar: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-calendar" {...props} />,
  Target: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-target" {...props} />,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('EmailEstablishmentHoverCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche seulement les enfants pendant le chargement', () => {
    mockUseEmailEstablishmentPreview.mockReturnValue(PREVIEW_LOADING);

    const Wrapper = createWrapper();

    render(
      <EmailEstablishmentHoverCard etablissementId="eta-1">
        <button type="button">Voir établissement</button>
      </EmailEstablishmentHoverCard>,
      { wrapper: Wrapper }
    );

    expect(mockUseEmailEstablishmentPreview).toHaveBeenCalledWith('eta-1');
    expect(screen.getByRole('button', { name: 'Voir établissement' })).toBeInTheDocument();
    expect(screen.queryByTestId('hover-card-content')).not.toBeInTheDocument();
    expect(screen.queryByText('Clinique Saint Martin')).not.toBeInTheDocument();
  });

  it('affiche les informations métier réelles de prévisualisation en succès', () => {
    mockUseEmailEstablishmentPreview.mockReturnValue(PREVIEW_SUCCESS);

    const Wrapper = createWrapper();

    render(
      <EmailEstablishmentHoverCard etablissementId="eta-2">
        <span>Survoler</span>
      </EmailEstablishmentHoverCard>,
      { wrapper: Wrapper }
    );

    expect(mockUseEmailEstablishmentPreview).toHaveBeenCalledWith('eta-2');
    expect(screen.getByTestId('hover-card')).toBeInTheDocument();
    expect(screen.getByTestId('hover-card-content')).toBeInTheDocument();

    expect(screen.getByText('Clinique Saint Martin')).toBeInTheDocument();
    expect(screen.getByText('Lyon')).toBeInTheDocument();

    const badge = screen.getByTestId('badge');
    expect(badge).toHaveTextContent('Production');
    expect(badge.className).toContain('bg-emerald-100');

    expect(screen.getByText('Progression')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '72');

    expect(screen.getByText('Engagement:')).toBeInTheDocument();
    expect(screen.getByText('88/100')).toBeInTheDocument();

    expect(screen.getByText('Prochaine étape:')).toBeInTheDocument();
    expect(screen.getByText('Appeler le directeur')).toBeInTheDocument();
    expect(screen.getByText('Échéance: 15/01/2025')).toBeInTheDocument();
  });

  it('en cas d’erreur sans données, ne rend que les enfants', () => {
    mockUseEmailEstablishmentPreview.mockReturnValue(PREVIEW_ERROR_NULL);

    const Wrapper = createWrapper();

    render(
      <EmailEstablishmentHoverCard etablissementId="eta-3">
        <span>Fallback enfant</span>
      </EmailEstablishmentHoverCard>,
      { wrapper: Wrapper }
    );

    expect(mockUseEmailEstablishmentPreview).toHaveBeenCalledWith('eta-3');
    expect(screen.getByText('Fallback enfant')).toBeInTheDocument();
    expect(screen.queryByTestId('hover-card-content')).not.toBeInTheDocument();
    expect(screen.queryByText('Progression')).not.toBeInTheDocument();
    expect(screen.queryByText('Engagement:')).not.toBeInTheDocument();
  });
});