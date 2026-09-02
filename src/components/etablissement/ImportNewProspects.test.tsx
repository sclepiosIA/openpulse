import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { PROSPECTS, dbState, mockFrom, mockToast } = vi.hoisted(() => {
  const PROSPECTS = [
    {
      nom: 'CH Test Un',
      type: 'CH',
      statut: 'F-RDV pris',
      ville: 'Lyon',
      region: 'Auvergne-Rhône-Alpes',
      dpi: 'Hôpital Manager',
      adresse: null,
      code_postal: null,
      notes: null,
      eta_signature: '2026 T3',
    },
    {
      nom: 'CHU Test Deux',
      type: 'CHU',
      statut: 'C-Bloqué',
      ville: 'Paris',
      region: 'Île-de-France',
      dpi: 'DPI bizarre inconnu',
      adresse: '1 rue de la Paix',
      code_postal: '75001',
      notes: 'une note',
      eta_signature: null,
    },
  ];

  const dbState: {
    existing: { id: string } | null;
    insertError: { message: string } | null;
    inserted: Array<Record<string, unknown>>;
  } = {
    existing: null,
    insertError: null,
    inserted: [],
  };

  const mockFrom = vi.fn(() => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(() =>
        Promise.resolve({ data: dbState.existing, error: null })
      ),
      insert: vi.fn((payload: Record<string, unknown>) => {
        dbState.inserted.push(payload);
        return Promise.resolve({ data: null, error: dbState.insertError });
      }),
    };
    return builder;
  });

  const mockToast = vi.fn();

  return { PROSPECTS, dbState, mockFrom, mockToast };
});

vi.mock('./newProspectsData', () => ({
  newProspects: PROSPECTS,
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/components/ui/button', async () => {
  const React = await import('react');
  return {
    Button: ({
      children,
      onClick,
      disabled,
    }: {
      children?: React.ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => React.createElement('button', { onClick, disabled }, children),
  };
});

vi.mock('@/components/ui/card', async () => {
  const React = await import('react');
  const passthrough =
    (testId: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': testId }, children);
  return {
    Card: passthrough('card'),
    CardContent: passthrough('card-content'),
    CardDescription: passthrough('card-description'),
    CardHeader: passthrough('card-header'),
    CardTitle: passthrough('card-title'),
  };
});

vi.mock('@/components/ui/progress', async () => {
  const React = await import('react');
  return {
    Progress: ({ value }: { value?: number }) =>
      React.createElement('div', {
        'data-testid': 'progress',
        'data-value': String(value ?? 0),
      }),
  };
});

vi.mock('lucide-react', () => ({
  Loader2: () => null,
}));

import { ImportNewProspects } from './ImportNewProspects';

describe('ImportNewProspects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbState.existing = null;
    dbState.insertError = null;
    dbState.inserted = [];
  });

  it('affiche le titre, la description et la liste des prospects à importer', () => {
    render(<ImportNewProspects />);

    expect(
      screen.getByText('Import des nouveaux prospects')
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Import de 2 nouveaux prospects avec leurs informations complètes'
      )
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Importer 2 prospects' })
    ).toBeTruthy();
    expect(
      screen.getByText('• CH Test Un (Lyon) - F-RDV pris')
    ).toBeTruthy();
    expect(
      screen.getByText('• CHU Test Deux (Paris) - C-Bloqué')
    ).toBeTruthy();
  });

  it('importe les prospects avec les statuts/DPI mappés et affiche le résultat de succès', async () => {
    render(<ImportNewProspects />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Importer 2 prospects' })
    );

    await waitFor(
      () => {
        expect(
          screen.getByText('Import terminé: 2 créés, 0 erreurs')
        ).toBeTruthy();
      },
      { timeout: 3000 }
    );

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(dbState.inserted).toHaveLength(2);

    const first = dbState.inserted[0];
    expect(first.nom).toBe('CH Test Un');
    expect(first.statut).toBe('RDV pris');
    expect(first.dpi).toBe('Hopital Manager');
    expect(first.ville).toBe('Lyon');
    expect(first.progression).toBe(0);
    expect(String(first.date_previsionnelle_signature)).toMatch(
      /^2026-09-1[45]$/
    );

    const second = dbState.inserted[1];
    expect(second.nom).toBe('CHU Test Deux');
    expect(second.statut).toBe('Bloqué');
    expect(second.dpi).toBe('Inconnu');
    expect(second.adresse).toBe('1 rue de la Paix');
    expect(second.code_postal).toBe('75001');
    expect(second.notes).toBe('une note');
    expect(second.date_previsionnelle_signature).toBeUndefined();

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Import terminé',
      description: 'Import terminé: 2 créés, 0 erreurs',
      variant: 'default',
    });
  });

  it("ignore les établissements déjà existants (aucun insert)", async () => {
    dbState.existing = { id: 'exist-1' };
    render(<ImportNewProspects />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Importer 2 prospects' })
    );

    await waitFor(
      () => {
        expect(
          screen.getByText('Import terminé: 0 créés, 0 erreurs')
        ).toBeTruthy();
      },
      { timeout: 3000 }
    );

    expect(dbState.inserted).toHaveLength(0);
  });

  it('affiche un toast destructive lorsque toutes les insertions échouent', async () => {
    dbState.insertError = { message: 'boom' };
    render(<ImportNewProspects />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Importer 2 prospects' })
    );

    await waitFor(
      () => {
        expect(
          screen.getByText('Import terminé: 0 créés, 2 erreurs')
        ).toBeTruthy();
      },
      { timeout: 3000 }
    );

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Import terminé',
      description: 'Import terminé: 0 créés, 2 erreurs',
      variant: 'destructive',
    });
  });
});