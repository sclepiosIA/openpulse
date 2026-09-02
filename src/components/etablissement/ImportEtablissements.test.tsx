/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ImportEtablissements } from './ImportEtablissements';

const {
  STATUTS_REF,
  TYPES_REF,
  DPI_REF,
  FALLBACK_STATUTS_IMPORT,
  FALLBACK_TYPES_ETABLISSEMENT,
  FALLBACK_DPI,
  AUTH_STATE,
  mockToastSuccess,
  mockToastError,
  mockSanitizeSupabaseError,
  mockDebugError,
  mockDebugWarn,
  mockCreateObjectURL,
  mockRevokeObjectURL,
  mockInvalidateQueries,
  mockParse,
  mockInsert,
  mockFrom,
  SUPABASE_SUCCESS,
  SUPABASE_ERROR,
} = vi.hoisted(() => {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  builder.then.mockImplementation((onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled)
  );
  builder.catch.mockImplementation((onRejected: (e: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected)
  );

  const SUPABASE_SUCCESS = { data: null, error: null };
  const SUPABASE_ERROR = { data: null, error: { message: 'insert failed' } };

  const mockInsert = vi.fn().mockResolvedValue(SUPABASE_SUCCESS);
  builder.insert.mockImplementation(mockInsert);

  return {
    STATUTS_REF: [{ label: 'Actif' }, { label: 'Prospect' }],
    TYPES_REF: [{ label: 'CHU' }, { label: 'CH' }],
    DPI_REF: [{ label: 'DxCare' }, { label: 'Easily' }],
    FALLBACK_STATUTS_IMPORT: ['Actif', 'Prospect'],
    FALLBACK_TYPES_ETABLISSEMENT: ['CHU', 'CH'],
    FALLBACK_DPI: ['DxCare', 'Easily'],
    AUTH_STATE: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockSanitizeSupabaseError: vi.fn((error: unknown) => {
      if (error && typeof error === 'object' && 'message' in error) {
        return String((error as { message: string }).message);
      }
      return 'sanitized error';
    }),
    mockDebugError: vi.fn(),
    mockDebugWarn: vi.fn(),
    mockCreateObjectURL: vi.fn(() => 'blob:test'),
    mockRevokeObjectURL: vi.fn(),
    mockInvalidateQueries: vi.fn(),
    mockParse: vi.fn(),
    mockInsert,
    mockFrom: vi.fn(() => builder),
    SUPABASE_SUCCESS,
    SUPABASE_ERROR,
  };
});

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
    warn: mockDebugWarn,
  },
}));

