import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionsDropdown, ActionItem } from '../ActionsDropdown';
import { Trash2, Edit } from 'lucide-react';

describe('ActionsDropdown', () => {
  const actions: ActionItem[] = [
    { label: 'Modifier', icon: Edit, onClick: vi.fn() },
    { label: 'Supprimer', icon: Trash2, onClick: vi.fn(), destructive: true },
  ];

  it('renders trigger button', () => {
    render(<ActionsDropdown actions={actions} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders nothing when all actions hidden', () => {
    const hiddenActions = actions.map(a => ({ ...a, hidden: true }));
    const { container } = render(<ActionsDropdown actions={hiddenActions} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing with empty actions', () => {
    const { container } = render(<ActionsDropdown actions={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
