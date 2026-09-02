import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProspectScoreBadge } from './ProspectScoreBadge';

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: { children?: React.ReactNode; className?: string; variant?: string }) => (
    <div data-testid="badge" data-variant={variant} className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children?: React.ReactNode }) => <div data-testid="tooltip-provider">{children}</div>,
  Tooltip: ({ children }: { children?: React.ReactNode }) => <div data-testid="tooltip-root">{children}</div>,
  TooltipTrigger: ({ children }: { children?: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
  TooltipContent: ({
    children,
    side,
    className,
  }: {
    children?: React.ReactNode;
    side?: string;
    className?: string;
  }) => (
    <div data-testid="tooltip-content" data-side={side} className={className}>
      {children}
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  TrendingUp: ({ className }: { className?: string }) => <svg data-testid="icon-trending-up" className={className} />,
  ArrowUp: ({ className }: { className?: string }) => <svg data-testid="icon-arrow-up" className={className} />,
  ArrowDown: ({ className }: { className?: string }) => <svg data-testid="icon-arrow-down" className={className} />,
  Minus: ({ className }: { className?: string }) => <svg data-testid="icon-minus" className={className} />,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}));

describe('ProspectScoreBadge', () => {
  it('returns null when score is null', () => {
    const { container } = render(<ProspectScoreBadge score={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when score is undefined', () => {
    const { container } = render(<ProspectScoreBadge score={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a simple badge without tooltip when only score is provided', () => {
    render(<ProspectScoreBadge score={72} />);

    const badge = screen.getByTestId('badge');
    expect(badge).toHaveTextContent('72/100');
    expect(badge.className).toContain('bg-emerald-100');
    expect(badge.className).toContain('text-emerald-800');
    expect(screen.getByTestId('icon-trending-up')).toBeInTheDocument();
    expect(screen.queryByTestId('tooltip-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-arrow-up')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-arrow-down')).not.toBeInTheDocument();
  });

  it('renders compact score value when compact is true', () => {
    render(<ProspectScoreBadge score={55} compact />);

    expect(screen.getByTestId('badge')).toHaveTextContent('55');
    expect(screen.getByTestId('badge')).not.toHaveTextContent('55/100');
    expect(screen.getByTestId('badge').className).toContain('bg-amber-100');
  });

  it('applies cold color classes for lower score tiers', () => {
    const { rerender } = render(<ProspectScoreBadge score={35} />);
    expect(screen.getByTestId('badge').className).toContain('bg-orange-100');
    expect(screen.getByTestId('badge').className).toContain('text-orange-800');

    rerender(<ProspectScoreBadge score={10} />);
    expect(screen.getByTestId('badge').className).toContain('bg-red-100');
    expect(screen.getByTestId('badge').className).toContain('text-red-800');
  });

  it('adds custom className to badge', () => {
    render(<ProspectScoreBadge score={64} className="custom-class" />);
    expect(screen.getByTestId('badge').className).toContain('custom-class');
    expect(screen.getByTestId('badge').className).toContain('font-mono');
  });

  it('shows upward trend on badge and detailed tooltip content for positive velocity and factors', () => {
    render(
      <ProspectScoreBadge
        score={80}
        velocity={1.26}
        behavioralScore={42}
        factors={[
          { label: 'Emails ouverts', points: 15, detail: 'A ouvert plusieurs emails' },
          { label: 'Inactivité', points: -8, detail: 'Aucune réponse récente' },
        ]}
      />
    );

    expect(screen.getByTestId('tooltip-provider')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();

    const badge = screen.getByTestId('badge');
    expect(badge).toHaveTextContent('80/100');
    expect(screen.getAllByTestId('icon-arrow-up').length).toBe(2);

    expect(screen.getByText('Score de conversion : 80/100 — Chaud')).toBeInTheDocument();
    expect(screen.getByText('Score comportemental')).toBeInTheDocument();
    expect(screen.getByText('42/50')).toBeInTheDocument();
    expect(screen.getByText('Vélocité')).toBeInTheDocument();
    expect(screen.getByText('+1.3/sem')).toBeInTheDocument();

    expect(screen.getByText('Emails ouverts')).toBeInTheDocument();
    expect(screen.getByText('+15')).toBeInTheDocument();
    expect(screen.getByText('Inactivité')).toBeInTheDocument();
    expect(screen.getByText('-8')).toBeInTheDocument();

    const positivePoints = screen.getByText('+15');
    const negativePoints = screen.getByText('-8');
    expect(positivePoints.className).toContain('text-emerald-600');
    expect(negativePoints.className).toContain('text-red-500');
  });

  it('shows downward trend and label Tiède for mid score', () => {
    render(<ProspectScoreBadge score={55} velocity={-2.04} />);

    expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
    expect(screen.getByText('Score de conversion : 55/100 — Tiède')).toBeInTheDocument();
    expect(screen.getAllByTestId('icon-arrow-down').length).toBe(2);
    expect(screen.getByText('-2/sem')).toBeInTheDocument();
  });

  it('shows stable velocity with minus icon in tooltip but no trend icon in badge when absolute velocity is below 0.5', () => {
    render(<ProspectScoreBadge score={32} velocity={0.2} behavioralScore={18} />);

    expect(screen.getByText('Score de conversion : 32/100 — Froid')).toBeInTheDocument();
    expect(screen.getByText('18/50')).toBeInTheDocument();
    expect(screen.getByText('stable')).toBeInTheDocument();
    expect(screen.getByTestId('icon-minus')).toBeInTheDocument();

    const badge = screen.getByTestId('badge');
    expect(badge).toHaveTextContent('32/100');
    expect(screen.queryByTestId('icon-arrow-up')).not.toBeInTheDocument();
    expect(screen.queryByTestId('icon-arrow-down')).not.toBeInTheDocument();
  });

  it('renders tooltip with only behavioral score when provided without factors or velocity', () => {
    render(<ProspectScoreBadge score={20} behavioralScore={9} />);

    expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
    expect(screen.getByText('Score de conversion : 20/100 — Très froid')).toBeInTheDocument();
    expect(screen.getByText('Score comportemental')).toBeInTheDocument();
    expect(screen.getByText('9/50')).toBeInTheDocument();
    expect(screen.queryByText('Vélocité')).not.toBeInTheDocument();
  });
});