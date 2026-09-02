import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { MockCard, MockZap, MockGitBranch, MockClock, MockSparkles } = vi.hoisted(() => {
  const Card = ({ children, className, onClick, ...rest }: { children?: React.ReactNode; className?: string; onClick?: React.MouseEventHandler<HTMLDivElement> }) => (
    <div data-testid="card" role="button" className={className} onClick={onClick} {...rest}>
      {children}
    </div>
  );
  const Icon = (props: Record<string, unknown>) => <svg data-icon {...props} />;
  return {
    MockCard: Card,
    MockZap: Icon,
    MockGitBranch: Icon,
    MockClock: Icon,
    MockSparkles: Icon,
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: MockCard,
}));

vi.mock('lucide-react', () => ({
  Zap: MockZap,
  GitBranch: MockGitBranch,
  Clock: MockClock,
  Sparkles: MockSparkles,
}));

import { NodeLibrary } from './NodeLibrary';

describe('NodeLibrary', () => {
  it('renders headings, items, descriptions and tip', () => {
    const onAddNode = vi.fn();
    render(<NodeLibrary onAddNode={onAddNode} />);

    expect(screen.getByText('Blocs disponibles')).toBeInTheDocument();
    expect(screen.getByText('Cliquez pour ajouter un bloc au workflow.')).toBeInTheDocument();

    // Items labels
    expect(screen.getByText('Condition')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Délai')).toBeInTheDocument();

    // Items descriptions
    expect(screen.getByText('Branche if/else')).toBeInTheDocument();
    expect(screen.getByText('Effet métier')).toBeInTheDocument();
    expect(screen.getByText('Attendre X temps')).toBeInTheDocument();

    // Icons rendered
    expect(screen.getAllByTestId('card').length).toBe(3);
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByTestId('card').reduce((acc, card) => acc + card.querySelectorAll('[data-icon]').length, 0)).toBeGreaterThanOrEqual(3);

    // Tip block
    expect(screen.getByText('💡 Astuce')).toBeInTheDocument();
    expect(screen.getByText('{{trigger.field}}')).toBeInTheDocument();
  });

  it('calls onAddNode with the correct type when clicking each item', async () => {
    const user = userEvent.setup();
    const onAddNode = vi.fn();
    render(<NodeLibrary onAddNode={onAddNode} />);

    await user.click(screen.getByText('Condition'));
    await user.click(screen.getByText('Action'));
    await user.click(screen.getByText('Délai'));

    expect(onAddNode).toHaveBeenCalledTimes(3);
    expect(onAddNode).toHaveBeenNthCalledWith(1, 'condition');
    expect(onAddNode).toHaveBeenNthCalledWith(2, 'action');
    expect(onAddNode).toHaveBeenNthCalledWith(3, 'delay');
  });
})