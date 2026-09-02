// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NativeEditorDialog } from './NativeEditorDialog';

const {
  authState,
  navigateMock,
  toastSuccess,
  toastError,
  documentEditorPropsSpy,
  spreadsheetEditorPropsSpy,
  presentationEditorPropsSpy,
  mockFrom,
  hookSuccessState,
  hookErrorState,
  unstableImportState,
} = vi.hoisted(() => {
  const auth = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const successState = { data: { id: 'row-1', name: 'ok' }, error: null };
  const errorState = { data: null, error: { message: 'x' } };
  const importState = { shouldThrowDocument: false };

  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => successState),
      maybeSingle: vi.fn(async () => successState),
      then: (
        onFulfilled?: (value: typeof successState) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(successState).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(successState).catch(onRejected),
    };
    return builder;
  };

  return {
    authState: auth,
    navigateMock: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    documentEditorPropsSpy: vi.fn(),
    spreadsheetEditorPropsSpy: vi.fn(),
    presentationEditorPropsSpy: vi.fn(),
    mockFrom: vi.fn(() => createBuilder()),
    hookSuccessState: successState,
    hookErrorState: errorState,
    unstableImportState: importState,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: authState.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: authState.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authState,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogPortal: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-portal">{children}</div>,
  DialogOverlay: () => <div data-testid="dialog-overlay" />,
}));

