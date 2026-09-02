import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KeyboardShortcutsHelp } from '@/components/shared/KeyboardShortcutsHelp';

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => ({
    isAdmin: true,
    canEditSalaries: true,
    canExportPayroll: true,
  }),
}));

describe('KeyboardShortcutsHelp', () => {
  it('should render dialog when open', () => {
    render(<KeyboardShortcutsHelp open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Raccourcis Clavier')).toBeInTheDocument();
  });

  it('should display navigation shortcuts', () => {
    render(<KeyboardShortcutsHelp open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Naviguer vers l'onglet N")).toBeInTheDocument();
  });

  it('should display search shortcuts', () => {
    render(<KeyboardShortcutsHelp open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Recherche globale')).toBeInTheDocument();
  });

  it('should display help shortcuts', () => {
    render(<KeyboardShortcutsHelp open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Afficher cette aide')).toBeInTheDocument();
    expect(screen.getByText('Fermer les dialogues')).toBeInTheDocument();
  });

  it('should show Mac tip', () => {
    render(<KeyboardShortcutsHelp open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText(/Cmd au lieu de Ctrl/)).toBeInTheDocument();
  });

  it('should filter RH shortcuts in equipe context', () => {
    render(<KeyboardShortcutsHelp open={true} onOpenChange={vi.fn()} context="equipe" />);
    expect(screen.queryByText('Ajouter un salaire')).not.toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<KeyboardShortcutsHelp open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('Raccourcis Clavier')).not.toBeInTheDocument();
  });
});
