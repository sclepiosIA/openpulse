/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { ForecastByCommercial } from './ForecastByCommercial';

const { progressCalls, rows } = vi.hoisted(() => ({
  progressCalls: [] as Array<{ value: number; className?: string }>,
  rows: [
    {
      user_id: 'u1',
      display_name: 'Alice Martin',
      deals_count: 3,
      raw: 10000,
      weighted: 4000,
      won: 2000,
    },
    {
      user_id: 'u2',
      display_name: 'Bob Durand',
      deals_count: 1,
      raw: 5000,
      weighted: 2500,
      won: 0,
    },
  ] as Array<{
    user_id: string | null;
    display_name: string;
    deals_count: number;
    raw: number;
    weighted: number;
    won: number;
  }>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section data-testid="card">{children}</section>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) => <th className={className}>{children}</th>,
  TableCell: ({ children, className }: { children: React.ReactNode; className?: string }) => <td className={className}>{children}</td>,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => {
    progressCalls.push({ value, className });
    return <div data-testid="progress" data-value={String(value)} className={className} />;
  },
}));

describe('ForecastByCommercial', () => {
  beforeEach(() => {
    progressCalls.length = 0;
  });

  it('affiche le titre et le message vide quand il n’y a aucune donnée', () => {
    render(<ForecastByCommercial data={[]} />);

    expect(screen.getByText('Forecast par commercial')).toBeInTheDocument();
    expect(screen.getByText('Aucun deal sur la période.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('progress')).toHaveLength(0);
  });

  it('affiche les colonnes et les valeurs métier formatées pour chaque commercial', () => {
    render(<ForecastByCommercial data={rows} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Commercial')).toBeInTheDocument();
    expect(screen.getByText('Deals')).toBeInTheDocument();
    expect(screen.getByText('Pipeline brut')).toBeInTheDocument();
    expect(screen.getByText('Pipeline pondéré')).toBeInTheDocument();
    expect(screen.getByText('Progression')).toBeInTheDocument();
    expect(screen.getByText('Gagné')).toBeInTheDocument();

    const aliceRow = screen.getByText('Alice Martin').closest('tr');
    const bobRow = screen.getByText('Bob Durand').closest('tr');

    expect(aliceRow).not.toBeNull();
    expect(bobRow).not.toBeNull();

    if (aliceRow) {
      const rowScope = within(aliceRow);
      expect(rowScope.getByRole('cell', { name: 'Alice Martin' })).toBeInTheDocument();
      expect(rowScope.getByRole('cell', { name: '3' })).toBeInTheDocument();
      expect(rowScope.getByText((content) => content.includes('10') && content.includes('000') && content.includes('€'))).toBeInTheDocument();
      expect(rowScope.getByText((content) => content.includes('4') && content.includes('000') && content.includes('€'))).toBeInTheDocument();
      expect(rowScope.getByText((content) => content.includes('2') && content.includes('000') && content.includes('€'))).toBeInTheDocument();
    }

    if (bobRow) {
      const rowScope = within(bobRow);
      expect(rowScope.getByRole('cell', { name: 'Bob Durand' })).toBeInTheDocument();
      expect(rowScope.getByRole('cell', { name: '1' })).toBeInTheDocument();
      expect(rowScope.getByText((content) => content.includes('5') && content.includes('000') && content.includes('€'))).toBeInTheDocument();
      expect(rowScope.getByText((content) => content.includes('2') && content.includes('500') && content.includes('€'))).toBeInTheDocument();
      expect(rowScope.getByText((content) => content === '0 €' || content === '0 €')).toBeInTheDocument();
    }
  });

  it('calcule la progression en pourcentage par rapport au pipeline pondéré maximal', () => {
    const data = [
      {
        user_id: 'u1',
        display_name: 'Alice Martin',
        deals_count: 3,
        raw: 10000,
        weighted: 4000,
        won: 2000,
      },
      {
        user_id: 'u2',
        display_name: 'Bob Durand',
        deals_count: 1,
        raw: 5000,
        weighted: 1000,
        won: 500,
      },
      {
        user_id: null,
        display_name: 'Sans commercial',
        deals_count: 2,
        raw: 7000,
        weighted: 0,
        won: 0,
      },
    ];

    render(<ForecastByCommercial data={data} />);

    const progressBars = screen.getAllByTestId('progress');
    expect(progressBars).toHaveLength(3);
    expect(progressCalls).toHaveLength(3);

    expect(progressBars[0]).toHaveAttribute('data-value', '100');
    expect(progressBars[1]).toHaveAttribute('data-value', '25');
    expect(progressBars[2]).toHaveAttribute('data-value', '0');

    expect(progressCalls[0]).toEqual({ value: 100, className: 'h-2' });
    expect(progressCalls[1]).toEqual({ value: 25, className: 'h-2' });
    expect(progressCalls[2]).toEqual({ value: 0, className: 'h-2' });
  });

  it('utilise un maximum de 1 pour éviter une division invalide quand tous les pondérés valent 0', () => {
    const data = [
      {
        user_id: 'u1',
        display_name: 'Alice Martin',
        deals_count: 2,
        raw: 3000,
        weighted: 0,
        won: 0,
      },
      {
        user_id: 'u2',
        display_name: 'Bob Durand',
        deals_count: 4,
        raw: 9000,
        weighted: 0,
        won: 1000,
      },
    ];

    render(<ForecastByCommercial data={data} />);

    const progressBars = screen.getAllByTestId('progress');
    expect(progressBars).toHaveLength(2);
    expect(progressCalls).toHaveLength(2);
    expect(progressBars[0]).toHaveAttribute('data-value', '0');
    expect(progressBars[1]).toHaveAttribute('data-value', '0');
  });

  it('utilise la clé de secours basée sur l’index quand user_id est nul', () => {
    const data = [
      {
        user_id: null,
        display_name: 'Sans commercial',
        deals_count: 2,
        raw: 7000,
        weighted: 1200,
        won: 300,
      },
    ];

    render(<ForecastByCommercial data={data} />);

    expect(screen.getByText('Sans commercial')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '2' })).toBeInTheDocument();
    expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '100');
  });
});