vi.mock('papaparse', () => ({
  default: {
    parse: mockParse,
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td {...props}>{children}</td>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
}));

vi.mock('lucide-react', () => ({
  Upload: () => <svg data-testid="icon-upload" />,
  Download: () => <svg data-testid="icon-download" />,
  CheckCircle: () => <svg data-testid="icon-check" />,
  AlertCircle: () => <svg data-testid="icon-alert" />,
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock('@/config/referenceDataDefaults', () => ({
  FALLBACK_STATUTS_IMPORT,
  FALLBACK_TYPES_ETABLISSEMENT,
  FALLBACK_DPI,
}));

vi.mock('@/hooks/system/useReferenceData', () => ({
  useStatutsEtablissement: vi.fn(() => ({ data: STATUTS_REF })),
  useTypesEtablissement: vi.fn(() => ({ data: TYPES_REF })),
  useDpiList: vi.fn(() => ({ data: DPI_REF })),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(mockInvalidateQueries);

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('ImportEtablissements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;
    mockFrom.mockClear();
    mockInsert.mockResolvedValue(SUPABASE_SUCCESS);
  });

  it('importe un CSV valide, transforme les données métier et invalide la query', async () => {
    const wrapper = createWrapper();

    mockParse.mockImplementation((_file: File, config: { complete: (results: { data: Array<Record<string, string>>; errors: Array<unknown> }) => void }) => {
      config.complete({
        data: [
          {
            "Nom de l'établissement": 'Clinique Saint Pierre',
            Ville: 'Lyon',
            Région: 'Auvergne-Rhône-Alpes',
            'Type (CH/CHU/GHT/ESPIC/Privé)': 'CHU',
            Statut: 'Actif',
            DPI: 'DxCare',
            'Nombre de passages urgences': '1200',
            Email: 'contact@hopital.fr',
            'Date signature': '2024-01-15',
            'Tarif Pallier 1': '100.5',
            'Tarif Pallier 2': '200',
          },
        ],
        errors: [],
      });
    });

    render(<ImportEtablissements />, { wrapper });

    const fileInput = screen.getByLabelText('Fichier CSV') as HTMLInputElement;
    const file = new File(['csv'], 'etablissements.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText('1 ligne(s) détectée(s)')).toBeInTheDocument();

    const importButton = screen.getByRole('button', { name: 'Importer' });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('etablissements');
    });

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith({
        nom: 'Clinique Saint Pierre',
        ville: 'Lyon',
        region: 'Auvergne-Rhône-Alpes',
        type: 'CHU',
        statut: 'Actif',
        dpi: 'DxCare',
        nombre_passages_urgences_annuel: 1200,
        email: 'contact@hopital.fr',
        date_signature: '2024-01-15',
        tarifs_palliers: {
          pallier_1: 100.5,
          pallier_2: 200,
        },
      });
    });

    expect(await screen.findByText('1 établissement(s) importé(s) avec succès')).toBeInTheDocument();
    expect(mockToastSuccess).toHaveBeenCalledWith('1 établissement(s) importé(s) avec succès');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['etablissements'] });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('affiche les erreurs de validation et n’insère rien si les données sont invalides', async () => {
    const wrapper = createWrapper();

    mockParse.mockImplementation((_file: File, config: { complete: (results: { data: Array<Record<string, string>>; errors: Array<unknown> }) => void }) => {
      config.complete({
        data: [
          {
            "Nom de l'établissement": 'Hopital Test',
            Ville: 'Paris',
            Région: 'Ile-de-France',
            'Type (CH/CHU/GHT/ESPIC/Privé)': 'TypeInvalide',
            Statut: 'MauvaisStatut',
            DPI: 'DpiInvalide',
            'Nombre de passages urgences': 'abc',
            Email: 'email-invalide',
          },
        ],
        errors: [],
      });
    });

    render(<ImportEtablissements />, { wrapper });

    const fileInput = screen.getByLabelText('Fichier CSV') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['csv'], 'bad.csv', { type: 'text/csv' })] } });

    expect(await screen.findByText('1 ligne(s) détectée(s)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Importer' }));

    await waitFor(() => {
      expect(screen.getByText('0 établissement(s) importé(s) avec succès')).toBeInTheDocument();
    });

    expect(screen.getByText('1 erreur(s):')).toBeInTheDocument();
    expect(screen.getByText(/Type invalide: TypeInvalide/)).toBeInTheDocument();
    expect(screen.getByText(/Statut invalide: MauvaisStatut/)).toBeInTheDocument();
    expect(screen.getByText(/DPI invalide: DpiInvalide/)).toBeInTheDocument();
    expect(screen.getByText(/Nombre de passages urgences doit être un nombre/)).toBeInTheDocument();
    expect(screen.getByText(/Email invalide: email-invalide/)).toBeInTheDocument();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith('1 erreur(s) lors de l\'import');
  });

  it('remonte une erreur supabase sur insert et affiche le résultat d’échec', async () => {
    const wrapper = createWrapper();

    mockInsert.mockResolvedValue(SUPABASE_ERROR);

    mockParse.mockImplementation((_file: File, config: { complete: (results: { data: Array<Record<string, string>>; errors: Array<unknown> }) => void }) => {
      config.complete({
        data: [
          {
            "Nom de l'établissement": 'Centre Hospitalier',
            Ville: 'Marseille',
            Région: 'PACA',
            'Type (CH/CHU/GHT/ESPIC/Privé)': 'CH',
          },
        ],
        errors: [],
      });
    });

    render(<ImportEtablissements />, { wrapper });

    fireEvent.change(screen.getByLabelText('Fichier CSV'), {
      target: { files: [new File(['csv'], 'ok.csv', { type: 'text/csv' })] },
    });

    expect(await screen.findByText('1 ligne(s) détectée(s)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Importer' }));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith({
        nom: 'Centre Hospitalier',
        ville: 'Marseille',
        region: 'PACA',
        type: 'CH',
      });
    });

    expect(await screen.findByText('0 établissement(s) importé(s) avec succès')).toBeInTheDocument();
    expect(screen.getByText('1 erreur(s):')).toBeInTheDocument();
    expect(screen.getByText(/Ligne 2: insert failed/)).toBeInTheDocument();
    expect(mockToastError).toHaveBeenCalledWith('1 erreur(s) lors de l\'import');
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('gère une erreur de parsing CSV via toast.error', async () => {
    const wrapper = createWrapper();

    mockParse.mockImplementation((_file: File, config: { complete: (results: { data: Array<Record<string, string>>; errors: Array<unknown> }) => void }) => {
      config.complete({
        data: [],
        errors: [{ message: 'parse failed' }],
      });
    });

    render(<ImportEtablissements />, { wrapper });

    fireEvent.change(screen.getByLabelText('Fichier CSV'), {
      target: { files: [new File(['csv'], 'broken.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la lecture du fichier CSV');
    });
  });

  it('télécharge le template CSV', () => {
    const wrapper = createWrapper();

    render(<ImportEtablissements />, { wrapper });

    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    appendSpy.mockClear();
    removeSpy.mockClear();

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    fireEvent.click(screen.getByRole('button', { name: /Télécharger template/i }));

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});