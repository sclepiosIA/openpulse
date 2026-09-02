import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  mockUseParams,
  mockNavigate,
  mockToast,
  mockUseFormDetail,
  mockUseFormResponses,
  FORM,
  RESPONSES,
} = vi.hoisted(() => {
  const FORM = {
    id: 'form-1',
    title: 'Form A',
    form_fields: [
      { id: 'f-head', type: 'heading', label: 'Titre' },
      { id: 'f-name', type: 'text', label: 'Nom complet' },
      { id: 'f-msg', type: 'textarea', label: 'Message' },
      { id: 'f-par', type: 'paragraph', label: 'Paragraphe' },
    ],
  };

  const RESPONSES = [
    {
      id: 'r1',
      submitted_at: '2024-01-02T10:20:30.000Z',
      respondent_name: 'Alice',
      respondent_email: 'alice@example.com',
      form_field_values: [
        { field_id: 'f-name', value: 'Alice Dupont' },
        { field_id: 'f-msg', value: 'Bonjour "le monde"' },
      ],
    },
  ];

  return {
    mockUseParams: vi.fn(() => ({ formId: 'form-1' })),
    mockNavigate: vi.fn(),
    mockToast: vi.fn(),
    mockUseFormDetail: vi.fn(),
    mockUseFormResponses: vi.fn(),
    FORM,
    RESPONSES,
  };
});

vi.mock('react-router-dom', () => ({
  useParams: () => mockUseParams(),
  useNavigate: () => mockNavigate,
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-arrow-left" {...props} />,
  Download: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-download" {...props} />,
  Eye: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-eye" {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    'aria-label': ariaLabel,
    ...rest
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    'aria-label'?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children?: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children?: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children?: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children?: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children?: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children }: { children?: React.ReactNode }) => <td>{children}</td>,
}));

vi.mock('@/hooks/forms/useForms', () => ({
  useFormDetail: (formId?: string) => mockUseFormDetail(formId),
  useFormResponses: (formId?: string) => mockUseFormResponses(formId),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: ({
    isLoading,
    isError,
    isEmpty,
    emptyTitle,
    onRetry,
    children,
  }: {
    isLoading: boolean;
    isError: boolean;
    isEmpty: boolean;
    emptyTitle: string;
    onRetry: () => void;
    children?: React.ReactNode;
  }) => (
    <div data-testid="page-data-state">
      <div data-testid="pds-loading">{String(isLoading)}</div>
      <div data-testid="pds-error">{String(isError)}</div>
      <div data-testid="pds-empty">{String(isEmpty)}</div>
      <div data-testid="pds-empty-title">{emptyTitle}</div>
      <button type="button" onClick={onRetry}>
        Retry
      </button>
      {children}
    </div>
  ),
}));

import FormResponses from './FormResponses';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('FormResponses', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ formId: 'form-1' });
    mockNavigate.mockReset();
    mockToast.mockReset();
    mockUseFormDetail.mockReset();
    mockUseFormResponses.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('affiche l’état de chargement via PageDataState quand les données chargent', () => {
    mockUseFormDetail.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseFormResponses.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithClient(<FormResponses />);

    expect(screen.getByTestId('page-data-state')).toBeTruthy();
    expect(screen.getByTestId('pds-loading').textContent).toBe('true');
    expect(screen.getByTestId('pds-error').textContent).toBe('false');
    expect(screen.getByTestId('pds-empty').textContent).toBe('false');
  });

  it('affiche une erreur (isError) via PageDataState et relance les refetch au retry', () => {
    const refetchForm = vi.fn();
    const refetchResponses = vi.fn();

    mockUseFormDetail.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      refetch: refetchForm,
    });
    mockUseFormResponses.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: refetchResponses,
    });

    renderWithClient(<FormResponses />);

    expect(screen.getByTestId('page-data-state')).toBeTruthy();
    expect(screen.getByTestId('pds-loading').textContent).toBe('false');
    expect(screen.getByTestId('pds-error').textContent).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetchForm).toHaveBeenCalledTimes(1);
    expect(refetchResponses).toHaveBeenCalledTimes(1);
  });

  it('rend le titre, le compteur, la table et exporte en CSV (sans champs heading/paragraph)', () => {
    mockUseFormDetail.mockReturnValue({
      data: FORM,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseFormResponses.mockReturnValue({
      data: RESPONSES,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const createObjectURL = vi.fn(() => 'blob:local');
    const revokeObjectURL = vi.fn();

    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const realBlob = globalThis.Blob;
    const blobCalls: { parts: unknown[]; options?: BlobPropertyBag }[] = [];
    class MockBlob extends realBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        blobCalls.push({ parts: [...parts], options });
      }
    }
    Object.defineProperty(globalThis, 'Blob', { value: MockBlob, writable: true });

    renderWithClient(<FormResponses />);

    expect(screen.getByText('Form A')).toBeTruthy();
    expect(screen.getByText('1 réponse')).toBeTruthy();

    expect(screen.getByText('Date')).toBeTruthy();
    expect(screen.getByText('Nom')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Nom complet')).toBeTruthy();
    expect(screen.getByText('Message')).toBeTruthy();
    expect(screen.queryByText('Titre')).toBeNull();
    expect(screen.queryByText('Paragraphe')).toBeNull();

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('alice@example.com')).toBeTruthy();
    expect(screen.getByText('Alice Dupont')).toBeTruthy();
    expect(screen.getByText('Bonjour "le monde"')).toBeTruthy();

    const exportBtn = screen.getByRole('button', { name: /Exporter CSV/i });
    expect(exportBtn).toBeTruthy();
    expect((exportBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(exportBtn);

    expect(blobCalls.length).toBe(1);
    const parts = blobCalls[0]?.parts ?? [];
    const blobText = String(parts[0] ?? '');
    expect(blobText.startsWith('\ufeff')).toBe(true);
    expect(blobText).toContain('"Date","Nom","Email","Nom complet","Message"');
    expect(blobText).toContain('"Alice","alice@example.com","Alice Dupont","Bonjour ""le monde"""');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith({ title: 'Export CSV téléchargé' });

    clickSpy.mockRestore();
    Object.defineProperty(globalThis, 'Blob', { value: realBlob, writable: true });
  });

  it('désactive le bouton Exporter CSV quand il n’y a aucune réponse et affiche le message vide', () => {
    mockUseFormDetail.mockReturnValue({
      data: FORM,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseFormResponses.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithClient(<FormResponses />);

    expect(screen.getByText('Aucune réponse')).toBeTruthy();
    expect(screen.getByText(/Les réponses apparaîtront ici/i)).toBeTruthy();

    const exportBtn = screen.getByRole('button', { name: /Exporter CSV/i });
    expect((exportBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('navigue vers la page d’édition au clic sur Retour', () => {
    mockUseFormDetail.mockReturnValue({
      data: FORM,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseFormResponses.mockReturnValue({
      data: RESPONSES,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseParams.mockReturnValue({ formId: 'form-1' });

    renderWithClient(<FormResponses />);

    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(mockNavigate).toHaveBeenCalledWith('/formulaires/form-1/edit');
  });
});