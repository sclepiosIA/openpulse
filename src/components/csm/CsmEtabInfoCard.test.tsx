import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CsmEtabInfoCard } from './CsmEtabInfoCard';

const {
  SUPABASE_ROWS,
  mockFrom,
  mockToastError,
  mockSanitizeError,
  mockEditableCell,
  mockEditableDateCell,
  mockEditableListCell,
  mockUseNavigate
} = vi.hoisted(() => {
  const SUPABASE_ROWS = [
    {
      id: 'etab-1',
      nom: 'Clinique Demo',
      contexte_csm: 'Contexte initial',
      besoins_du_compte: 'Besoins initiaux',
      prochaine_action_orga: ['Appeler le directeur'],
      prochaine_action_csm: ['Préparer une démo'],
      date_action_orga: '2024-01-10',
      date_action_csm: '2024-01-15',
      point_hebdo: 'Tous les lundis',
      derniere_venue_site: '2024-02-01',
      modules_actifs: ['module-a']
    }
  ];

  const baseBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn()
  };

  const mockFrom = vi.fn(() => baseBuilder);

  const mockToastError = vi.fn();
  const mockSanitizeError = vi.fn((err: Error) => `sanitized-${err.message}`);

  const mockEditableCell = vi.fn(
    ({
      value,
      placeholder,
      multiline,
      onSave
    }: {
      value: string | null;
      placeholder?: string;
      multiline?: boolean;
      onSave: (v: string | null) => void;
    }) => {
      return (
        <div>
          <span data-testid={`editable-cell-${placeholder}`}>{value ?? ''}</span>
          <button
            type="button"
            data-testid={`editable-cell-save-${placeholder}`}
            onClick={() => onSave('nouvelle valeur')}
          >
            save
          </button>
        </div>
      );
    }
  );

  const mockEditableDateCell = vi.fn(
    ({
      value,
      placeholder,
      onSave,
      className
    }: {
      value: string | null;
      placeholder?: string;
      onSave: (v: string | null) => void;
      className?: string;
    }) => {
      return (
        <div>
          <span data-testid="editable-date-cell">{value ?? ''}</span>
          <button
            type="button"
            data-testid="editable-date-cell-save"
            onClick={() => onSave('2024-03-01')}
          >
            save-date
          </button>
        </div>
      );
    }
  );

  const mockEditableListCell = vi.fn(
    ({
      items,
      placeholder,
      onSave
    }: {
      items: string[] | null;
      placeholder?: string;
      onSave: (v: string[]) => void;
    }) => {
      return (
        <div>
          <span data-testid={`editable-list-${placeholder}`}>{(items ?? []).join(',')}</span>
          <button
            type="button"
            data-testid={`editable-list-save-${placeholder}`}
            onClick={() => onSave(['item-1', 'item-2'])}
          >
            save-list
          </button>
        </div>
      );
    }
  );

  const mockUseNavigate = vi.fn();

  return {
    SUPABASE_ROWS,
    mockFrom,
    mockToastError,
    mockSanitizeError,
    mockEditableCell,
    mockEditableDateCell,
    mockEditableListCell,
    mockUseNavigate
  };
});

vi.mock('@/lib/supabaseBrowser', () => {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn()
  };

  (builder.then as any).mockImplementation((onFulfilled: any, onRejected: any) => {
    const promise = Promise.resolve({ data: null, error: null });
    return promise.then(onFulfilled, onRejected);
  });

  (builder.catch as any).mockImplementation((onRejected: any) => {
    const promise = Promise.resolve({ data: null, error: null });
    return promise.catch(onRejected);
  });

  (builder.maybeSingle as any).mockImplementation(async () => ({ data: null, error: null }));
  (builder.single as any).mockImplementation(async () => ({ data: null, error: null }));

  (mockFrom as any).mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom
    }
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({
    children,
    className
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({
    children,
    className
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({
    children,
    className
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <h2 data-testid="card-title" className={className}>
      {children}
    </h2>
  )
}));

vi.mock('@/components/csm/EditableCell', () => ({
  EditableCell: mockEditableCell
}));

vi.mock('@/components/csm/EditableDateCell', () => ({
  EditableDateCell: mockEditableDateCell
}));

vi.mock('@/components/csm/EditableListCell', () => ({
  EditableListCell: mockEditableListCell
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: mockToastError
  }
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeError
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockUseNavigate
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0
      },
      mutations: {
        retry: 0
      }
    }
  });
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
  };
}

