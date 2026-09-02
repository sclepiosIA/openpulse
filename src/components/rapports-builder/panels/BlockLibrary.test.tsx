// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlockLibrary } from './BlockLibrary';

const { buttonCalls, scrollAreaCalls } = vi.hoisted(() => ({
  buttonCalls: vi.fn(),
  scrollAreaCalls: vi.fn(),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: string;
  }) => {
    buttonCalls({ className, variant });
    return (
      <button type="button" data-variant={variant} className={className} onClick={onClick}>
        {children}
      </button>
    );
  },
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => {
    scrollAreaCalls({ className });
    return (
      <div data-testid="scroll-area" className={className}>
        {children}
      </div>
    );
  },
}));

vi.mock('lucide-react', () => {
  const makeIcon = (name: string) =>
    ({ className }: { className?: string }) =>
      <svg data-testid={`icon-${name}`} className={className} />;
  return {
    Hash: makeIcon('hash'),
    BarChart3: makeIcon('bar-chart-3'),
    LineChart: makeIcon('line-chart'),
    PieChart: makeIcon('pie-chart'),
    Table2: makeIcon('table-2'),
    TrendingDown: makeIcon('trending-down'),
    FileText: makeIcon('file-text'),
  };
});

describe('BlockLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche la bibliothèque complète avec les libellés et descriptions métier attendus', () => {
    const onAdd = vi.fn();

    render(<BlockLibrary onAdd={onAdd} />);

    expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
    expect(screen.getByText('Bibliothèque')).toBeInTheDocument();

    expect(screen.getByText('KPI')).toBeInTheDocument();
    expect(screen.getByText('Barres')).toBeInTheDocument();
    expect(screen.getByText('Lignes')).toBeInTheDocument();
    expect(screen.getByText('Donut')).toBeInTheDocument();
    expect(screen.getByText('Tableau')).toBeInTheDocument();
    expect(screen.getByText('Funnel')).toBeInTheDocument();
    expect(screen.getByText('Texte')).toBeInTheDocument();

    expect(screen.getByText('Indicateur unique')).toBeInTheDocument();
    expect(screen.getByText('Graphique en barres')).toBeInTheDocument();
    expect(screen.getByText('Évolution temporelle')).toBeInTheDocument();
    expect(screen.getByText('Répartition circulaire')).toBeInTheDocument();
    expect(screen.getByText('Liste de données')).toBeInTheDocument();
    expect(screen.getByText('Entonnoir de conversion')).toBeInTheDocument();
    expect(screen.getByText('Texte libre / titre')).toBeInTheDocument();

    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(buttonCalls).toHaveBeenCalledTimes(7);
    expect(scrollAreaCalls).toHaveBeenCalledTimes(1);
    expect(scrollAreaCalls).toHaveBeenCalledWith({ className: 'h-full' });
  });

  it('déclenche onAdd avec le type exact de widget pour chaque bloc cliqué', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(<BlockLibrary onAdd={onAdd} />);

    await user.click(screen.getByRole('button', { name: /KPI/i }));
    await user.click(screen.getByRole('button', { name: /Barres/i }));
    await user.click(screen.getByRole('button', { name: /Lignes/i }));
    await user.click(screen.getByRole('button', { name: /Donut/i }));
    await user.click(screen.getByRole('button', { name: /Tableau/i }));
    await user.click(screen.getByRole('button', { name: /Funnel/i }));
    await user.click(screen.getByRole('button', { name: /Texte/i }));

    expect(onAdd).toHaveBeenNthCalledWith(1, 'kpi');
    expect(onAdd).toHaveBeenNthCalledWith(2, 'bar_chart');
    expect(onAdd).toHaveBeenNthCalledWith(3, 'line_chart');
    expect(onAdd).toHaveBeenNthCalledWith(4, 'donut_chart');
    expect(onAdd).toHaveBeenNthCalledWith(5, 'table');
    expect(onAdd).toHaveBeenNthCalledWith(6, 'funnel');
    expect(onAdd).toHaveBeenNthCalledWith(7, 'markdown');
    expect(onAdd).toHaveBeenCalledTimes(7);
  });

  it('rend les icônes et transmet le style attendu aux composants UI', () => {
    const onAdd = vi.fn();

    render(<BlockLibrary onAdd={onAdd} />);

    expect(screen.getByTestId('icon-hash')).toHaveClass('h-4', 'w-4', 'mr-3', 'shrink-0', 'text-primary');
    expect(screen.getByTestId('icon-bar-chart-3')).toHaveClass('h-4', 'w-4', 'mr-3', 'shrink-0', 'text-primary');
    expect(screen.getByTestId('icon-line-chart')).toHaveClass('h-4', 'w-4', 'mr-3', 'shrink-0', 'text-primary');
    expect(screen.getByTestId('icon-pie-chart')).toHaveClass('h-4', 'w-4', 'mr-3', 'shrink-0', 'text-primary');
    expect(screen.getByTestId('icon-table-2')).toHaveClass('h-4', 'w-4', 'mr-3', 'shrink-0', 'text-primary');
    expect(screen.getByTestId('icon-trending-down')).toHaveClass('h-4', 'w-4', 'mr-3', 'shrink-0', 'text-primary');
    expect(screen.getByTestId('icon-file-text')).toHaveClass('h-4', 'w-4', 'mr-3', 'shrink-0', 'text-primary');

    const buttons = screen.getAllByRole('button');
    for (const button of buttons) {
      expect(button).toHaveAttribute('data-variant', 'outline');
      expect(button).toHaveClass('w-full', 'justify-start', 'h-auto', 'py-3');
    }

    expect(buttonCalls).toHaveBeenNthCalledWith(1, {
      className: 'w-full justify-start h-auto py-3',
      variant: 'outline',
    });
  });
});