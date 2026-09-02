import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickActionsBar } from '../QuickActionsBar';

describe('QuickActionsBar', () => {
  it('renders edit button', () => {
    render(<QuickActionsBar onEdit={vi.fn()} etablissementNom="CHU Test" />);
    expect(screen.getByTitle('Modifier')).toBeInTheDocument();
  });

  it('calls onEdit when edit button clicked', () => {
    const onEdit = vi.fn();
    render(<QuickActionsBar onEdit={onEdit} etablissementNom="CHU" />);
    fireEvent.click(screen.getByTitle('Modifier'));
    expect(onEdit).toHaveBeenCalled();
  });

  it('renders more actions dropdown trigger', () => {
    render(<QuickActionsBar onEdit={vi.fn()} etablissementNom="CHU" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2); // edit + dropdown trigger
  });

  it('renders dropdown trigger with aria-haspopup', () => {
    render(<QuickActionsBar onEdit={vi.fn()} etablissementNom="CHU Test" />);
    const trigger = screen.getByRole('button', { expanded: false });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  });
});
