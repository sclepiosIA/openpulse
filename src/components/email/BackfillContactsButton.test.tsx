import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { BackfillContactsButton } from './BackfillContactsButton';

const { mockInvokeEdge, mockToast, RESULT } = vi.hoisted(() => {
  const RESULT = {
    success: true,
    message: 'ok',
    threads_processed: 12,
    etablissements_processed: 3,
    total_contacts_created: 7,
    total_contacts_updated: 4,
    total_contacts_skipped: 2,
    total_errors: 1,
    report: [
      {
        etablissement_id: 'etab-1',
        etablissement_nom: 'Lycée Pasteur',
        etablissement_ville: 'Lille',
        threads_processed: 5,
        contacts_created: 3,
        contacts_updated: 2,
        contacts_skipped: 1,
        contacts_errors: 1,
      },
      {
        etablissement_id: 'etab-2',
        etablissement_nom: 'Collège Voltaire',
        etablissement_ville: 'Lyon',
        threads_processed: 7,
        contacts_created: 4,
        contacts_updated: 2,
        contacts_skipped: 1,
        contacts_errors: 0,
      },
    ],
  };
  return {
    RESULT,
    mockInvokeEdge: vi.fn(),
    mockToast: {
      info: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('@/services/edgeFunctions', () => ({
  invokeEdge: mockInvokeEdge,
}));

vi.mock('sonner', () => ({
  toast: mockToast,
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: vi.fn(() => 'erreur nettoyée'),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) =>
    React.createElement('button', { onClick, disabled }, children),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? React.createElement('div', { 'data-testid': 'dialog' }, children) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement('h2', null, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement('p', null, children),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) =>
    React.createElement('span', null, children),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

describe('BackfillContactsButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le bouton sans dialog au rendu initial', () => {
    render(<BackfillContactsButton />);
    expect(screen.getByText('Importer contacts historiques')).toBeTruthy();
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('lance le backfill, affiche le rapport et le toast de succès', async () => {
    mockInvokeEdge.mockResolvedValueOnce(RESULT);
    render(<BackfillContactsButton />);

    await act(async () => {
      fireEvent.click(screen.getByText('Importer contacts historiques'));
    });

    expect(mockInvokeEdge).toHaveBeenCalledWith('backfill-contacts-from-ai-data', {});
    expect(mockToast.info).toHaveBeenCalledWith('Démarrage du backfill des contacts...');
    expect(mockToast.success).toHaveBeenCalledWith(
      'Backfill terminé : 7 créés, 4 enrichis sur 3 établissements'
    );

    expect(screen.getByTestId('dialog')).toBeTruthy();
    expect(screen.getByText("Rapport d'import des contacts")).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('Lycée Pasteur')).toBeTruthy();
    expect(screen.getByText('Lille')).toBeTruthy();
    expect(screen.getByText('Collège Voltaire')).toBeTruthy();
    expect(screen.getByText('1 erreur(s) rencontrée(s)')).toBeTruthy();
  });

  it('ferme le dialog via le bouton Fermer', async () => {
    mockInvokeEdge.mockResolvedValueOnce(RESULT);
    render(<BackfillContactsButton />);

    await act(async () => {
      fireEvent.click(screen.getByText('Importer contacts historiques'));
    });
    expect(screen.getByTestId('dialog')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText('Fermer'));
    });
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('affiche un toast d erreur sanitizée si invokeEdge échoue', async () => {
    mockInvokeEdge.mockRejectedValueOnce(new Error('boom'));
    render(<BackfillContactsButton />);

    await act(async () => {
      fireEvent.click(screen.getByText('Importer contacts historiques'));
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Erreur : erreur nettoyée');
    });
    expect(screen.queryByTestId('dialog')).toBeNull();
    const button = screen.getByText('Importer contacts historiques').closest('button');
    expect(button?.disabled).toBe(false);
  });
});