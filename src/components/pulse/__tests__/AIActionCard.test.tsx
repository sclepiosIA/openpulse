import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AIActionCard } from '../AIActionCard';

describe('AIActionCard', () => {
  const action = {
    type: 'created_task' as const,
    label: 'Tâche de suivi',
    details: 'Relancer CHU Lyon',
    data: {},
  } as any;

  it('renders action title', () => {
    render(<AIActionCard action={action} onExecute={vi.fn()} />);
    expect(screen.getByText('Tâche créée')).toBeInTheDocument();
  });

  it('renders action details', () => {
    render(<AIActionCard action={action} onExecute={vi.fn()} />);
    expect(screen.getByText('Nouvelle tâche')).toBeInTheDocument();
  });

  it('renders execute button', () => {
    render(<AIActionCard action={action} onExecute={vi.fn()} />);
    expect(screen.getByText('Voir la tâche')).toBeInTheDocument();
  });

  it('calls onExecute on button click', () => {
    const onExecute = vi.fn();
    render(<AIActionCard action={action} onExecute={onExecute} />);
    fireEvent.click(screen.getByText('Voir la tâche'));
    expect(onExecute).toHaveBeenCalledWith(action);
  });
});
