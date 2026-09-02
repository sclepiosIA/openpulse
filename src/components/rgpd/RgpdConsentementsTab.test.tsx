import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RgpdConsentementsTab } from './RgpdConsentementsTab';

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
  }) => (
    <span data-variant={variant ?? 'default'} className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th scope="col">{children}</th>,
  TableCell: ({
    children,
    colSpan,
    className,
  }: {
    children: React.ReactNode;
    colSpan?: number;
    className?: string;
  }) => (
    <td colSpan={colSpan} className={className}>
      {children}
    </td>
  ),
}));

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = makeQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('RgpdConsentementsTab', () => {
  it('affiche le message vide quand consentements est undefined', () => {
    render(
      <Wrapper>
        <RgpdConsentementsTab consentements={undefined} />
      </Wrapper>
    );

    expect(screen.getByText('Registre des consentements')).toBeInTheDocument();
    expect(screen.getByText('Suivi des consentements collectés par finalité')).toBeInTheDocument();

    const msg = screen.getByText('Aucun consentement enregistré');
    expect(msg).toBeInTheDocument();
    expect(msg.closest('td')?.getAttribute('colspan')).toBe('5');

    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Finalité' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Statut' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Mode' })).toBeInTheDocument();
  });

  it('affiche une ligne par consentement avec statut et date formatée', () => {
    const consentements = [
      {
        id: 'c1',
        personne_email: 'alice@example.fr',
        finalite: 'Newsletter',
        est_accorde: true,
        date_retrait: null,
        date_consentement: '2024-02-03T10:11:12.000Z',
        mode_collecte: 'Formulaire',
      },
      {
        id: 'c2',
        personne_email: 'bob@example.fr',
        finalite: 'Statistiques',
        est_accorde: false,
        date_retrait: '2024-03-01T00:00:00.000Z',
        date_consentement: '2024-01-15T08:00:00.000Z',
        mode_collecte: 'Import',
      },
    ];

    render(
      <Wrapper>
        <RgpdConsentementsTab consentements={consentements} />
      </Wrapper>
    );

    const table = screen.getByRole('table');

    const rowAlice = within(table).getByText('alice@example.fr').closest('tr');
    expect(rowAlice).not.toBeNull();
    if (rowAlice) {
      expect(within(rowAlice).getByText('Newsletter')).toBeInTheDocument();
      const badge = within(rowAlice).getByText('Accordé');
      expect(badge).toBeInTheDocument();
      expect((badge as HTMLElement).getAttribute('data-variant')).toBe('default');
      expect(within(rowAlice).getByText('03/02/2024')).toBeInTheDocument();
      expect(within(rowAlice).getByText('Formulaire')).toBeInTheDocument();
    }

    const rowBob = within(table).getByText('bob@example.fr').closest('tr');
    expect(rowBob).not.toBeNull();
    if (rowBob) {
      expect(within(rowBob).getByText('Statistiques')).toBeInTheDocument();
      const badge = within(rowBob).getByText('Retiré');
      expect(badge).toBeInTheDocument();
      expect((badge as HTMLElement).getAttribute('data-variant')).toBe('secondary');
      expect(within(rowBob).getByText('15/01/2024')).toBeInTheDocument();
      expect(within(rowBob).getByText('Import')).toBeInTheDocument();
    }

    expect(screen.queryByText('Aucun consentement enregistré')).not.toBeInTheDocument();
  });

  it('affiche le message vide quand consentements est un tableau vide', () => {
    render(
      <Wrapper>
        <RgpdConsentementsTab consentements={[]} />
      </Wrapper>
    );

    expect(screen.getByText('Aucun consentement enregistré')).toBeInTheDocument();
    expect(screen.queryByText('Accordé')).not.toBeInTheDocument();
    expect(screen.queryByText('Retiré')).not.toBeInTheDocument();
  });
});