vi.mock('@radix-ui/react-dialog', () => ({
  Content: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  Title: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Description: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@radix-ui/react-visually-hidden', () => ({
  VisuallyHidden: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('lucide-react', () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
  AlertTriangle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="alert-icon" {...props} />,
  RotateCcw: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="retry-icon" {...props} />,
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="close-icon" {...props} />,
}));

vi.mock('./DocumentEditor', () => ({
  DocumentEditor: (props: {
    documentId?: string;
    documentName: string;
    initialContent?: string;
    folderId?: string | null;
    onClose: () => void;
    className: string;
    collaborative: boolean;
  }) => {
    if (unstableImportState.shouldThrowDocument) {
      throw new Error('boom');
    }

    documentEditorPropsSpy(props);
    return (
      <div data-testid="document-editor">
        <span>{props.documentName}</span>
        <span>{props.documentId ?? 'no-id'}</span>
        <span>{props.initialContent ?? 'no-content'}</span>
        <span>{props.folderId ?? 'no-folder'}</span>
        <span>{props.collaborative ? 'collaborative' : 'solo'}</span>
        <button onClick={props.onClose}>close-doc</button>
      </div>
    );
  },
}));

vi.mock('./SpreadsheetEditor', () => ({
  SpreadsheetEditor: (props: {
    documentId?: string;
    documentName: string;
    initialContent?: string;
    folderId?: string | null;
    onClose: () => void;
    className: string;
  }) => {
    spreadsheetEditorPropsSpy(props);
    return (
      <div data-testid="spreadsheet-editor">
        <span>{props.documentName}</span>
        <span>{props.documentId ?? 'no-id'}</span>
        <span>{props.initialContent ?? 'no-content'}</span>
        <span>{props.folderId ?? 'no-folder'}</span>
        <button onClick={props.onClose}>close-sheet</button>
      </div>
    );
  },
}));

vi.mock('./PresentationEditor', () => ({
  PresentationEditor: (props: {
    documentId?: string;
    documentName: string;
    initialContent?: string;
    folderId?: string | null;
    onClose: () => void;
    className: string;
  }) => {
    presentationEditorPropsSpy(props);
    return (
      <div data-testid="presentation-editor">
        <span>{props.documentName}</span>
        <span>{props.documentId ?? 'no-id'}</span>
        <span>{props.initialContent ?? 'no-content'}</span>
        <span>{props.folderId ?? 'no-folder'}</span>
        <button onClick={props.onClose}>close-pres</button>
      </div>
    );
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('NativeEditorDialog', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    unstableImportState.shouldThrowDocument = false;
  });

  it('configure le wrapper QueryClientProvider et couvre chargement/succès/erreur via renderHook', async () => {
    const Wrapper = createWrapper();

    const { result, rerender } = renderHook(
      ({ mode }: { mode: 'loading' | 'success' | 'error' }) => {
        if (mode === 'loading') {
          return { isLoading: true, isError: false, data: null, error: null };
        }
        if (mode === 'success') {
          return { isLoading: false, isError: false, data: hookSuccessState.data, error: null };
        }
        return { isLoading: false, isError: true, data: null, error: hookErrorState.error };
      },
      {
        initialProps: { mode: 'loading' as const },
        wrapper: Wrapper,
      },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();

    rerender({ mode: 'success' });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toEqual({ id: 'row-1', name: 'ok' });

    rerender({ mode: 'error' });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: 'x' });
  });

  it('affiche le fallback de chargement puis rend DocumentEditor avec les bonnes props métier', async () => {
    const onOpenChange = vi.fn();
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <NativeEditorDialog
          open={true}
          onOpenChange={onOpenChange}
          editorType="native_doc"
          documentId="doc-1"
          documentName="Rapport Q2"
          initialContent="Contenu initial"
          folderId="folder-9"
        />
      </Wrapper>,
    );

    expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
    expect(screen.getByText('Éditeur de document')).toBeInTheDocument();
    expect(screen.getByText('Éditeur de document natif')).toBeInTheDocument();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();

    const editor = await screen.findByTestId('document-editor');
    expect(editor).toBeInTheDocument();
    expect(screen.getByText('Rapport Q2')).toBeInTheDocument();
    expect(screen.getByText('doc-1')).toBeInTheDocument();
    expect(screen.getByText('Contenu initial')).toBeInTheDocument();
    expect(screen.getByText('folder-9')).toBeInTheDocument();
    expect(screen.getByText('collaborative')).toBeInTheDocument();

    const lastCall = documentEditorPropsSpy.mock.calls.at(-1);
    expect(lastCall?.[0]).toMatchObject({
      documentId: 'doc-1',
      documentName: 'Rapport Q2',
      initialContent: 'Contenu initial',
      folderId: 'folder-9',
      className: 'h-full',
      collaborative: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'close-doc' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('rend SpreadsheetEditor avec les bonnes valeurs', async () => {
    const onOpenChange = vi.fn();
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <NativeEditorDialog
          open={true}
          onOpenChange={onOpenChange}
          editorType="native_sheet"
          documentName="Budget"
          initialContent="A1=10"
          folderId={null}
        />
      </Wrapper>,
    );

    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();

    const editor = await screen.findByTestId('spreadsheet-editor');
    expect(editor).toBeInTheDocument();
    expect(screen.getByText('Budget')).toBeInTheDocument();
    expect(screen.getByText('no-id')).toBeInTheDocument();
    expect(screen.getByText('A1=10')).toBeInTheDocument();
    expect(screen.getByText('no-folder')).toBeInTheDocument();

    const lastCall = spreadsheetEditorPropsSpy.mock.calls.at(-1);
    expect(lastCall?.[0]).toMatchObject({
      documentId: undefined,
      documentName: 'Budget',
      initialContent: 'A1=10',
      folderId: null,
      className: 'h-full',
    });

    fireEvent.click(screen.getByRole('button', { name: 'close-sheet' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('rend PresentationEditor avec le nom par défaut Sans titre', async () => {
    const onOpenChange = vi.fn();
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <NativeEditorDialog
          open={true}
          onOpenChange={onOpenChange}
          editorType="native_pres"
          documentId="pres-4"
        />
      </Wrapper>,
    );

    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();

    const editor = await screen.findByTestId('presentation-editor');
    expect(editor).toBeInTheDocument();
    expect(screen.getByText('Sans titre')).toBeInTheDocument();
    expect(screen.getByText('pres-4')).toBeInTheDocument();
    expect(screen.getByText('no-content')).toBeInTheDocument();
    expect(screen.getByText('no-folder')).toBeInTheDocument();

    const lastCall = presentationEditorPropsSpy.mock.calls.at(-1);
    expect(lastCall?.[0]).toMatchObject({
      documentId: 'pres-4',
      documentName: 'Sans titre',
      initialContent: undefined,
      folderId: undefined,
      className: 'h-full',
    });

    fireEvent.click(screen.getByRole('button', { name: 'close-pres' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('n affiche rien quand open=false', () => {
    const onOpenChange = vi.fn();
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <NativeEditorDialog
          open={false}
          onOpenChange={onOpenChange}
          editorType="native_doc"
          documentName="Invisible"
        />
      </Wrapper>,
    );

    expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    expect(screen.queryByTestId('document-editor')).not.toBeInTheDocument();
    expect(screen.queryByTestId('spreadsheet-editor')).not.toBeInTheDocument();
    expect(screen.queryByTestId('presentation-editor')).not.toBeInTheDocument();
  });

  it("affiche l'état d'erreur si l'éditeur lazy échoue, permet de fermer puis de réessayer avec succès", async () => {
    const onOpenChange = vi.fn();
    const Wrapper = createWrapper();
    unstableImportState.shouldThrowDocument = true;

    const { rerender } = render(
      <Wrapper>
        <NativeEditorDialog
          open={true}
          onOpenChange={onOpenChange}
          editorType="native_doc"
          documentName="Doc erreur"
        />
      </Wrapper>,
    );

    expect(await screen.findByText("Erreur de chargement de l'éditeur")).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Fermer/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    unstableImportState.shouldThrowDocument = false;

    fireEvent.click(screen.getByRole('button', { name: /Réessayer/i }));

    rerender(
      <Wrapper>
        <NativeEditorDialog
          open={true}
          onOpenChange={onOpenChange}
          editorType="native_doc"
          documentName="Doc erreur"
        />
      </Wrapper>,
    );

    expect(await screen.findByTestId('document-editor')).toBeInTheDocument();
    expect(screen.getByText('Doc erreur')).toBeInTheDocument();
    expect(screen.getByText('solo')).toBeInTheDocument();
  });
});