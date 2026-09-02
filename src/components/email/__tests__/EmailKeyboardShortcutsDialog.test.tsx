import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailKeyboardShortcutsDialog } from '../EmailKeyboardShortcutsDialog';

describe('EmailKeyboardShortcutsDialog', () => {
  it('renders dialog when open', () => {
    render(<EmailKeyboardShortcutsDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Raccourcis clavier')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<EmailKeyboardShortcutsDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('Raccourcis clavier')).not.toBeInTheDocument();
  });

  it('renders all shortcut categories', () => {
    render(<EmailKeyboardShortcutsDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Affichage')).toBeInTheDocument();
  });

  it('renders shortcut descriptions', () => {
    render(<EmailKeyboardShortcutsDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Répondre au message')).toBeInTheDocument();
    expect(screen.getByText('Transférer le message')).toBeInTheDocument();
    expect(screen.getByText('Message suivant')).toBeInTheDocument();
  });

  it('renders key badges', () => {
    render(<EmailKeyboardShortcutsDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getAllByText('R').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.getByText('J')).toBeInTheDocument();
  });
});
