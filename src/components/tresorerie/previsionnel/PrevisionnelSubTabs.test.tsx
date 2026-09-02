import { render, screen, fireEvent } from '@testing-library/react';
import { PrevisionnelSubTabs } from './PrevisionnelSubTabs';

const { DummyIcon } = vi.hoisted(() => {
  const DummyIconComponent = ({ className }: { className?: string }) => {
    return <svg role="img" data-testid={`icon-${className || 'icon'}`} />;
  };

  return {
    DummyIcon: DummyIconComponent,
  };
});

vi.mock('lucide-react', () => {
  return {
    LayoutDashboard: DummyIcon,
    Calendar: DummyIcon,
    TrendingUp: DummyIcon,
  };
});

vi.mock('@/lib/utils', () => {
  return {
    cn: (...classes: unknown[]) =>
      classes
        .filter(Boolean)
        .join(' ')
        .trim(),
  };
});

describe('PrevisionnelSubTabs', () => {
  it('renders all tabs with correct labels', () => {
    const handleChange = vi.fn();

    render(<PrevisionnelSubTabs value="resume" onValueChange={handleChange} />);

    expect(screen.getByText('Résumé')).toBeInTheDocument();
    expect(screen.getByText('Trésorerie jour')).toBeInTheDocument();
    expect(screen.getByText('Trésorerie prévisionnelle')).toBeInTheDocument();
  });

  it('applies active styles based on value prop', () => {
    const handleChange = vi.fn();

    const { rerender } = render(
      <PrevisionnelSubTabs value="resume" onValueChange={handleChange} />,
    );

    const resumeButton = screen.getByText('Résumé').closest('button');
    const jourButton = screen.getByText('Trésorerie jour').closest('button');
    const prevButton = screen
      .getByText('Trésorerie prévisionnelle')
      .closest('button');

    expect(resumeButton?.className).toContain(
      'bg-background text-foreground shadow-sm',
    );
    expect(jourButton?.className).toContain(
      'text-muted-foreground hover:text-foreground hover:bg-background/50',
    );
    expect(prevButton?.className).toContain(
      'text-muted-foreground hover:text-foreground hover:bg-background/50',
    );

    rerender(
      <PrevisionnelSubTabs value="jour" onValueChange={handleChange} />,
    );

    expect(
      screen.getByText('Trésorerie jour').closest('button')?.className,
    ).toContain('bg-background text-foreground shadow-sm');
    expect(screen.getByText('Résumé').closest('button')?.className).toContain(
      'text-muted-foreground hover:text-foreground hover:bg-background/50',
    );
  });

  it('calls onValueChange with correct value when a tab is clicked', () => {
    const handleChange = vi.fn();

    render(<PrevisionnelSubTabs value="resume" onValueChange={handleChange} />);

    fireEvent.click(screen.getByText('Trésorerie jour'));
    expect(handleChange).toHaveBeenCalledWith('jour');

    fireEvent.click(screen.getByText('Trésorerie prévisionnelle'));
    expect(handleChange).toHaveBeenCalledWith('previsionnel');

    fireEvent.click(screen.getByText('Résumé'));
    expect(handleChange).toHaveBeenCalledWith('resume');
  });

  it('renders icons for each tab', () => {
    const handleChange = vi.fn();

    render(<PrevisionnelSubTabs value="resume" onValueChange={handleChange} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(3);

    buttons.forEach((button) => {
      const icon = button.querySelector('svg[role="img"]');
      expect(icon).not.toBeNull();
    });
  });
});