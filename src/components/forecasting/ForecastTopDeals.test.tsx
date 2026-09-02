import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children?: ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children?: ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <td className={className}>{children}</td>
  ),
  TableHead: ({ children }: { children?: ReactNode }) => <th>{children}</th>,
  TableHeader: ({ children }: { children?: ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children }: { children?: ReactNode }) => <tr>{children}</tr>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span data-testid="badge">{children}</span>,
}));

vi.mock('lucide-react', () => ({
  Flame: () => null,
  AlertTriangle: () => null,
  Trophy: () => null,
}));

import { ForecastTopDeals } from './ForecastTopDeals';

interface Deal {
  id: string;
  nom: string;
  statut: string;
  probability: number;
  deal_value: number;
  weighted_value: number;
  closing_date: string;
}

const makeDeal = (overrides: Partial<Deal> = {}): Deal => ({
  id: 'd1',
  nom: 'Hôtel Test',
  statut: 'en_negociation',
  probability: 75,
  deal_value: 120000,
  weighted_value: 90000,
  closing_date: '2099-12-31',
  ...overrides,
});

const normalize = (s: string) => s.replace(/[\u202f\u00a0]/g, ' ');

const renderComp = (props: { data: Deal[]; hot?: Deal[]; atRisk?: Deal[] }) =>
  render(
    <MemoryRouter>
      <ForecastTopDeals
        data={props.data as never}
        hot={props.hot as never}
        atRisk={props.atRisk as never}
      />
    </MemoryRouter>
  );

describe('ForecastTopDeals', () => {
  it('affiche les trois sections avec leurs titres', () => {
    renderComp({ data: [] });
    expect(screen.getByText(/Deals chauds \(probabilité ≥ 65 %\)/)).toBeTruthy();
    expect(screen.getByText(/Deals à risque \(closing dépassé\)/)).toBeTruthy();
    expect(screen.getByText(/Top 10 deals \(pondéré\)/)).toBeTruthy();
    expect(screen.getAllByTestId('card')).toHaveLength(3);
  });

  it('affiche les messages vides quand aucune donnée', () => {
    renderComp({ data: [] });
    expect(screen.getByText('Aucun deal chaud sur la période.')).toBeTruthy();
    expect(screen.getByText('Aucun deal en retard 🎉')).toBeTruthy();
    expect(screen.getByText('Aucun deal sur la période.')).toBeTruthy();
  });

  it('affiche les deals du top 10 avec lien, statut humanisé et probabilité', () => {
    renderComp({ data: [makeDeal()] });
    const link = screen.getByRole('link', { name: 'Hôtel Test' });
    expect(link.getAttribute('href')).toBe('/etablissements/d1');
    expect(screen.getByText('en negociation')).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();
  });

  it('formate les montants en euros (valeur brute et pondérée)', () => {
    renderComp({ data: [makeDeal({ deal_value: 120000, weighted_value: 90000 })] });
    const cells = screen.getAllByRole('cell').map((c) => normalize(c.textContent ?? ''));
    expect(cells).toContain('120 000 €');
    expect(cells).toContain('90 000 €');
  });

  it('formate la date de closing en français', () => {
    renderComp({ data: [makeDeal({ closing_date: '2025-03-15' })] });
    const expected = new Date('2025-03-15').toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const cells = screen.getAllByRole('cell').map((c) => c.textContent ?? '');
    expect(cells).toContain(expected);
  });

  it('met en évidence les deals en retard dans la section à risque', () => {
    renderComp({
      data: [],
      atRisk: [makeDeal({ id: 'late1', nom: 'Resto Retard', closing_date: '2020-01-01' })],
    });
    expect(screen.getByRole('link', { name: 'Resto Retard' })).toBeTruthy();
    const overdueCell = screen
      .getAllByRole('cell')
      .find((c) => (c.className || '').includes('text-destructive'));
    expect(overdueCell).toBeTruthy();
    expect(overdueCell?.className).toContain('font-medium');
  });

  it('ne met pas en évidence les retards dans le top 10 (highlightOverdue désactivé)', () => {
    renderComp({ data: [makeDeal({ closing_date: '2020-01-01' })] });
    const destructive = screen
      .getAllByRole('cell')
      .filter((c) => (c.className || '').includes('text-destructive'));
    expect(destructive).toHaveLength(0);
  });

  it('affiche les deals chauds dans la première section', () => {
    renderComp({
      data: [],
      hot: [makeDeal({ id: 'hot1', nom: 'Spa Chaud', probability: 80 })],
    });
    expect(screen.getByRole('link', { name: 'Spa Chaud' })).toBeTruthy();
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.queryByText('Aucun deal chaud sur la période.')).toBeNull();
  });
});