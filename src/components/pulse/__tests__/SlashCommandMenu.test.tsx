import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SlashCommandMenu } from '../SlashCommandMenu';

vi.mock('@/hooks/ui/useSlashCommands', () => ({
  useSlashCommands: (query: string) => ({
    commands: query === 'empty' ? [] : [
      { id: 'task', label: 'Créer une tâche', description: 'Crée une tâche', icon: 'CheckSquare', action: 'task' },
      { id: 'poll', label: 'Créer un sondage', description: 'Crée un sondage', icon: 'BarChart', action: 'poll' },
    ],
  }),
}));

describe('SlashCommandMenu', () => {
  const defaultProps = {
    query: '',
    position: { top: 100, left: 200 },
    onSelect: vi.fn(),
    onClose: vi.fn(),
    visible: true,
  };

  it('renders commands when visible', () => {
    render(<SlashCommandMenu {...defaultProps} />);
    expect(screen.getByText('Crée une tâche')).toBeInTheDocument();
    expect(screen.getByText('Crée un sondage')).toBeInTheDocument();
  });

  it('renders nothing when not visible', () => {
    const { container } = render(<SlashCommandMenu {...defaultProps} visible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no commands', () => {
    const { container } = render(<SlashCommandMenu {...defaultProps} query="empty" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders descriptions', () => {
    render(<SlashCommandMenu {...defaultProps} />);
    expect(screen.getByText('Crée une tâche')).toBeInTheDocument();
  });
});