describe('CsmEtabInfoCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const builder = (mockFrom as any)();
    builder.select.mockReturnThis();
    builder.eq.mockReturnThis();
    builder.gte.mockReturnThis();
    builder.lte.mockReturnThis();
    builder.in.mockReturnThis();
    builder.order.mockReturnThis();
    builder.limit.mockReturnThis();
    builder.insert.mockReturnThis();
    builder.update.mockReturnThis();
    builder.delete.mockReturnThis();
  });

  it('ne rend rien quand aucune donnée établissement', async () => {
    const builder = (mockFrom as any)();
    builder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { container } = renderWithClient(<CsmEtabInfoCard etablissementId="etab-1" />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
  });

  it('affiche les données de l’établissement en succès', async () => {
    const builder = (mockFrom as any)();
    builder.maybeSingle.mockResolvedValueOnce({ data: SUPABASE_ROWS[0], error: null });

    renderWithClient(<CsmEtabInfoCard etablissementId="etab-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('card-title').textContent).toContain('Informations CSM');
    });

    expect(screen.getByText('Contexte du compte')).toBeInTheDocument();
    expect(screen.getByText('Besoins du compte')).toBeInTheDocument();
    expect(screen.getByText('Actions organisationnelles')).toBeInTheDocument();
    expect(screen.getByText('Actions CSM')).toBeInTheDocument();
    expect(screen.getByText('Dernière venue sur site')).toBeInTheDocument();

    expect(
      screen.getByTestId('editable-cell-Contexte du compte...')
    ).toHaveTextContent('Contexte initial');
    expect(
      screen.getByTestId('editable-cell-Besoins du compte...')
    ).toHaveTextContent('Besoins initiaux');

    expect(
      screen.getByTestId('editable-list-Ajouter une action orga...')
    ).toHaveTextContent('Appeler le directeur');
    expect(
      screen.getByTestId('editable-list-Ajouter une action CSM...')
    ).toHaveTextContent('Préparer une démo');

    expect(screen.getByTestId('editable-date-cell')).toHaveTextContent('2024-02-01');
  });

  it('met à jour le champ contexte_csm via EditableCell et invalide les queries', async () => {
    const builder = (mockFrom as any)();
    builder.maybeSingle
      .mockResolvedValueOnce({ data: SUPABASE_ROWS[0], error: null })
      .mockResolvedValueOnce({ data: { id: 'etab-1' }, error: null });

    const { queryClient } = renderWithClient(<CsmEtabInfoCard etablissementId="etab-1" />);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(screen.getByTestId('editable-cell-Contexte du compte...')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('editable-cell-save-Contexte du compte...');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(builder.update).toHaveBeenCalledWith({ contexte_csm: 'nouvelle valeur' });
      expect(builder.eq).toHaveBeenCalledWith('id', 'etab-1');
      expect(builder.select).toHaveBeenCalledWith('id');
      expect(builder.maybeSingle).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['csm-etab-info', 'etab-1']
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['production'] });
    });

    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('affiche un toast si update retourne data null', async () => {
    const builder = (mockFrom as any)();
    builder.maybeSingle
      .mockResolvedValueOnce({ data: SUPABASE_ROWS[0], error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    renderWithClient(<CsmEtabInfoCard etablissementId="etab-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('editable-cell-Contexte du compte...')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('editable-cell-save-Besoins du compte...');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Modification non autorisée ou établissement introuvable.'
      );
    });
  });

  it('affiche un toast avec erreur sanitizée si update échoue', async () => {
    const builder = (mockFrom as any)();
    builder.maybeSingle.mockResolvedValueOnce({ data: SUPABASE_ROWS[0], error: null });
    const updateError = new Error('update-failed');
    builder.maybeSingle.mockRejectedValueOnce(updateError);

    renderWithClient(<CsmEtabInfoCard etablissementId="etab-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('editable-date-cell')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('editable-date-cell-save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSanitizeError).toHaveBeenCalledWith(updateError);
      expect(mockToastError).toHaveBeenCalledWith('sanitized-update-failed');
    });
  });

  it('met à jour les listes d’actions organisationnelles et CSM', async () => {
    const builder = (mockFrom as any)();
    builder.maybeSingle
      .mockResolvedValueOnce({ data: SUPABASE_ROWS[0], error: null })
      .mockResolvedValue({ data: { id: 'etab-1' }, error: null });

    renderWithClient(<CsmEtabInfoCard etablissementId="etab-1" />);

    await waitFor(() => {
      expect(
        screen.getByTestId('editable-list-Ajouter une action orga...')
      ).toBeInTheDocument();
    });

    const saveOrga = screen.getByTestId('editable-list-save-Ajouter une action orga...');
    fireEvent.click(saveOrga);

    await waitFor(() => {
      expect(builder.update).toHaveBeenCalledWith({
        prochaine_action_orga: ['item-1', 'item-2']
      });
    });

    const saveCsm = screen.getByTestId('editable-list-save-Ajouter une action CSM...');
    fireEvent.click(saveCsm);

    await waitFor(() => {
      expect(builder.update).toHaveBeenCalledWith({
        prochaine_action_csm: ['item-1', 'item-2']
      });
    });
  });

  it('gère une erreur lors du chargement initial sans log console obligatoire', async () => {
    const builder = (mockFrom as any)();
    const loadError = new Error('load-failed');
    builder.maybeSingle.mockRejectedValueOnce(loadError);

    const { container } = renderWithClient(<CsmEtabInfoCard etablissementId="etab-1" />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('permet de mettre à jour la date de dernière venue sur site', async () => {
    const builder = (mockFrom as any)();
    builder.maybeSingle
      .mockResolvedValueOnce({ data: SUPABASE_ROWS[0], error: null })
      .mockResolvedValueOnce({ data: { id: 'etab-1' }, error: null });

    renderWithClient(<CsmEtabInfoCard etablissementId="etab-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('editable-date-cell')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('editable-date-cell-save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(builder.update).toHaveBeenCalledWith({
        derniere_venue_site: '2024-03-01'
      });
    });
  });
});